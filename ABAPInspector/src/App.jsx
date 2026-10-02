import { useState, useEffect } from 'react';
import UploadPage from './components/UploadPage';
import LoadingPage from './components/LoadingPage';
import ResultsPage from './components/ResultsPage';
import DocumentsPage from './components/DocumentsPage';
import S4Panel from './components/S4Panel';
import ChatPanel from './components/ChatPanel';

const STORAGE_KEY = 'abap_inspector_aiconfig';

const defaultAiConfig = {
  provider: 'anthropic',
  keys: null,
  token: '',
  resourceGroup: 'default',
  deployments: [],
  selectedDeployment: null,
  anthropicKey: '',
};

const REPORTS_KEY = 'abap_inspector_reports';
const MAX_REPORTS  = 15;
const S4_KEY       = 'abap_inspector_s4config';

function loadSavedConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const { keys, anthropicKey, token, ...saved } = JSON.parse(raw);
      return { ...defaultAiConfig, ...saved };
    }
  } catch {}
  return defaultAiConfig;
}

function loadReports() {
  try { return JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]'); } catch { return []; }
}

function loadS4Config() {
  try { return JSON.parse(localStorage.getItem(S4_KEY) || 'null'); } catch { return null; }
}

function saveReport(analysis, modelLabel) {
  const reports = loadReports();
  const entry = {
    id: Date.now().toString(),
    programName: analysis?.programInfo?.name || 'Unknown',
    programType: analysis?.programInfo?.type || '',
    programTitle: analysis?.programInfo?.title || '',
    date: new Date().toISOString(),
    modelLabel: modelLabel || 'AI',
    screenCount: analysis?.screens?.length || 0,
    pboCount: analysis?.pboModules?.length || 0,
    paiCount: analysis?.paiModules?.length || 0,
    validationCount: analysis?.validations?.length || 0,
    zTableCount: analysis?.databaseTables?.zTables?.length || 0,
    author: '',
    notes: '',
    changeLog: [],
    analysis,
  };
  const updated = [entry, ...reports].slice(0, MAX_REPORTS);
  try { localStorage.setItem(REPORTS_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

/* ── Landing Page ─────────────────────────────────────────────────────────── */

const KEYWORDS = [
  'MODULE', 'ENDMODULE', 'PROCESS BEFORE OUTPUT', 'PROCESS AFTER INPUT',
  'SELECT', 'LOOP AT', 'READ TABLE', 'CALL SCREEN', 'LEAVE PROGRAM',
  'SET PF-STATUS', 'MESSAGE', 'DATA:', 'TYPES:', 'FORM', 'ENDFORM',
  'PERFORM', 'MOVE', 'CLEAR', 'TABLES:', 'AT SELECTION-SCREEN',
];

const KW_POSITIONS = [
  { top:'8%',  left:'3%',  dur:'18s', delay:'0s',   r:'-6deg'  },
  { top:'14%', right:'5%', dur:'22s', delay:'3s',   r:'4deg'   },
  { top:'28%', left:'1%',  dur:'20s', delay:'7s',   r:'-3deg'  },
  { top:'42%', right:'2%', dur:'25s', delay:'1.5s', r:'5deg'   },
  { top:'60%', left:'4%',  dur:'17s', delay:'5s',   r:'-7deg'  },
  { top:'72%', right:'6%', dur:'23s', delay:'9s',   r:'3deg'   },
  { top:'85%', left:'8%',  dur:'19s', delay:'2s',   r:'-4deg'  },
  { top:'20%', left:'42%', dur:'26s', delay:'11s',  r:'2deg'   },
  { top:'78%', left:'55%', dur:'21s', delay:'6s',   r:'-5deg'  },
];

function LandingPage({ onEnter }) {
  return (
    <div className="lp-wrap" id="lp-wrap">
      <div className="lp-grid" />
      <div className="lp-orb-1" /><div className="lp-orb-2" />
      <div className="lp-orb-3" /><div className="lp-orb-4" />

      {KW_POSITIONS.map((pos, i) => (
        <span key={i} className="lp-kw" style={{
          top: pos.top, left: pos.left, right: pos.right,
          '--dur': pos.dur, '--delay': pos.delay, '--r': pos.r,
        }}>
          {KEYWORDS[i % KEYWORDS.length]}
        </span>
      ))}

      <div className="lp-content">

        <div className="lp-logo">
          <div className="lp-logo-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
            </svg>
          </div>
          <div className="lp-logo-text">
            <div className="lp-logo-name">ABAP Inspector</div>
            <div className="lp-logo-sub">Deep Technical Analyzer</div>
          </div>
        </div>

        <h1 className="lp-h1">
          Instant Documentation for<br/>
          <span className="lp-grad">Any SAP ABAP Program</span>
        </h1>

        <p className="lp-sub">
          Paste any Module Pool, Dialogue, or Function program.
          Get 15-section technical reports — screens, PBO/PAI logic,
          Z-tables, validations, mockups — in under 3 minutes.
        </p>

        <div className="lp-cards">
          <div className="lp-card">
            <div className="lp-card-icon">🖥</div>
            <div className="lp-card-title">Screen Flow</div>
            <div className="lp-card-desc">PBO / PAI modules, GUI status, screen mockups</div>
          </div>
          <div className="lp-card">
            <div className="lp-card-icon">🗄</div>
            <div className="lp-card-title">Data & Tables</div>
            <div className="lp-card-desc">Z-tables, SAP standards, field-level analysis</div>
          </div>
          <div className="lp-card">
            <div className="lp-card-icon">⚙️</div>
            <div className="lp-card-title">Logic & Rules</div>
            <div className="lp-card-desc">Validations, BAPIs, enhancements, dependencies</div>
          </div>
        </div>

        <button className="lp-btn" onClick={onEnter}>
          Start Analyzing
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>

        <div className="lp-divider" />

        <div className="lp-stats">
          <span>15 Analysis Sections</span>
          <span className="lp-stats-dot"/>
          <span>Print-Ready PDF</span>
          <span className="lp-stats-dot"/>
          <span>Stored Reports</span>
          <span className="lp-stats-dot"/>
          <span>SAP AI Core</span>
        </div>
      </div>
    </div>
  );
}

/* ── App ──────────────────────────────────────────────────────────────────── */

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [view, setView] = useState('upload');
  const [analysis, setAnalysis] = useState(null);
  const [progress, setProgress] = useState({ step: 0, total: 7, message: 'Initializing...' });
  const [analysisDone, setAnalysisDone] = useState(false);
  const [error, setError] = useState(null);
  const [aiConfig, setAiConfig] = useState(loadSavedConfig);
  const [reports, setReports]   = useState(loadReports);
  const [s4Config, setS4Config] = useState(loadS4Config);

  function handleS4ConfigChange(cfg) {
    setS4Config(cfg);
    try {
      if (cfg) localStorage.setItem(S4_KEY, JSON.stringify(cfg));
      else     localStorage.removeItem(S4_KEY);
    } catch {}
  }

  // Persist non-sensitive config to localStorage (exclude keys/secrets)
  useEffect(() => {
    const { token, keys, anthropicKey, ...toSave } = aiConfig;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [aiConfig]);

  function handleEnter() {
    const el = document.getElementById('lp-wrap');
    if (el) { el.style.opacity = '0'; setTimeout(() => setShowLanding(false), 400); }
    else setShowLanding(false);
  }

  function handleShowLanding() {
    setShowLanding(true);
  }

  function updateReport(updated) {
    const next = reports.map(r => r.id === updated.id ? updated : r);
    setReports(next);
    try { localStorage.setItem(REPORTS_KEY, JSON.stringify(next)); } catch {}
  }

  const handleAnalyze = async (code, isFile, file) => {
    setView('analyzing');
    setAnalysisDone(false);
    setError(null);

    try {
      let body, headers = {};
      const { provider, keys, token, selectedDeployment, anthropicKey } = aiConfig;

      // Smart provider selection:
      // If AI Core is selected but not fully configured, fall back to Anthropic (server key or user key)
      const aicoreReady = provider === 'aicore' && !!selectedDeployment?.id && !!token && !!keys;
      const effectiveProvider = aicoreReady ? 'aicore' : 'anthropic';

      const keysWithModel = keys
        ? { ...keys, _selectedModelName: selectedDeployment?.modelName || '' }
        : null;

      if (isFile && file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('provider', effectiveProvider);
        if (effectiveProvider === 'aicore') {
          fd.append('deploymentId', selectedDeployment?.id || '');
          fd.append('token', token);
          fd.append('aicoreKeys', JSON.stringify(keysWithModel));
        } else {
          fd.append('anthropicKey', anthropicKey || '');
        }
        body = fd;
      } else {
        const payload = { code, provider: effectiveProvider };
        if (effectiveProvider === 'aicore') {
          payload.deploymentId = selectedDeployment?.id;
          payload.token = token;
          payload.aicoreKeys = keysWithModel;
        } else {
          payload.anthropicKey = anthropicKey || '';
        }
        body = JSON.stringify(payload);
        headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch('/api/analyze', { method: 'POST', body, headers });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotComplete = false;

      const processLine = (line) => {
        if (!line.startsWith('data: ')) return;
        let data;
        try { data = JSON.parse(line.slice(6)); } catch (e) {
          // Partial/malformed SSE line — skip silently
          return;
        }
        if (data.type === 'progress') {
          setProgress({ step: data.step, total: data.total, message: data.message });
        } else if (data.type === 'complete') {
          gotComplete = true;
          const saved = saveReport(data.analysis, modelLabel);
          setReports(saved);
          setAnalysisDone(true);
          setTimeout(() => {
            setAnalysis(data.analysis);
            setView('results');
          }, 1200);
        } else if (data.type === 'error') {
          gotComplete = true; // treat error as "done"
          setError(data.message);
          setView('upload');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffered data before exiting
          if (buffer) buffer.split('\n').forEach(processLine);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last potentially incomplete line
        lines.forEach(processLine);
      }

      if (!gotComplete) {
        throw new Error('Analysis stream ended without a result. The AI may have timed out — please try again.');
      }
    } catch (err) {
      setError(err.message);
      setView('upload');
    }
  };

  const modelLabel = aiConfig.provider === 'aicore'
    ? aiConfig.selectedDeployment?.displayName
    : aiConfig.anthropicKey ? 'Claude (Direct)' : null;

  return (
    <>
      {showLanding && <LandingPage onEnter={handleEnter} />}
      <div style={{ display: showLanding ? 'none' : undefined }} className="min-h-screen bg-slate-100">
        {view === 'upload' && (
          <UploadPage
            onAnalyze={handleAnalyze}
            error={error}
            aiConfig={aiConfig}
            onAiConfigChange={setAiConfig}
            reportCount={reports.length}
            onOpenDashboard={() => setView('dashboard')}
            onOpenS4={() => setView('s4')}
            s4Connected={!!s4Config?.connected}
            onGoHome={handleShowLanding}
          />
        )}
        {view === 'analyzing' && (
          <LoadingPage progress={progress} modelLabel={modelLabel} isDone={analysisDone} />
        )}
        {view === 'results' && analysis && (
          <ResultsPage
            analysis={analysis}
            modelLabel={modelLabel}
            onBack={() => { setView('upload'); setAnalysis(null); }}
            onGoHome={handleShowLanding}
          />
        )}
        {view === 'dashboard' && (
          <DocumentsPage
            reports={reports}
            onView={(r) => { setAnalysis(r.analysis); setView('results'); }}
            onDelete={(id) => {
              const updated = reports.filter(r => r.id !== id);
              setReports(updated);
              try { localStorage.setItem(REPORTS_KEY, JSON.stringify(updated)); } catch {}
            }}
            onUpdate={updateReport}
            onBack={() => setView('upload')}
            onGoHome={handleShowLanding}
          />
        )}
        {view === 's4' && (
          <S4Panel
            s4Config={s4Config}
            onS4ConfigChange={handleS4ConfigChange}
            onAnalyze={(code) => {
              setView('upload');
              setTimeout(() => handleAnalyze(code, false, null), 50);
            }}
            onBack={() => setView('upload')}
            onGoHome={handleShowLanding}
          />
        )}
      </div>
      {!showLanding && (
        <ChatPanel
          aiConfig={aiConfig}
          analysis={view === 'results' ? analysis : null}
        />
      )}
    </>
  );
}
