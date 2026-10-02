import SectionCard from '../SectionCard';

export default function OverallFlow({ analysis }) {
  return (
    <SectionCard title="Overall Flow & Business Logic" icon="🔄">
      <div className="space-y-5">
        {analysis.overallFlow && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              📊 Program Flow — End-to-End
            </h3>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {analysis.overallFlow}
            </div>
          </div>
        )}

        {analysis.keyBusinessLogic && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              💼 Key Business Logic
            </h3>
            <div className="bg-green-50 border border-green-100 rounded-xl p-5 text-sm text-gray-700 leading-relaxed">
              {analysis.keyBusinessLogic}
            </div>
          </div>
        )}

        {analysis.errorHandling && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              ⚠️ Error Handling
            </h3>
            <div className="bg-red-50 border border-red-100 rounded-xl p-5 text-sm text-gray-700 leading-relaxed">
              {analysis.errorHandling}
            </div>
          </div>
        )}

        {analysis.performanceNotes && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              ⚡ Performance Notes
            </h3>
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-5 text-sm text-gray-700 leading-relaxed">
              {analysis.performanceNotes}
            </div>
          </div>
        )}

        {analysis.securityNotes && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              🔒 Security & Authorization
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-700 leading-relaxed">
              {analysis.securityNotes}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
