# ABAP Inspector — End-to-End Setup Guide

## Part 1 — S/4HANA Private Cloud Edition (Basis Admin Tasks)

Everything below is a one-time setup. No transport is needed — all actions are in Customising or system config.

---

### 1.1  Activate the ADT Service in SICF

ABAP Inspector talks to the S/4HANA system over the **ABAP Development Tools (ADT) REST API**, which ships with every S/4HANA system but is inactive by default.

**Transaction: SICF**

1. Navigate to: `default_host → sap → bc → adt`
2. Right-click the `adt` node → **Activate Service**
3. Confirm the recursive activation dialog (activates all child nodes)
4. Also verify the `discovery` sub-node is active:
   `default_host → sap → bc → adt → discovery`

> **Tip:** If the node doesn't exist, your system version may be older than S/4HANA 1610. Run `SE80 → search for report SAPMADT*` to check if ADT is installed.

---

### 1.2  HTTPS Port

The ADT REST API must be reached over **HTTPS**. Confirm the ICM HTTPS port is open:

**Transaction: SMICM → Goto → Services**

| Port | Protocol | Active |
|------|----------|--------|
| 44300 (default) | HTTPS | ✅ |

If HTTPS is not yet configured, ask Basis to run the ICM HTTPS setup wizard or maintain `icm/server_port_N` in the profile.

---

### 1.3  Create a Dedicated ADT Read-Only User

Do **not** use a dialog user with wide authorisation. Create a minimal service account:

**Transaction: SU01**

| Field | Value |
|-------|-------|
| User type | **Service** (type S) |
| Password | Strong password, set to never expire |
| Valid from/to | As required |

**Assign these authorization objects** (via a role, not directly on the user):

| Object | Field | Value |
|--------|-------|-------|
| `S_DEVELOP` | `ACTVT` | `03` (Display) |
| `S_DEVELOP` | `DEVCLASS` | `*` or specific package names |
| `S_DEVELOP` | `OBJTYPE` | `*` |
| `S_DEVELOP` | `OBJNAME` | `*` |
| `S_RFC` | `ACTVT` | `16` |
| `S_RFC` | `RFC_TYPE` | `FUGR` |
| `S_RFC` | `RFC_NAME` | `SADT_REST_RFC_ENDPOINT` |

> **Note:** `S_DEVELOP` with ACTVT=03 is read-only (display). It does not allow create/modify/delete.

---

### 1.4  Test the ADT Endpoint Manually

Before configuring the app, confirm ADT responds correctly from a browser or curl:

```
GET https://<your-s4-host>:44300/sap/bc/adt/discovery?sap-client=100
Authorization: Basic <base64(user:pass)>
Accept: application/xml
```

Expected response: HTTP 200 with an XML `<app:service>` document listing ADT collections.

If you get:
- **401** → wrong credentials or user locked
- **404** → ADT service not activated in SICF
- **Connection refused** → HTTPS port not open or firewall blocking

---

### 1.5  SSL Certificate (Private Cloud)

If the S/4HANA system uses a **self-signed certificate**, the app will fail with a TLS error when running locally. Options:

| Option | How |
|--------|-----|
| Use a CA-signed cert | Ask Basis to install a cert from a trusted CA |
| Export and trust the cert | Export the system cert from STRUST, import into your OS trust store |
| For dev only | Set `NODE_TLS_REJECT_UNAUTHORIZED=0` in `.env` (never in production) |

---

### 1.6  For BTP Deployment — Cloud Connector Setup

If the S/4HANA system is behind a firewall (private cloud), the BTP app reaches it through the **SAP Cloud Connector (SCC)**.

**In the Cloud Connector admin UI** (`https://localhost:8443`):

1. **Add the BTP subaccount** (Subaccount → Add, paste the subaccount region URL + credentials)
2. **Cloud To On-Premise → Add System Mapping:**
   | Field | Value |
   |-------|-------|
   | Back-end Type | `ABAP System` |
   | Protocol | `HTTPS` |
   | Internal Host | `<actual S/4HANA hostname>` |
   | Internal Port | `44300` |
   | Virtual Host | e.g. `s4hana` (you choose this) |
   | Virtual Port | `44300` |
   | Principal Type | `None` |
3. **Add resource** under that mapping:
   | Path | Access Policy |
   |------|---------------|
   | `/sap/bc/adt/` | Path and all sub-paths |
4. **Check the "Active" column** — must show a green tick

The **Virtual Host** value (e.g. `s4hana:44300`) is what you enter in the ABAP Inspector connection form under "Manual (Virtual Host)".

---

### 1.7  For BTP Deployment — Create a Named Destination (Recommended)

Instead of entering virtual host + credentials manually, create a BTP destination so the app reads everything automatically.

**BTP Cockpit → Connectivity → Destinations → New Destination:**

| Field | Value |
|-------|-------|
| Name | `S4HANA_PROD` (or any name) |
| Type | `HTTP` |
| URL | `http://s4hana:44300` (the SCC virtual host URL) |
| Proxy Type | `OnPremise` |
| Authentication | `BasicAuthentication` |
| User | `<ADT service user>` |
| Password | `<password>` |

Additional Properties:
| Key | Value |
|-----|-------|
| `sap-client` | `100` |

> The **URL** uses `http://` because the encryption is handled by the SCC tunnel. The app's connection to SCC itself is over TLS.

---

## Part 2 — ABAP Inspector App Setup

### 2.1  Local Development

**Prerequisites:** Node.js 18+, npm, a terminal

```bash
cd "Desktop/Vibe Apps/ABAPInspector"
npm install
```

**Environment variables** (create a `.env` file — never commit it):

```env
# Optional: enables direct Anthropic fallback when AI Core isn't configured
ANTHROPIC_API_KEY=sk-ant-...
```

**Start dev server:**

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

**Connect to S/4HANA locally:**
- In the app: click **S/4HANA** button → fill in System URL + credentials → "Test & Connect"
- System URL: `https://<your-s4-host>:44300`
- Session token is stored in memory on the server (not in browser storage)

---

### 2.2  SAP AI Core Setup (Optional — for enterprise model access)

The app supports both **direct Anthropic** (via `ANTHROPIC_API_KEY`) and **SAP AI Core** (for GPT-4o, Claude, Llama etc. via your BTP subscription).

**To use AI Core:**
1. In the app, click the ⚙ AI settings icon
2. Select **SAP AI Core** provider
3. Upload your AI Core **Service Key JSON** (download from BTP Cockpit → Service Keys)
4. Click **Connect** — the app fetches all running deployments
5. Select the model you want (GPT-4o, Claude, Llama, etc.)

The service key stays **server-side only** — it is never written to localStorage.

---

### 2.3  SAP BTP Cloud Foundry Deployment

**Prerequisites:** CF CLI installed, logged in to your BTP subaccount

**Step 1 — Create required CF service instances** (one-time):

```bash
# Connectivity service — for Cloud Connector routing
cf create-service connectivity lite connectivity

# Destination service — for named destination lookups
cf create-service destination lite destination
```

**Step 2 — Set the Anthropic API key** (if not using AI Core):

Edit `manifest.yml`:
```yaml
env:
  NODE_ENV: production
  ANTHROPIC_API_KEY: sk-ant-your-actual-key-here
```

**Step 3 — Build and deploy:**

```bash
npm run cf-deploy
# Equivalent to: npm run build && cf push
```

**Step 4 — Confirm the app is running:**

```bash
cf apps          # should show abap-inspector STARTED
cf logs abap-inspector --recent   # check for startup errors
```

**Access the app:**
```
https://abap-inspector.<your-cf-domain>.hana.ondemand.com
```

---

### 2.4  Connecting to S/4HANA on BTP

After deployment, open the app and click **S/4HANA**. The connection form adapts automatically:

**Option A — Destination Service (recommended):**
- Enter only the **Destination Name** (e.g. `S4HANA_PROD`)
- No URL or credentials needed — the app reads them from the BTP destination
- SAP Client (optional override)
- SCC Location ID (if using multiple SCCs)

**Option B — Manual:**
- Enter the **Virtual Host** from your SCC mapping (e.g. `s4hana:44300`)
- Enter Username + Password of the ADT service user

Either way, clicking **Test & Connect** does a live `GET /sap/bc/adt/discovery` call to verify connectivity before saving.

---

## Part 3 — Security Reference

### What is stored where

| Data | Location | Notes |
|------|----------|-------|
| SAP AI Core service key | Browser memory only (server-side in current session) | Cleared on page refresh |
| S/4HANA credentials | **Server memory only** (session token in localStorage) | Never written to localStorage |
| Session token | `localStorage` (key: `abap_inspector_s4config`) | Random 64-hex string; expires 8h |
| Analyzed reports | `localStorage` (key: `abap_inspector_reports`) | Max 15 reports; no credentials |
| ANTHROPIC_API_KEY | Server environment variable | Set in CF manifest or `.env` |

### Rate limits applied

| Endpoint | Limit |
|----------|-------|
| `POST /api/analyze` | 10 requests / minute / IP |
| `POST /api/chat` | 30 messages / minute / IP |
| `POST /api/s4/connect` | 20 attempts / 5 minutes / IP |

### Security headers set by Helmet

`X-Frame-Options`, `X-Content-Type-Options`, `X-DNS-Prefetch-Control`, `Strict-Transport-Security` (on HTTPS), `Content-Security-Policy` (default-src 'self').

### SSRF protections

- `directUri` in fetch requests is validated to start with `/sap/bc/adt/` — arbitrary paths are rejected
- `objectType` is validated against an allow-list of known ABAP object types
- Search queries are stripped of special characters (allow: `A-Z 0-9 _ * / - .`)
- `host` URL must start with `https://`

---

## Part 4 — Checklist Before Go-Live

### S/4HANA
- [ ] ADT service active in SICF (`/sap/bc/adt` and children)
- [ ] Dedicated service user created with `S_DEVELOP` ACTVT=03 only
- [ ] HTTPS port 44300 reachable (or custom port configured in app)
- [ ] SSL certificate is from a trusted CA (or explicitly trusted on app server)
- [ ] Manual test of ADT discovery endpoint returns HTTP 200

### Cloud Connector (if applicable)
- [ ] BTP subaccount added to SCC
- [ ] System mapping created with correct virtual host
- [ ] Resource `/sap/bc/adt/` (all sub-paths) added
- [ ] SCC shows green "Active" status

### BTP Destination (if using Destination Service mode)
- [ ] Destination created with type HTTP, ProxyType OnPremise
- [ ] Authentication: BasicAuthentication, correct user/password
- [ ] Property `sap-client` set to the correct client number

### App Deployment
- [ ] `connectivity` and `destination` CF service instances created
- [ ] `ANTHROPIC_API_KEY` set in manifest.yml (if not using AI Core)
- [ ] `npm run cf-deploy` succeeded — app shows STARTED in `cf apps`
- [ ] App URL accessible, landing page loads
- [ ] S/4HANA connect flow tested end-to-end (connect → search → fetch + analyze)
