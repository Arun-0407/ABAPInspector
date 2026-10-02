export default function DashboardPage({ reports, onOpen, onDelete, onBack, onGoHome }) {
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onGoHome && (
            <button onClick={onGoHome} className="lp-home-btn" title="Home">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </button>
          )}
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/>
            </svg>
            New Analysis
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-none">Reports Dashboard</div>
              <div className="text-slate-500 text-[10px] mt-0.5">{reports.length} saved · last {MAX_REPORTS} kept</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">Stored locally in your browser</div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <p className="text-slate-500 font-semibold mb-1">No reports yet</p>
            <p className="text-slate-400 text-sm">Analyze an ABAP program and it will appear here automatically.</p>
            <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
              Start Analyzing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
            {reports.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                {/* Card header */}
                <div className="px-5 pt-4 pb-3 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-mono font-bold text-slate-800 text-sm truncate">{r.programName}</h3>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{r.programTitle || r.programType}</p>
                </div>

                {/* Stats */}
                <div className="px-5 py-3 flex flex-wrap gap-2">
                  {[
                    { label: 'Screens', val: r.screenCount },
                    { label: 'PBO', val: r.pboCount },
                    { label: 'PAI', val: r.paiCount },
                    { label: 'Validations', val: r.validationCount },
                    { label: 'Z-Tables', val: r.zTableCount },
                  ].filter(s => s.val > 0).map(s => (
                    <span key={s.label} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                      {s.val} {s.label}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400">{fmt(r.date)}</div>
                    {r.modelLabel && (
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]">via {r.modelLabel}</div>
                    )}
                  </div>
                  <button
                    onClick={() => onOpen(r)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    View Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MAX_REPORTS = 15;
