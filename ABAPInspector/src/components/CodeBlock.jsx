import { useState } from 'react';

const KEYWORDS = [
  'PROGRAM','REPORT','FUNCTION-POOL','CLASS-POOL','INTERFACE-POOL',
  'TABLES','DATA','TYPES','CONSTANTS','FIELD-SYMBOLS','STATICS','RANGES',
  'CONTROLS','CLASS','ENDCLASS','METHOD','ENDMETHOD','INTERFACE','ENDINTERFACE',
  'MODULE','ENDMODULE','FORM','ENDFORM','FUNCTION','ENDFUNCTION',
  'PROCESS BEFORE OUTPUT','PROCESS AFTER INPUT','PROCESS ON VALUE-REQUEST','PROCESS ON HELP-REQUEST',
  'LOOP AT SCREEN','ENDLOOP','LOOP AT','LOOP','ENDLOOP',
  'IF','ELSEIF','ELSE','ENDIF','CASE','WHEN','ENDCASE',
  'DO','ENDDO','WHILE','ENDWHILE',
  'SELECT','FROM','INTO','WHERE','ORDER BY','GROUP BY','HAVING','ENDSELECT',
  'INSERT','UPDATE','DELETE','MODIFY','COMMIT WORK','ROLLBACK WORK',
  'READ TABLE','APPEND','COLLECT','SORT','FIND','REPLACE',
  'CALL FUNCTION','USING','CHANGING','EXCEPTIONS','EXPORTING','IMPORTING','TABLES',
  'CALL SCREEN','LEAVE SCREEN','LEAVE PROGRAM','LEAVE TO SCREEN',
  'CALL METHOD','CREATE OBJECT','RAISE EVENT',
  'SET PF-STATUS','SET TITLEBAR','SET CURSOR','SET PARAMETER',
  'GET PARAMETER','GET CURSOR',
  'MESSAGE','WRITE','NEW-LINE','SKIP',
  'AUTHORITY-CHECK','OBJECT',
  'MOVE','MOVE-CORRESPONDING','CLEAR','REFRESH','FREE','INITIALIZE',
  'CONCATENATE','SPLIT','CONDENSE','TRANSLATE','OVERLAY',
  'PERFORM','CHAIN','ENDCHAIN','FIELD','AT',
  'AT LINE-SELECTION','AT USER-COMMAND','INITIALIZATION',
  'START-OF-SELECTION','END-OF-SELECTION','LOAD-OF-PROGRAM',
  'AT SELECTION-SCREEN','AT EXIT-COMMAND',
  'TYPE','LIKE','VALUE','LENGTH','DECIMALS','REF TO',
  'AND','OR','NOT','IS','INITIAL','INITIAL','BETWEEN','IN',
  'SY-UCOMM','SY-SUBRC','SY-DATUM','SY-UZEIT','SY-UNAME','SY-MANDT','SY-REPID','SY-DYNNR',
  'OTHERS','SPACE','TRUE','FALSE',
  'TABLE CONTROL','TABLEVIEW',
  'ABSTRACT','ALIASES','ASSIGNING','CASTING',
];

function highlightABAP(code) {
  if (!code) return '';

  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Comments (* at start of line or " inline)
  html = html.replace(/^(\*[^\n]*)/gm, '<span class="abap-comment">$1</span>');
  html = html.replace(/("(?:[^"<])*)/g, '<span class="abap-comment">$1</span>');

  // Strings
  html = html.replace(/'([^']*)'/g, '<span class="abap-string">\'$1\'</span>');

  // Numbers
  html = html.replace(/\b(\d+)\b/g, '<span class="abap-number">$1</span>');

  // Sort keywords by length (longest first to avoid partial matches)
  const sorted = [...KEYWORDS].sort((a, b) => b.length - a.length);
  sorted.forEach(kw => {
    const escaped = kw.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const re = new RegExp(`(?<![a-z_-])(${escaped})(?![a-z_-])`, 'gi');
    html = html.replace(re, '<span class="abap-keyword">$1</span>');
  });

  return html;
}

export default function CodeBlock({ code, title, lang = 'abap', maxHeight = 500 }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!code) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lines = code.split('\n');
  const isLong = lines.length > 30;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#1e1e2e] px-4 py-2.5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          {title && <span className="text-gray-400 text-xs font-mono">{title}</span>}
          <span className="text-gray-600 text-xs uppercase tracking-wider">{lang}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-xs">{lines.length} lines</span>
          <button
            onClick={handleCopy}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
          >
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
        </div>
      </div>

      {/* Code */}
      <div
        className="bg-[#1e1e2e] overflow-auto relative"
        style={{ maxHeight: !isLong || expanded ? 'none' : `${maxHeight}px` }}
      >
        <pre className="p-4 text-[13px] leading-relaxed abap-code">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="line-number text-gray-600 select-none">{i + 1}</span>
                <span
                  className="flex-1 text-[#cdd6f4]"
                  dangerouslySetInnerHTML={{ __html: highlightABAP(line) || '&nbsp;' }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Expand button for long code */}
      {isLong && (
        <div className={`bg-[#1e1e2e] border-t border-gray-700 text-center py-2 ${!expanded ? 'bg-gradient-to-t from-[#1e1e2e] to-transparent' : ''}`}>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-white px-4 py-1 rounded hover:bg-white/10 transition-colors"
          >
            {expanded ? '▲ Show Less' : `▼ Show All ${lines.length} Lines`}
          </button>
        </div>
      )}
    </div>
  );
}
