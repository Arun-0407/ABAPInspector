import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

export default function TopModule({ data }) {
  if (!data || !data.exists) return null;

  return (
    <SectionCard title="Top Module — LOAD-OF-PROGRAM" icon="🔝">
      <div className="space-y-4">
        {data.purpose && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <div className="text-xs font-semibold text-amber-700 uppercase mb-1">Purpose</div>
            <p className="text-sm text-gray-700">{data.purpose}</p>
          </div>
        )}

        {data.explanation && (
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Explanation</h3>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4">{data.explanation}</p>
          </div>
        )}

        {data.code && (
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Source Code</h3>
            <CodeBlock code={data.code} title="LOAD-OF-PROGRAM" />
          </div>
        )}

        {data.lineByLine?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Line-by-Line Explanation</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <th className="px-3 py-2 text-left w-12">#</th>
                    <th className="px-3 py-2 text-left w-2/5">Code</th>
                    <th className="px-3 py-2 text-left">Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lineByLine.map((l, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-gray-400 text-xs">{l.lineNum || i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#003366] whitespace-pre-wrap">{l.code}</td>
                      <td className="px-3 py-2 text-gray-700 text-xs">{l.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
