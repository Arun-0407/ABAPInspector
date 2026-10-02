import SectionCard from '../SectionCard';
import CodeBlock from '../CodeBlock';

const typeStyles = {
  'Mandatory': { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  'Format': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  'Range': { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  'ExistenceCheck': { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  'BusinessRule': { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' },
  'AuthorityCheck': { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' },
};

const msgTypeLabel = { 'E': '❌ Error', 'W': '⚠️ Warning', 'I': 'ℹ️ Information', 'S': '✅ Success' };

export default function Validations({ data }) {
  if (!data?.length) return null;

  const grouped = data.reduce((acc, v) => {
    const key = v.type || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {});

  return (
    <SectionCard title="Validations" icon="✅" badge={`${data.length} validations`}>
      <div className="mb-4 p-3 bg-yellow-50 rounded-xl border border-yellow-100 text-sm text-gray-700">
        Validations ensure data integrity before processing. They are implemented in PAI modules, CHAIN/FIELD blocks, and FORM routines. Messages use the <code className="font-mono bg-white px-1 rounded">MESSAGE</code> statement with type E (Error), W (Warning), I (Info), S (Success).
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([type, validations]) => {
          const style = typeStyles[type] || typeStyles['BusinessRule'];
          return (
            <div key={type}>
              <h3 className={`text-xs font-bold uppercase mb-3 flex items-center gap-2 ${style.text}`}>
                <span className={`px-2 py-0.5 rounded-full ${style.badge} text-xs`}>{type}</span>
                <span className="text-gray-400 font-normal">({validations.length})</span>
              </h3>
              <div className="space-y-3">
                {validations.map((v, i) => (
                  <div key={i} className={`border border-gray-100 rounded-xl overflow-hidden`}>
                    <div className={`px-4 py-3 ${style.bg}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 text-sm">{v.description}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {v.screen && <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded">Screen {v.screen}</span>}
                            {v.field && <span className="font-mono text-xs text-[#0070f2] bg-blue-50 px-2 py-0.5 rounded">{v.field}</span>}
                            {v.location && <span className="text-xs text-gray-500">in {v.location}</span>}
                          </div>
                        </div>
                        {v.messageType && (
                          <span className={`text-xs px-2 py-1 rounded shrink-0 ${
                            v.messageType === 'E' ? 'bg-red-100 text-red-700'
                            : v.messageType === 'W' ? 'bg-yellow-100 text-yellow-700'
                            : v.messageType === 'I' ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                          }`}>
                            {msgTypeLabel[v.messageType] || v.messageType}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-3 bg-white">
                      {v.explanation && (
                        <p className="text-xs text-gray-700">{v.explanation}</p>
                      )}

                      {v.errorMessage && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg p-2.5">
                          <span className="text-red-500 shrink-0">⚠</span>
                          <div>
                            <span className="text-xs font-semibold text-red-600">Error Message: </span>
                            <span className="text-xs text-gray-700">"{v.errorMessage}"</span>
                            {v.messageClass && (
                              <span className="ml-2 font-mono text-xs text-gray-500">[{v.messageClass}/{v.messageNumber}]</span>
                            )}
                          </div>
                        </div>
                      )}

                      {v.fullCode && (
                        <details>
                          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium">View validation code →</summary>
                          <div className="mt-2">
                            <CodeBlock code={v.fullCode} title="Validation Code" />
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
