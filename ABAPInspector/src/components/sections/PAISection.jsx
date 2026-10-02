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
        className="flex items-center justify-between px-4 py-3 bg-orange-50 cursor-pointer hover:bg-orange-100"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-6 h-6 bg-orange-600 text-white rounded text-xs font-bold flex items-center justify-center">{index + 1}</span>
          <span className="font-mono font-bold text-[#003366] text-sm">{mod.name}</span>
          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">PAI</span>
          {(mod.screens || []).map(s => (
            <span key={s} className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded border">Screen {s}</span>
          ))}
          {mod.triggerCondition && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
              {mod.triggerCondition}
            </span>
          )}
        </div>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="p-4 space-y-4 bg-white">
          {mod.purpose && (
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-orange-700 mb-1">Purpose</div>
              <p className="text-sm text-gray-700">{mod.purpose}</p>
            </div>
          )}

          {mod.explanation && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700 leading-relaxed">{mod.explanation}</p>
            </div>
          )}

          {/* Handled Function Codes */}
          {mod.handledFunctionCodes?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Handled Function Codes</div>
              <div className="flex flex-wrap gap-2">
                {mod.handledFunctionCodes.map((fc, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg px-3 py-2">
                    <span className="font-mono font-bold text-[#0070f2] text-sm">{typeof fc === 'object' ? fc.fcode : fc}</span>
                    {typeof fc === 'object' && fc.description && (
                      <span className="ml-2 text-xs text-gray-500">→ {fc.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validations */}
          {mod.validationsPerformed?.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-yellow-700 uppercase mb-1">Validations Performed</div>
              <ul className="list-disc ml-4 space-y-0.5">
                {mod.validationsPerformed.map((v, i) => <li key={i} className="text-xs text-gray-700">{v}</li>)}
              </ul>
            </div>
          )}

          {/* DB Operations */}
          {mod.dbOperations?.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Database Operations</div>
              <ul className="list-disc ml-4 space-y-0.5">
                {mod.dbOperations.map((op, i) => <li key={i} className="text-xs text-gray-700 font-mono">{op}</li>)}
              </ul>
            </div>
          )}

          {mod.fullCode && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Full Source Code</div>
              <CodeBlock code={mod.fullCode} title={`MODULE ${mod.name} INPUT`} />
            </div>
          )}

          <LineByLine lines={mod.lineByLine} />
        </div>
      )}
    </div>
  );
};

export default function PAISection({ data }) {
  if (!data?.length) return null;
  return (
    <SectionCard title="PAI Modules — Process After Input" icon="◀" badge={`${data.length} modules`}>
      <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100 text-sm text-gray-700">
        <strong className="text-orange-700">PAI (Process After Input)</strong> modules run after the user takes an action on the screen (presses Enter, clicks a button, or uses a menu). They process function codes (SY-UCOMM), validate inputs, execute business logic, perform database operations, and navigate to other screens.
      </div>
      <div className="space-y-3">
        {data.map((mod, i) => <ModuleCard key={i} mod={mod} index={i} />)}
      </div>
    </SectionCard>
  );
}
