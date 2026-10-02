import { useState } from 'react';
import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

export default function F4Help({ data }) {
  const [selected, setSelected] = useState(null);
  if (!data?.length) return null;

  return (
    <SectionCard title="F4 Help — Process On Value-Request (POV)" icon="🔍" badge={`${data.length} F4 handlers`}>
      <div className="mb-4 p-3 bg-purple-50 rounded-xl border border-purple-100 text-sm text-gray-700">
        <strong className="text-purple-700">F4 Help (POV)</strong> is triggered when the user presses F4 on an input field. The PROCESS ON VALUE-REQUEST section in screen flow calls a MODULE which provides a popup value selection dialog, typically using <code className="font-mono bg-white px-1 rounded">F4IF_INT_TABLE_VALUE_REQUEST</code> or custom selection screens.
      </div>

      <div className="space-y-3">
        {data.map((f4, i) => (
          <div key={i} className="border border-purple-100 rounded-xl overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3 bg-purple-50 cursor-pointer hover:bg-purple-100"
              onClick={() => setSelected(selected === i ? null : i)}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono font-bold text-[#003366]">{f4.field}</span>
                <span className="text-xs text-gray-500">→</span>
                <span className="font-mono text-sm text-purple-700">{f4.moduleName}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  f4.type?.includes('Custom') ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                }`}>{f4.type || 'Custom F4'}</span>
                {f4.screen && <span className="text-xs text-gray-400">Screen {f4.screen}</span>}
              </div>
              <span className="text-gray-400">{selected === i ? '▲' : '▼'}</span>
            </div>

            {selected === i && (
              <div className="p-4 space-y-4 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {f4.selectionTable && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Selection Table</div>
                      <span className="font-mono text-sm text-[#003366]">{f4.selectionTable}</span>
                    </div>
                  )}
                  {f4.returnField && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-xs font-semibold text-green-700 uppercase mb-1">Return Field</div>
                      <span className="font-mono text-sm text-[#003366]">{f4.returnField}</span>
                    </div>
                  )}
                  {f4.callFunctionUsed && (
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <div className="text-xs font-semibold text-indigo-700 uppercase mb-1">FM Used</div>
                      <span className="font-mono text-xs text-[#003366] break-all">{f4.callFunctionUsed}</span>
                    </div>
                  )}
                </div>

                {f4.explanation && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-700">{f4.explanation}</p>
                  </div>
                )}

                {f4.fullCode && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Full Module Code</div>
                    <CodeBlock code={f4.fullCode} title={`MODULE ${f4.moduleName} INPUT (POV)`} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
