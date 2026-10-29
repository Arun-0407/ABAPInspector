const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const http       = require('http');
const https      = require('https');
const crypto     = require('crypto');
const fs         = require('fs');
const Anthropic  = require('@anthropic-ai/sdk');
const path       = require('path');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { jsonrepair } = require('jsonrepair');

// ── Load .env file for local dev (no extra package needed) ───────────────────
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const eq = t.indexOf('=');
      if (eq < 1) return;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (k && !(k in process.env)) process.env[k] = v;
    });
    console.log('[ENV] .env loaded');
  }
} catch (e) { console.warn('[ENV] Could not load .env:', e.message); }

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Trust BTP/CF reverse proxy so rate-limiter reads correct client IP ────────
// BTP Cloud Foundry sits behind a GoRouter proxy that sets X-Forwarded-For.
// Without this, express-rate-limit throws ValidationError and crashes analyze.
app.set('trust proxy', 1);

// ── BTP Cloud Foundry environment detection ──────────────────────────────────
let VCAP = {};
try { VCAP = JSON.parse(process.env.VCAP_SERVICES || '{}'); } catch {}
const connCreds = VCAP.connectivity?.[0]?.credentials || null;
const destCreds = VCAP.destination?.[0]?.credentials  || null;
const ON_BTP    = !!(connCreds || destCreds); // running on BTP if either service is bound

// Log bound services at startup for diagnostics
console.log('[BTP] ON_BTP:', ON_BTP, '| SCC bound:', !!connCreds, '| Dest bound:', !!destCreds);
if (destCreds) {
  console.log('[BTP] Destination service URI:', destCreds.uri);
  console.log('[BTP] Destination XSUAA URL:  ', destCreds.url);
}

// ── S/4HANA session store ─────────────────────────────────────────────────────
// Credentials stay server-side. Frontend receives only a random session token.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours (rolling)
const s4Sessions = new Map(); // token → { cfg, expiresAt }

function createSession(cfg) {
  const token = crypto.randomBytes(32).toString('hex');
  s4Sessions.set(token, { cfg, expiresAt: Date.now() + SESSION_TTL_MS });
  for (const [k, v] of s4Sessions) {
    if (Date.now() > v.expiresAt) s4Sessions.delete(k);
  }
  return token;
}

function getSession(token) {
  if (!token || typeof token !== 'string') return null;
  const sess = s4Sessions.get(token);
  if (!sess) return null;
  if (Date.now() > sess.expiresAt) { s4Sessions.delete(token); return null; }
  sess.expiresAt = Date.now() + SESSION_TTL_MS;
  return sess.cfg;
}

function deleteSession(token) { s4Sessions.delete(token); }

// ── Input validation helpers ──────────────────────────────────────────────────
const ALLOWED_OBJECT_TYPES = new Set(['PROG', 'FUGR', 'FUNC', 'SSFO', 'CLAS', 'ENHO', 'TABD', 'DTEL', 'MSAG', 'INTF']);

function validateObjectType(t) {
  const upper = (t || '').toUpperCase();
  return ALLOWED_OBJECT_TYPES.has(upper) ? upper : 'PROG';
}

function isValidADTPath(p) {
  if (typeof p !== 'string') return false;
  const clean = p.split('?')[0];
  return clean.startsWith('/sap/bc/adt/') && !clean.includes('..') && !clean.includes('\0') && clean.length < 500;
}

function sanitizeSearchQuery(q) {
  return (q || 'Z*').replace(/[^A-Za-z0-9_*/\-\.]/g, '').slice(0, 100) || 'Z*';
}

function safeError(err) {
  const msg = (err?.message || String(err)).slice(0, 400);
  return msg
    .replace(/Basic\s+[A-Za-z0-9+/=]+/g, 'Basic [redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [redacted]')
    .replace(/clientsecret[^,}"']*/gi, 'clientsecret [redacted]')
    .replace(/password[^,}"']*/gi, 'password [redacted]');
}

// SCC OAuth token cache (tokens live ~12h — refresh 60s before expiry)
let _sccToken = null, _sccExpiry = 0;

async function getSCCToken() {
  if (_sccToken && Date.now() < _sccExpiry) return _sccToken;
  const tokenUrl = connCreds.token_service_url.replace(/\/+$/, '');
  const url = tokenUrl.endsWith('/oauth/token') ? tokenUrl : `${tokenUrl}/oauth/token`;
  const creds = Buffer.from(`${connCreds.clientid}:${connCreds.clientsecret}`).toString('base64');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${creds}` },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) throw new Error(`SCC token failed (${resp.status})`);
  const data = await resp.json();
  _sccToken  = data.access_token;
  _sccExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  return _sccToken;
}

// Destination service token cache
let _destToken = null, _destExpiry = 0;

async function getDestToken() {
  if (_destToken && Date.now() < _destExpiry) return _destToken;
  if (!destCreds) throw new Error('Destination service not bound — add "destination" service to manifest.yml');

  // destCreds.url  = XSUAA base URL  (e.g. https://<subaccount>.authentication.eu10.hana.ondemand.com)
  // destCreds.uri  = Destination API (e.g. https://destination-configuration.cfapps.eu10.hana.ondemand.com)
  const xsuaaBase = (destCreds.url || '').replace(/\/+$/, '');
  const oauthUrl  = `${xsuaaBase}/oauth/token`;

  console.log('[Dest] Fetching token from:', oauthUrl);
  const creds = Buffer.from(`${destCreds.clientid}:${destCreds.clientsecret}`).toString('base64');
  const resp = await fetch(oauthUrl, {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${creds}` },
    body   : 'grant_type=client_credentials',
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Destination token fetch failed (${resp.status}): ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!data.access_token) throw new Error('Destination token response missing access_token');
  _destToken  = data.access_token;
  _destExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
  console.log('[Dest] Token obtained, expires in', data.expires_in, 's');
  return _destToken;
}

// Fetch a named destination from the BTP Destination service and return a resolved s4 config
async function resolveDestination(name) {
  const token = await getDestToken();

  // destCreds.uri is the Destination service base URL from VCAP
  // e.g. https://destination-configuration.cfapps.eu10.hana.ondemand.com
  const destSvcUrl = (destCreds.uri || '').replace(/\/+$/, '');
  const apiUrl     = `${destSvcUrl}/destination-configuration/v1/destinations/${encodeURIComponent(name)}`;

  console.log('[Dest] Resolving destination:', name, '→', apiUrl);

  const resp = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const respText = await resp.text();
  console.log('[Dest] Destination API response status:', resp.status);
  console.log('[Dest] Destination API response body:  ', respText.slice(0, 600));

  if (resp.status === 404) throw new Error(`Destination '${name}' not found in BTP Cockpit → Connectivity → Destinations. Check the destination name spelling.`);
  if (resp.status === 401 || resp.status === 403) throw new Error(`Destination service auth error (${resp.status}) — check the destination service binding in manifest.yml`);
  if (!resp.ok) throw new Error(`Destination service returned HTTP ${resp.status}: ${respText.slice(0, 200)}`);

  let data;
  try { data = JSON.parse(respText); } catch { throw new Error('Destination service returned invalid JSON'); }

  // BTP Destination API v1 response structure:
  // { destinationConfiguration: { URL, Authentication, User, Password, ProxyType, ... }, authTokens: [...] }
  const dc = data.destinationConfiguration || data;

  console.log('[Dest] destinationConfiguration keys:', Object.keys(dc).join(', '));

  const rawUrl    = (dc.URL || '').replace(/\/+$/, '');
  const proxyType = (dc.ProxyType || 'Internet').toLowerCase();
  const authType  = (dc.Authentication || '').toLowerCase();

  if (!rawUrl) throw new Error(`Destination '${name}' has no URL configured — check BTP Cockpit`);

  let virtualHost = null;
  let host        = null;

  if (proxyType === 'onpremise') {
    // URL is the SCC virtual host  e.g. http://s4hana:44300  or  s4hana:44300
    try {
      const u = new URL(rawUrl.includes('://') ? rawUrl : `http://${rawUrl}`);
      virtualHost = u.port ? `${u.hostname}:${u.port}` : u.hostname;
    } catch {
      virtualHost = rawUrl;
    }
    console.log('[Dest] OnPremise proxy → virtualHost:', virtualHost);
  } else {
    // Internet-type destination — direct HTTPS call
    host = rawUrl;
    console.log('[Dest] Internet proxy → host:', host);
  }

  // Extract SAP client from destination additional properties if set
  const sapClient = dc['sap-client'] || dc['SAP-Client'] || dc['sapClient'] || null;

  // For BasicAuthentication, credentials come from dc.User + dc.Password
  // For authTokens flow (OAuth/SAMLAssertion), we'd need dc from authTokens — not supported here
  let user = dc.User     || '';
  let pass = dc.Password || '';

  // authTokens array from BTP contains pre-fetched bearer tokens for non-Basic auth types
  if (data.authTokens && data.authTokens.length > 0 && !pass) {
    const at = data.authTokens[0];
    if (at.type && at.value) {
      console.log('[Dest] Using authToken of type:', at.type);
      // Store as bearer token to use directly
      pass = at.value;
      user = '__token__'; // sentinel value to indicate bearer auth
    }
  }

  return {
    host,
    virtualHost,
    user,
    pass,
    proxyType,
    sapClient,        // SAP client from destination properties
    destinationName     : name,
    destinationAuthType : dc.Authentication || '',
    useAuthToken        : user === '__token__',
  };
}

// Low-level HTTP request via SCC proxy — returns a fetch-compatible Response-like object
// The SCC proxy requires:
//   1. Proxy-Authorization: Bearer <connectivity-service-token>   (authenticates this BTP app to SCC)
//   2. SAP-Connectivity-Authentication: Bearer <token>            (same token, different header)
//   3. Host: <virtual-host>                                        (tells SCC which system to reach)
//   4. Authorization: Basic <s4-credentials>                      (S/4HANA user auth)
function proxyRequest(cfg, reqPath, accept) {
  return new Promise((resolve, reject) => {
    if (!connCreds) return reject(new Error('Cloud Connector service (connectivity) is not bound — cannot route via SCC'));

    getSCCToken().then(sccToken => {
      const proxyHost   = connCreds.onpremise_proxy_host;
      const proxyPort   = parseInt(connCreds.onpremise_proxy_http_port || connCreds.onpremise_proxy_port || '20003', 10);
      const virtualHost = cfg.virtualHost; // e.g. "s4hana:44300"

      // Build Authorization header — either Basic (user/pass) or Bearer (authToken from dest)
      const authHeader = cfg.useAuthToken
        ? `Bearer ${cfg.pass}`
        : `Basic ${Buffer.from(`${cfg.user}:${cfg.pass}`).toString('base64')}`;

      const headers = {
        'Host'                               : virtualHost,
        'Authorization'                      : authHeader,
        'Proxy-Authorization'                : `Bearer ${sccToken}`,  // ← required by SCC
        'SAP-Connectivity-Authentication'    : `Bearer ${sccToken}`,  // ← also required
        'Accept'                             : accept,
      };

      // Only add Location_ID header if non-empty (empty string causes 407 on some SCC versions)
      if (cfg.sccLocationId && cfg.sccLocationId.trim()) {
        headers['SAP-Connectivity-SCC-Location_ID'] = cfg.sccLocationId.trim();
      }

      console.log(`[SCC] Proxy ${proxyHost}:${proxyPort} → Host:${virtualHost} Path:${reqPath.slice(0, 80)}`);

      const options = {
        hostname : proxyHost,
        port     : proxyPort,
        path     : reqPath,
        method   : 'GET',
        headers,
      };

      const req = http.request(options, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          console.log(`[SCC] Response: ${res.statusCode}, body length: ${body.length}`);
          if (res.statusCode === 407) {
            console.error('[SCC] 407 Proxy Auth Required — SCC may not be connected to this BTP subaccount, or the connectivity token is invalid');
          }
          resolve({
            ok     : res.statusCode >= 200 && res.statusCode < 300,
            status : res.statusCode,
            text   : () => Promise.resolve(body),
            json   : () => Promise.resolve(JSON.parse(body)),
            headers: { get: h => res.headers[h.toLowerCase()] || null },
          });
        });
      });
      req.on('error', err => {
        console.error('[SCC] Request error:', err.message);
        reject(err);
      });
      req.end();
    }).catch(err => {
      console.error('[SCC] Token fetch error:', err.message);
      reject(err);
    });
  });
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      connectSrc:  ["'self'"],
      imgSrc:      ["'self'", 'data:'],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Static files served BEFORE any CORS/API middleware — same-origin, no CORS needed
app.use(express.static(path.join(__dirname, 'dist')));

app.use(express.json({ limit: '15mb' }));

// CORS on /api only — blocks external sites from calling our API.
// Not needed in production (frontend + backend are same origin on CF),
// but keeps Vite dev server (port 5173) working locally.
if (process.env.NODE_ENV !== 'production') {
  const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'];
  app.use('/api', cors({
    origin(origin, cb) {
      if (!origin || DEV_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('CORS: origin not allowed'));
    },
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  }));
}

// Rate limiters — protect AI endpoints from abuse
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1-minute window
  max: 10,                     // 10 analyze requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests. Please wait a minute and try again.' },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,                     // 30 chat messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat requests. Please slow down.' },
});

const connectLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,    // 5-minute window
  max: 20,                     // 20 connect attempts per 5 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many connection attempts. Please wait 5 minutes.' },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    // Only accept plain text and common code file extensions
    const ok = /\.(txt|abap|prog|incl|fugr|clas)$/i.test(file.originalname)
      || file.mimetype === 'text/plain'
      || file.mimetype === 'application/octet-stream';
    cb(ok ? null : new Error('Only .abap / .txt files are accepted'), ok);
  },
});

// ─── SAP AI Core helpers ────────────────────────────────────────────────────

function parseKeys(keys) {
  // Format 1: flat { clientid, clientsecret, url, serviceurls.AI_API_URL }
  // Format 2: UAA-wrapped { uaa: { clientid, clientsecret, url }, url: <AI_API_URL> }
  const trim = (s) => (s || '').replace(/\/+$/, ''); // strip trailing slashes
  if (keys.uaa) {
    return {
      clientid: keys.uaa.clientid,
      clientsecret: keys.uaa.clientsecret,
      tokenUrl: trim(keys.uaa.url),
      apiUrl: trim(keys.url || keys.serviceurls?.AI_API_URL),
      resourceGroup: keys.resource_group || 'default'
    };
  }
  return {
    clientid: keys.clientid,
    clientsecret: keys.clientsecret,
    tokenUrl: trim(keys.url),
    apiUrl: trim(keys.serviceurls?.AI_API_URL || keys.ai_api_url || keys.AI_API_URL),
    resourceGroup: keys.resource_group || 'default'
  };
}

async function getToken(keys) {
  const { clientid, clientsecret, tokenUrl } = parseKeys(keys);
  if (!clientid || !clientsecret || !tokenUrl) throw new Error('Invalid SAP AI Core keys — missing clientid, clientsecret, or url');

  const creds = Buffer.from(`${clientid}:${clientsecret}`).toString('base64');
  const resp = await fetch(`${tokenUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${creds}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Token request failed (${resp.status}): ${txt.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!data.access_token) throw new Error('No access_token in response');
  return data.access_token;
}

function modelCategory(name = '') {
  const n = name.toLowerCase();
  if (n.includes('gpt') || n.includes('o1') || n.includes('o3')) return { label: 'OpenAI', color: '#10a37f' };
  if (n.includes('claude')) return { label: 'Anthropic', color: '#d97706' };
  if (n.includes('llama')) return { label: 'Meta', color: '#1877f2' };
  if (n.includes('gemini') || n.includes('palm')) return { label: 'Google', color: '#4285f4' };
  if (n.includes('mistral') || n.includes('mixtral')) return { label: 'Mistral', color: '#7c3aed' };
  if (n.includes('titan')) return { label: 'Amazon', color: '#ff9900' };
  if (n.includes('command') || n.includes('cohere')) return { label: 'Cohere', color: '#39d0d8' };
  return { label: 'Other', color: '#6b7280' };
}

async function fetchDeployments(keys, token) {
  const { apiUrl, resourceGroup } = parseKeys(keys);
  if (!apiUrl) throw new Error('Could not determine AI_API_URL from service key');

  // Guide endpoint: GET {AI_API_URL}/v2/lm/deployments (no query params)
  const url = `${apiUrl}/v2/lm/deployments`;
  console.log(`[AI Core] GET ${url}  resource-group=${resourceGroup}`);

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'AI-Resource-Group': resourceGroup }
  });

  const txt = await resp.text();
  console.log(`[AI Core] deployments response ${resp.status}:`, txt.slice(0, 400));

  if (!resp.ok) {
    throw new Error(`Deployments request failed (${resp.status}): ${txt.slice(0, 300)}`);
  }

  const data = JSON.parse(txt);
  // Filter RUNNING deployments client-side
  const resources = (data.resources || []).filter(d => d.status === 'RUNNING' || !d.status);
  return resources.map(d => {
    const modelName = d.details?.resources?.backend_details?.model?.name
      || d.configurationName
      || d.id;
    const version = d.details?.resources?.backend_details?.model?.version || '';
    const cat = modelCategory(modelName);
    // Strip vendor prefix like "anthropic--", "openai--", "meta--" from display
    const cleanName = modelName.replace(/^[a-zA-Z]+-{1,2}/i, '');
    // Only append version if it's non-trivial (not just "1" or "2")
    const showVersion = version && !/^\d+$/.test(version.trim());
    return {
      id: d.id,
      modelName,
      version,
      configurationName: d.configurationName || d.id,
      status: d.status,
      category: cat.label,
      categoryColor: cat.color,
      displayName: showVersion ? `${cleanName} (${version})` : cleanName,
      createdAt: d.createdAt
    };
  });
}

async function inferViaAICore(code, deploymentId, keys, token) {
  const { apiUrl, resourceGroup } = parseKeys(keys);
  const base = `${apiUrl}/v2/inference/deployments/${deploymentId}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'AI-Resource-Group': resourceGroup,
    'Content-Type': 'application/json'
  };

  // Detect model type from deployment to choose correct endpoint + body format.
  // Get deployments again OR infer from deployment ID (not reliable).
  // We pass modelName from the frontend via aicoreKeys metadata — fall back to heuristic.
  const modelName = (keys._selectedModelName || '').toLowerCase();
  const isAnthropic = modelName.includes('claude') || modelName.includes('anthropic');

  let resp, data, content;

  if (isAnthropic) {
    // Claude via AI Core: use /invoke with Anthropic body format
    resp = await fetch(`${base}/invoke`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 6000,
        messages: [{ role: 'user', content: buildPrompt(code) }]
      })
    });
    data = await resp.json();
    if (!resp.ok) throw new Error(`AI Core Claude invoke failed (${resp.status}): ${JSON.stringify(data).slice(0, 300)}`);
    content = data.content?.[0]?.text;
  } else {
    // GPT / OpenAI-compatible: use /chat/completions
    resp = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(code) }
        ],
        max_tokens: 6000,
        temperature: 0.1
      })
    });
    data = await resp.json();
    if (!resp.ok) throw new Error(`AI Core GPT inference failed (${resp.status}): ${JSON.stringify(data).slice(0, 300)}`);
    content = data.choices?.[0]?.message?.content;
  }

  if (!content) throw new Error('Empty response from AI Core deployment');
  return content;
}

// ─── Anthropic helper ───────────────────────────────────────────────────────

async function inferViaAnthropic(code, apiKey) {
  const client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(code) }]
  });
  return response.content[0].text;
}

// ─── Chat helpers ────────────────────────────────────────────────────────────

async function chatViaAICore(messages, systemPrompt, deploymentId, keys, token) {
  const { apiUrl, resourceGroup } = parseKeys(keys);
  const base = `${apiUrl}/v2/inference/deployments/${deploymentId}`;
  const modelName = (keys._selectedModelName || '').toLowerCase();
  const isAnthropic = modelName.includes('claude') || modelName.includes('anthropic');

  async function doRequest(tok) {
    const headers = {
      Authorization: `Bearer ${tok}`,
      'AI-Resource-Group': resourceGroup,
      'Content-Type': 'application/json',
    };
    let resp, data;
    if (isAnthropic) {
      resp = await fetch(`${base}/invoke`, {
        method: 'POST', headers,
        body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 2000, system: systemPrompt, messages }),
      });
    } else {
      resp = await fetch(`${base}/chat/completions`, {
        method: 'POST', headers,
        body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, ...messages], max_tokens: 2000, temperature: 0.7 }),
      });
    }
    data = await resp.json();
    return { resp, data };
  }

  let { resp, data } = await doRequest(token);

  // Token expired — refresh once and retry
  if (resp.status === 401) {
    const newToken = await getToken(keys);
    ({ resp, data } = await doRequest(newToken));
  }

  if (!resp.ok) throw new Error(`AI Core chat error ${resp.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return isAnthropic ? (data.content?.[0]?.text || '') : (data.choices?.[0]?.message?.content || '');
}

async function chatViaAnthropic(messages, systemPrompt, apiKey) {
  const client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    system: systemPrompt,
    messages,
  });
  return resp.content[0].text;
}



const SYSTEM_PROMPT = `You are a senior SAP ABAP architect analyzing Module Pool / Dialogue programs.

Return ONLY a valid JSON object — no text before or after.
Be CONCISE: 1-2 sentence explanations, no verbosity.
Include exact verbatim code only where the schema field asks for it (fullCode).
If a section is absent use [] or null — never omit fields.`;

const buildPrompt = (code) => `Analyze this ABAP program and return JSON:

\`\`\`abap
${code}
\`\`\`

Return this exact JSON structure:

{
  "programInfo": {
    "name": "technical name", "title": "descriptive title", "type": "Module Pool / Dialogue Program",
    "programClass": "M/F/etc", "objective": "2-3 sentences on business purpose",
    "authorIfFound": "", "packageIfFound": "", "logicalSystem": "ECC/S4HANA/R3",
    "topModule": { "exists": true, "code": "exact LOAD-OF-PROGRAM code", "purpose": "1 sentence" }
  },
  "globalDeclarations": {
    "tableStatements": [{ "name": "", "sapDescription": "", "isCustom": false, "usage": "" }],
    "dataDeclarations": [{ "name": "", "type": "", "description": "" }],
    "typeDeclarations": [{ "name": "", "definition": "", "description": "" }],
    "constants": [{ "name": "", "value": "", "description": "" }],
    "internalTables": [{ "name": "", "type": "", "description": "" }],
    "workAreas": [{ "name": "", "type": "", "description": "" }],
    "fieldSymbols": [{ "name": "", "type": "", "description": "" }],
    "controls": [{ "name": "", "type": "TABLEVIEW/TABSTRIP", "screen": "" }]
  },
  "databaseTables": {
    "zTables": [{ "name": "", "sapDescription": "", "tableType": "", "keyFields": [{ "field": "", "type": "", "description": "" }], "dataFields": [{ "field": "", "type": "", "description": "" }], "usedFor": "", "operations": ["SELECT/INSERT/etc"] }],
    "standardTables": [{ "name": "", "sapDescription": "", "module": "MM/SD/FI etc", "usedFor": "", "operations": ["SELECT/etc"] }]
  },
  "screens": [{
    "number": "100", "title": "", "type": "Normal/Subscreen/Modal Dialog/Selection Screen",
    "objective": "1 sentence", "calledBy": "", "guiStatus": "", "guiTitle": "",
    "elements": [{ "name": "", "label": "", "type": "InputField/OutputField/Pushbutton/etc", "description": "" }],
    "buttons": [{ "text": "", "functionCode": "", "type": "Normal/Exit", "description": "" }]
  }],
  "pboModules": [{ "name": "", "screens": [], "fullCode": "exact MODULE...ENDMODULE", "purpose": "1 sentence", "explanation": "1-2 sentences", "setsGUIStatus": "", "setsTitleBar": "", "callsSubroutines": [] }],
  "paiModules": [{ "name": "", "screens": [], "fullCode": "exact MODULE...ENDMODULE", "purpose": "1 sentence", "explanation": "1-2 sentences", "triggerCondition": "", "handledFunctionCodes": [{ "fcode": "", "description": "" }], "callsSubroutines": [] }],
  "guiStatuses": [{ "name": "", "usedOnScreens": [], "description": "1 sentence", "buttons": [{ "text": "", "fCode": "", "fKey": "", "type": "Normal/Exit", "description": "" }] }],
  "functionCodes": [{ "code": "", "type": "Function/Exit/Back/Cancel/Enter", "description": "", "handledInModule": "", "resultingAction": "" }],
  "f4HelpPOV": [{ "field": "", "screen": "", "moduleName": "", "fullCode": "exact MODULE...ENDMODULE", "explanation": "" }],
  "tableControls": [{ "name": "", "screen": "", "relatedInternalTable": "", "explanation": "1-2 sentences" }],
  "validations": [{ "description": "", "screen": "", "field": "", "type": "Mandatory/Format/Range/ExistenceCheck/BusinessRule", "fullCode": "exact validation code", "errorMessage": "", "messageType": "E/W/I/S" }],
  "subroutines": [{ "name": "", "calledFrom": [], "usingParams": [{ "name": "", "type": "", "direction": "USING/CHANGING" }], "fullCode": "exact FORM...ENDFORM", "explanation": "1-2 sentences" }],
  "events": [{ "name": "LOAD-OF-PROGRAM/AT SELECTION-SCREEN/etc", "code": "exact event code", "explanation": "1 sentence" }],
  "overallFlow": "3-5 sentences on end-to-end program flow",
  "keyBusinessLogic": "2-3 sentences on core business rules",
  "errorHandling": "1-2 sentences on error handling approach",
  "performanceNotes": "any slow SELECTs or missing indexes",
  "securityNotes": "AUTHORITY-CHECK usage"
}`;

// ─── API Routes ─────────────────────────────────────────────────────────────

// Chat endpoint
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    let { messages, systemContext, provider = 'anthropic', deploymentId, token, aicoreKeys, anthropicKey } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'No messages provided' });

    const systemPrompt = `You are ABAP Inspector AI — an expert SAP ABAP technical assistant with deep knowledge of Module Pool programming, DYNPRO screens, Dialogue development, SAP Data Dictionary, S/4HANA, and BTP.
Answer questions concisely and helpfully. Use markdown formatting (bold, code blocks, bullet lists) where it aids clarity.${systemContext ? '\n\n' + systemContext : ''}`;

    let reply;

    // Try AI Core first if keys + deployment are available
    const aicoreReady = provider === 'aicore' && aicoreKeys && deploymentId;
    if (aicoreReady) {
      if (!token || !token.trim()) {
        try { token = await getToken(aicoreKeys); } catch {}
      }
      if (token) {
        reply = await chatViaAICore(messages, systemPrompt, deploymentId, aicoreKeys, token);
        return res.json({ reply });
      }
    }

    // Fall back to direct Anthropic (user-provided key or server env var)
    const effectiveKey = anthropicKey || process.env.ANTHROPIC_API_KEY;
    if (!effectiveKey) {
      return res.status(400).json({ error: 'Claude is not configured. Please add ANTHROPIC_API_KEY to the server environment, or connect SAP AI Core in the settings panel.' });
    }
    reply = await chatViaAnthropic(messages, systemPrompt, effectiveKey);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── S/4HANA ADT Integration ────────────────────────────────────────────────

function s4Headers(cfg, accept = 'text/plain') {
  // Support both Basic (user/pass) and Bearer (authToken from BTP Destination service)
  const authHeader = cfg.useAuthToken
    ? `Bearer ${cfg.pass}`
    : `Basic ${Buffer.from(`${cfg.user}:${cfg.pass}`).toString('base64')}`;
  return { Authorization: authHeader, Accept: accept };
}

async function s4Get(reqPath, cfg, accept = 'text/plain') {
  const sep      = reqPath.includes('?') ? '&' : '?';
  const fullPath = `${reqPath}${sep}sap-client=${cfg.client || '100'}`;

  if (cfg.virtualHost) {
    // On-premise: route through Cloud Connector proxy (BTP only)
    return proxyRequest(cfg, fullPath, accept);
  }

  // Direct HTTPS — local dev or internet-reachable S/4HANA
  if (!cfg.host) throw new Error('Neither virtualHost nor host is configured — check your connection settings');

  // Support self-signed SSL certs: set NODE_TLS_REJECT_UNAUTHORIZED=0 in .env
  const fetchOpts = { headers: s4Headers(cfg, accept) };
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    fetchOpts.agent = new https.Agent({ rejectUnauthorized: false });
  }

  try {
    return await fetch(`${cfg.host}${fullPath}`, fetchOpts);
  } catch (err) {
    const msg = err.message || '';
    if (/CERT|SSL|certificate|UNABLE_TO_VERIFY/i.test(msg)) {
      throw new Error(
        `SSL Certificate Error: "${cfg.host}" uses a self-signed or untrusted certificate.\n\n` +
        `Fix: Open the .env file in the project root and uncomment:\n` +
        `  NODE_TLS_REJECT_UNAUTHORIZED=0\n` +
        `Then restart: npm run dev\n\nOriginal: ${msg}`
      );
    }
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg)) {
      throw new Error(
        `Cannot reach S/4HANA at "${cfg.host}".\n` +
        `• Check the URL is correct (https://hostname:44300)\n` +
        `• Make sure port 44300 is open / not blocked by firewall or VPN\n\nOriginal: ${msg}`
      );
    }
    throw err;
  }
}

function parseADTRefs(xml) {
  if (!xml) return [];
  const out = [];

  // ── Strategy 1: single-tag attributes (classic ADT format) ──────────────
  // <adtcore:objectReference adtcore:name="ZProg" adtcore:type="PROG" adtcore:uri="..." />
  const re1 = /<[^>]*adtcore:name="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re1.exec(xml)) !== null) {
    const tag  = m[0];
    const name = m[1];
    const type = (tag.match(/adtcore:type="([^"]+)"/)       || [])[1] || '';
    const uri  = (tag.match(/adtcore:uri="([^"]*)"/)         || [])[1] || '';
    const desc = (tag.match(/adtcore:description="([^"]*)"/) || [])[1] || '';
    const pkg  = (tag.match(/adtcore:packageName="([^"]*)"/) || [])[1] || '';
    if (name && uri) out.push({ name, type, uri, description: desc, package: pkg });
  }
  if (out.length > 0) return out;

  // ── Strategy 2: atom:entry blocks (OpenSearch/NW 7.4+ format) ───────────
  // <atom:entry>
  //   <atom:title>ZProg</atom:title>
  //   <adtcore:objectReference adtcore:uri="/sap/bc/adt/..." adtcore:type="PROG" ... />
  // </atom:entry>
  const entryRe = /<(?:atom:)?entry>([\s\S]*?)<\/(?:atom:)?entry>/gi;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    // name from atom:title or adtcore:name
    const name = (block.match(/adtcore:name="([^"]+)"/)            ||
                  block.match(/<(?:atom:)?title[^>]*>([^<]+)</)    || [])[1] || '';
    const type = (block.match(/adtcore:type="([^"]+)"/)            || [])[1] || '';
    const uri  = (block.match(/adtcore:uri="([^"]+)"/)             || [])[1] || '';
    const desc = (block.match(/adtcore:description="([^"]*)"/)     ||
                  block.match(/<(?:atom:)?summary[^>]*>([^<]+)</)  || [])[1] || '';
    const pkg  = (block.match(/adtcore:packageName="([^"]*)"/)     || [])[1] || '';
    if (name && uri) out.push({ name, type, uri, description: desc, package: pkg });
    else if (name && type) out.push({ name, type, uri: '', description: desc, package: pkg });
  }
  if (out.length > 0) return out;

  // ── Strategy 3: link href with name in title (some older formats) ────────
  const linkRe = /href="([^"]*\/sap\/bc\/adt\/[^"]+)"[^>]*>[^<]*<[^>]*title="([^"]+)"/gi;
  while ((m = linkRe.exec(xml)) !== null) {
    const uri  = m[1];
    const name = m[2];
    const type = (uri.match(/\/programs\/([^/?]+)/) ? 'PROG' :
                  uri.match(/\/functions\/([^/?]+)/) ? 'FUNC' : '');
    out.push({ name, type, uri, description: '', package: '' });
  }

  console.log(`[parseADTRefs] xml length=${xml.length}, found=${out.length} objects. First 300 chars: ${xml.slice(0,300)}`);
  return out;
}

function extractDeps(source) {
  const upper = source.toUpperCase();
  const includes = [], fms = [], performs = [], smartforms = [];

  for (const m of upper.matchAll(/^\s*INCLUDE\s+(\w+)\s*\./gm))
    includes.push(m[1]);

  // Only custom Z/Y function modules
  for (const m of upper.matchAll(/CALL\s+FUNCTION\s+'([YZ][A-Z0-9_]+)'/g))
    fms.push(m[1]);

  // External PERFORM ... IN PROGRAM
  for (const m of upper.matchAll(/PERFORM\s+\w+\s+IN\s+PROGRAM\s+([YZ][A-Z0-9_]+)/g))
    performs.push(m[1]);

  // Smartform names from FORM = '...' (SSF flow)
  for (const m of upper.matchAll(/FORM\s*=\s*'([YZ][A-Z0-9_]+)'/g))
    smartforms.push(m[1]);

  return {
    includes:   [...new Set(includes)],
    fms:        [...new Set(fms)],
    performs:   [...new Set(performs)],
    smartforms: [...new Set(smartforms)],
  };
}

async function s4FetchSource(uri, cfg) {
  const resp = await s4Get(`${uri}/source/main`, cfg);
  if (!resp.ok) return null;
  return await resp.text();
}

// GET /api/s4/env — tell the frontend whether we're running on BTP (affects which fields to show)
app.get('/api/s4/env', (_req, res) => {
  res.json({ onBTP: ON_BTP, hasDestService: !!destCreds, hasSCC: !!connCreds });
});

// GET /api/s4/dest-debug?name=<destination-name>
// Diagnostic endpoint — resolves a destination and returns its config (no password) for troubleshooting
app.get('/api/s4/dest-debug', async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Provide ?name=<destination-name>' });
  if (!destCreds) return res.status(400).json({ error: 'Destination service not bound' });
  try {
    const token = await getDestToken();
    const destSvcUrl = (destCreds.uri || '').replace(/\/+$/, '');
    const apiUrl     = `${destSvcUrl}/destination-configuration/v1/destinations/${encodeURIComponent(name)}`;
    const resp       = await fetch(apiUrl, { headers: { Authorization: `Bearer ${token}` } });
    const text       = await resp.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    // Redact password
    if (parsed.destinationConfiguration?.Password) parsed.destinationConfiguration.Password = '[redacted]';
    res.json({ status: resp.status, destination: parsed, destServiceUrl: apiUrl });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// POST /api/s4/connect — verify ADT is reachable + credentials valid
app.post('/api/s4/connect', connectLimiter, async (req, res) => {
  try {
    const { host, virtualHost, client, user, pass, sccLocationId, useDestination, destinationName } = req.body;

    let cfg;

    if (useDestination && destinationName) {
      // ── BTP Destination mode ─────────────────────────────────────────────
      if (!destCreds) return res.status(400).json({ error: 'Destination service is not bound to this app. Add "destination" to services in manifest.yml and redeploy.' });

      console.log('[Connect] Destination mode → resolving:', destinationName);
      const resolved = await resolveDestination(destinationName);

      cfg = {
        ...resolved,
        // Prefer client from the destination's sap-client property, then from form, then default 100
        client       : (resolved.sapClient || client || '100').replace(/\D/g, '').slice(0, 3),
        sccLocationId: (sccLocationId || '').slice(0, 100),
      };
      console.log('[Connect] Resolved cfg → proxyType:', cfg.proxyType, 'virtualHost:', cfg.virtualHost, 'host:', cfg.host, 'client:', cfg.client);

    } else {
      // ── Manual mode ──────────────────────────────────────────────────────
      // On BTP: allow either virtualHost (SCC) or direct host (internet-reachable S/4)
      if (!host && !virtualHost) return res.status(400).json({ error: 'Please enter either a Host URL (direct HTTPS) or a Virtual Host (Cloud Connector).' });
      if (!user || !pass)        return res.status(400).json({ error: 'Username and password are required.' });

      if (host && !/^https?:\/\//i.test(host)) {
        return res.status(400).json({ error: 'Host URL must start with https://' });
      }

      cfg = {
        host         : (virtualHost ? null : (host || '').replace(/\/+$/, '').slice(0, 300)),
        virtualHost  : (virtualHost || null)?.slice(0, 200),
        client       : (client || '100').replace(/\D/g, '').slice(0, 3),
        user         : (user || '').slice(0, 100),
        pass,
        sccLocationId: (sccLocationId || '').slice(0, 100),
        useAuthToken : false,
      };
    }

    // ── Test ADT discovery + extract search URL template ──────────────────
    console.log('[Connect] Testing ADT discovery...');
    const resp = await s4Get('/sap/bc/adt/discovery', cfg, 'application/atomsvc+xml');
    console.log('[Connect] ADT discovery response:', resp.status);

    if (resp.status === 407) return res.status(502).json({
      error: 'HTTP 407 — Cloud Connector proxy authentication failed.\n\n' +
             '• Make sure SAP Cloud Connector is installed and connected to this BTP subaccount\n' +
             '• In SCC admin UI: check the subaccount connection shows "Connected"\n' +
             '• Verify the Virtual Host mapping exists for your S/4HANA system\n' +
             '• Ensure the resource /sap/bc/adt/ is added to the system mapping'
    });
    if (resp.status === 401) return res.status(401).json({ error: 'HTTP 401 — Invalid S/4HANA credentials. Check username and password in the destination or connection form.' });
    if (resp.status === 403) return res.status(403).json({ error: 'HTTP 403 — Forbidden. User lacks S_DEVELOP (ACTVT=03) authorization in S/4HANA.' });
    if (resp.status === 404) return res.status(404).json({ error: 'HTTP 404 — ADT service not found. Ask Basis to activate /sap/bc/adt in SICF transaction.' });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `S/4HANA returned HTTP ${resp.status}: ${body.slice(0, 300)}` });
    }

    // Parse discovery XML to extract search endpoint + template params
    const discoveryXml = await resp.text().catch(() => '');
    const searchMeta   = extractSearchMeta(discoveryXml);
    console.log('[Connect] Search meta from discovery:', JSON.stringify(searchMeta));

    // Store credentials server-side, return session token only
    const sessionToken = createSession(cfg);

    // Store the discovered search meta for this session
    if (searchMeta) searchMetaCache.set(sessionToken, searchMeta);

    // Build safe display info (no password)
    const displayInfo = {
      host               : cfg.host || null,
      virtualHost        : cfg.virtualHost || null,
      client             : cfg.client,
      user               : cfg.useAuthToken ? '(token auth)' : cfg.user,
      destinationName    : cfg.destinationName || null,
      destinationAuthType: cfg.destinationAuthType || null,
      proxyType          : cfg.proxyType || null,
    };

    res.json({ ok: true, sessionToken, displayInfo });
  } catch (err) {
    console.error('[Connect] Error:', err.message);
    res.status(500).json({ error: safeError(err) });
  }
});

// DELETE /api/s4/session — explicitly invalidate a session on disconnect
app.delete('/api/s4/session', (req, res) => {
  const token = req.body?.sessionToken || req.headers['x-s4-session'];
  if (token) deleteSession(token);
  res.json({ ok: true });
});

// POST /api/s4/search — search repository objects by type + query pattern
// ── Dynamic ADT Search ───────────────────────────────────────────────────────
const searchSessionCache = new Map(); // sessionToken → variantIdx (-1=meta, 0-N=static)
const searchMetaCache    = new Map(); // sessionToken → { url, paramNames } from discovery

function encVal(v) {
  return encodeURIComponent(String(v)).replace(/%3A/gi, ':').replace(/%2A/gi, '*');
}
function buildQS(obj) {
  return Object.entries(obj).map(([k, v]) => `${encVal(k)}=${encVal(v)}`).join('&');
}

function extractSearchMeta(xml) {
  if (!xml || xml.length < 100) return null;
  try {
    // The discovery XML may HTML-encode the URI template, e.g.:
    //   href="/sap/bc/adt/repository/informationsystem/search{?operation,query,...,&amp;objectType*}"
    // We need to:
    //   1. Find the href/template containing 'informationsystem/search'
    //   2. HTML-decode it (&amp; → &, etc.)
    //   3. Strip URI-template syntax {} 
    //   4. Extract clean parameter names

    const pats = [
      /href="([^"]*\/informationsystem\/search[^"]*)"/gi,
      /template="([^"]*\/informationsystem\/search[^"]*)"/gi,
      /uri="([^"]*\/informationsystem\/search[^"]*)"/gi,
    ];

    for (const pat of pats) {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(xml)) !== null) {
        // HTML-decode the matched value
        const decoded = m[1]
          .replace(/&amp;/gi, '&')
          .replace(/&lt;/gi, '<')
          .replace(/&gt;/gi, '>')
          .replace(/&quot;/gi, '"');

        // Base path = everything before { or ?
        const basePath = decoded.replace(/[{?].*$/, '').replace(/\/$/, '');
        if (!basePath.includes('/informationsystem/search')) continue;

        // Extract params from URI template: {?param1,param2,...} or ?param1&param2
        // First try URI template style
        const tplMatch = decoded.match(/\{[?+]?([^}]+)\}/);
        let paramStr = tplMatch ? tplMatch[1] : '';

        // Also grab params from query string part after ?
        const qsPart = decoded.split('?')[1] || '';
        if (qsPart) paramStr = paramStr ? paramStr + ',' + qsPart : qsPart;

        // Split by comma or & and clean up
        const names = paramStr
          .split(/[,&]/)
          .map(p => p.trim().replace(/\*/g, '').replace(/[{}]/g, '').replace(/^amp;/, ''))
          .filter(p => p && !p.startsWith('sap-') && /^[a-zA-Z]/.test(p));

        const unique = [...new Set(names)];
        if (unique.length > 0) {
          console.log(`[Discovery] search url=${basePath} params=${unique.join(',')}`);
          return { url: basePath, paramNames: unique };
        }
      }
    }
  } catch (e) { console.error('[Discovery] err:', e.message); }
  return null;
}

// operation values to try — empty string means "omit the operation param entirely"
const OPERATION_VALUES = ['', 'quickSearch', 'quick', 'start', 'search'];

function buildFromMeta(meta, q, t, m, operationOverride) {
  const p = {};
  for (const n of meta.paramNames) {
    const l = n.toLowerCase();
    if (l === 'operation') {
      // Use override value if provided, else default to 'quick'
      const val = operationOverride !== undefined ? operationOverride : 'quick';
      if (val !== '') p[n] = val; // omit if empty string
    }
    else if (l === 'ris_request_type')              p[n] = 'OBJECT_REFERENCES';
    else if (l === 'usesearchprovider')             { /* SKIP — restricts to TREX/Enterprise Search */ }
    else if (l === 'nodescription')                 { /* omit — optional */ }
    else if (l.includes('objecttype') && t)         p[n] = t;
    else if (l.includes(':name') || l === 'name')   p[n] = q;
    else if (l === 'searchstring' || l === 'query') p[n] = q;
    else if (l === 'maxresults')                    p[n] = m;
    else if (l === 'type' && t)                     p[n] = t;
    // skip all other optional params
  }
  // Ensure we always have a search term
  const hasSearchTerm = Object.keys(p).some(k => {
    const l = k.toLowerCase().split(':').pop();
    return ['name','searchstring','query'].includes(l);
  });
  if (!hasSearchTerm) p.query = q;
  if (!p.maxResults) p.maxResults = m;
  return p;
}

const SEARCH_VARIANTS = [
  // V0 — No operation param + objectType (most likely for this S/4HANA)
  (q,t,m) => ({query:q,objectType:t,maxResults:m}),
  // V1 — No operation param, no type filter
  (q,t,m) => ({query:q,maxResults:m}),
  // V2 — S/4HANA 1909+ / BTP ABAP
  (q,t,m) => ({objectType:t,searchString:q,maxResults:m}),
  // V3 — operation=quickSearch with type
  (q,t,m) => ({operation:'quickSearch',query:q,objectType:t,maxResults:m}),
  // V4 — operation=quickSearch no type
  (q,t,m) => ({operation:'quickSearch',query:q,maxResults:m}),
  // V5 — operation=start with type
  (q,t,m) => ({operation:'start',query:q,objectType:t,maxResults:m}),
  // V6 — operation=start no type
  (q,t,m) => ({operation:'start',query:q,maxResults:m}),
  // V7 — NW 7.4x name+type
  (q,t,m) => ({name:q,type:t,maxResults:m}),
  // V8 — adtcore namespace
  (q,t,m) => ({'adtcore:name':q,'adtcore:objectType':t,maxResults:m}),
  // V9 — adtcore name only
  (q,t,m) => ({'adtcore:name':q,maxResults:m}),
  // V10 — RIS style
  (q,t,m) => ({'ris_request_type':'OBJECT_REFERENCES','adtcore:objectType':t,'adtcore:name':q,maxResults:m}),
  // V11 — plain name
  (q,t,m) => ({name:q,maxResults:m}),
];
const SEARCH_ACCEPT = 'application/atom+xml, application/xml';
const DEFAULT_SEARCH_URL = '/sap/bc/adt/repository/informationsystem/search';
const makeErrResp = (s, b) => ({ ok:false, status:s, text:()=>Promise.resolve(b), json:()=>Promise.resolve({}), headers:{get:()=>null} });

async function adtSearch(cfg, sessionToken, query, objectType, maxResults = '100') {
  const meta = searchMetaCache.get(sessionToken);

  // 1. Use cached winning variant
  const cached = searchSessionCache.get(sessionToken);
  if (cached !== undefined) {
    const url    = meta?.url || DEFAULT_SEARCH_URL;
    const params = cached === -1
      ? buildFromMeta(meta, query, objectType, maxResults, meta?.winningOp)
      : SEARCH_VARIANTS[cached](query, objectType, maxResults);
    const resp = await s4Get(`${url}?${buildQS(params)}`, cfg, SEARCH_ACCEPT);
    if (resp.ok) {
      const xml  = await resp.text();
      const hits = parseADTRefs(xml);
      if (hits.length > 0 || xml.length < 200) { // accept empty only if truly empty doc
        return { ok: true, status: 200, text: () => Promise.resolve(xml), json: () => Promise.resolve({}), headers: { get: () => null } };
      }
    }
    searchSessionCache.delete(sessionToken); // stale — re-probe
  }

  // 2. Discovery-derived params — try all operation values until results come back non-empty
  if (meta?.paramNames?.length) {
    const hasOperation = meta.paramNames.some(n => n.toLowerCase() === 'operation');
    const opValues = hasOperation ? OPERATION_VALUES : [undefined];

    for (let oi = 0; oi < opValues.length; oi++) {
      const params = buildFromMeta(meta, query, objectType, maxResults, opValues[oi]);
      const qs     = buildQS(params);
      console.log(`[Search] Discovery op="${opValues[oi]}" → ${meta.url}?${qs.slice(0,160)}`);
      const resp   = await s4Get(`${meta.url}?${qs}`, cfg, SEARCH_ACCEPT);
      if (!resp.ok) {
        const b = await resp.text().catch(()=>'');
        console.log(`[Search] Discovery op="${opValues[oi]}" failed ${resp.status}: ${b.slice(0,120)}`);
        // Continue on 400/500 "No service found" — these are wrong-param errors
        const isParamErr = resp.status === 400 || (resp.status === 500 && b.includes('No service found'));
        if (!isParamErr) break;
        continue;
      }
      // Got HTTP 200 — check if results are non-empty
      const xml  = await resp.text();
      const hits = parseADTRefs(xml);
      console.log(`[Search] Discovery op="${opValues[oi]}" → ${hits.length} results`);
      if (hits.length > 0) {
        searchSessionCache.set(sessionToken, -1);
        searchMetaCache.set(sessionToken, { ...meta, winningOp: opValues[oi] });
        return { ok:true, status:200, text:()=>Promise.resolve(xml), json:()=>Promise.resolve({}), headers:{get:()=>null} };
      }
      // HTTP 200 but empty — try next operation value
    }
    console.log('[Search] Discovery exhausted all operation values — falling back to static variants');
  }

  // 3. Static fallback variants — check for both HTTP 200 AND non-empty results
  let lastStatus = 0, lastBody = '', lastEmptyXml = '';
  for (let i = 0; i < SEARCH_VARIANTS.length; i++) {
    const qs   = buildQS(SEARCH_VARIANTS[i](query, objectType, maxResults));
    console.log(`[Search] V${i} → ${qs.slice(0,160)}`);
    const resp = await s4Get(`${DEFAULT_SEARCH_URL}?${qs}`, cfg, SEARCH_ACCEPT);
    lastStatus = resp.status;
    if (resp.ok) {
      const xml  = await resp.text();
      const hits = parseADTRefs(xml);
      console.log(`[Search] V${i} HTTP 200 → ${hits.length} results`);
      if (hits.length > 0) {
        searchSessionCache.set(sessionToken, i);
        return { ok:true, status:200, text:()=>Promise.resolve(xml), json:()=>Promise.resolve({}), headers:{get:()=>null} };
      }
      lastEmptyXml = xml; // keep the empty 200 as fallback
      continue; // try next variant — maybe another gives results
    }
    lastBody = await resp.text().catch(()=>'');
    console.log(`[Search] V${i} failed ${lastStatus}: ${lastBody.slice(0,100)}`);
    // Continue on wrong-param errors (400) or "No service found" (500)
    const isParamErr = lastStatus === 400 || (lastStatus === 500 && lastBody.includes('No service found'));
    if (!isParamErr) break;
  }
  // All variants either failed or returned empty — return last empty 200 or last error
  if (lastEmptyXml) return { ok:true, status:200, text:()=>Promise.resolve(lastEmptyXml), json:()=>Promise.resolve({}), headers:{get:()=>null} };
  return makeErrResp(lastStatus, lastBody);
}

app.post('/api/s4/search', async (req, res) => {
  try {
    const { sessionToken, query, objectType } = req.body;
    const cfg = getSession(sessionToken);
    if (!cfg) return res.status(401).json({ error: 'Session expired — please reconnect to S/4HANA.', code: 'SESSION_EXPIRED' });

    const safeQuery = sanitizeSearchQuery(query);
    const safeType  = validateObjectType(objectType);

    const resp = await adtSearch(cfg, sessionToken, safeQuery, safeType);
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `Search failed (${resp.status}): ${body.slice(0, 300)}` });
    }
    const xml  = await resp.text();
    let objects = parseADTRefs(xml);

    // If no results with objectType filter, retry WITHOUT objectType — may be cross-type result
    if (objects.length === 0 && safeType) {
      console.log('[Search] No results with objectType filter — retrying without type filter');
      const resp2  = await adtSearch(cfg, sessionToken, safeQuery, '');
      const xml2   = resp2.ok ? await resp2.text() : '';
      const all    = parseADTRefs(xml2);
      // Filter to the requested type if type info is present, else return all
      objects = all.filter(o => !o.type || o.type === safeType || o.type.includes(safeType));
      if (objects.length === 0) objects = all; // return everything if type mismatch
    }

    res.json({ objects });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// POST /api/s4/fetch — fetch main program + auto-crawl all custom dependencies
app.post('/api/s4/fetch', async (req, res) => {
  try {
    const { sessionToken, programName, uri: directUri } = req.body;
    const cfg = getSession(sessionToken);
    if (!cfg) return res.status(401).json({ error: 'Session expired — please reconnect to S/4HANA.', code: 'SESSION_EXPIRED' });

    // Validate programName
    if (!programName || !/^[A-Za-z0-9_\-]{1,40}$/.test(programName)) {
      return res.status(400).json({ error: 'Invalid program name.' });
    }

    // Validate directUri to only allow known ADT path prefixes (SSRF guard)
    if (directUri && !isValidADTPath(directUri)) {
      return res.status(400).json({ error: 'Invalid object URI.' });
    }

    // Determine the correct ADT URI based on object type or use the directUri passed from search results
    function adtUriForObject(name, type) {
      const n = encodeURIComponent(name);
      switch ((type || '').toUpperCase()) {
        case 'SSFO': return `/sap/bc/adt/vit/wb/object_type/ssfo/object_name/${n}`;  // Smartform
        case 'FUGR': return `/sap/bc/adt/function/groups/${n}`;                       // Function Group
        case 'FUNC': return `/sap/bc/adt/functions/groups/${n}`;                      // Function Module (via group lookup)
        case 'CLAS': return `/sap/bc/adt/oo/classes/${n}`;                            // ABAP Class
        case 'INTF': return `/sap/bc/adt/oo/interfaces/${n}`;                         // Interface
        case 'ENHO': return `/sap/bc/adt/enhancements/${n}`;                          // Enhancement
        case 'TABD': return `/sap/bc/adt/ddic/tables/${n}`;                           // Dictionary Table
        default:     return `/sap/bc/adt/programs/programs/${n}`;                     // PROG / default
      }
    }

    // Use directUri from search result (most accurate), fallback to type-based URI
    const objectType = req.body.objectType || '';
    const mainUri    = (directUri && isValidADTPath(directUri))
      ? directUri
      : adtUriForObject(programName, objectType);

    const mainSource = await s4FetchSource(mainUri, cfg);
    if (!mainSource) return res.status(404).json({ error: `Source not found for ${programName}` });

    const visited = new Set([programName.toUpperCase()]);
    const deps    = [];

    async function crawl(source, depth) {
      if (depth >= 2 || deps.length >= 20) return;
      const found = extractDeps(source);

      for (const inc of found.includes) {
        if (visited.has(inc)) continue;
        visited.add(inc);
        const src = await s4FetchSource(`/sap/bc/adt/programs/includes/${inc}`, cfg);
        if (src) {
          deps.push({ name: inc, type: 'INCLUDE', lines: src.split('\n').length, source: src });
          await crawl(src, depth + 1);
        } else {
          deps.push({ name: inc, type: 'INCLUDE', lines: 0, source: null, error: 'Not found' });
        }
      }

      for (const fm of found.fms) {
        if (visited.has(fm)) continue;
        visited.add(fm);
        try {
          // Use the shared adtSearch helper (auto-detects params, uses cached variant)
          const sr2   = await adtSearch(cfg, sessionToken, fm, 'FUNC', '1');
          const srText = sr2.ok ? await sr2.text() : '';
          const refs  = parseADTRefs(srText);
          if (refs[0]) {
            const src = await s4FetchSource(refs[0].uri, cfg);
            if (src) deps.push({ name: fm, type: 'FUNCTION_MODULE', lines: src.split('\n').length, source: src });
            else     deps.push({ name: fm, type: 'FUNCTION_MODULE', lines: 0, source: null, error: 'Source not accessible' });
          }
        } catch { deps.push({ name: fm, type: 'FUNCTION_MODULE', lines: 0, source: null, error: 'Lookup failed' }); }
      }

      for (const prog of found.performs) {
        if (visited.has(prog)) continue;
        visited.add(prog);
        const src = await s4FetchSource(`/sap/bc/adt/programs/programs/${prog}`, cfg);
        if (src) deps.push({ name: prog, type: 'PROGRAM', lines: src.split('\n').length, source: src });
      }

      for (const sf of found.smartforms) {
        if (visited.has(sf)) continue;
        visited.add(sf);
        deps.push({ name: sf, type: 'SMARTFORM', lines: 0, source: `*--- SMARTFORM: ${sf}\n* Source: use SE63 / SMARTFORMS transaction\n* This form is called from the program.` });
      }
    }

    await crawl(mainSource, 0);

    let combined = `*${'='.repeat(60)}\n* MAIN: ${programName}\n*${'='.repeat(60)}\n${mainSource}`;
    for (const d of deps) {
      if (d.source) combined += `\n\n*${'='.repeat(60)}\n* ${d.type}: ${d.name}\n*${'='.repeat(60)}\n${d.source}`;
    }

    const totalLines = mainSource.split('\n').length + deps.filter(d => d.source).reduce((a, d) => a + d.lines, 0);
    res.json({
      combined,
      programName,
      totalLines,
      deps: deps.map(({ name, type, lines, error }) => ({ name, type, lines, error })),
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// Connect to SAP AI Core — returns deployments
app.post('/api/aicore/connect', async (req, res) => {
  try {
    const { keys } = req.body;
    if (!keys) return res.status(400).json({ error: 'No service key provided' });

    const token = await getToken(keys);
    const deployments = await fetchDeployments(keys, token);

    const { resourceGroup } = parseKeys(keys);
    res.json({ success: true, deployments, token, resourceGroup });
  } catch (err) {
    console.error('AI Core connect error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Analyze ABAP code — supports both AI Core and Anthropic
app.post('/api/analyze', analyzeLimiter, upload.single('file'), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // start SSE stream immediately — required for proper streaming

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    // Extract ABAP code
    let code = '';
    let provider = 'anthropic';
    let anthropicKey = '';
    let deploymentId = '';
    let aicoreKeys = null;
    let token = '';

    if (req.file) {
      code = req.file.buffer.toString('utf-8');
      // Provider info comes via body fields when using FormData
      provider = req.body.provider || 'anthropic';
      anthropicKey = req.body.anthropicKey || '';
      deploymentId = req.body.deploymentId || '';
      token = req.body.token || '';
      try { aicoreKeys = req.body.aicoreKeys ? JSON.parse(req.body.aicoreKeys) : null; } catch {}
    } else {
      code = req.body.code || '';
      provider = req.body.provider || 'anthropic';
      anthropicKey = req.body.anthropicKey || '';
      deploymentId = req.body.deploymentId || '';
      token = req.body.token || '';
      aicoreKeys = req.body.aicoreKeys || null;
    }

    if (code.trim().length < 30) {
      send({ type: 'error', message: 'Code too short. Please provide a complete ABAP Module Pool program.' });
      return res.end();
    }

    // Guard against excessively large inputs (> 200 KB of ABAP text)
    if (code.length > 200_000) {
      send({ type: 'error', message: 'Code exceeds the 200 KB limit. Split into smaller sections and analyze each separately.' });
      return res.end();
    }

    if (provider === 'aicore' && (!deploymentId || !token || !aicoreKeys)) {
      // AI Core not configured — automatically fall back to Anthropic if key is available
      const fallbackKey = anthropicKey || process.env.ANTHROPIC_API_KEY || '';
      const isPlaceholder = fallbackKey.includes('YOUR_') || fallbackKey.length < 20;
      if (fallbackKey && !isPlaceholder) {
        console.log('[Analyze] AI Core incomplete — falling back to Anthropic');
        provider = 'anthropic';
        // continue with anthropic provider below
      } else {
        send({ type: 'error', message: 'AI provider not configured.\n\n• To use SAP AI Core: go to the main page → AI Provider → SAP AI Core → upload your service key JSON and select a deployment.\n\n• To use Direct Anthropic: click the 🔑 "Set AI Key" button in the header and enter your Anthropic API key (sk-ant-...).' });
        return res.end();
      }
    }

    const steps = [
      'Parsing ABAP source code structure...',
      'Analyzing program declarations and data dictionary objects...',
      'Processing screen flow logic (PBO / PAI / POV)...',
      'Extracting GUI status, function codes, and F4 helpers...',
      'Analyzing table controls, validations, and subroutines...',
      'Building comprehensive technical documentation...',
      'Running AI analysis — generating full code walkthrough...'
    ];

    for (let i = 0; i < steps.length - 1; i++) {
      send({ type: 'progress', step: i + 1, total: steps.length, message: steps[i] });
      await new Promise(r => setTimeout(r, 280));
    }
    send({ type: 'progress', step: steps.length, total: steps.length, message: steps[steps.length - 1] });

    // Heartbeat: keep SSE alive and update UI every 15 s while AI is running
    const heartbeatMsgs = [
      'AI is reading your ABAP code...',
      'Mapping screens, PBO and PAI modules...',
      'Extracting table controls and validations...',
      'Generating line-by-line code explanation...',
      'Almost done — building final documentation...',
    ];
    let hbIdx = 0;
    const heartbeat = setInterval(() => {
      try {
        send({ type: 'progress', step: steps.length, total: steps.length, message: heartbeatMsgs[hbIdx++ % heartbeatMsgs.length] });
      } catch {}
    }, 15000);

    // Wrap AI call with 4-minute timeout
    const withTimeout = (promise, ms) =>
      Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`AI analysis timed out after ${Math.round(ms/60000)} minutes. Try a smaller program or try again.`)), ms))]);

    // ── Validate AI provider config before starting ───────────────────────
    if (provider !== 'aicore') {
      const effectiveKey = anthropicKey || process.env.ANTHROPIC_API_KEY || '';
      const isPlaceholder = effectiveKey.includes('YOUR_') || effectiveKey === '';
      if (!effectiveKey || isPlaceholder) {
        send({ type: 'error', message: 'No Anthropic API key configured.\n\nTo fix:\n1. Click ⚙️ Settings in the top-right\n2. Select "Direct Anthropic" and enter your API key (sk-ant-...)\n   OR\n3. Select "SAP AI Core" and upload your service key JSON\n\nAlternatively ask your admin to set ANTHROPIC_API_KEY in the BTP app environment.' });
        return res.end();
      }
    }

    let rawText = '';
    try {
      console.log(`[Analyze] Starting inference via ${provider}...`);
      if (provider === 'aicore') {
        rawText = await withTimeout(inferViaAICore(code, deploymentId, aicoreKeys, token), 240000);
      } else {
        const effectiveKey = anthropicKey || process.env.ANTHROPIC_API_KEY || '';
        rawText = await withTimeout(inferViaAnthropic(code, effectiveKey), 240000);
      }
      console.log(`[Analyze] AI returned ${rawText.length} chars`);
    } finally {
      clearInterval(heartbeat);
    }

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      send({ type: 'error', message: 'AI did not return JSON. The program may be too large — try pasting a smaller section, or try again.' });
      return res.end();
    }

    let analysis;
    try {
      analysis = JSON.parse(match[0]);
      console.log('[Analyze] JSON.parse succeeded');
    } catch (parseErr) {
      console.log('[Analyze] JSON.parse failed, trying jsonrepair...', parseErr.message.slice(0, 120));
      try {
        analysis = JSON.parse(jsonrepair(match[0]));
        console.log('[Analyze] jsonrepair succeeded');
      } catch (repairErr) {
        console.error('[Analyze] jsonrepair also failed:', repairErr.message.slice(0, 200));
        send({ type: 'error', message: 'AI returned malformed JSON that could not be repaired. Please try again with a shorter program.' });
        return res.end();
      }
    }

    console.log('[Analyze] Sending complete event...');
    send({ type: 'complete', analysis });
    res.end();
    console.log('[Analyze] Done.');
  } catch (err) {
    console.error('Analyze error:', err.message);
    send({ type: 'error', message: err.message || 'Analysis failed. Please try again.' });
    res.end();
  }
});

// SPA fallback
// ── Runtime API key store (survives restarts if set via CF env, else in-memory) ──
let _runtimeAnthropicKey = '';

// GET /api/ai-status — tells the frontend whether an API key is configured
app.get('/api/ai-status', (_req, res) => {
  const key = _runtimeAnthropicKey || process.env.ANTHROPIC_API_KEY || '';
  const hasKey = !!key && !key.includes('YOUR_') && key.length > 20;
  res.json({ hasKey, provider: hasKey ? 'anthropic' : 'none' });
});

// POST /api/set-apikey — save Anthropic key in runtime memory for this session
// (persists until app restarts; to make permanent, use: cf set-env abap-inspector ANTHROPIC_API_KEY <key>)
app.post('/api/set-apikey', express.json(), (req, res) => {
  const { anthropicKey } = req.body || {};
  if (!anthropicKey || typeof anthropicKey !== 'string' || anthropicKey.length < 20) {
    return res.status(400).json({ error: 'Invalid API key — must be at least 20 characters' });
  }
  if (!anthropicKey.startsWith('sk-')) {
    return res.status(400).json({ error: 'Invalid API key format — must start with sk-' });
  }
  _runtimeAnthropicKey = anthropicKey.trim();
  // Also set in process.env so inferViaAnthropic picks it up immediately
  process.env.ANTHROPIC_API_KEY = _runtimeAnthropicKey;
  console.log('[API Key] Anthropic API key updated at runtime');
  res.json({ ok: true, message: 'API key saved. AI analysis is now enabled.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🔍 ABAP Inspector v2 — http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('   ⚠  ANTHROPIC_API_KEY not set (needed for Direct Anthropic mode)\n');
  }
});
