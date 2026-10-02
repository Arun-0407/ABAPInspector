export default function Sidebar({ analysis, activeSection, onNavigate }) {
  const screens = analysis?.screens || [];
  const hasPBO = (analysis?.pboModules?.length || 0) > 0;
  const hasPAI = (analysis?.paiModules?.length || 0) > 0;
  const hasGUI = (analysis?.guiStatuses?.length || 0) > 0;
  const hasFCodes = (analysis?.functionCodes?.length || 0) > 0;
  const hasF4 = (analysis?.f4HelpPOV?.length || 0) > 0;
  const hasTC = (analysis?.tableControls?.length || 0) > 0;
  const hasVal = (analysis?.validations?.length || 0) > 0;
  const hasSubs = (analysis?.subroutines?.length || 0) > 0 || (analysis?.events?.length || 0) > 0;
  const hasFlow = !!(analysis?.overallFlow || analysis?.keyBusinessLogic);
  const hasTopModule = analysis?.programInfo?.topModule?.exists;

  const Item = ({ id, label, icon, badge }) => {
    const active = activeSection === id;
    return (
      <button
        onClick={() => onNavigate(id)}
        className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all group ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
      >
        <div className={`w-0.5 h-4 rounded-full shrink-0 transition-all ${active ? 'bg-blue-500' : 'bg-transparent group-hover:bg-slate-300'}`} />
        <span className="shrink-0 text-sm leading-none">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {badge !== undefined && badge !== null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  const Group = ({ label }) => (
    <div className="px-3 pt-4 pb-1.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );

  return (
    <div className="w-56 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
            </svg>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 leading-tight">ABAP Inspector</div>
            <div className="text-[9px] text-slate-400 leading-tight">Technical Analysis</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1 px-1.5">
        <Group label="Program" />
        <Item id="overview" label="Program Overview" icon="📌" />
        {hasTopModule && <Item id="topmodule" label="Top Module" icon="🔝" />}
        <Item id="global" label="Global Declarations" icon="📋" />
        <Item id="dbtables" label="Database Tables" icon="🗄️" badge={(analysis?.databaseTables?.zTables?.length || 0) + (analysis?.databaseTables?.standardTables?.length || 0)} />

        {screens.length > 0 && (
          <>
            <Group label={`Screens · ${screens.length}`} />
            {screens.map((s, i) => (
              <Item key={i} id={`screen-${s.number}`} label={`Screen ${s.number}${s.title ? ' — ' + s.title.slice(0, 14) : ''}`} icon="🖥️" />
            ))}
          </>
        )}

        <Group label="Modules" />
        {hasPBO && <Item id="pbo" label="PBO Modules" icon="▶" badge={analysis.pboModules.length} />}
        {hasPAI && <Item id="pai" label="PAI Modules" icon="◀" badge={analysis.paiModules.length} />}

        <Group label="UI Logic" />
        {hasGUI && <Item id="gui" label="GUI Status" icon="🔘" badge={analysis.guiStatuses.length} />}
        {hasFCodes && <Item id="fcodes" label="Function Codes" icon="⌨️" badge={analysis.functionCodes.length} />}
        {hasF4 && <Item id="f4" label="F4 Help / POV" icon="🔍" badge={analysis.f4HelpPOV.length} />}

        <Group label="Data & Validation" />
        {hasTC && <Item id="tablecontrol" label="Table Controls" icon="📊" badge={analysis.tableControls.length} />}
        {hasVal && <Item id="validations" label="Validations" icon="✅" badge={analysis.validations.length} />}
        {hasSubs && <Item id="subroutines" label="Subroutines & Events" icon="⚙️" />}

        <Group label="Docs" />
        <Item id="fullcode" label="Full Code + Explanation" icon="📖" />
        {hasFlow && <Item id="flow" label="Overall Flow" icon="🔄" />}
      </nav>

      {/* Footer stats */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'Screens', val: analysis?.screens?.length || 0, color: 'text-blue-600' },
            { label: 'Modules', val: (analysis?.pboModules?.length || 0) + (analysis?.paiModules?.length || 0), color: 'text-orange-500' },
            { label: 'DB Tables', val: (analysis?.databaseTables?.zTables?.length || 0) + (analysis?.databaseTables?.standardTables?.length || 0), color: 'text-purple-600' },
            { label: 'Validations', val: analysis?.validations?.length || 0, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className={`text-sm font-bold leading-none ${s.color}`}>{s.val}</div>
              <div className="text-[9px] text-slate-400 mt-0.5 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
