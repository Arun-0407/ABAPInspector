import { useState } from 'react';
import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

const FieldTable = ({ fields, title }) => (
  fields?.length > 0 ? (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{title}</div>
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 text-gray-400 uppercase">
            <th className="px-2 py-1.5 text-left">Field</th>
            <th className="px-2 py-1.5 text-left">Data Element</th>
            <th className="px-2 py-1.5 text-left">Type</th>
            <th className="px-2 py-1.5 text-left">Len</th>
            <th className="px-2 py-1.5 text-left">Description</th>
          </tr></thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-2 py-1.5 font-mono font-bold text-[#0070f2]">{f.field}</td>
                <td className="px-2 py-1.5 font-mono text-purple-600">{f.dataElement || '—'}</td>
                <td className="px-2 py-1.5 font-mono text-gray-600">{f.type}</td>
                <td className="px-2 py-1.5 text-gray-500">{f.length || '—'}</td>
                <td className="px-2 py-1.5 text-gray-700">{f.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null
);

const TableCard = ({ table, isCustom }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 ${isCustom ? 'bg-purple-50' : 'bg-blue-50'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-lg text-[#003366]">{table.name}</span>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isCustom ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
            {isCustom ? '⚡ Z Custom Table' : '📦 SAP Standard'}
          </span>
          {table.tableType && <span className="text-xs text-gray-500">{table.tableType}</span>}
          {table.module && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{table.module}</span>}
        </div>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="p-4 space-y-4 bg-white">
          {(table.sapDescription || table.description) && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</div>
              <p className="text-sm text-gray-800">{table.sapDescription || table.description}</p>
            </div>
          )}

          {table.usedFor && (
            <div className="bg-amber-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-600 uppercase mb-1">Used For</div>
              <p className="text-sm text-gray-800">{table.usedFor}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldTable fields={table.keyFields} title="Key Fields" />
            <FieldTable fields={table.dataFields} title="Data Fields" />
          </div>

          {table.dmlOperations?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">DML Operations</div>
              <div className="space-y-2">
                {table.dmlOperations.map((op, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                        op.type === 'SELECT' ? 'bg-green-100 text-green-700'
                        : op.type === 'INSERT' ? 'bg-blue-100 text-blue-700'
                        : op.type === 'UPDATE' ? 'bg-yellow-100 text-yellow-700'
                        : op.type === 'DELETE' ? 'bg-red-100 text-red-700'
                        : op.type === 'MODIFY' ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-700'
                      }`}>{op.type}</span>
                      {op.purpose && <span className="text-xs text-gray-600">{op.purpose}</span>}
                    </div>
                    {op.code && <code className="text-xs font-mono text-[#003366] whitespace-pre-wrap break-all">{op.code}</code>}
                    {op.condition && <div className="text-xs text-gray-500 mt-1 font-mono">{op.condition}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function DatabaseTables({ data }) {
  const zCount = data?.zTables?.length || 0;
  const stdCount = data?.standardTables?.length || 0;
  if (!zCount && !stdCount) return null;

  const [tab, setTab] = useState(zCount > 0 ? 'z' : 'std');

  return (
    <SectionCard title="Database Tables" icon="🗄️" badge={`${zCount + stdCount} tables`}>
      <div className="flex gap-2 mb-4">
        {zCount > 0 && (
          <button onClick={() => setTab('z')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'z' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Z/Y Custom Tables ({zCount})
          </button>
        )}
        {stdCount > 0 && (
          <button onClick={() => setTab('std')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'std' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            SAP Standard Tables ({stdCount})
          </button>
        )}
      </div>

      <div className="space-y-3">
        {tab === 'z' && (data.zTables || []).map((t, i) => (
          <TableCard key={i} table={t} isCustom={true} />
        ))}
        {tab === 'std' && (data.standardTables || []).map((t, i) => (
          <TableCard key={i} table={t} isCustom={false} />
        ))}
      </div>
    </SectionCard>
  );
}
