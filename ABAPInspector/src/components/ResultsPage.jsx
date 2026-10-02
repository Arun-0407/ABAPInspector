import { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import ProgramOverview from './sections/ProgramOverview';
import TopModule from './sections/TopModule';
import GlobalData from './sections/GlobalData';
import DatabaseTables from './sections/DatabaseTables';
import ScreenAnalysis from './sections/ScreenAnalysis';
import PBOSection from './sections/PBOSection';
import PAISection from './sections/PAISection';
import GUIStatus from './sections/GUIStatus';
import FunctionCodes from './sections/FunctionCodes';
import F4Help from './sections/F4Help';
import TableControl from './sections/TableControl';
import Validations from './sections/Validations';
import SubroutinesEvents from './sections/SubroutinesEvents';
import FullCode from './sections/FullCode';
import OverallFlow from './sections/OverallFlow';

/* ── HTML report generator ──────────────────────────────────────────────── */

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function code(s) {
  return `<pre class="code">${esc(s)}</pre>`;
}

function section(title, body, icon = '') {
  return `<div class="section"><h2>${icon ? icon + ' ' : ''}${esc(title)}</h2>${body}</div>`;
}

function table(headers, rows) {
  if (!rows?.length) return '<p class="empty">None</p>';
  const ths = headers.map(h => `<th>${esc(h)}</th>`).join('');
  const trs = rows.map(r => `<tr>${r.map(c => `<td>${esc(c ?? '')}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function kv(pairs) {
  return `<table class="kv">${pairs.filter(([,v]) => v).map(([k,v]) =>
    `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`;
}

function generatePrintHTML(analysis, modelLabel) {
  const a = analysis || {};
  const pi = a.programInfo || {};
  const gd = a.globalDeclarations || {};
  const db = a.databaseTables || {};
  const now = new Date().toLocaleString();

  let html = '';

  /* 1 — Program Overview */
  html += section('Program Overview', `
    ${kv([
      ['Program Name', pi.name],
      ['Title', pi.title],
      ['Type', pi.type],
      ['Class', pi.programClass],
      ['Logical System', pi.logicalSystem],
      ['Author', pi.authorIfFound],
      ['Package', pi.packageIfFound],
    ])}
    ${pi.objective ? `<p class="objective">${esc(pi.objective)}</p>` : ''}
  `, '📌');

  /* 2 — Top Module */
  if (pi.topModule?.exists) {
    const tm = pi.topModule;
    html += section('Top Module (LOAD-OF-PROGRAM)', `
      <p>${esc(tm.purpose || '')}</p>
      ${tm.explanation ? `<p>${esc(tm.explanation)}</p>` : ''}
      ${tm.code ? code(tm.code) : ''}
      ${tm.lineByLine?.length ? `
        <h3>Line-by-Line</h3>
        <table><thead><tr><th>Line</th><th>Explanation</th></tr></thead><tbody>
          ${tm.lineByLine.map(l => `<tr><td class="mono">${esc(l.line)}</td><td>${esc(l.explanation)}</td></tr>`).join('')}
        </tbody></table>` : ''}
    `, '🔝');
  }

  /* 3 — Global Declarations */
  {
    let body = '';
    if (gd.tableStatements?.length) {
      body += '<h3>TABLES Statements</h3>' + table(['Name','SAP Description','Custom','Usage'],
        gd.tableStatements.map(t => [t.name, t.sapDescription, t.isCustom ? 'Yes' : 'No', t.usage]));
    }
    if (gd.dataDeclarations?.length) {
      body += '<h3>DATA Declarations</h3>' + table(['Name','Type','Length','Description'],
        gd.dataDeclarations.map(d => [d.name, d.type, d.length, d.description]));
    }
    if (gd.typeDeclarations?.length) {
      body += '<h3>TYPE Declarations</h3>' + table(['Name','Based On','Description'],
        gd.typeDeclarations.map(t => [t.name, t.basedOn, t.description]));
    }
    if (gd.constants?.length) {
      body += '<h3>Constants</h3>' + table(['Name','Type','Value','Description'],
        gd.constants.map(c => [c.name, c.type, c.value, c.description]));
    }
    if (gd.internalTables?.length) {
      body += '<h3>Internal Tables</h3>' + table(['Name','Type','Description','Populated By'],
        gd.internalTables.map(t => [t.name, t.type, t.description, t.populatedBy]));
    }
    if (gd.controls?.length) {
      body += '<h3>Controls</h3>' + table(['Name','Type','Screen','Description'],
        gd.controls.map(c => [c.name, c.type, c.screen, c.description]));
    }
    if (!body) body = '<p class="empty">No global declarations found.</p>';
    html += section('Global Declarations', body, '📋');
  }

  /* 4 — Database Tables */
  {
    let body = '';
    if (db.zTables?.length) {
      body += '<h3>Custom Z-Tables</h3>';
      db.zTables.forEach(t => {
        body += `<div class="sub-section"><h4>${esc(t.name)} — ${esc(t.sapDescription)}</h4>`;
        body += kv([['Table Type', t.tableType], ['Delivery Class', t.deliveryClass], ['Used For', t.usedFor]]);
        if (t.keyFields?.length) {
          body += '<h5>Key Fields</h5>' + table(['Field','Data Element','Type','Length','Description'],
            t.keyFields.map(f => [f.field, f.dataElement, f.type, f.length, f.description]));
        }
        if (t.dataFields?.length) {
          body += '<h5>Data Fields</h5>' + table(['Field','Data Element','Type','Length','Description'],
            t.dataFields.map(f => [f.field, f.dataElement, f.type, f.length, f.description]));
        }
        if (t.dmlOperations?.length) {
          body += '<h5>DML Operations</h5>' + table(['Type','Code','Purpose'],
            t.dmlOperations.map(d => [d.type, d.code, d.purpose]));
        }
        body += '</div>';
      });
    }
    if (db.standardTables?.length) {
      body += '<h3>Standard SAP Tables</h3>' + table(['Name','Description','Module','Used For'],
        db.standardTables.map(t => [t.name, t.sapDescription, t.module, t.usedFor]));
    }
    if (!body) body = '<p class="empty">No database tables found.</p>';
    html += section('Database Tables', body, '🗄️');
  }

  /* 5 — Screens */
  (a.screens || []).forEach((scr, i) => {
    let body = kv([
      ['Screen Number', scr.number],
      ['Title', scr.title],
      ['Type', scr.type],
      ['Objective', scr.objective],
      ['Called By', scr.calledBy],
      ['GUI Status', scr.guiStatus],
    ]);
    if (scr.screenMockup) {
      body += '<h3>Screen Mockup</h3><pre class="mockup">' + esc(scr.screenMockup) + '</pre>';
    }
    if (scr.elements?.length) {
      body += '<h3>Screen Elements</h3>' + table(['Type','Name','Label','Mandatory','Description'],
        scr.elements.map(e => [e.type, e.name, e.label, e.mandatory ? 'Yes' : '', e.description]));
    }
    if (scr.buttons?.length) {
      body += '<h3>Buttons & Function Codes</h3>' + table(['Label','Function Code','Type','Description'],
        scr.buttons.map(b => [b.text, b.functionCode, b.type, b.description]));
    }
    if (scr.screenFlowLogic?.pboSection) {
      body += '<h3>PBO Logic</h3>' + code(scr.screenFlowLogic.pboSection);
    }
    if (scr.screenFlowLogic?.paiSection) {
      body += '<h3>PAI Logic</h3>' + code(scr.screenFlowLogic.paiSection);
    }
    if (scr.testData) {
      body += '<h3>Test Data</h3><p>' + esc(scr.testData) + '</p>';
    }
    html += section(`Screen ${scr.number}${scr.title ? ' — ' + scr.title : ''}`, body, '🖥️');
  });

  /* 6 — PBO Modules */
  if (a.pboModules?.length) {
    let body = '';
    a.pboModules.forEach(m => {
      body += `<div class="sub-section"><h3>${esc(m.name)}</h3>`;
      body += `<p><strong>Purpose:</strong> ${esc(m.purpose)}</p>`;
      if (m.explanation) body += `<p>${esc(m.explanation)}</p>`;
      if (m.fullCode) body += code(m.fullCode);
      if (m.lineByLine?.length) {
        body += '<h4>Line-by-Line</h4><table><thead><tr><th>#</th><th>Code</th><th>Explanation</th></tr></thead><tbody>' +
          m.lineByLine.map(l => `<tr><td>${l.lineNum||''}</td><td class="mono">${esc(l.code)}</td><td>${esc(l.explanation)}</td></tr>`).join('') +
          '</tbody></table>';
      }
      body += '</div>';
    });
    html += section('PBO Modules', body, '▶');
  }

  /* 7 — PAI Modules */
  if (a.paiModules?.length) {
    let body = '';
    a.paiModules.forEach(m => {
      body += `<div class="sub-section"><h3>${esc(m.name)}</h3>`;
      body += `<p><strong>Purpose:</strong> ${esc(m.purpose)}</p>`;
      if (m.triggerCondition) body += `<p><strong>Trigger:</strong> ${esc(m.triggerCondition)}</p>`;
      if (m.explanation) body += `<p>${esc(m.explanation)}</p>`;
      if (m.fullCode) body += code(m.fullCode);
      if (m.handledFunctionCodes?.length) {
        body += '<h4>Handled Function Codes</h4>' + table(['FCode','Description'],
          m.handledFunctionCodes.map(f => [f.fcode, f.description]));
      }
      if (m.lineByLine?.length) {
        body += '<h4>Line-by-Line</h4><table><thead><tr><th>#</th><th>Code</th><th>Explanation</th></tr></thead><tbody>' +
          m.lineByLine.map(l => `<tr><td>${l.lineNum||''}</td><td class="mono">${esc(l.code)}</td><td>${esc(l.explanation)}</td></tr>`).join('') +
          '</tbody></table>';
      }
      body += '</div>';
    });
    html += section('PAI Modules', body, '◀');
  }

  /* 8 — GUI Status */
  if (a.guiStatuses?.length) {
    let body = '';
    a.guiStatuses.forEach(g => {
      body += `<div class="sub-section"><h3>${esc(g.name || g.statusName)}</h3>`;
      body += kv([['Screen', g.screen], ['Purpose', g.purpose]]);
      if (g.menuEntries?.length) {
        body += '<h4>Menu Entries</h4>' + table(['Text','FCode','Description'],
          g.menuEntries.map(e => [e.text, e.fcode, e.description]));
      }
      if (g.toolbarButtons?.length) {
        body += '<h4>Toolbar Buttons</h4>' + table(['Text','FCode','Description'],
          g.toolbarButtons.map(e => [e.text, e.fcode, e.description]));
      }
      body += '</div>';
    });
    html += section('GUI Status', body, '🔘');
  }

  /* 9 — Function Codes */
  if (a.functionCodes?.length) {
    html += section('Function Codes', table(['Code','Type','Description','Handler Module'],
      a.functionCodes.map(f => [f.code||f.fcode, f.type, f.description, f.handlerModule])), '⌨️');
  }

  /* 10 — F4 Help / POV */
  if (a.f4HelpPOV?.length) {
    let body = '';
    a.f4HelpPOV.forEach(f => {
      body += `<div class="sub-section"><h3>${esc(f.field || f.name)}</h3>`;
      body += kv([['Screen Field', f.screenField], ['Purpose', f.purpose], ['Function Module', f.functionModule]]);
      if (f.fullCode) body += code(f.fullCode);
      body += '</div>';
    });
    html += section('F4 Help / POV', body, '🔍');
  }

  /* 11 — Table Controls */
  if (a.tableControls?.length) {
    let body = '';
    a.tableControls.forEach(tc => {
      body += `<div class="sub-section"><h3>${esc(tc.name)}</h3>`;
      body += kv([['Screen', tc.screen], ['Type', tc.type], ['Internal Table', tc.internalTable], ['Purpose', tc.purpose]]);
      if (tc.loopCode) body += '<h4>LOOP Code</h4>' + code(tc.loopCode);
      if (tc.explanation) body += `<p>${esc(tc.explanation)}</p>`;
      body += '</div>';
    });
    html += section('Table Controls', body, '📊');
  }

  /* 12 — Validations */
  if (a.validations?.length) {
    let body = '';
    a.validations.forEach(v => {
      body += `<div class="sub-section"><h3>${esc(v.field || v.name || v.description)}</h3>`;
      body += kv([['Module', v.module], ['Type', v.type], ['Trigger', v.trigger], ['Error Message', v.errorMessage]]);
      if (v.code) body += code(v.code);
      if (v.explanation) body += `<p>${esc(v.explanation)}</p>`;
      body += '</div>';
    });
    html += section('Validations', body, '✅');
  }

  /* 13 — Subroutines & Events */
  if (a.subroutines?.length || a.events?.length) {
    let body = '';
    (a.subroutines || []).forEach(s => {
      body += `<div class="sub-section"><h3>FORM ${esc(s.name)}</h3>`;
      body += `<p><strong>Purpose:</strong> ${esc(s.purpose)}</p>`;
      if (s.parameters?.length) {
        body += '<h4>Parameters</h4>' + table(['Name','Type','Passing','Description'],
          s.parameters.map(p => [p.name, p.type, p.passing, p.description]));
      }
      if (s.fullCode) body += code(s.fullCode);
      if (s.lineByLine?.length) {
        body += '<h4>Line-by-Line</h4><table><thead><tr><th>Code</th><th>Explanation</th></tr></thead><tbody>' +
          s.lineByLine.map(l => `<tr><td class="mono">${esc(l.line||l.code)}</td><td>${esc(l.explanation)}</td></tr>`).join('') +
          '</tbody></table>';
      }
      body += '</div>';
    });
    (a.events || []).forEach(e => {
      body += `<div class="sub-section"><h3>EVENT: ${esc(e.name)}</h3>`;
      body += `<p>${esc(e.purpose || e.description)}</p>`;
      if (e.code) body += code(e.code);
      body += '</div>';
    });
    html += section('Subroutines & Events', body, '⚙️');
  }

  /* 14 — Full Code + Explanation */
  if (a.fullCodeWithExplanation?.length) {
    let body = '';
    a.fullCodeWithExplanation.forEach(sec => {
      body += `<div class="sub-section"><h3>${esc(sec.section || sec.sectionName || sec.title)}</h3>`;
      if (sec.purpose) body += `<p><strong>Purpose:</strong> ${esc(sec.purpose)}</p>`;
      if (sec.explanation) body += `<p>${esc(sec.explanation)}</p>`;
      if (sec.code) body += code(sec.code);
      if (sec.lineByLine?.length) {
        body += '<h4>Line-by-Line</h4><table><thead><tr><th>Code</th><th>Explanation</th></tr></thead><tbody>' +
          sec.lineByLine.map(l => `<tr><td class="mono">${esc(l.line||l.code)}</td><td>${esc(l.explanation)}</td></tr>`).join('') +
          '</tbody></table>';
      }
      body += '</div>';
    });
    html += section('Full Code + Explanation', body, '📖');
  }

  /* 15 — Overall Flow */
  if (a.overallFlow || a.keyBusinessLogic) {
    let body = '';
    if (a.overallFlow) body += `<p>${esc(a.overallFlow)}</p>`;
    if (a.keyBusinessLogic) {
      if (typeof a.keyBusinessLogic === 'string') body += `<p>${esc(a.keyBusinessLogic)}</p>`;
      else if (Array.isArray(a.keyBusinessLogic)) {
        body += '<ul>' + a.keyBusinessLogic.map(b => `<li>${esc(typeof b === 'string' ? b : JSON.stringify(b))}</li>`).join('') + '</ul>';
      }
    }
    html += section('Overall Flow & Business Logic', body, '🔄');
  }

  const programName = pi.name || 'ABAP Program';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ABAP Inspector — ${esc(programName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
         font-size: 11pt; color: #1e293b; background: #fff; line-height: 1.6; }

  /* ── Cover ── */
  .cover { padding: 56px 64px 48px; border-bottom: 3px solid #2563eb; background: #0f172a;
            color: #fff; min-height: 100vh; display: flex; flex-direction: column;
            justify-content: space-between; box-sizing: border-box; }
  .cover-logo { font-size: 13px; font-weight: 700; color: #60a5fa; letter-spacing: .12em;
                text-transform: uppercase; margin-bottom: 24px; }
  .cover-title { font-size: 28pt; font-weight: 900; margin-bottom: 8px; }
  .cover-sub { font-size: 14pt; color: #94a3b8; margin-bottom: 32px; }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
  .cover-meta-item { font-size: 10pt; }
  .cover-meta-label { color: #64748b; font-size: 9pt; text-transform: uppercase;
                      letter-spacing: .06em; margin-bottom: 2px; }
  .cover-meta-val { color: #e2e8f0; font-weight: 600; }
  .cover-footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155;
                  font-size: 9pt; color: #475569; }

  /* ── TOC ── */
  .toc { padding: 36px 56px; page-break-after: always; }
  .toc h1 { font-size: 16pt; font-weight: 800; color: #1e293b; margin-bottom: 20px;
             border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  .toc-item { display: flex; align-items: baseline; gap: 8px;
               padding: 5px 0; border-bottom: 1px dotted #e2e8f0; font-size: 10.5pt; }
  .toc-num { color: #2563eb; font-weight: 700; min-width: 24px; }
  .toc-title { flex: 1; }
  .toc-pg { color: #94a3b8; font-size: 9pt; }

  /* ── Sections ── */
  .section { padding: 28px 56px 24px; border-bottom: 1px solid #e2e8f0; }
  .section:last-child { border-bottom: none; }
  .section h2 { font-size: 15pt; font-weight: 800; color: #1e3a8a; margin-bottom: 14px;
                padding-bottom: 8px; border-bottom: 2px solid #dbeafe; }
  .section h3 { font-size: 12pt; font-weight: 700; color: #1e293b; margin: 16px 0 8px; }
  .section h4 { font-size: 10.5pt; font-weight: 700; color: #334155; margin: 12px 0 6px; }
  .section h5 { font-size: 9.5pt; font-weight: 700; color: #475569; margin: 8px 0 4px; }
  .section p  { margin-bottom: 8px; color: #334155; }
  .section ul { padding-left: 20px; margin-bottom: 8px; }
  .section li { margin-bottom: 4px; color: #334155; }
  .objective { background: #eff6ff; border-left: 3px solid #2563eb; padding: 10px 14px;
               border-radius: 0 6px 6px 0; font-style: italic; color: #1e40af; margin-bottom: 12px; }
  .sub-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
                  padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .empty { color: #94a3b8; font-style: italic; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9.5pt; }
  th { background: #1e3a8a; color: #fff; text-align: left; padding: 6px 10px;
       font-weight: 600; font-size: 9pt; }
  td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  table.kv th { width: 160px; background: #f1f5f9; color: #475569; font-size: 9pt; }
  table.kv td { color: #1e293b; font-weight: 500; }
  .mono { font-family: 'Cascadia Code','Courier New',monospace; font-size: 8.5pt; color: #0f172a; }

  /* ── Code blocks ── */
  pre.code { background: #0d1117; color: #e6edf3; padding: 12px 16px; border-radius: 6px;
             font-family: 'Cascadia Code','Courier New',monospace; font-size: 8.5pt;
             line-height: 1.55; overflow-wrap: break-word; white-space: pre-wrap;
             margin-bottom: 10px; page-break-inside: avoid; }
  pre.mockup { background: #020617; color: #4ade80; padding: 12px 16px; border-radius: 6px;
               font-family: 'Courier New',monospace; font-size: 8.5pt; line-height: 1.55;
               white-space: pre; overflow-x: auto; margin-bottom: 10px; }

  /* ── Print ── */
  @media print {
    body { font-size: 9.5pt; }
    .cover { min-height: 0; height: 100vh; page-break-after: always; break-after: page; }
    .section + .section { page-break-before: always; break-before: page; }
    .sub-section { page-break-inside: avoid; break-inside: avoid; }
    pre.code { page-break-inside: avoid; break-inside: avoid; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    @page { margin: 18mm 16mm; size: A4; }
  }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <!-- Top branding -->
  <div>
    <div class="cover-logo">⚡ ABAP Inspector · Technical Analysis Report</div>
  </div>

  <!-- Center: title + meta -->
  <div>
    <div style="font-size:11px;font-weight:700;color:#3b82f6;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px">SAP Technical Documentation</div>
    <div class="cover-title">${esc(programName)}</div>
    <div class="cover-sub">${esc(pi.title || pi.type || 'Module Pool / Dialogue Program')}</div>
    <div style="width:60px;height:3px;background:#2563eb;margin:24px 0 32px;"></div>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Program Type</div>
        <div class="cover-meta-val">${esc(pi.type || '—')}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Logical System</div>
        <div class="cover-meta-val">${esc(pi.logicalSystem || '—')}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Generated</div>
        <div class="cover-meta-val">${esc(now)}</div>
      </div>
    </div>
  </div>

  <!-- Bottom stats footer -->
  <div class="cover-footer">
    Screens: ${(a.screens||[]).length} &nbsp;·&nbsp;
    PBO Modules: ${(a.pboModules||[]).length} &nbsp;·&nbsp;
    PAI Modules: ${(a.paiModules||[]).length} &nbsp;·&nbsp;
    Validations: ${(a.validations||[]).length} &nbsp;·&nbsp;
    Z-Tables: ${(db.zTables||[]).length}
  </div>
</div>

<!-- SECTIONS -->
${html}

</body>
</html>`;
}

/* ── ResultsPage ─────────────────────────────────────────────────────────── */

export default function ResultsPage({ analysis, modelLabel, onBack, onGoHome }) {
  const [activeSection, setActiveSection] = useState('overview');
  const sectionRefs = useRef({});
  const mainRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const scrollTo = (id) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el && mainRef.current) {
      mainRef.current.scrollTo({ top: el.offsetTop - 72, behavior: 'smooth' });
    }
  };

  const reg = (id) => (el) => { sectionRefs.current[id] = el; };

  const programName = analysis?.programInfo?.name || 'ABAP Program';
  const programType = analysis?.programInfo?.type || 'Module Pool';

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(analysis, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar analysis={analysis} activeSection={activeSection} onNavigate={scrollTo} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ── Top bar ── */}
        <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            {onGoHome && (
              <button onClick={onGoHome} className="lp-home-btn" title="Home">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
              </button>
            )}
            <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-colors shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
              New
            </button>
            <div className="w-px h-4 bg-slate-200 shrink-0" />
            <span className="font-mono font-bold text-slate-800 text-sm truncate">{programName}</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] rounded-full font-semibold shrink-0">{programType}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              {analysis?.screens?.length || 0} screens · {(analysis?.pboModules?.length || 0) + (analysis?.paiModules?.length || 0)} modules
            </span>
            <button onClick={handleCopyJSON} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">
              {copied ? '✓ Copied JSON' : 'Copy JSON'}
            </button>
            <button
              onClick={() => {
                const html = generatePrintHTML(analysis, modelLabel);
                const w = window.open('', '_blank');
                if (w) {
                  w.document.write(html);
                  w.document.close();
                  setTimeout(() => w.print(), 800);
                }
              }}
              className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Print / Export
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-5 py-6 space-y-5">

            <div ref={reg('overview')} className="section-card">
              <ProgramOverview data={analysis.programInfo} />
            </div>

            {analysis?.programInfo?.topModule?.exists && (
              <div ref={reg('topmodule')} className="section-card">
                <TopModule data={analysis.programInfo.topModule} />
              </div>
            )}

            <div ref={reg('global')} className="section-card">
              <GlobalData data={analysis.globalDeclarations} />
            </div>

            <div ref={reg('dbtables')} className="section-card">
              <DatabaseTables data={analysis.databaseTables} />
            </div>

            {(analysis?.screens || []).map((screen, i) => (
              <div key={i} ref={reg(`screen-${screen.number}`)} className="section-card">
                <ScreenAnalysis screen={screen} index={i} />
              </div>
            ))}

            {analysis?.pboModules?.length > 0 && (
              <div ref={reg('pbo')} className="section-card">
                <PBOSection data={analysis.pboModules} />
              </div>
            )}

            {analysis?.paiModules?.length > 0 && (
              <div ref={reg('pai')} className="section-card">
                <PAISection data={analysis.paiModules} />
              </div>
            )}

            {analysis?.guiStatuses?.length > 0 && (
              <div ref={reg('gui')} className="section-card">
                <GUIStatus data={analysis.guiStatuses} />
              </div>
            )}

            {analysis?.functionCodes?.length > 0 && (
              <div ref={reg('fcodes')} className="section-card">
                <FunctionCodes data={analysis.functionCodes} />
              </div>
            )}

            {analysis?.f4HelpPOV?.length > 0 && (
              <div ref={reg('f4')} className="section-card">
                <F4Help data={analysis.f4HelpPOV} />
              </div>
            )}

            {analysis?.tableControls?.length > 0 && (
              <div ref={reg('tablecontrol')} className="section-card">
                <TableControl data={analysis.tableControls} />
              </div>
            )}

            {analysis?.validations?.length > 0 && (
              <div ref={reg('validations')} className="section-card">
                <Validations data={analysis.validations} />
              </div>
            )}

            {((analysis?.subroutines?.length || 0) > 0 || (analysis?.events?.length || 0) > 0) && (
              <div ref={reg('subroutines')} className="section-card">
                <SubroutinesEvents subroutines={analysis.subroutines} events={analysis.events} />
              </div>
            )}

            <div ref={reg('fullcode')} className="section-card">
              <FullCode data={analysis.fullCodeWithExplanation} />
            </div>

            {(analysis?.overallFlow || analysis?.keyBusinessLogic) && (
              <div ref={reg('flow')} className="section-card">
                <OverallFlow analysis={analysis} />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
