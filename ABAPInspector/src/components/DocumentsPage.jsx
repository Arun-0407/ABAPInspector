import { useState, useMemo } from 'react';

function getSummary(r) {
  const a = r.analysis;
  const raw = a?.overallFlow || a?.keyBusinessLogic || a?.programInfo?.objective || '';
  return raw.length > 180 ? raw.slice(0, 177) + '…' : raw || '—';
}

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtFull(iso) {
  const d = new Date(iso);
  return fmt(iso) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function DocumentsPage({ reports, onView, onDelete, onBack, onGoHome, onUpdate }) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: '', notes: '', author: '' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(r =>
      (r.programName || '').toLowerCase().includes(q) ||
      (r.editedTitle || r.programTitle || '').toLowerCase().includes(q) ||
      (r.programType || '').toLowerCase().includes(q) ||
      (r.author || '').toLowerCase().includes(q)
    );
  }, [reports, search]);

  function openEdit(r) {
    setEditDraft({
      title: r.editedTitle || r.programTitle || '',
      notes: r.notes || '',
      author: r.author || '',
    });
    setEditingId(r.id);
  }

  function saveEdit() {
    const report = reports.find(r => r.id === editingId);
    if (!report) return;
    const prev = { title: report.editedTitle || report.programTitle || '', notes: report.notes || '', author: report.author || '' };
    const changed = Object.keys(editDraft).filter(k => editDraft[k] !== prev[k] && editDraft[k] !== '');
    const updated = {
      ...report,
      editedTitle: editDraft.title || report.programTitle,
      notes: editDraft.notes,
      author: editDraft.author,
      changeLog: changed.length ? [
        ...(report.changeLog || []),
        { at: new Date().toISOString(), by: editDraft.author || 'User', fields: changed },
      ] : (report.changeLog || []),
    };
    onUpdate(updated);
    setEditingId(null);
  }

  const editing = editingId ? reports.find(r => r.id === editingId) : null;

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center gap-3 shrink-0">
        {onGoHome && (
          <button onClick={onGoHome} className="lp-home-btn" title="Home">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
          </button>
        )}
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/>
          </svg>
          Analyze
        </button>
        <div className="w-px h-4 bg-slate-700 shrink-0" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-none">Technical Documents</div>
            <div className="text-slate-500 text-[10px] mt-0.5">{reports.length} document{reports.length !== 1 ? 's' : ''} · stored locally</div>
          </div>
        </div>
        <div className="relative w-56 shrink-0">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg pl-8 pr-3 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <p className="text-slate-600 font-semibold mb-1">{search ? 'No matching documents' : 'No documents yet'}</p>
            <p className="text-slate-400 text-sm">{search ? 'Try a different search term.' : 'Analyze an ABAP program to generate your first document.'}</p>
            {!search && (
              <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
                Start Analyzing
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-7xl mx-auto">
            {/* Column headers */}
            <div className="grid items-center px-5 py-3 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
              style={{ gridTemplateColumns: '2fr 1.2fr 2.8fr 0.7fr 1fr auto' }}>
              <span>Object / Program</span>
              <span>Type · Author</span>
              <span>Auto Summary</span>
              <span>Screens</span>
              <span>Date</span>
              <span className="pr-1">Actions</span>
            </div>

            {filtered.map((r, i) => (
              <div key={r.id}
                className={`grid items-start px-5 py-4 gap-4 group transition-colors hover:bg-indigo-50/30 ${i < filtered.length - 1 ? 'border-b border-slate-100' : ''}`}
                style={{ gridTemplateColumns: '2fr 1.2fr 2.8fr 0.7fr 1fr auto' }}
              >
                {/* Object name */}
                <div className="min-w-0">
                  <button onClick={() => onView(r)}
                    className="font-mono font-bold text-slate-800 text-sm hover:text-blue-600 transition-colors text-left truncate block w-full">
                    {r.programName}
                  </button>
                  {(r.editedTitle || r.programTitle) && (
                    <div className="text-xs text-slate-400 mt-0.5 truncate">{r.editedTitle || r.programTitle}</div>
                  )}
                  {r.notes && (
                    <div className="text-xs text-indigo-500 mt-1 italic truncate" title={r.notes}>{r.notes}</div>
                  )}
                </div>

                {/* Type / Author */}
                <div>
                  <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                    {r.programType || 'Module Pool'}
                  </span>
                  <div className="flex items-center gap-1 mt-1.5">
                    <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    <span className="text-[11px] text-slate-500 truncate">{r.author || 'User'}</span>
                  </div>
                </div>

                {/* Summary */}
                <div className="text-xs text-slate-500 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {getSummary(r)}
                </div>

                {/* Screens */}
                <div>
                  <div className="text-sm font-bold text-slate-700">{r.screenCount || 0}</div>
                  <div className="text-[11px] text-slate-400">{(r.pboCount || 0) + (r.paiCount || 0)} mod</div>
                </div>

                {/* Date */}
                <div>
                  <div className="text-xs text-slate-600">{fmt(r.date)}</div>
                  {r.changeLog?.length > 0 && (
                    <div className="text-[11px] text-amber-500 mt-0.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                      Edited ×{r.changeLog.length}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onView(r)} title="View Report"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" aria-label="View">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  </button>
                  <button onClick={() => openEdit(r)} title="Edit Document"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" aria-label="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button onClick={() => onDelete(r.id)} title="Delete"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100" aria-label="Delete">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={e => e.target === e.currentTarget && setEditingId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" style={{ animation: 'slide-up 0.2s ease forwards' }}>
            {/* Modal header */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Edit Document</h3>
                <p className="font-mono text-xs text-slate-400 mt-0.5">{editing.programName}</p>
              </div>
              <button onClick={() => setEditingId(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Document Title</label>
                <input value={editDraft.title} onChange={e => setEditDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Descriptive document title…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Author / Analyst</label>
                <input value={editDraft.author} onChange={e => setEditDraft(d => ({ ...d, author: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Your name…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes / Remarks</label>
                <textarea value={editDraft.notes} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))}
                  rows={3} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  placeholder="Add context, remarks, or business notes about this document…" />
              </div>

              {editing.changeLog?.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Change History ({editing.changeLog.length})
                  </label>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-32 overflow-y-auto">
                    {[...editing.changeLog].reverse().map((entry, i) => (
                      <div key={i} className="px-3 py-2 text-xs text-slate-600 flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {editing.changeLog.length - i}
                        </span>
                        <div>
                          <span className="font-semibold">{entry.by}</span>
                          {' edited '}
                          <span className="text-indigo-600">{entry.fields.join(', ')}</span>
                          <span className="text-slate-400"> · {fmtFull(entry.at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors">Cancel</button>
              <button onClick={saveEdit} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
