import { useState } from 'react';
import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

const ColumnTable = ({ columns }) => (
  columns?.length > 0 ? (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-xs">
        <thead><tr className="bg-gray-50 text-gray-400 uppercase">
          <th className="px-3 py-2 text-left">#</th>
          <th className="px-3 py-2 text-left">Column Name</th>
          <th className="px-3 py-2 text-left">Field</th>
          <th className="px-3 py-2 text-left">Type</th>
          <th className="px-3 py-2 text-left">Length</th>
          <th className="px-3 py-2 text-left">Description</th>
        </tr></thead>
        <tbody>
          {columns.map((c, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2 text-gray-400">{i + 1}</td>
              <td className="px-3 py-2 font-mono font-bold text-[#003366]">{c.name}</td>
              <td className="px-3 py-2 font-mono text-[#0070f2]">{c.fieldName || c.field}</td>
              <td className="px-3 py-2 font-mono text-gray-600">{c.type || '—'}</td>
              <td className="px-3 py-2 text-gray-500">{c.length || '—'}</td>
              <td className="px-3 py-2 text-gray-700">{c.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : null
);

export default function TableControl({ data }) {
  const [selectedTC, setSelectedTC] = useState(0);
  const [codeTab, setCodeTab] = useState('pbo');
  if (!data?.length) return null;

  const tc = data[selectedTC];

  return (
    <SectionCard title="Table Controls" icon="📊" badge={`${data.length} controls`}>
      <div className="mb-4 p-3 bg-teal-50 rounded-xl border border-teal-100 text-sm text-gray-700">
        <strong className="text-teal-700">Table Controls</strong> (TYPE TABLEVIEW) enable displaying and editing multiple rows of data in a grid-like interface within a Module Pool screen. They require CONTROLS declaration, LOOP AT ... ENDLOOP in both PBO and PAI, and precise line management using the control's CURRENT_LINE property.
      </div>

      {/* TC selector */}
      {data.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {data.map((tc, i) => (
            <button key={i} onClick={() => setSelectedTC(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedTC === i ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {tc.name} (Screen {tc.screen})
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5">
        {/* Definition */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 uppercase mb-1">Control Name</div>
            <div className="font-mono font-bold text-[#003366]">{tc.name}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 uppercase mb-1">Screen</div>
            <div className="font-mono text-gray-700">{tc.screen}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 uppercase mb-1">Related Internal Table</div>
            <div className="font-mono font-bold text-[#0070f2]">{tc.relatedInternalTable || '—'}</div>
          </div>
        </div>

        {tc.controlDefinition && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">CONTROLS Declaration</div>
            <code className="block bg-[#1e1e2e] text-[#cdd6f4] font-mono text-xs rounded-lg px-4 py-2">{tc.controlDefinition}</code>
          </div>
        )}

        {/* Columns */}
        {tc.columns?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Columns ({tc.columns.length})</div>
            <ColumnTable columns={tc.columns} />
          </div>
        )}

        {/* Code Tabs */}
        <div>
          <div className="flex gap-1.5 mb-3">
            {[
              { id: 'pbo', label: 'PBO LOOP Code' },
              { id: 'pai', label: 'PAI LOOP Code' },
              { id: 'full', label: 'Complete Code' },
            ].map(t => (
              <button key={t.id} onClick={() => setCodeTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${codeTab === t.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {codeTab === 'pbo' && tc.pboLoopCode && (
            <CodeBlock code={tc.pboLoopCode} title={`LOOP AT ${tc.relatedInternalTable || '...'} (PBO)`} />
          )}
          {codeTab === 'pai' && tc.paiLoopCode && (
            <CodeBlock code={tc.paiLoopCode} title={`LOOP AT ${tc.relatedInternalTable || '...'} (PAI)`} />
          )}
          {codeTab === 'full' && tc.fullCode && (
            <CodeBlock code={tc.fullCode} title={`Table Control ${tc.name} — Complete`} />
          )}
        </div>

        {/* Explanation */}
        {tc.explanation && (
          <div className="bg-teal-50 rounded-xl p-4">
            <div className="text-xs font-semibold text-teal-700 uppercase mb-2">How It Works</div>
            <p className="text-sm text-gray-700 leading-relaxed">{tc.explanation}</p>
          </div>
        )}

        {/* Logic details */}
        {[
          { label: 'Scrolling Logic', val: tc.scrollingLogic, color: 'blue' },
          { label: 'Edit / Delete / Insert Logic', val: tc.editDeleteInsertLogic, color: 'orange' },
          { label: 'Mark Logic', val: tc.markLogic, color: 'purple' },
          { label: 'Sort Logic', val: tc.sortLogic, color: 'green' },
        ].filter(d => d.val).map(({ label, val, color }) => (
          <div key={label} className={`bg-${color}-50 rounded-xl p-4`}>
            <div className={`text-xs font-semibold text-${color}-700 uppercase mb-2`}>{label}</div>
            <p className="text-sm text-gray-700">{val}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
