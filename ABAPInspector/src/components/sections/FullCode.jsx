import { useState } from 'react';
import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

const sectionTypeColors = {
  'declaration': 'bg-blue-100 text-blue-700',
  'screenLogic': 'bg-green-100 text-green-700',
  'pboModule': 'bg-emerald-100 text-emerald-700',
  'paiModule': 'bg-orange-100 text-orange-700',
  'form': 'bg-purple-100 text-purple-700',
  'event': 'bg-teal-100 text-teal-700',
};

export default function FullCode({ data }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  if (!data?.length) return null;

  const types = [...new Set(data.map(d => d.sectionType).filter(Boolean))];

  const filtered = data.filter(s => {
    const matchType = filter === 'all' || s.sectionType === filter;
    const matchSearch = !search || s.section?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <SectionCard title="Full Code with Explanation" icon="📖" badge={`${data.length} sections`}>
      <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
        The entire program source code broken into logical sections with line-by-line technical explanations. Every section includes its purpose, how it connects to other parts of the program, and detailed commentary.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sections..."
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0070f2] w-48"
        />
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          All ({data.length})
        </button>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {filtered.map((section, i) => (
          <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Section header */}
            <div className="flex items-start justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-400">{section.sequence || i + 1}</span>
                <h3 className="font-semibold text-[#003366] text-sm">{section.section}</h3>
                {section.sectionType && (
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sectionTypeColors[section.sectionType] || 'bg-gray-100 text-gray-600'}`}>
                    {section.sectionType}
                  </span>
                )}
              </div>
              {section.relatesTo?.length > 0 && (
                <div className="text-xs text-gray-400 shrink-0 ml-2">
                  → {section.relatesTo.join(', ')}
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Explanation */}
              {section.explanation && (
                <div className="bg-blue-50 border-l-4 border-blue-300 rounded-r-lg px-4 py-3">
                  <p className="text-sm text-gray-700 leading-relaxed">{section.explanation}</p>
                </div>
              )}

              {/* Source code */}
              {section.code && (
                <CodeBlock code={section.code} title={section.section} />
              )}

              {/* Line-by-line */}
              {section.lineByLine?.length > 0 && (
                <details>
                  <summary className="text-xs text-[#0070f2] cursor-pointer hover:underline font-medium">
                    📋 View Line-by-Line Explanation ({section.lineByLine.length} lines) →
                  </summary>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-gray-50 text-gray-400 uppercase">
                        <th className="px-3 py-2 text-left w-8">#</th>
                        <th className="px-3 py-2 text-left w-2/5">Code</th>
                        <th className="px-3 py-2 text-left">Explanation</th>
                      </tr></thead>
                      <tbody>
                        {section.lineByLine.map((l, j) => (
                          <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-gray-400">{l.lineNum || j + 1}</td>
                            <td className="px-3 py-2 font-mono text-[#003366] whitespace-pre-wrap">{l.code}</td>
                            <td className="px-3 py-2 text-gray-700">{l.explanation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">No sections match your filter</div>
      )}
    </SectionCard>
  );
}
