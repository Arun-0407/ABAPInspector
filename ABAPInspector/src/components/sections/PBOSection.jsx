import { useState } from 'react';
import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

const LineByLine = ({ lines }) => (
  lines?.length > 0 ? (
    <div className="overflow-x-auto rounded-lg border border-gray-100 mt-3">
      <table className="w-full text-xs">
        <thead><tr className="bg-gray-50 text-gray-400 uppercase">
          <th className="px-3 py-2 text-left w-8">#</th>
          <th className="px-3 py-2 text-left w-2/5">Code Line</th>
          <th className="px-3 py-2 text-left">Explanation</th>
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2 text-gray-400">{l.lineNum || i + 1}</td>
              <td className="px-3 py-2 font-mono text-[#003366] whitespace-pre-wrap">{l.code}</td>
              <td className="px-3 py-2 text-gray-700">{l.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null
);

const ModuleCard = ({ mod, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 bg-green-50 cursor-pointer hover:bg-green-100"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 bg-green-600 text-white rounded text-xs font-bold flex items-center justify-center">{index + 1}</span>
          <span className="font-mono font-bold text-[#003366] text-sm">{mod.name}</span>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">PBO</span>
          {(mod.screens || []).map(s => (
            <span key={s} className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border">Screen {s}</span>
          ))}
        </div>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="p-4 space-y-4 bg-white">
          {mod.purpose && (
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-green-700 mb-1">Purpose</div>
              <p className="text-sm text-gray-700">{mod.purpose}</p>
            </div>
          )}

          {mod.explanation && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700 leading-relaxed">{mod.explanation}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {mod.setsGUIStatus && (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="font-semibold text-blue-600 mb-1">Sets GUI Status</div>
                <span className="font-mono text-[#003366]">{mod.setsGUIStatus}</span>
              </div>
            )}
            {mod.setsTitleBar && (
              <div className="bg-indigo-50 rounded-lg p-3">
                <div className="font-semibold text-indigo-600 mb-1">Sets Title Bar</div>
                <span className="font-mono text-[#003366]">{mod.setsTitleBar}</span>
              </div>
            )}
            {mod.callsSubroutines?.length > 0 && (
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="font-semibold text-purple-600 mb-1">Calls Subroutines</div>
                {mod.callsSubroutines.map(s => <div key={s} className="font-mono text-[#003366]">{s}</div>)}
              </div>
            )}
          </div>

          {mod.fullCode && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Full Source Code</div>
              <CodeBlock code={mod.fullCode} title={`MODULE ${mod.name} OUTPUT`} />
            </div>
          )}

          <LineByLine lines={mod.lineByLine} />
        </div>
      )}
    </div>
  );
};

export default function PBOSection({ data }) {
  if (!data?.length) return null;
  return (
    <SectionCard title="PBO Modules — Process Before Output" icon="▶" badge={`${data.length} modules`}>
      <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-100 text-sm text-gray-700">
        <strong className="text-green-700">PBO (Process Before Output)</strong> modules run before a screen is displayed. They set the GUI status, populate fields, initialize table controls, and control screen element visibility/editability.
      </div>
      <div className="space-y-3">
        {data.map((mod, i) => <ModuleCard key={i} mod={mod} index={i} />)}
      </div>
    </SectionCard>
  );
}
