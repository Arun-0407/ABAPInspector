import { useState, useRef, useEffect } from 'react';

function renderMd(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:11px;overflow-x:auto;margin:6px 0;white-space:pre-wrap"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;border:1px solid #e2e8f0;padding:1px 5px;border-radius:4px;font-size:11px;font-family:monospace">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<div style="font-size:12px;font-weight:700;color:#1e293b;margin:10px 0 4px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-size:13px;font-weight:700;color:#1e293b;margin:10px 0 4px">$1</div>')
    .replace(/^[-*] (.+)$/gm, '<div style="padding-left:14px;margin:2px 0;position:relative"><span style="position:absolute;left:4px;color:#94a3b8">•</span>$1</div>')
    .replace(/^\d+\. (.+)$/gm, '<div style="padding-left:16px;margin:2px 0">$1</div>')
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/\n/g, '<br/>');
}

const GENERAL_STARTERS = [
  'What is Module Pool programming?',
  'Explain PBO and PAI modules',
  'What is DYNPRO in SAP?',
  'ABAP best practices for performance',
];

export default function ChatPanel({ aiConfig, analysis }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [useContext, setUseContext] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const starters = analysis ? [
    `What does ${analysis?.programInfo?.name || 'this program'} do?`,
    'List all screens and their purpose',
    'Explain the PAI modules',
    'What database tables are accessed?',
  ] : GENERAL_STARTERS;

  async function send(text) {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput('');
    setLoading(true);

    try {
      const systemContext = useContext && analysis
        ? `The user is viewing this ABAP program analysis:\n` +
          `Program: ${analysis.programInfo?.name}\n` +
          `Title: ${analysis.programInfo?.title}\n` +
          `Type: ${analysis.programInfo?.type}\n` +
          `Objective: ${analysis.programInfo?.objective}\n` +
          `Screens: ${analysis.screens?.map(s => `${s.number} (${s.title})`).join(', ') || 'none'}\n` +
          `PBO Modules: ${analysis.pboModules?.map(m => m.name).join(', ') || 'none'}\n` +
          `PAI Modules: ${analysis.paiModules?.map(m => m.name).join(', ') || 'none'}\n` +
          `Z-Tables: ${analysis.databaseTables?.zTables?.map(t => t.name).join(', ') || 'none'}\n` +
          `Overall Flow: ${analysis.overallFlow || ''}\n` +
          `Answer questions about this specific ABAP program.`
        : null;

      const { provider, keys, token, selectedDeployment, anthropicKey } = aiConfig;
      const keysWithModel = keys
        ? { ...keys, _selectedModelName: selectedDeployment?.modelName || '' }
        : null;

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMsgs,
          systemContext,
          provider,
          deploymentId: selectedDeployment?.id || '',
          token,
          aicoreKeys: keysWithModel,
          anthropicKey,
        }),
      });

      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Unexpected server response (${resp.status}). Please reload the page and try again.`);
      }
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  const modelLabel = aiConfig?.selectedDeployment?.displayName ||
    (aiConfig?.anthropicKey ? 'Claude' : null);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed z-40 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-all"
        style={{ bottom: '24px', right: '24px', boxShadow: open ? '0 4px 20px rgba(37,99,235,0.5)' : undefined,
          animation: open ? 'none' : 'btn-pulse 2.4s ease-in-out infinite' }}
        title="Ask AI"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          style={{ bottom: '88px', right: '24px', width: '390px', height: '520px', animation: 'slide-up 0.22s ease forwards' }}
        >
          {/* Panel header */}
          <div className="bg-slate-900 px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm leading-none">ABAP Inspector AI</div>
              <div className="text-slate-400 text-[10px] mt-0.5 truncate">
                {modelLabel ? `Using ${modelLabel}` : 'No AI model connected'}
              </div>
            </div>

            {analysis && (
              <button
                onClick={() => setUseContext(u => !u)}
                className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                  useContext ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                title="Toggle document context"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Doc
              </button>
            )}

            <button onClick={() => setMessages([])} title="Clear conversation"
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <p className="text-slate-500 text-sm font-medium mb-1">Ask me anything</p>
                <p className="text-slate-400 text-xs mb-4">
                  {analysis && !useContext ? 'Enable "Doc" to ask about the current program.' : 'Try one of these:'}
                </p>
                <div className="flex flex-col gap-2">
                  {starters.map(q => (
                    <button key={q} onClick={() => send(q)}
                      className="text-left text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mb-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                  </div>
                )}
                <div className={`max-w-[80%] px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-bl-sm shadow-sm'
                }`}>
                  {m.role === 'assistant'
                    ? <div dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />
                    : m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400"
                        style={{ animation: 'pulse-glow 1s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input bar */}
          <div className="px-3 py-3 bg-white border-t border-slate-200 shrink-0">
            {useContext && analysis && (
              <div className="flex items-center gap-1.5 text-[10px] text-blue-600 font-semibold mb-2 px-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                Asking about: {analysis.programInfo?.name}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                placeholder={useContext ? 'Ask about this ABAP program…' : 'Ask about ABAP, SAP, or this app…'}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0">
                <svg className="w-4 h-4" style={{ transform: 'rotate(90deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
