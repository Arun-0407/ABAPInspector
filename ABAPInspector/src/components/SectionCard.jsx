export default function SectionCard({ title, icon, badge, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-lg leading-none">{icon}</span>}
          <h2 className="font-bold text-slate-800 text-sm">{title}</h2>
        </div>
        {badge && (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[11px] rounded-full font-semibold border border-slate-200">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
