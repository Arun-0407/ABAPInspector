import SectionCard from '../SectionCard';

const typeStyles = {
  'Function': 'bg-blue-100 text-blue-700',
  'Exit Command': 'bg-red-100 text-red-700',
  'Back': 'bg-gray-100 text-gray-700',
  'Cancel': 'bg-orange-100 text-orange-700',
  'Enter': 'bg-green-100 text-green-700',
  'Save': 'bg-teal-100 text-teal-700',
};

export default function FunctionCodes({ data }) {
  if (!data?.length) return null;

  return (
    <SectionCard title="Function Codes" icon="⌨️" badge={`${data.length} FCodes`}>
      <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm text-gray-700">
        <strong className="text-blue-700">Function Codes (SY-UCOMM)</strong> are the values set when the user clicks a button or selects a menu item. They are evaluated in PAI modules using CASE SY-UCOMM / WHEN statements.
      </div>

      <div className="grid grid-cols-1 gap-3">
        {data.map((fc, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-xl text-[#003366] bg-gray-50 px-3 py-1 rounded-lg border">{fc.code}</span>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeStyles[fc.type] || 'bg-gray-100 text-gray-600'}`}>
                    {fc.type || 'Function'}
                  </span>
                  {fc.associatedButton && (
                    <span className="ml-2 text-xs text-gray-500">Button: [{fc.associatedButton}]</span>
                  )}
                </div>
              </div>
              {fc.handledInModule && (
                <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded">
                  Handled in: {fc.handledInModule}
                </span>
              )}
            </div>

            {fc.description && <p className="text-sm text-gray-700 mb-2">{fc.description}</p>}

            {fc.resultingAction && (
              <div className="bg-green-50 rounded-lg p-2 mt-2">
                <span className="text-xs font-semibold text-green-700">Result: </span>
                <span className="text-xs text-gray-700">{fc.resultingAction}</span>
              </div>
            )}

            {fc.codeBlock && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium">View handling code →</summary>
                <div className="mt-2 bg-[#1e1e2e] text-[#cdd6f4] font-mono text-xs rounded-lg p-3 whitespace-pre-wrap">
                  {fc.codeBlock}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
