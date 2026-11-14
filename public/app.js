// OpenRamp front end. All dynamic text is inserted with textContent (no innerHTML with data).
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { scanId: null, fixes: [], taskFixes: [], task: null };

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style') node.style.cssText = v; // CSSOM: allowed under our strict CSP (style attributes are not)
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return node;
  }

  function setStatus(target, message, kind = '') {
    const box = $(target);
    box.className = `status ${kind}`;
    box.replaceChildren();
    if (kind === 'loading') box.append(el('span', { class: 'spinner', 'aria-hidden': 'true' }));
    if (message) box.append(message);
  }

  async function api(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON error */ }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    return data;
  }

  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.setAttribute('aria-busy', String(on));
  }

  const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];
  const impactLabel = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };

  // ---------- Step 1: scan ----------
  async function runScan(body, btn) {
    for (const id of ['results', 'fixes', 'verify']) $(id).hidden = true;
    setStatus('status', 'Loading the page and running the accessibility engine… this can take up to a minute.', 'loading');
    busy(btn, true);
    try {
      const data = await api('/api/scan', body);
      state.scanId = data.scanId;
      state.fixes = [];
      state.taskFixes = [];
      state.task = null;
      stopSpeaking();
      for (const id of ['task-result', 'task-after', 'fix-list', 'needs-human']) $(id).replaceChildren();
      $('task-input').value = '';
      renderResults(data);
      setStatus('status', `Scan complete: ${data.before.issueCount} issue${data.before.issueCount === 1 ? '' : 's'} found.`, 'success');
      $('results').hidden = false;
      $('results-title').focus();
    } catch (e) {
      setStatus('status', e.message, 'error');
    } finally {
      busy(btn, false);
    }
  }

  $('scan-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const url = $('url').value.trim();
    if (!url) {
      setStatus('status', 'Please enter a website address, for example https://example.com', 'error');
      $('url').focus();
      return;
    }
    runScan({ url: /^https?:\/\//i.test(url) ? url : `https://${url}` }, ev.submitter);
  });
  $('demo-btn').addEventListener('click', (ev) => runScan({ sample: 'bakery' }, ev.currentTarget));

  function renderResults(data) {
    const r = data.before;
    $('results-target').textContent = `Page: ${data.target} · Engine: ${r.engine} · ${r.passedRuleCount} rules passed`;
    $('disclaimer').textContent = data.disclaimer;
    $('disclaimer-2').textContent = data.disclaimer;
    const reportHref = `/api/scan/${encodeURIComponent(state.scanId)}/report.html`;
    $('report-link-1').href = reportHref;
    $('report-link-2').href = reportHref;

    const stats = [el('div', { class: 'stat total' }, el('span', { class: 'num', text: r.issueCount }), el('span', { class: 'lbl', text: 'issues found' }))];
    for (const imp of IMPACTS) stats.push(el('div', { class: 'stat' }, el('span', { class: 'num', text: r.byImpact[imp] || 0 }), el('span', { class: 'lbl', text: `${impactLabel[imp]}` })));
    stats.push(el('div', { class: 'stat' }, el('span', { class: 'num', text: r.needsReviewCount }), el('span', { class: 'lbl', text: 'need manual review' })));
    $('summary').replaceChildren(...stats);

    const list = r.violations.map((v) =>
      el('details', { class: 'issue' },
        el('summary', {}, el('span', { class: `badge ${v.impact}`, text: impactLabel[v.impact] || v.impact }), el('span', { text: v.help }), el('span', { class: 'count', text: `${v.nodes.length} element${v.nodes.length === 1 ? '' : 's'}` })),
        el('div', { class: 'issue-body' },
          el('p', {}, v.description, ' ', el('a', { href: v.helpUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Learn more (opens in new tab)' })),
          el('p', { class: 'muted small', text: `Rule: ${v.id} · WCAG success criteria: ${formatWcag(v.wcag)}` }),
          v.nodes.map((n) =>
            el('div', { class: 'node' },
              el('div', {}, el('strong', { text: 'Element: ' }), el('code', { text: n.selector })),
              el('pre', { text: n.html }),
              n.contrast ? contrastLine(n.contrast) : null,
              el('p', { class: 'small muted', text: n.failureSummary }),
            ),
          ),
        ),
      ),
    );
    $('issues').replaceChildren(...(list.length ? list : [el('p', { text: 'No automatically detectable issues. Great start! A manual check is still recommended.' })]));
    $('propose-btn').hidden = r.issueCount === 0;
  }

  // "wcag412" -> "4.1.2"; level tags like "wcag2a" are dropped.
  function formatWcag(tags) {
    const sc = tags.filter((t) => /^wcag\d{3,4}$/.test(t)).map((t) => t.slice(4).split('').join('.').replace(/^(\d)\.(\d)\.(\d)\.(\d)$/, '$1.$2.$3$4'));
    return sc.join(', ') || 'n/a';
  }

  function contrastLine(c) {
    return el('p', { class: 'small' },
      'Text ', el('span', { class: 'swatch', style: `background:${c.fgColor}`, 'aria-hidden': 'true' }), el('code', { text: c.fgColor }),
      ' on ', el('span', { class: 'swatch', style: `background:${c.bgColor}`, 'aria-hidden': 'true' }), el('code', { text: c.bgColor }),
      ` = ${c.ratio}:1 (needs ${c.expected})`);
  }

  // ---------- Step 2: AI proposals ----------
  $('propose-btn').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    setStatus('status', 'Claude is reviewing the findings, checking colours and looking at images…', 'loading');
    busy(btn, true);
    try {
      const data = await api(`/api/scan/${encodeURIComponent(state.scanId)}/propose`);
      state.fixes = data.fixes;
      renderFixes(data);
      setStatus('status', `${data.fixes.length} fix${data.fixes.length === 1 ? '' : 'es'} proposed. Please review them.`, 'success');
      $('fixes').hidden = false;
      $('fixes-title').focus();
    } catch (e) {
      setStatus('status', e.message, 'error');
    } finally {
      busy(btn, false);
    }
  });

  function describeChange(f) {
    if (f.action === 'add_focus_style') return ['Add a visible keyboard focus outline ', el('span', { class: 'badge conf', text: 'found by keyboard test' })];
    if (f.action === 'set_document_title') return ['Set page title to ', el('code', { text: `"${f.value}"` })];
    if (f.action === 'set_css') return ['Change ', el('code', { text: f.name }), ' to ', el('span', { class: 'swatch', style: `background:${f.value}`, 'aria-hidden': 'true' }), el('code', { text: f.value })];
    if (f.name === 'alt' && f.value === '') return ['Mark as decorative: ', el('code', { text: 'alt=""' })];
    return ['Set ', el('code', { text: f.name }), ' to ', el('code', { text: `"${f.value}"` })];
  }

  function renderFixes(data) {
    state.fixes = data.fixes;
    renderFixList();
    renderFixNotes(data);
  }

  // AI proposals + code-generated keyboard-test fixes, in one reviewable list. Keeps the owner's untick choices.
  function renderFixList() {
    const unticked = new Set([...document.querySelectorAll('#fix-list input[type=checkbox]:not(:checked)')].map((c) => c.value));
    const all = [...state.fixes, ...state.taskFixes];
    $('fix-list').replaceChildren(
      ...all.map((f) =>
        el('li', { class: 'fix' },
          el('input', { type: 'checkbox', id: `chk-${f.id}`, value: f.id, checked: !unticked.has(f.id), 'aria-describedby': `desc-${f.id}` }),
          el('div', {},
            el('label', { for: `chk-${f.id}` }, describeChange(f)),
            el('p', { class: 'small muted' }, 'Element ', el('code', { text: f.selector }), ` · rule ${f.rule_id} · `, el('span', { class: 'badge conf', text: `${f.confidence} confidence` })),
            el('p', { id: `desc-${f.id}`, text: f.explanation }),
          ),
        ),
      ),
    );
    $('apply-btn').hidden = all.length === 0;
  }

  function renderFixNotes(data) {
    const nh = data.needsHuman || [];
    const notes = [];
    if (data.notSentCount > 0) notes.push(el('p', { class: 'disclaimer', text: `${data.notSentCount} affected element${data.notSentCount === 1 ? ' was' : 's were'} not sent to the AI in this pass (page too large or element inside a frame). They still appear in the report and need manual fixing.` }));
    if (data.rejectedCount > 0) notes.push(el('p', { class: 'muted small', text: `${data.rejectedCount} AI suggestion${data.rejectedCount === 1 ? ' was' : 's were'} discarded by our safety checks.` }));
    $('needs-human').replaceChildren(
      ...(nh.length
        ? [el('h3', { text: 'Needs a person' }), el('ul', {}, nh.map((n) => el('li', {}, el('code', { text: n.selector }), ` (${n.rule_id}): ${n.reason}`)))]
        : []),
      ...notes,
    );
    const u = data.usage;
    $('usage').textContent = u ? `AI cost for this run: about $${u.estimatedCostUsd.toFixed(3)} (${u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens} input / ${u.outputTokens} output tokens)` : '';
  }

  // ---------- Customer task check ----------
  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function hearBlock(title, transcript) {
    const list = el('ol', { class: 'transcript' }, transcript.map((t) => el('li', { class: t.isGoal ? 'goal' : '', text: t.text })));
    const row = el('div', { class: 'hear-row' }, el('h4', { text: title }));
    if ('speechSynthesis' in window && transcript.length) {
      const btn = el('button', { type: 'button', class: 'btn btn-secondary btn-small', text: '▶ Play' });
      btn.addEventListener('click', () => {
        if (window.speechSynthesis.speaking) {
          stopSpeaking();
          btn.textContent = '▶ Play';
          return;
        }
        const u = new SpeechSynthesisUtterance(transcript.map((t) => t.text).join('. '));
        u.rate = 0.95;
        u.onend = () => { btn.textContent = '▶ Play'; };
        btn.textContent = '■ Stop';
        window.speechSynthesis.speak(u);
      });
      row.append(btn);
    }
    return el('div', {}, row, list);
  }

  function profileCards(result) {
    return el('div', { class: 'profiles' },
      result.profiles.map((p) =>
        el('div', { class: 'profile' },
          el('h4', { text: p.title }),
          el('span', { class: `verdict ${p.pass ? 'pass' : 'fail'}`, text: p.pass ? '✓ Can complete the task' : '✗ Blocked or at risk' }),
          p.issues.length ? el('ul', {}, p.issues.map((i) => el('li', { text: i }))) : null,
          el('p', { class: 'small muted', text: p.evidence }),
        ),
      ),
    );
  }

  function renderTask(task) {
    const box = $('task-result');
    if (!task.taskFound) {
      box.replaceChildren(el('p', { class: 'disclaimer', text: `No elements on this page appear to complete "${task.text}". ${task.explanation}` }));
      return;
    }
    box.replaceChildren(
      el('p', {}, el('strong', { text: 'Task elements found: ' }), task.explanation),
      profileCards(task.before),
      hearBlock('What a blind customer hears, tabbing to this task', task.before.transcript),
      el('p', { class: 'small muted', text: `Elements identified by Claude (about $${(task.usage?.estimatedCostUsd || 0).toFixed(4)}). All verdicts above are measured in a real browser, not AI-generated.` }),
    );
  }

  document.querySelectorAll('.task-example').forEach((b) => b.addEventListener('click', () => {
    $('task-input').value = b.textContent.trim();
    $('task-input').focus();
  }));

  $('task-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const task = $('task-input').value.trim();
    if (task.length < 3) {
      setStatus('status', 'Please describe the customer task in a few words.', 'error');
      $('task-input').focus();
      return;
    }
    const btn = ev.submitter;
    stopSpeaking();
    setStatus('status', 'Finding the task on the page and testing it with keyboard, screen-reader and contrast checks…', 'loading');
    busy(btn, true);
    try {
      const data = await api(`/api/scan/${encodeURIComponent(state.scanId)}/task`, { task });
      state.task = data.task;
      state.taskFixes = data.taskFixes || [];
      renderTask(data.task);
      if (data.task.after) renderTaskAfter(data.task);
      const blocked = data.task.taskFound ? data.task.before.profiles.filter((p) => !p.pass).length : 0;
      setStatus('status', data.task.taskFound ? `Task tested: ${blocked} of 3 customer groups blocked or at risk.` : 'That task was not found on this page.', data.task.taskFound ? 'success' : 'error');
      if (state.taskFixes.length) {
        renderFixList();
        $('fixes').hidden = false;
      }
    } catch (e) {
      setStatus('status', e.message, 'error');
    } finally {
      busy(btn, false);
    }
  });

  function renderTaskAfter(task) {
    if (!task?.taskFound || !task.after) {
      $('task-after').replaceChildren();
      return;
    }
    const rows = task.before.profiles.map((p, i) => {
      const a = task.after.profiles[i];
      const word = (x) => (x.pass ? '✓ can complete' : '✗ blocked');
      return el('li', {}, el('strong', { text: `${p.title}: ` }), `${word(p)} → `, el('span', { class: `verdict ${a.pass ? 'pass' : 'fail'}`, text: word(a) }));
    });
    $('task-after').replaceChildren(
      el('div', { class: 'task-after-card' },
        el('h3', { text: `Customer task after fixes: "${task.text}"` }),
        el('ul', {}, rows),
        el('div', { class: 'task-compare' },
          hearBlock('Before: what a blind customer hears', task.before.transcript),
          hearBlock('After: what a blind customer hears', task.after.transcript),
        ),
        task.after.profiles.some((p) => !p.pass) ? profileCards(task.after) : null,
      ),
    );
  }

  const setAll = (on) => document.querySelectorAll('#fix-list input[type=checkbox]').forEach((c) => { c.checked = on; });
  $('select-all').addEventListener('click', () => setAll(true));
  $('select-none').addEventListener('click', () => setAll(false));

  // ---------- Step 3: apply to copy + verify ----------
  $('apply-btn').addEventListener('click', async (ev) => {
    const fixIds = [...document.querySelectorAll('#fix-list input[type=checkbox]:checked')].map((c) => c.value);
    if (!fixIds.length) {
      setStatus('status', 'Please select at least one fix.', 'error');
      return;
    }
    const btn = ev.currentTarget;
    setStatus('status', 'Applying your approved fixes to a copy and re-running the accessibility engine…', 'loading');
    busy(btn, true);
    try {
      const data = await api(`/api/scan/${encodeURIComponent(state.scanId)}/apply`, { fixIds });
      renderVerify(data);
      if (data.task) {
        state.task = data.task;
        renderTaskAfter(data.task);
      }
      const c = data.comparison;
      setStatus('status', `Re-test complete: ${c.beforeTotal} issues before, ${c.afterTotal} after.`, 'success');
      $('verify').hidden = false;
      $('verify-title').focus();
    } catch (e) {
      setStatus('status', e.message, 'error');
    } finally {
      busy(btn, false);
    }
  });

  function renderVerify(data) {
    const c = data.comparison;
    $('big-compare').replaceChildren(
      el('div', { class: 'before' }, el('span', { class: 'num', text: c.beforeTotal }), el('div', { text: 'issues before' })),
      el('span', { class: 'arrow', 'aria-hidden': 'true', text: '→' }),
      el('div', { class: 'after' }, el('span', { class: 'num', text: c.afterTotal }), el('div', { text: 'issues after' })),
      el('p', { class: 'muted', text: `${c.fixedCount} issue${c.fixedCount === 1 ? '' : 's'} resolved, confirmed by re-scan with the same engine and rules.${c.newIssues.length ? ` New issues: ${c.newIssues.join(', ')}.` : ''}` }),
    );
    $('compare-body').replaceChildren(
      ...c.rows.map((r) =>
        el('tr', {}, el('td', {}, r.help, ' ', el('span', { class: 'muted small', text: `(${r.ruleId})` })), el('td', { text: r.before }), el('td', { class: r.after < r.before ? 'good' : r.after > r.before ? 'bad' : '', text: r.after })),
      ),
    );
    const base = `/api/scan/${encodeURIComponent(state.scanId)}`;
    $('preview').src = `${base}/preview?t=${Date.now()}`;
    $('download-fixed').href = `${base}/fixed.html`;
  }

  // ---------- Contact form ----------
  $('contact-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    if (!body.name.trim() || !body.email.trim() || body.message.trim().length < 10) {
      setStatus('contact-status', 'Please fill in your name, a valid email and a message of at least 10 characters.', 'error');
      return;
    }
    const btn = form.querySelector('button[type=submit]');
    setStatus('contact-status', 'Sending…', 'loading');
    busy(btn, true);
    try {
      await api('/api/contact', body);
      form.reset();
      setStatus('contact-status', 'Thank you! Your message has been sent.', 'success');
    } catch (e) {
      setStatus('contact-status', e.message, 'error');
    } finally {
      busy(btn, false);
    }
  });
})();
