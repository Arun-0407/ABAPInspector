import { useState } from 'react';
import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

const LineByLine = ({ lines }) => (
  lines?.length > 0 ? (
    <div className="overflow-x-auto rounded-lg border border-gray-100 mt-2">
      <table className="w-full text-xs">
        <thead><tr className="bg-gray-50 text-gray-400 uppercase">
          <th className="px-3 py-2 text-left w-8">#</th>
          <th className="px-3 py-2 text-left w-2/5">Code</th>
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

const SubCard = ({ sub, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono font-bold text-[#003366]">{sub.name}</span>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">{sub.type || 'FORM'}</span>
          {sub.calledFrom?.length > 0 && (
            <span className="text-xs text-gray-500">Called from: {(sub.calledFrom || []).join(', ')}</span>
          )}
        </div>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="p-4 space-y-3 bg-white">
          {sub.usingParams?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Parameters</div>
              <div className="flex flex-wrap gap-2">
                {sub.usingParams.map((p, i) => (
                  <div key={i} className="bg-gray-50 border rounded-lg px-3 py-1.5 text-xs">
                    <span className={`font-medium mr-1 ${p.direction === 'USING' ? 'text-blue-600' : 'text-orange-600'}`}>{p.direction}</span>
                    <span className="font-mono text-[#003366]">{p.name}</span>
                    {p.type && <span className="text-gray-500 ml-1">TYPE {p.type}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {sub.explanation && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">{sub.explanation}</p>
            </div>
          )}

          {sub.sideEffects && (
            <div className="bg-yellow-50 rounded-lg p-2.5">
              <span className="text-xs font-semibold text-yellow-700">Side Effects: </span>
              <span className="text-xs text-gray-700">{sub.sideEffects}</span>
            </div>
          )}

          {sub.fullCode && (
            <CodeBlock code={sub.fullCode} title={`FORM ${sub.name}`} />
          )}

          <LineByLine lines={sub.lineByLine} />
        </div>
      )}
    </div>
  );
};

export default function SubroutinesEvents({ subroutines, events }) {
  const [tab, setTab] = useState('subs');
  const hasSubs = subroutines?.length > 0;
  const hasEvents = events?.length > 0;

  return (
    <SectionCard title="Subroutines & Events" icon="⚙️" badge={`${(subroutines?.length || 0) + (events?.length || 0)} items`}>
      <div className="flex gap-2 mb-4">
        {hasSubs && (
          <button onClick={() => setTab('subs')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'subs' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            FORM Subroutines ({subroutines.length})
          </button>
        )}
        {hasEvents && (
          <button onClick={() => setTab('events')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'events' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Events ({events.length})
          </button>
        )}
      </div>

      {tab === 'subs' && (
        <div className="space-y-3">
          {(subroutines || []).map((sub, i) => <SubCard key={i} sub={sub} index={i} />)}
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-4">
          {(events || []).map((ev, i) => (
            <div key={i} className="border border-teal-100 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-teal-50">
                <span className="font-mono font-bold text-[#003366]">{ev.name}</span>
                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded">{ev.type}</span>
              </div>
              <div className="p-4 space-y-3 bg-white">
                {ev.explanation && <p className="text-sm text-gray-700">{ev.explanation}</p>}
                {ev.code && <CodeBlock code={ev.code} title={ev.name} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
