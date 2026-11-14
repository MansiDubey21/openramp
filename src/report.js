// Before/after comparison and the downloadable HTML report.

export const DISCLAIMER =
  'Automated testing finds only some accessibility barriers. These results are not a WCAG conformance certificate ' +
  'or legal compliance advice. A manual review (keyboard and screen-reader testing) is still recommended.';

export function compareReports(before, after) {
  const ids = new Set([...before.violations.map((v) => v.id), ...after.violations.map((v) => v.id)]);
  const count = (r, id) => r.violations.find((v) => v.id === id)?.nodes.length || 0;
  const help = (id) => (before.violations.find((v) => v.id === id) || after.violations.find((v) => v.id === id)).help;
  const rows = [...ids].map((id) => ({ ruleId: id, help: help(id), before: count(before, id), after: count(after, id) }));
  rows.sort((a, b) => b.before - a.before);
  return {
    rows,
    beforeTotal: before.issueCount,
    afterTotal: after.issueCount,
    fixedCount: Math.max(0, before.issueCount - after.issueCount),
    newIssues: rows.filter((r) => r.after > r.before).map((r) => r.ruleId),
  };
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderReportHtml(session) {
  const { target, before, after, comparison, appliedFixes = [], needsHuman = [] } = session;
  const date = new Date().toISOString().slice(0, 10);
  const t = session.task;
  const verdict = (p) => (p.pass ? 'Can complete' : `Blocked or at risk: ${esc(p.issues.join(' '))}`);
  const taskHtml = t?.taskFound
    ? `<h2>Customer task check: "${esc(t.text)}"</h2>
<p>Task elements were identified by AI. Every verdict was measured in a real browser (Tab-key walk, screenshot focus comparison, browser accessibility tree, axe-core contrast).</p>
<table><thead><tr><th>Customer</th><th>Before</th>${t.after ? '<th>After fixes</th>' : ''}</tr></thead><tbody>
${t.before.profiles.map((p, i) => `<tr><td>${esc(p.title)}</td><td>${verdict(p)}</td>${t.after ? `<td>${verdict(t.after.profiles[i])}</td>` : ''}</tr>`).join('')}
</tbody></table>
<p><strong>What a blind customer hears (before):</strong> ${esc(t.before.transcript.map((x) => x.text).join(' → '))}</p>
${t.after ? `<p><strong>After fixes:</strong> ${esc(t.after.transcript.map((x) => x.text).join(' → '))}</p>` : ''}`
    : '';
  const issues = before.violations
    .map(
      (v) => `<section><h3>${esc(v.help)} <small>(${esc(v.id)}, ${esc(v.impact)}, ${v.nodes.length} element${v.nodes.length === 1 ? '' : 's'})</small></h3>
<p>${esc(v.description)} <a href="${esc(v.helpUrl)}">Learn more</a>. WCAG: ${esc(v.wcag.join(', ') || 'n/a')}</p>
<ul>${v.nodes.map((n) => `<li><code>${esc(n.selector)}</code><pre>${esc(n.html)}</pre></li>`).join('')}</ul></section>`,
    )
    .join('');
  const fixes = appliedFixes
    .map((f) => `<tr><td>${esc(f.rule_id)}</td><td><code>${esc(f.selector)}</code></td><td>${esc(f.action)} ${esc(f.name)} = <code>${esc(f.value)}</code></td><td>${esc(f.explanation)}</td></tr>`)
    .join('');
  const compRows = comparison
    ? comparison.rows.map((r) => `<tr><td>${esc(r.help)} <small>(${esc(r.ruleId)})</small></td><td>${r.before}</td><td>${r.after}</td></tr>`).join('')
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>OpenRamp accessibility report: ${esc(target)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#1d1d1f;line-height:1.5}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.4rem;text-align:left;vertical-align:top}
pre{white-space:pre-wrap;background:#f4f4f4;padding:.5rem;font-size:.85rem}.note{background:#fff6d6;border-left:4px solid #b58300;padding:.75rem}</style></head>
<body><h1>Accessibility report</h1>
<p><strong>Page:</strong> ${esc(target)}<br><strong>Date:</strong> ${date}<br><strong>Engine:</strong> ${esc(before.engine)} (rules: ${esc(before.tags.join(', '))})</p>
<p class="note">${esc(DISCLAIMER)}</p>
<h2>Summary</h2>
<p>Issues found: <strong>${before.issueCount}</strong> (critical ${before.byImpact.critical}, serious ${before.byImpact.serious}, moderate ${before.byImpact.moderate}, minor ${before.byImpact.minor}).
Items needing manual review: ${before.needsReviewCount}.</p>
${after ? `<p>After the approved fixes were applied to a copy and re-scanned: <strong>${after.issueCount}</strong> issues remain.</p>` : ''}
${Object.values(session.summaries || {})
  .map(
    (sm) => `<section lang="${esc(sm.bcp47)}"><h2>${esc(sm.headline)}</h2><p>${esc(sm.summary)}</p><ol>${sm.next_steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
<p lang="en"><small>Plain-language summary written by Claude from the measured results.</small></p></section>`,
  )
  .join('')}
${taskHtml}
${compRows ? `<h2>Before and after</h2><table><thead><tr><th>Rule</th><th>Before</th><th>After</th></tr></thead><tbody>${compRows}</tbody></table>` : ''}
${fixes ? `<h2>Approved fixes</h2><table><thead><tr><th>Rule</th><th>Element</th><th>Change</th><th>Why it matters</th></tr></thead><tbody>${fixes}</tbody></table>` : ''}
${needsHuman.length ? `<h2>Needs a person</h2><ul>${needsHuman.map((n) => `<li><code>${esc(n.selector)}</code> (${esc(n.rule_id)}): ${esc(n.reason)}</li>`).join('')}</ul>` : ''}
<h2>Detected issues (evidence)</h2>${issues || '<p>No automatically detectable issues.</p>'}
<p><small>Generated by OpenRamp. Fix proposals were written by Claude (Anthropic) and approved by the site owner.</small></p>
</body></html>`;
}
