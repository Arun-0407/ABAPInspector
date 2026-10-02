import SectionCard from '../SectionCard';

const InfoGrid = ({ items }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {items.filter(i => i.value).map(({ label, value, mono, wide }) => (
      <div key={label} className={`bg-gray-50 rounded-xl p-4 ${wide ? 'md:col-span-2' : ''}`}>
        <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</div>
        <div className={`text-sm text-gray-800 ${mono ? 'font-mono font-bold text-[#003366]' : ''}`}>{value}</div>
      </div>
    ))}
  </div>
);

export default function ProgramOverview({ data }) {
  if (!data) return null;

  return (
    <SectionCard title="Program Overview" icon="📌" badge={data.programClass || 'Module Pool'}>
      <div className="space-y-5">
        {/* Key info */}
        <InfoGrid items={[
          { label: 'Program Name', value: data.name, mono: true },
          { label: 'Title', value: data.title },
          { label: 'Program Type', value: data.type || 'Module Pool / Dialogue Program' },
          { label: 'Program Class', value: data.programClass },
          { label: 'Author', value: data.authorIfFound },
          { label: 'Package / Dev. Class', value: data.packageIfFound },
          { label: 'Logical System', value: data.logicalSystem },
        ]} />

        {/* Objective */}
        {data.objective && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              🎯 Program Objective
            </h3>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
              {data.objective}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
