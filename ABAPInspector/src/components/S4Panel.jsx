import { useState, useEffect } from 'react';

const OBJECT_TYPES = [
  { key: 'PROG', label: 'Programs & Reports',    icon: '📄' },
  { key: 'FUGR', label: 'Function Groups/BAPIs', icon: '⚙️' },
  { key: 'SSFO', label: 'Smartforms',            icon: '🖨' },
  { key: 'CLAS', label: 'ABAP Classes',          icon: '🏗' },
  { key: 'ENHO', label: 'BADIs / Enhancements',  icon: '🔌' },
];

const DEP_TYPE_COLORS = {
  INCLUDE:         { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200'   },
  FUNCTION_MODULE: { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200'  },
  PROGRAM:         { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  SMARTFORM:       { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200'  },
};

export default function S4Panel({ s4Config, onS4ConfigChange, onAnalyze, onBack, onGoHome }) {
  const [onBTP, setOnBTP]                 = useState(false);
  const [hasDestService, setHasDestService] = useState(false);
  const [useDestination, setUseDestination] = useState(s4Config?.useDestination ?? true);

  /* ── AI Key Modal state ────────────────────────────────────────────────── */
  const [showKeyModal, setShowKeyModal]   = useState(false);
  const [keyInput, setKeyInput]           = useState('');
  const [keyStatus, setKeyStatus]         = useState(''); // 'saving' | 'ok' | 'error'
  const [keyMsg, setKeyMsg]               = useState('');
  const [aiKeySet, setAiKeySet]           = useState(false);

  // Check on mount if key is already configured
  useEffect(() => {
    fetch('/api/ai-status').then(r => r.json()).then(d => {
      setAiKeySet(!!d.hasKey);
    }).catch(() => {});
  }, []);

  async function handleSaveKey() {
    if (!keyInput.trim()) return;
    setKeyStatus('saving');
    setKeyMsg('');
    try {
      const resp = await fetch('/api/set-apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropicKey: keyInput.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) { setKeyStatus('error'); setKeyMsg(data.error || 'Failed to save key'); return; }
      setKeyStatus('ok');
      setKeyMsg('API key saved! AI analysis is now enabled.');
      setAiKeySet(true);
      setKeyInput('');
      setTimeout(() => setShowKeyModal(false), 1500);
    } catch (err) {
      setKeyStatus('error');
      setKeyMsg(`Error: ${err.message}`);
    }
  }
  const [form, setForm] = useState({
    host            : s4Config?.displayInfo?.host             || '',
    virtualHost     : s4Config?.displayInfo?.virtualHost      || '',
    client          : s4Config?.displayInfo?.client           || '100',
    user            : s4Config?.displayInfo?.user             || '',
    pass            : '',   // never re-populated from saved state
    sccLocationId   : s4Config?.displayInfo?.sccLocationId    || '',
    destinationName : s4Config?.displayInfo?.destinationName  || '',
  });

  useEffect(() => {
    fetch('/api/s4/env').then(r => r.json()).then(d => {
      setOnBTP(!!d.onBTP);
      setHasDestService(!!d.hasDestService);
      if (!d.hasDestService) setUseDestination(false);
    }).catch(() => {});
  }, []);
  // connMode: 'dest' | 'scc' | 'direct'
  const [connMode, setConnMode] = useState(
    s4Config?.useDestination ? 'dest' :
    s4Config?.displayInfo?.virtualHost ? 'scc' : 'scc' // default to SCC
  );

  const [connecting, setConnecting]   = useState(false);
  const [connectError, setConnectError] = useState('');

  const [objectType, setObjectType]   = useState('PROG');
  const [searchQuery, setSearchQuery] = useState('Z*');
  const [results, setResults]         = useState([]);
  const [searching, setSearching]     = useState(false);
  const [searchError, setSearchError] = useState('');

  const [selected, setSelected]         = useState(null);
  const [fetchingDeps, setFetchingDeps] = useState(false);
  const [depResult, setDepResult]       = useState(null);
  const [depError, setDepError]         = useState('');

  const connected = !!s4Config?.connected;

  /* ── Connection ──────────────────────────────────────────────────────────── */
  async function handleConnect() {
    setConnecting(true);
    setConnectError('');
    try {
      // Build payload based on connection mode
      let payload;
      if (connMode === 'dest') {
        payload = { useDestination: true, destinationName: form.destinationName, client: form.client, sccLocationId: form.sccLocationId };
      } else if (connMode === 'scc') {
        payload = { useDestination: false, virtualHost: form.virtualHost, client: form.client, user: form.user, pass: form.pass, sccLocationId: form.sccLocationId };
      } else {
        payload = { useDestination: false, host: form.host, client: form.client, user: form.user, pass: form.pass };
      }

      const resp = await fetch('/api/s4/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) { setConnectError(data.error || 'Connection failed'); return; }

      // Backend returns sessionToken + displayInfo (no password)
      onS4ConfigChange({
        sessionToken    : data.sessionToken,
        displayInfo     : data.displayInfo,
        useDestination  : !!(onBTP && useDestination),
        connected       : true,
        onBTP,
      });
    } catch (err) {
      setConnectError(`Network error: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    if (s4Config?.sessionToken) {
      fetch('/api/s4/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: s4Config.sessionToken }),
      }).catch(() => {});
    }
    onS4ConfigChange(null);
    setResults([]);
    setSelected(null);
    setDepResult(null);
  }

  /* ── Search ──────────────────────────────────────────────────────────────── */
  async function handleSearch() {
    setSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const resp = await fetch('/api/s4/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: s4Config?.sessionToken, query: searchQuery || 'Z*', objectType }),
      });
      const data = await resp.json();
      if (resp.status === 401) { setSearchError('Session expired — please reconnect to S/4HANA.'); return; }
      if (!resp.ok) { setSearchError(data.error || 'Search failed'); return; }
      setResults(data.objects || []);
      if (!data.objects?.length) setSearchError('No objects found matching the query.');
    } catch (err) {
      setSearchError(`Search error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  }

  /* ── Fetch with dependencies ─────────────────────────────────────────────── */
  async function handleFetchDeps(obj) {
    setSelected(obj);
    setFetchingDeps(true);
    setDepResult(null);
    setDepError('');
    try {
      const resp = await fetch('/api/s4/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: s4Config?.sessionToken, programName: obj.name, uri: obj.uri, objectType: obj.type }),
      });
      const data = await resp.json();
      if (resp.status === 401) { setDepError('Session expired — please reconnect to S/4HANA.'); return; }
      if (!resp.ok) { setDepError(data.error || 'Fetch failed'); return; }
      setDepResult(data);
    } catch (err) {
      setDepError(`Fetch error: ${err.message}`);
    } finally {
      setFetchingDeps(false);
    }
  }

  function handleAnalyze() {
    if (depResult?.combined) onAnalyze(depResult.combined);
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center gap-3 shrink-0">
        {onGoHome && (
          <button onClick={onGoHome} className="lp-home-btn" title="Home">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        )}
        <button onClick={e => { e.preventDefault(); onBack(); }} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="w-px h-4 bg-slate-700 shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">S/4HANA Connector</div>
            <div className="text-slate-500 text-[10px] mt-0.5">
              {connected
                ? `● Connected · ${s4Config.destinationName ? `Destination: ${s4Config.destinationName}` : s4Config.virtualHost || s4Config.host}`
                : 'Connect to browse and analyze ABAP objects'}
            </div>
          </div>
        </div>
        {/* AI Key Button */}
        <button
          onClick={() => { setShowKeyModal(true); setKeyStatus(''); setKeyMsg(''); }}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${aiKeySet ? 'text-emerald-400 hover:bg-emerald-900/20' : 'text-amber-400 hover:bg-amber-900/20 animate-pulse'}`}
          title={aiKeySet ? 'AI key set — click to update' : 'Set Anthropic API key to enable AI'}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          {aiKeySet ? 'AI Key ✓' : 'Set AI Key'}
        </button>

        {connected && (
          <button onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-red-400 font-medium transition-colors px-2.5 py-1.5 hover:bg-red-900/20 rounded-lg">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Disconnect
          </button>
        )}
      </header>

      {/* ── AI Key Modal ────────────────────────────────────────────────────── */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Set Anthropic API Key</h2>
                  <p className="text-[11px] text-slate-500">Required for AI analysis of ABAP programs</p>
                </div>
              </div>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {aiKeySet && keyStatus !== 'ok' && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[11px] text-emerald-700 font-semibold">API key is configured. Enter a new one below to replace it.</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Anthropic API Key</label>
              <input
                type="password"
                value={keyInput}
                onChange={e => { setKeyInput(e.target.value); setKeyStatus(''); setKeyMsg(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                placeholder="sk-ant-api03-..."
                autoFocus
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-colors"
              />
              <p className="text-[10px] text-slate-400 mt-1.5">
                Get your key at{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                  console.anthropic.com/settings/keys
                </a>. Starts with <code className="bg-slate-100 px-1 rounded">sk-ant-</code>
              </p>
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-[10px] text-amber-700 font-semibold">⚠️ This key is saved in app memory only.</p>
                <p className="text-[10px] text-amber-600 mt-0.5">To make it permanent (survives restarts), ask your admin to run:</p>
                <code className="text-[10px] text-amber-800 bg-amber-100 rounded px-1.5 py-0.5 block mt-1 break-all">
                  cf set-env abap-inspector ANTHROPIC_API_KEY sk-ant-...
                </code>
              </div>
            </div>

            {keyMsg && (
              <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px] font-medium border ${keyStatus === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {keyStatus === 'ok'
                  ? <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                }
                {keyMsg}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowKeyModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveKey} disabled={!keyInput.trim() || keyStatus === 'saving'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors">
                {keyStatus === 'saving'
                  ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving...</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Save & Enable AI</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── Connection Card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">S/4HANA Connection</span>
            </div>
            {connected && (
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Connected
              </span>
            )}
          </div>

          <div className="p-5">
            {connected ? (
              <div className="flex items-center gap-4 flex-wrap">
                {s4Config.displayInfo?.destinationName
                  ? <Info label="Destination" value={s4Config.displayInfo.destinationName} />
                  : s4Config.displayInfo?.virtualHost
                    ? <Info label="Virtual Host" value={s4Config.displayInfo.virtualHost} />
                    : <Info label="Host" value={s4Config.displayInfo?.host} />
                }
                <Info label="Client" value={s4Config.displayInfo?.client} />
                {s4Config.displayInfo?.user && <Info label="User" value={s4Config.displayInfo.user} />}
                {s4Config.displayInfo?.destinationAuthType && (
                  <Info label="Auth" value={s4Config.displayInfo.destinationAuthType} />
                )}
                <div className="flex-1" />
                <button onClick={handleDisconnect}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  Change Connection
                </button>
              </div>
            ) : (
              <>
                {/* Connection Mode Tabs */}
                <div className="flex gap-1 mb-4 p-1 bg-slate-100 rounded-xl">
                  {hasDestService && (
                    <button onClick={() => { setConnMode('dest'); setUseDestination(true); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors ${connMode==='dest' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
                      BTP Destination
                    </button>
                  )}
                  <button onClick={() => { setConnMode('scc'); setUseDestination(false); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors ${connMode==='scc' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    SCC / Virtual Host
                  </button>
                  <button onClick={() => { setConnMode('direct'); setUseDestination(false); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-colors ${connMode==='direct' ? 'bg-white text-slate-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Direct HTTPS
                  </button>
                </div>
<div className="grid grid-cols-2 gap-3 mb-3">
                  {connMode==='dest' ? (
                    /* ── BTP Destination Service mode ────────────────────── */
                    <>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Destination Name
                        </label>
                        <input
                          value={form.destinationName}
                          onChange={e => setForm(f => ({ ...f, destinationName: e.target.value }))}
                          placeholder="S4HANA_PROD"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                          onKeyDown={e => e.key === 'Enter' && handleConnect()}
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Name of a destination configured in BTP Cockpit → Connectivity → Destinations.
                          Must be type <strong>HTTP</strong>, authentication <strong>BasicAuthentication</strong>.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">SAP Client</label>
                        <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="100"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          SCC Location ID <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <input value={form.sccLocationId} onChange={e => setForm(f => ({ ...f, sccLocationId: e.target.value }))} placeholder="leave blank for default"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
                          <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <p className="text-[11px] text-emerald-700">
                            Host URL and credentials are read from the BTP destination — no need to enter them here.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : connMode==='scc' ? (
                    /* ── BTP manual: virtual host + SCC + credentials ─────── */
                    <>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          Virtual Host <span className="text-slate-400 font-normal normal-case">(from Cloud Connector System Mapping)</span>
                        </label>
                        <input
                          value={form.virtualHost}
                          onChange={e => setForm(f => ({ ...f, virtualHost: e.target.value }))}
                          placeholder="s4hana:44300"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Must match the Virtual Host in SCC → Cloud To On-Premise → System Mapping</p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">SAP Client</label>
                        <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="100"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          SCC Location ID <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <input value={form.sccLocationId} onChange={e => setForm(f => ({ ...f, sccLocationId: e.target.value }))} placeholder="leave blank for default"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Username</label>
                        <input value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} placeholder="S4_DEV_USER" autoComplete="off"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Password</label>
                        <input type="password" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} placeholder="••••••••"
                          autoComplete="current-password"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          onKeyDown={e => e.key === 'Enter' && handleConnect()} />
                      </div>
                    </>
                  ) : (
                    /* ── Direct HTTPS ─────────────────────────────────────── */
                    <>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">System URL (HTTPS)</label>
                        <input
                          value={form.host}
                          onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                          placeholder="https://my-s4hana.example.com:44300"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">S/4HANA must be reachable over the internet with a valid SSL certificate.</p>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">SAP Client</label>
                        <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="100"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Username</label>
                        <input value={form.user} onChange={e => setForm(f => ({ ...f, user: e.target.value }))} placeholder="S4_DEV_USER" autoComplete="off"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Password</label>
                        <input type="password" value={form.pass} onChange={e => setForm(f => ({ ...f, pass: e.target.value }))} placeholder="••••••••"
                          autoComplete="current-password"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          onKeyDown={e => e.key === 'Enter' && handleConnect()} />
                      </div>
                    </>
                  )}
                </div>

                {connectError && (
                  <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {connectError}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Requires ADT service active in S/4HANA (SICF → <code className="bg-slate-100 px-1 rounded">/sap/bc/adt</code>) and a user with <strong>S_DEVELOP</strong> read access.
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={connecting || (
                      connMode==='dest'   ? !form.destinationName :
                      connMode==='scc'    ? (!form.virtualHost || !form.user || !form.pass) :
                                           (!form.host || !form.user || !form.pass)
                    )}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors shrink-0"
                  >
                    {connecting ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {connecting ? 'Connecting…' : 'Test & Connect'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── What S/4HANA admin needs (shown when not connected) ─────────── */}
        {!connected && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <div className="text-sm font-bold text-amber-800 mb-2">What your S/4HANA Basis admin needs to do (one-time setup)</div>
                <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
                  <li>Transaction <strong>SICF</strong> → navigate to <code className="bg-amber-100 px-1 rounded">/sap/bc/adt</code> → right-click → <strong>Activate Service</strong></li>
                  <li>Create or use a dialog user with authorization object <strong>S_DEVELOP</strong> (ACTVT = 03 Read)</li>
                  <li>Ensure HTTPS port (<strong>44300</strong> default) is reachable from where this app runs</li>
                  <li>If deployed on BTP: configure <strong>Cloud Connector</strong> to tunnel to the private cloud system</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* ── Object Browser (shown when connected) ──────────────────────── */}
        {connected && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Browse ABAP Objects</span>
            </div>
            <div className="p-5">
              {/* Object type pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {OBJECT_TYPES.map(t => (
                  <button key={t.key}
                    onClick={() => setObjectType(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                      objectType === t.key
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-700'
                    }`}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              {/* Search row */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                  </svg>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Z* or ZFIN* or ZMM_*"
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
                >
                  {searching ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                    </svg>
                  )}
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>

              {searchError && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{searchError}</div>
              )}

              {/* Results table */}
              {results.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="grid px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wide"
                    style={{ gridTemplateColumns: '2fr 0.6fr 1.5fr auto' }}>
                    <span>Object Name</span>
                    <span>Type</span>
                    <span>Description</span>
                    <span>Action</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {results.map(obj => (
                      <div key={obj.uri} className="grid items-center px-4 py-3 hover:bg-slate-50 transition-colors"
                        style={{ gridTemplateColumns: '2fr 0.6fr 1.5fr auto' }}>
                        <button onClick={() => handleFetchDeps(obj)}
                          className="font-mono text-sm font-bold text-slate-800 hover:text-emerald-700 text-left truncate">
                          {obj.name}
                        </button>
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full w-fit">{obj.type}</span>
                        <span className="text-xs text-slate-400 truncate">{obj.description || '—'}</span>
                        <button
                          onClick={() => handleFetchDeps(obj)}
                          disabled={fetchingDeps && selected?.name === obj.name}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
                        >
                          {fetchingDeps && selected?.name === obj.name ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          )}
                          Fetch + Analyze
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-400">
                    {results.length} object{results.length !== 1 ? 's' : ''} found
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Dependency Tree (shown after fetching) ───────────────────────── */}
        {selected && (depResult || fetchingDeps || depError) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-700 text-sm">{selected.name}</span>
                <span className="text-[11px] px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full font-semibold">{selected.type}</span>
              </div>
              {depResult && (
                <span className="text-[11px] text-slate-500">
                  {depResult.totalLines.toLocaleString()} lines · {(depResult.deps?.length || 0) + 1} objects
                </span>
              )}
            </div>

            <div className="p-5">
              {fetchingDeps && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <svg className="w-8 h-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <div className="text-sm font-semibold text-slate-600">Scanning dependencies…</div>
                  <div className="text-xs text-slate-400">Fetching includes, function modules, smartforms, external programs</div>
                </div>
              )}

              {depError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {depError}
                </div>
              )}

              {depResult && (
                <>
                  {/* Dependency tree list */}
                  <div className="space-y-1.5 mb-5">
                    {/* Main program row */}
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 rounded-xl">
                      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-mono text-sm font-bold text-white flex-1">{depResult.programName}</span>
                      <span className="text-[11px] text-slate-400">MAIN PROGRAM</span>
                    </div>

                    {depResult.deps?.length === 0 && (
                      <div className="px-4 py-3 text-sm text-slate-400 text-center">No custom Z/Y dependencies found — standalone program.</div>
                    )}

                    {depResult.deps?.map((dep, i) => {
                      const colors = DEP_TYPE_COLORS[dep.type] || DEP_TYPE_COLORS.INCLUDE;
                      const ok = dep.lines > 0;
                      return (
                        <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${colors.bg} ${colors.border}`}>
                          <span className="text-slate-400 text-xs font-mono shrink-0">
                            {i === depResult.deps.length - 1 ? '└─' : '├─'}
                          </span>
                          {ok ? (
                            <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className={`font-mono text-sm font-bold flex-1 ${colors.text}`}>{dep.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                            {dep.type.replace('_', ' ')}
                          </span>
                          {ok
                            ? <span className="text-[11px] text-slate-500">{dep.lines.toLocaleString()} lines</span>
                            : <span className="text-[11px] text-red-400">{dep.error || 'Not found'}</span>
                          }
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary bar */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 mb-4">
                    <div className="flex items-center gap-5">
                      <Stat label="Total Lines" value={depResult.totalLines.toLocaleString()} />
                      <Stat label="Objects" value={(depResult.deps?.length || 0) + 1} />
                      <Stat label="Fetched OK" value={depResult.deps?.filter(d => d.lines > 0).length + 1} />
                      <Stat label="Not Found" value={depResult.deps?.filter(d => !d.lines).length} />
                    </div>
                    <button
                      onClick={handleAnalyze}
                      className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Analyze All {depResult.deps?.length + 1} Objects with Claude
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-mono font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-base font-bold text-slate-800">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}
