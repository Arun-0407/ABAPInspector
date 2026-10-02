import { useState } from 'react';
import SectionCard from '../SectionCard';

export default function GUIStatus({ data }) {
  const [selected, setSelected] = useState(0);
  if (!data?.length) return null;

  const status = data[selected];

  return (
    <SectionCard title="GUI Status & Title Bars" icon="🔘" badge={`${data.length} statuses`}>
      <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-sm text-gray-700">
        <strong className="text-indigo-700">GUI Status</strong> defines the toolbar, menu bar, and keyboard shortcuts available on a screen. It is set in PBO using <code className="font-mono bg-white px-1 rounded">SET PF-STATUS 'name'</code>.
      </div>

      {/* Status selector */}
      {data.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {data.map((s, i) => (
            <button key={i} onClick={() => setSelected(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selected === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 uppercase mb-1">Status Name</div>
            <div className="font-mono font-bold text-[#003366]">{status.name}</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs text-gray-400 uppercase mb-1">Type</div>
            <div className="text-sm text-gray-700">{status.type || 'Normal Screen'}</div>
          </div>
          {status.usedOnScreens?.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-400 uppercase mb-1">Used On Screens</div>
              <div className="font-mono text-sm text-gray-700">{status.usedOnScreens.join(', ')}</div>
            </div>
          )}
        </div>

        {status.description && (
          <div className="bg-indigo-50 rounded-xl p-3 text-sm text-gray-700">{status.description}</div>
        )}

        {status.setByCode && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-1">SET PF-STATUS Statement</div>
            <code className="block bg-[#1e1e2e] text-[#cdd6f4] font-mono text-xs rounded-lg px-4 py-2">{status.setByCode}</code>
          </div>
        )}

        {/* Buttons */}
        {status.buttons?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Toolbar / Application Buttons</div>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 text-gray-400 uppercase">
                  <th className="px-3 py-2 text-left">Button Text</th>
                  <th className="px-3 py-2 text-left">FCode</th>
                  <th className="px-3 py-2 text-left">F-Key</th>
                  <th className="px-3 py-2 text-left">Icon</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Description</th>
                </tr></thead>
                <tbody>
                  {status.buttons.map((b, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium text-gray-800">[{b.text}]</td>
                      <td className="px-3 py-2 font-mono font-bold text-[#0070f2]">{b.fCode}</td>
                      <td className="px-3 py-2 text-gray-500">{b.fKey || '—'}</td>
                      <td className="px-3 py-2 text-gray-500 font-mono">{b.icon || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${b.type === 'Exit' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{b.type || 'Normal'}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{b.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Menu Items */}
        {status.menuItems?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Menu Items</div>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50 text-gray-400 uppercase">
                  <th className="px-3 py-2 text-left">Menu Path</th>
                  <th className="px-3 py-2 text-left">FCode</th>
                  <th className="px-3 py-2 text-left">Description</th>
                </tr></thead>
                <tbody>
                  {status.menuItems.map((m, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-mono text-[#003366]">{m.menu}</td>
                      <td className="px-3 py-2 font-mono font-bold text-[#0070f2]">{m.fCode}</td>
                      <td className="px-3 py-2 text-gray-600">{m.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {status.excludedFCodes?.length > 0 && (
          <div className="bg-red-50 rounded-xl p-3">
            <div className="text-xs font-semibold text-red-600 uppercase mb-1">Excluded Standard FCodes</div>
            <div className="flex flex-wrap gap-1.5">
              {status.excludedFCodes.map(fc => (
                <span key={fc} className="font-mono text-xs bg-white border border-red-200 text-red-700 px-2 py-0.5 rounded">{fc}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
