import { useState, useRef, useCallback, useEffect } from 'react';

const SAMPLE_CODE = `PROGRAM SAPMZDEMO_VENDOR.

TABLES: LFA1, LFB1, ZVD_CUSTOM.

DATA: WA_LFA1  TYPE LFA1,
      WA_LFB1  TYPE LFB1,
      WA_ZVD   TYPE ZVD_CUSTOM,
      IT_LFA1  TYPE TABLE OF LFA1,
      GV_LIFNR TYPE LFA1-LIFNR,
      GV_BUKRS TYPE LFB1-BUKRS VALUE '1000',
      GV_MSG   TYPE STRING.

CONSTANTS: C_PROG TYPE CHAR20 VALUE 'SAPMZDEMO_VENDOR'.
CONTROLS: TC_VENDOR TYPE TABLEVIEW USING SCREEN 0200.

LOAD-OF-PROGRAM.
  CLEAR: WA_LFA1, WA_LFB1, IT_LFA1.
  GV_BUKRS = '1000'.

PROCESS BEFORE OUTPUT.
  MODULE STATUS_0100.
PROCESS AFTER INPUT.
  MODULE USER_COMMAND_0100.

PROCESS BEFORE OUTPUT.
  MODULE STATUS_0200.
  LOOP AT IT_LFA1 INTO WA_LFA1 WITH CONTROL TC_VENDOR
       CURSOR TC_VENDOR-CURRENT_LINE.
    MODULE FILL_TABLE_CONTROL.
  ENDLOOP.
PROCESS AFTER INPUT.
  LOOP AT IT_LFA1.
    MODULE READ_TABLE_CONTROL.
  ENDLOOP.
  MODULE USER_COMMAND_0200.
PROCESS ON VALUE-REQUEST.
  FIELD WA_LFA1-LIFNR MODULE LIFNR_F4.

MODULE STATUS_0100 OUTPUT.
  SET PF-STATUS 'STATUS_100'.
  SET TITLEBAR 'TIT_100'.
  CLEAR WA_LFA1.
ENDMODULE.

MODULE USER_COMMAND_0100 INPUT.
  CASE SY-UCOMM.
    WHEN 'SEARCH'.
      PERFORM SEARCH_VENDORS.
      CALL SCREEN 200.
    WHEN 'EXIT' OR 'BACK' OR 'CANC'.
      LEAVE PROGRAM.
  ENDCASE.
ENDMODULE.

MODULE STATUS_0200 OUTPUT.
  SET PF-STATUS 'STATUS_200'.
  SET TITLEBAR 'TIT_200'.
ENDMODULE.

MODULE FILL_TABLE_CONTROL OUTPUT.
  READ TABLE IT_LFA1 INTO WA_LFA1 INDEX TC_VENDOR-CURRENT_LINE.
ENDMODULE.

MODULE READ_TABLE_CONTROL INPUT.
  READ TABLE IT_LFA1 INDEX TC_VENDOR-CURRENT_LINE.
  MOVE-CORRESPONDING WA_LFA1 TO IT_LFA1.
  MODIFY IT_LFA1 INDEX TC_VENDOR-CURRENT_LINE.
ENDMODULE.

MODULE USER_COMMAND_0200 INPUT.
  CASE SY-UCOMM.
    WHEN 'SAVE'.
      PERFORM SAVE_VENDOR.
    WHEN 'BACK'.
      LEAVE SCREEN.
  ENDCASE.
ENDMODULE.

MODULE LIFNR_F4 INPUT.
  DATA: LT_RETURN TYPE TABLE OF DDSHRETVAL,
        WA_RETURN TYPE DDSHRETVAL.
  CALL FUNCTION 'F4IF_INT_TABLE_VALUE_REQUEST'
    EXPORTING
      RETFIELD        = 'LIFNR'
      DYNPPROG        = SY-REPID
      DYNPNR          = SY-DYNNR
      DYNPROFIELD     = 'WA_LFA1-LIFNR'
      VALUE_ORG       = 'S'
    TABLES
      VALUE_TAB       = IT_LFA1
      RETURN_TAB      = LT_RETURN
    EXCEPTIONS
      PARAMETER_ERROR = 1
      NO_VALUES_FOUND = 2
      OTHERS          = 3.
  IF SY-SUBRC = 0.
    READ TABLE LT_RETURN INTO WA_RETURN INDEX 1.
    WA_LFA1-LIFNR = WA_RETURN-FIELDVAL.
  ENDIF.
ENDMODULE.

FORM SEARCH_VENDORS.
  REFRESH IT_LFA1.
  IF WA_LFA1-LIFNR IS INITIAL AND WA_LFA1-NAME1 IS INITIAL.
    MESSAGE 'Please enter Vendor Number or Name' TYPE 'W'.
    RETURN.
  ENDIF.
  SELECT * FROM LFA1 INTO TABLE IT_LFA1
    WHERE LIFNR LIKE WA_LFA1-LIFNR
      AND NAME1 LIKE WA_LFA1-NAME1
      AND LOEVM = SPACE.
  IF SY-SUBRC <> 0.
    MESSAGE 'No vendors found' TYPE 'I'.
  ENDIF.
ENDFORM.

FORM SAVE_VENDOR.
  READ TABLE IT_LFA1 INTO WA_LFA1 INDEX TC_VENDOR-CURRENT_LINE.
  IF SY-SUBRC <> 0.
    MESSAGE 'Select a vendor row first' TYPE 'E'.
    RETURN.
  ENDIF.
  AUTHORITY-CHECK OBJECT 'F_LFA1_GEN' ID 'ACTVT' FIELD '02'.
  IF SY-SUBRC <> 0.
    MESSAGE 'No authorization to modify vendor' TYPE 'E'.
    RETURN.
  ENDIF.
  MODIFY LFA1 FROM WA_LFA1.
  MOVE-CORRESPONDING WA_LFA1 TO WA_ZVD.
  WA_ZVD-MANDT = SY-MANDT.
  WA_ZVD-UDATE = SY-DATUM.
  WA_ZVD-UTIME = SY-UZEIT.
  WA_ZVD-UNAME = SY-UNAME.
  MODIFY ZVD_CUSTOM FROM WA_ZVD.
  IF SY-SUBRC = 0.
    COMMIT WORK AND WAIT.
    MESSAGE 'Vendor saved successfully' TYPE 'S'.
  ELSE.
    ROLLBACK WORK.
    MESSAGE 'Error saving vendor data' TYPE 'E'.
  ENDIF.
ENDFORM.`;

/* ─────────────────── AI Provider Panel ─────────────────────────────────── */

function ModelBadge({ category, color }) {
  return (
    <span className="model-badge" style={{ color, borderColor: `${color}40`, background: `${color}15` }}>
      {category}
    </span>
  );
}

function AICorePanel({ aiConfig, onAiConfigChange }) {
  const alreadyConnected = aiConfig.deployments?.length > 0;
  const [step, setStep] = useState(alreadyConnected ? 2 : 1);
  const [keyText, setKeyText] = useState('');
  const [keyDrag, setKeyDrag] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState('');
  const keyFileRef = useRef(null);

  // If parent silently refreshed the token and we're still on step 1, advance
  useEffect(() => {
    if (aiConfig.deployments?.length > 0 && step === 1) setStep(2);
  }, [aiConfig.deployments]);

  const handleKeyFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setKeyText(e.target.result);
    reader.readAsText(file);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectErr('');
    try {
      let keys;
      try { keys = JSON.parse(keyText); } catch {
        throw new Error('Invalid JSON — please paste a valid SAP AI Core service key');
      }
      const res = await fetch('/api/aicore/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Connection failed');

      onAiConfigChange(prev => ({
        ...prev,
        keys,
        token: data.token,
        resourceGroup: data.resourceGroup || 'default',
        deployments: data.deployments || [],
        selectedDeployment: data.deployments?.[0] || null
      }));
      setStep(2);
    } catch (err) {
      setConnectErr(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleClear = () => {
    onAiConfigChange(prev => ({ ...prev, keys: null, token: '', deployments: [], selectedDeployment: null }));
    setStep(1);
    setKeyText('');
    setConnectErr('');
  };

  return (
    <div className="space-y-4">
      {step === 1 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
            <span className="text-sm font-semibold text-slate-700">Upload Service Key</span>
          </div>

          {/* Drag zone */}
          <div
            onDragOver={e => { e.preventDefault(); setKeyDrag(true); }}
            onDragLeave={() => setKeyDrag(false)}
            onDrop={e => { e.preventDefault(); setKeyDrag(false); const f = e.dataTransfer.files[0]; if (f) handleKeyFile(f); }}
            onClick={() => keyFileRef.current?.click()}
            className={`relative h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all text-xs ${keyDrag ? 'border-blue-500 bg-blue-50' : keyText ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/40'}`}
          >
            <input ref={keyFileRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) handleKeyFile(f); }} />
            {keyText ? (
              <><span className="text-green-600 font-semibold">✓ Key JSON loaded</span><span className="text-slate-400 mt-0.5">Click to replace</span></>
            ) : (
              <><span className="text-slate-500 font-medium">Drop key.json here</span><span className="text-slate-400 mt-0.5">or click to browse</span></>
            )}
          </div>

          {/* Or paste */}
          <textarea
            value={keyText}
            onChange={e => setKeyText(e.target.value)}
            placeholder={'{\n  "clientid": "sb-...",\n  "clientsecret": "...",\n  "url": "https://...",\n  "serviceurls": { "AI_API_URL": "..." }\n}'}
            className="w-full h-28 px-3 py-2.5 font-mono text-[11px] bg-slate-900 text-slate-200 rounded-xl border border-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600"
            spellCheck={false}
          />

          {connectErr && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-1.5">
              <span>⚠</span><span>{connectErr}</span>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={!keyText.trim() || connecting}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${!keyText.trim() || connecting ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm active:scale-[.98]'}`}
          >
            {connecting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>
                Connecting…
              </span>
            ) : 'Connect to SAP AI Core →'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">✓</span>
              <span className="text-sm font-semibold text-slate-700">Connected</span>
              <span className="px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-700 text-[10px] font-semibold rounded-full">Saved</span>
            </div>
            <button onClick={handleClear} className="text-xs text-slate-400 hover:text-red-500 transition-colors">Clear saved key</button>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
            <span className="text-sm font-semibold text-slate-700">Select Deployment Model</span>
          </div>

          {aiConfig.deployments.length === 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              No RUNNING deployments found in resource group "{aiConfig.resourceGroup}". Please check your SAP AI Core setup.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {aiConfig.deployments.map(dep => (
                <button
                  key={dep.id}
                  onClick={() => onAiConfigChange(prev => ({ ...prev, selectedDeployment: dep }))}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all ${aiConfig.selectedDeployment?.id === dep.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${aiConfig.selectedDeployment?.id === dep.id ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                        {aiConfig.selectedDeployment?.id === dep.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="font-semibold text-xs text-slate-800 truncate">{dep.displayName}</span>
                    </div>
                    <ModelBadge category={dep.category} color={dep.categoryColor} />
                  </div>
                  <div className="ml-5.5 mt-0.5 text-[10px] text-slate-400 font-mono truncate pl-[22px]">
                    {dep.id}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnthropicPanel({ aiConfig, onAiConfigChange }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-700">Anthropic API Key</div>
      <input
        type="password"
        value={aiConfig.anthropicKey}
        onChange={e => onAiConfigChange(prev => ({ ...prev, anthropicKey: e.target.value }))}
        placeholder="sk-ant-api03-..."
        className="w-full px-3 py-2.5 font-mono text-sm bg-slate-900 text-slate-200 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600"
      />
      <p className="text-xs text-slate-400">
        Saved locally in your browser. Get a key at <span className="text-blue-500">console.anthropic.com</span>
      </p>
    </div>
  );
}

/* ─────────────────── Main UploadPage ───────────────────────────────────── */

export default function UploadPage({ onAnalyze, error, aiConfig, onAiConfigChange, reportCount, onOpenDashboard, onOpenS4, s4Connected, onGoHome }) {
  const [code, setCode] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [codeTab, setCodeTab] = useState('paste');
  const fileRef = useRef(null);

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setCodeTab('file'); }
  }, []);

  const isAICoreReady = aiConfig.provider === 'aicore' && !!aiConfig.selectedDeployment;
  const isAnthropicReady = aiConfig.provider === 'anthropic' && (!!aiConfig.anthropicKey.trim() || true);
  const hasCode = codeTab === 'file' ? !!file : code.trim().length > 30;
  const canAnalyze = hasCode && (isAICoreReady || isAnthropicReady);

  const handleAnalyze = () => {
    if (codeTab === 'file' && file) onAnalyze('', true, file);
    else if (code.trim()) onAnalyze(code, false, null);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Compact header ── */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onGoHome && (
            <button onClick={onGoHome} className="lp-home-btn" title="Home">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </button>
          )}
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">ABAP Inspector</div>
            <div className="text-slate-500 text-[10px] mt-0.5">Module Pool &amp; Dialogue Analyzer v2</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onOpenS4}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              s4Connected
                ? 'text-emerald-300 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-700'
                : 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
            }`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            {s4Connected ? '● S/4HANA' : 'S/4HANA'}
          </button>
          {reportCount > 0 && (
            <button onClick={onOpenDashboard}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Documents ({reportCount})
            </button>
          )}
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-glow" />
            AI-powered
          </span>
        </div>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-5 mt-3 shrink-0 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* ── Main: two-column, fills remaining height ── */}
      <div className="flex-1 flex gap-4 px-5 py-4 min-h-0">

        {/* LEFT: ABAP Code */}
        <div className="flex-[3] min-w-0 flex flex-col">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                </svg>
                <span className="font-semibold text-slate-700 text-xs">ABAP Source Code</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  {[{ id: 'paste', label: 'Paste' }, { id: 'file', label: 'Upload' }].map(t => (
                    <button key={t.id} onClick={() => setCodeTab(t.id)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${codeTab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => { setCode(SAMPLE_CODE); setCodeTab('paste'); setFile(null); }}
                  className="text-[11px] text-blue-500 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                  Sample
                </button>
              </div>
            </div>

            {/* Code area — fills remaining card height */}
            <div className="flex-1 relative min-h-0">
              {codeTab === 'paste' ? (
                <>
                  <textarea
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder={"Paste your ABAP Module Pool program here...\n\nPROGRAM SAPMZ_YOUR_PROGRAM.\nTABLES: ...\nDATA: ..."}
                    className="absolute inset-0 w-full h-full px-4 py-3 font-mono text-[12px] leading-relaxed bg-[#0d1117] text-[#e6edf3] resize-none focus:outline-none placeholder-[#484f58]"
                    spellCheck={false}
                  />
                  <div className="absolute bottom-2 right-3 text-[10px] text-slate-600 pointer-events-none select-none bg-[#0d1117]/80 px-1.5 py-0.5 rounded">
                    {code.split('\n').length} lines · {code.length.toLocaleString()} chars
                  </div>
                </>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-[#0d1117] transition-all ${dragging ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                >
                  <input ref={fileRef} type="file" accept=".abap,.txt,.prog" onChange={e => { const f = e.target.files[0]; if (f) setFile(f); }} className="hidden" />
                  {file ? (
                    <div className="text-center">
                      <div className="text-4xl mb-3">📄</div>
                      <div className="font-semibold text-slate-200 text-sm">{file.name}</div>
                      <div className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                      </svg>
                      <div className="text-slate-400 font-medium text-sm">Drop your ABAP file here</div>
                      <div className="text-slate-600 text-xs mt-1">.abap · .txt · .prog</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: AI Config + Analyze */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          {/* AI Provider card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              <span className="font-semibold text-slate-700 text-xs">AI Provider</span>
            </div>

            <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1">
              {/* Provider toggle */}
              <div className="grid grid-cols-2 gap-2">
                {[{ id: 'aicore', label: 'SAP AI Core', icon: '🔷' }, { id: 'anthropic', label: 'Direct API', icon: '⚡' }].map(p => (
                  <button key={p.id} onClick={() => onAiConfigChange(prev => ({ ...prev, provider: p.id }))}
                    className={`py-2 px-2 rounded-lg border-2 text-xs font-semibold transition-all flex items-center justify-center gap-1 ${aiConfig.provider === p.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-600 hover:border-slate-300'}`}>
                    <span>{p.icon}</span>{p.label}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-3">
                {aiConfig.provider === 'aicore'
                  ? <AICorePanel aiConfig={aiConfig} onAiConfigChange={onAiConfigChange} />
                  : <AnthropicPanel aiConfig={aiConfig} onAiConfigChange={onAiConfigChange} />
                }
              </div>
            </div>
          </div>

          {/* Selected model badge */}
          {aiConfig.provider === 'aicore' && aiConfig.selectedDeployment && (
            <div className="px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 shrink-0">
              <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse-glow" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-green-700 truncate">{aiConfig.selectedDeployment.displayName}</div>
                <div className="text-[10px] text-green-600">{aiConfig.selectedDeployment.category} · SAP AI Core</div>
              </div>
            </div>
          )}

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all shrink-0 ${canAnalyze
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 active:scale-[.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {canAnalyze ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2"/><path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Analyze Program
              </span>
            ) : (
              !hasCode ? 'Paste or upload ABAP code'
              : aiConfig.provider === 'aicore' ? 'Select a deployment'
              : 'Ready to analyze'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
