import { useState } from 'react';
import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

const typeColors = {
  'Normal': 'bg-blue-100 text-blue-700',
  'Modal': 'bg-orange-100 text-orange-700',
  'Subscreen': 'bg-green-100 text-green-700',
  'Modal Dialog': 'bg-orange-100 text-orange-700',
  'Selection Screen': 'bg-purple-100 text-purple-700',
};

export default function ScreenAnalysis({ screen, index }) {
  const [tab, setTab] = useState('overview');
  if (!screen) return null;

  const colorClass = typeColors[screen.type] || 'bg-gray-100 text-gray-700';

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'elements', label: `Elements (${screen.elements?.length || 0})`, icon: '🔲' },
    { id: 'buttons', label: `Buttons (${screen.buttons?.length || 0})`, icon: '🔘' },
    { id: 'flow', label: 'Screen Flow', icon: '⚙️' },
    { id: 'mockup', label: 'Screen Mockup', icon: '🖥️' },
    { id: 'testdata', label: 'Test Data', icon: '🧪' },
  ].filter(t => {
    if (t.id === 'elements') return screen.elements?.length > 0;
    if (t.id === 'buttons') return screen.buttons?.length > 0;
    if (t.id === 'flow') return screen.screenFlowLogic?.pboSection || screen.screenFlowLogic?.paiSection;
    if (t.id === 'mockup') return screen.screenMockup;
    if (t.id === 'testdata') return screen.testData;
    return true;
  });

  return (
    <SectionCard
      title={`Screen ${screen.number} — ${screen.title || 'Untitled'}`}
      icon="🖥️"
      badge={screen.type || 'Normal'}
    >
      {/* Screen meta bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>{screen.type || 'Normal Screen'}</span>
        {screen.guiStatus && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Status: {screen.guiStatus}</span>}
        {screen.guiTitle && <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Title: {screen.guiTitle}</span>}
        {screen.calledBy && <span className="text-xs text-gray-500 font-mono">Called by: {screen.calledBy}</span>}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-5 border-b border-gray-100 pb-3">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? 'bg-[#0070f2] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-3">
          {screen.objective && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Objective</div>
              <p className="text-sm text-gray-700">{screen.objective}</p>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {screen.screenFlowLogic?.pboSection && (
              <div className="bg-green-50 rounded-xl p-3">
                <div className="text-xs text-green-600 font-semibold mb-1">PBO Modules</div>
                <div className="space-y-0.5">{(screen.pboModules || []).map((m, i) => <div key={i} className="font-mono text-xs text-gray-700">{m}</div>)}</div>
              </div>
            )}
            {screen.screenFlowLogic?.paiSection && (
              <div className="bg-orange-50 rounded-xl p-3">
                <div className="text-xs text-orange-600 font-semibold mb-1">PAI Modules</div>
                <div className="space-y-0.5">{(screen.paiModules || []).map((m, i) => <div key={i} className="font-mono text-xs text-gray-700">{m}</div>)}</div>
              </div>
            )}
          </div>
          {screen.expectedOutput && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Expected Output</div>
              <p className="text-sm text-gray-700">{screen.expectedOutput}</p>
            </div>
          )}
        </div>
      )}

      {/* Elements */}
      {tab === 'elements' && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50 text-gray-500 uppercase">
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Logic</th>
              <th className="px-3 py-2 text-left">Visible</th>
              <th className="px-3 py-2 text-left">Editable</th>
            </tr></thead>
            <tbody>
              {(screen.elements || []).map((el, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      el.type?.includes('Input') ? 'bg-blue-100 text-blue-700'
                      : el.type?.includes('Push') ? 'bg-orange-100 text-orange-700'
                      : el.type?.includes('Table') ? 'bg-purple-100 text-purple-700'
                      : el.type?.includes('Check') ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                    }`}>{el.type || 'Field'}</span>
                  </td>
                  <td className="px-3 py-2 font-mono font-bold text-[#003366]">{el.name}</td>
                  <td className="px-3 py-2 text-gray-700">{el.label}</td>
                  <td className="px-3 py-2 text-gray-600">{el.description}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-xs">{el.logic}</td>
                  <td className="px-3 py-2 text-gray-500">{el.visible || 'Always'}</td>
                  <td className="px-3 py-2 text-gray-500">{el.editable || 'Always'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Buttons */}
      {tab === 'buttons' && (
        <div className="space-y-3">
          {(screen.buttons || []).map((btn, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm bg-gray-800 text-white px-3 py-1 rounded">[{btn.text}]</span>
                  <span className="font-mono text-xs bg-[#0070f2]/10 text-[#0070f2] px-2 py-1 rounded font-bold">FCODE: {btn.functionCode}</span>
                  {btn.type && <span className="text-xs text-gray-500">{btn.type}</span>}
                </div>
              </div>
              {btn.description && <p className="text-sm text-gray-700 mb-2">{btn.description}</p>}
              {btn.logic && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Logic Triggered</div>
                  <p className="text-xs text-gray-700">{btn.logic}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Screen Flow */}
      {tab === 'flow' && (
        <div className="space-y-4">
          {screen.screenFlowLogic?.pboSection && (
            <div>
              <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-green-100 rounded text-xs">PBO</span>
                PROCESS BEFORE OUTPUT
              </h3>
              <CodeBlock code={screen.screenFlowLogic.pboSection} title={`Screen ${screen.number} PBO`} />
            </div>
          )}
          {screen.screenFlowLogic?.paiSection && (
            <div>
              <h3 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-orange-100 rounded text-xs">PAI</span>
                PROCESS AFTER INPUT
              </h3>
              <CodeBlock code={screen.screenFlowLogic.paiSection} title={`Screen ${screen.number} PAI`} />
            </div>
          )}
          {screen.screenFlowLogic?.povSection && (
            <div>
              <h3 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-purple-100 rounded text-xs">POV</span>
                PROCESS ON VALUE-REQUEST
              </h3>
              <CodeBlock code={screen.screenFlowLogic.povSection} title={`Screen ${screen.number} POV`} />
            </div>
          )}
          {screen.screenFlowLogic?.pohSection && (
            <div>
              <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-100 rounded text-xs">POH</span>
                PROCESS ON HELP-REQUEST
              </h3>
              <CodeBlock code={screen.screenFlowLogic.pohSection} title={`Screen ${screen.number} POH`} />
            </div>
          )}
        </div>
      )}

      {/* Mockup */}
      {tab === 'mockup' && screen.screenMockup && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-700">Screen Layout Mockup</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Approximate layout based on analysis</span>
          </div>
          <div className="screen-mockup">
            {screen.screenMockup}
          </div>
        </div>
      )}

      {/* Test Data */}
      {tab === 'testdata' && (
        <div className="space-y-4">
          {screen.testData && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Sample Test Input Data</h3>
              <div className="bg-[#1e1e2e] rounded-xl p-4 font-mono text-sm text-[#a6e3a1] whitespace-pre-wrap">
                {screen.testData}
              </div>
            </div>
          )}
          {screen.expectedOutput && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="text-xs font-semibold text-green-700 uppercase mb-2">Expected Result After Test</div>
              <p className="text-sm text-gray-700">{screen.expectedOutput}</p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
