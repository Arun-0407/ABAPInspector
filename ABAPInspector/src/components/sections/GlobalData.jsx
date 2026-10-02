import { useState } from 'react';
import SectionCard from '../SectionCard';

const EmptyState = ({ label }) => (
  <div className="text-xs text-gray-400 italic py-1">No {label} found</div>
);

const SubTable = ({ headers, rows }) => (
  rows?.length > 0 ? (
    <div className="overflow-x-auto rounded-lg border border-gray-100 mt-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase">
            {headers.map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {headers.map(h => {
                const key = Object.keys(row).find(k => k.toLowerCase().includes(h.toLowerCase().replace(/[. ]/g, '')));
                const val = key ? row[key] : '';
                return (
                  <td key={h} className="px-3 py-2 font-mono text-[#003366] whitespace-pre-wrap">
                    {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : (val || '—')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <EmptyState label="entries" />
);

export default function GlobalData({ data }) {
  const [tab, setTab] = useState('tables');
  if (!data) return null;

  const tabs = [
    { id: 'tables', label: 'TABLES', count: data.tableStatements?.length },
    { id: 'data', label: 'DATA', count: data.dataDeclarations?.length },
    { id: 'types', label: 'TYPES', count: data.typeDeclarations?.length },
    { id: 'constants', label: 'CONSTANTS', count: data.constants?.length },
    { id: 'itabs', label: 'Internal Tables', count: data.internalTables?.length },
    { id: 'wa', label: 'Work Areas', count: data.workAreas?.length },
    { id: 'fs', label: 'Field Symbols', count: data.fieldSymbols?.length },
    { id: 'controls', label: 'CONTROLS', count: data.controls?.length },
  ].filter(t => t.count > 0);

  const total = tabs.reduce((s, t) => s + (t.count || 0), 0);

  return (
    <SectionCard title="Global Declarations" icon="📋" badge={`${total} objects`}>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id
                ? 'bg-[#0070f2] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === 'tables' && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-3 py-2 text-left">Table</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Custom</th>
              <th className="px-3 py-2 text-left">Usage</th>
            </tr></thead>
            <tbody>
              {(data.tableStatements || []).map((t, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-mono font-bold text-[#0070f2] text-xs">{t.name}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{t.sapDescription || t.description}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.isCustom ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {t.isCustom ? 'Z/Y Custom' : 'SAP Standard'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">{t.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'data' && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-3 py-2 text-left">Variable</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Len</th>
              <th className="px-3 py-2 text-left">Description</th>
            </tr></thead>
            <tbody>
              {(data.dataDeclarations || []).map((d, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-mono text-xs font-bold text-[#003366]">{d.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#0070f2]">{d.type}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{d.length || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{d.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'types' && (
        <div className="space-y-3">
          {(data.typeDeclarations || []).map((t, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="font-mono font-bold text-[#003366] text-sm">{t.name}</span>
                {t.basedOn && <span className="text-xs text-gray-500">Based on: <span className="font-mono text-[#0070f2]">{t.basedOn}</span></span>}
              </div>
              {t.definition && <div className="font-mono text-xs bg-[#1e1e2e] text-[#cdd6f4] rounded-lg px-3 py-2 mb-2">{t.definition}</div>}
              {t.description && <p className="text-xs text-gray-600">{t.description}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'constants' && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-3 py-2 text-left">Constant</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Value</th>
              <th className="px-3 py-2 text-left">Description</th>
            </tr></thead>
            <tbody>
              {(data.constants || []).map((c, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-mono font-bold text-[#003366] text-xs">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#0070f2]">{c.type}</td>
                  <td className="px-3 py-2 font-mono text-xs text-green-700 bg-green-50 rounded">'{c.value}'</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'itabs' && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-3 py-2 text-left">Internal Table</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Header</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Populated By</th>
            </tr></thead>
            <tbody>
              {(data.internalTables || []).map((t, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-mono font-bold text-[#003366] text-xs">{t.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[#0070f2]">{t.type}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full ${t.hasHeader ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.hasHeader ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{t.description}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{t.populatedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'wa' && (
        <SubTable
          headers={['Name', 'Type', 'Description', 'LinkedTo']}
          rows={data.workAreas}
        />
      )}

      {tab === 'fs' && (
        <SubTable
          headers={['Name', 'Type', 'Description', 'AssignedAt']}
          rows={data.fieldSymbols}
        />
      )}

      {tab === 'controls' && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="px-3 py-2 text-left">Control Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Screen</th>
              <th className="px-3 py-2 text-left">Description</th>
            </tr></thead>
            <tbody>
              {(data.controls || []).map((c, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-mono font-bold text-[#003366] text-xs">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-purple-600">{c.type}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">{c.screen}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
