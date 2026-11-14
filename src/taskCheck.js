// Customer Task Check: "Can every customer complete the task this business cares about?"
// Claude's only job here is to identify WHICH elements complete the owner's task (validated against the real list).
// Everything else is measured in the browser:
//   - keyboard: real Tab key presses, focus order, visible focus indicator (screenshot comparison)
//   - screen reader: role + accessible name computed by Chromium's accessibility tree (DevTools protocol)
//   - low vision: axe-core colour-contrast findings on the task's elements
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const TASK_MODEL = process.env.TASK_MODEL || 'claude-haiku-5-5';
const PRICE = { input: 0.1, output: 0.5 }; // USD per million tokens, claude-haiku-5-5 (prompts <100K)
const MAX_ELEMENTS = 150;
const MAX_TABS = 120;

export class TaskCheckError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const TaskInputSchema = z.string().trim().min(3, 'Please describe the task in a few words.').max(120, 'Please keep the task under 120 characters.');

/** Lists visible interactive elements in document order, tagging each with data-openramp-id. */
async function collectInteractive(page) {
  const elements = await page.evaluate((max) => {
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]';
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.disabled;
    };
    return [...document.querySelectorAll(sel)]
      .filter(visible)
      .slice(0, max)
      .map((el, i) => {
        el.setAttribute('data-openramp-id', String(i));
        const region = el.closest('form, section, header, footer, nav, main, article, aside');
        const heading = region?.querySelector('h1, h2, h3, h4')?.innerText || '';
        const img = el.querySelector('img');
        // Stable structural selector (used only for code-generated focus fixes).
        const parts = [];
        for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
          const tag = n.tagName.toLowerCase();
          const sameTag = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [n];
          parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(n) + 1})` : tag);
        }
        return {
          id: i,
          cssPath: parts.join(' > '),
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || '',
          text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          href: (el.getAttribute('href') || '').slice(0, 120),
          placeholder: el.getAttribute('placeholder') || '',
          nameAttr: el.getAttribute('name') || '',
          imageFile: img ? (img.getAttribute('src') || '').split('/').pop().slice(0, 60) : '',
          options: el.tagName === 'SELECT' ? [...el.options].slice(0, 6).map((o) => o.text.trim()) : [],
          region: region ? region.tagName.toLowerCase() : '',
          regionHeading: heading.replace(/\s+/g, ' ').trim().slice(0, 80),
        };
      });
  }, MAX_ELEMENTS);

  // Role and accessible name exactly as Chromium exposes them to screen readers.
  const cdp = await page.context().newCDPSession(page);
  try {
    for (const el of elements) {
      const { result } = await cdp.send('Runtime.evaluate', { expression: `document.querySelector('[data-openramp-id="${el.id}"]')` });
      if (!result.objectId) continue;
      const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false });
      const node = nodes.find((n) => !n.ignored) || nodes[0];
      el.role = node?.role?.value || el.tag;
      el.name = String(node?.name?.value || '').replace(/\s+/g, ' ').trim();
    }
  } finally {
    await cdp.detach().catch(() => {});
  }
  return elements;
}

const ROLE_WORDS = { textbox: 'edit text', combobox: 'combo box', button: 'button', link: 'link', checkbox: 'check box', radio: 'radio button', searchbox: 'search edit text', listbox: 'list box' };

/** Approximates how a screen reader announces an element: "Subscribe, button". */
export function announce(el) {
  const role = ROLE_WORDS[el.role] || el.role || el.tag;
  return el.name ? `${el.name}, ${role}` : role;
}

/** Asks Claude which elements a customer must use to complete the task. Returns validated ids. */
async function pickGoalElements(task, elements, client) {
  if (!client && !process.env.ANTHROPIC_API_KEY) throw new TaskCheckError('NOT_CONFIGURED', 'AI is not configured on this server (missing API key).');
  const anthropic = client || new Anthropic();
  const list = elements.map((e) => {
    const o = { id: e.id, tag: e.tag, role: e.role, accessible_name: e.name || '(none)' };
    for (const k of ['type', 'text', 'href', 'placeholder', 'nameAttr', 'imageFile', 'region', 'regionHeading']) if (e[k]) o[k] = e[k];
    if (e.options.length) o.options = e.options;
    return o;
  });
  let response;
  try {
    response = await anthropic.messages.create({
      model: TASK_MODEL,
      max_tokens: 2000,
      system:
        'You map a business owner\'s plain-language customer task to the interactive elements on their web page. ' +
        'Pick ONLY ids from the list, in the order a customer would use them (e.g. fields first, then the submit button). ' +
        'Many elements have no accessible name; use href, imageFile, placeholder, region and regionHeading as clues. ' +
        'If nothing on the page plausibly completes the task, set task_found to false and return an empty list. ' +
        'Explain your choice in one short plain-language sentence.',
      messages: [{ role: 'user', content: `Customer task: "${task}"\n\nInteractive elements:\n${JSON.stringify(list)}` }],
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              task_found: { type: 'boolean' },
              goal_ids: { type: 'array', items: { type: 'integer' } },
              explanation: { type: 'string' },
            },
            required: ['task_found', 'goal_ids', 'explanation'],
            additionalProperties: false,
          },
        },
      },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new TaskCheckError('RATE_LIMIT', 'The AI service is busy. Please try again in a minute.');
    if (e instanceof Anthropic.APIError) throw new TaskCheckError('API_ERROR', `The AI service returned an error (${e.status ?? 'network'}).`);
    throw e;
  }
  if (response.stop_reason === 'refusal') throw new TaskCheckError('REFUSAL', 'The AI declined this request.');
  const text = response.content.find((b) => b.type === 'text')?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TaskCheckError('BAD_OUTPUT', 'The AI returned an unexpected format.');
  }
  const valid = new Set(elements.map((e) => e.id));
  const goalIds = [...new Set((Array.isArray(parsed.goal_ids) ? parsed.goal_ids : []).filter((id) => Number.isInteger(id) && valid.has(id)))].slice(0, 8);
  const u = response.usage || {};
  const usage = {
    model: TASK_MODEL,
    inputTokens: u.input_tokens || 0,
    outputTokens: u.output_tokens || 0,
    estimatedCostUsd: Math.round((((u.input_tokens || 0) * PRICE.input + (u.output_tokens || 0) * PRICE.output) / 1e6) * 10000) / 10000,
  };
  return { taskFound: Boolean(parsed.task_found) && goalIds.length > 0, goalIds, explanation: String(parsed.explanation || '').slice(0, 400), usage };
}

/** Presses Tab repeatedly from the top of the page and records which tagged elements receive focus. */
async function keyboardWalk(page, goalIds) {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  const sequence = [];
  const reachedAt = {};
  const remaining = new Set(goalIds);
  let lastId = null;
  let repeats = 0;
  for (let i = 1; i <= MAX_TABS && remaining.size; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const a = document.activeElement;
      const v = a?.getAttribute?.('data-openramp-id');
      return v === null || v === undefined ? (a === document.body || !a ? 'body' : 'other') : Number(v);
    });
    sequence.push(id);
    if (typeof id === 'number' && remaining.has(id)) {
      reachedAt[id] = i;
      remaining.delete(id);
    }
    repeats = id === lastId ? repeats + 1 : 0;
    lastId = id;
    if (repeats >= 3) break; // focus stuck on one element
    if (id === 'body' && i > 1) break; // reached the end of the page and wrapped around
  }
  return { reachedAt, unreached: [...remaining], presses: sequence.length, sequence, stuck: repeats >= 3 };
}

/** True if focusing the element visibly changes the pixels around it (an outline, ring, colour change...). */
async function hasVisibleFocus(page, id) {
  const loc = page.locator(`[data-openramp-id="${id}"]`);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const box = await loc.boundingBox();
  if (!box) return null;
  const vp = page.viewportSize();
  const pad = 6;
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: Math.min(box.width + pad * 2, vp.width - Math.max(0, box.x - pad)),
    height: Math.min(box.height + pad * 2, vp.height - Math.max(0, box.y - pad)),
  };
  if (clip.width <= 0 || clip.height <= 0) return null;
  await page.evaluate(() => document.activeElement?.blur?.());
  const unfocused = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  await page.evaluate((i) => document.querySelector(`[data-openramp-id="${i}"]`)?.focus({ focusVisible: true }), id);
  // A real keyboard focus (not a mouse click) is what triggers :focus-visible styles.
  await page.keyboard.press('Shift');
  const focused = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  return !unfocused.equals(focused);
}

/** Elements on the task path that axe-core flagged for colour contrast. */
async function contrastProblems(page, goalIds, report) {
  const selectors = (report.violations.find((v) => v.id === 'color-contrast')?.nodes || []).map((n) => n.simpleSelector).filter(Boolean);
  if (!selectors.length) return [];
  return page.evaluate(
    ({ ids, sels }) => {
      const out = [];
      for (const id of ids) {
        const goal = document.querySelector(`[data-openramp-id="${id}"]`);
        if (!goal) continue;
        for (const s of sels) {
          let node = null;
          try {
            node = document.querySelector(s);
          } catch {
            continue;
          }
          if (node && (goal.contains(node) || node.contains(goal))) {
            out.push(id);
            break;
          }
        }
      }
      return out;
    },
    { ids: goalIds, sels: selectors },
  );
}

/**
 * Runs the measured checks for given goal ids on an open page.
 * @returns per-profile verdicts with plain-language evidence and a screen-reader transcript.
 */
async function measure(page, elements, goalIds, report) {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const label = (id) => {
    const e = byId.get(id);
    const role = ROLE_WORDS[e.role] || e.role || e.tag;
    if (e.name) return `"${short(e.name)}" ${role}`;
    const hint = e.tag !== 'select' && e.text ? `"${short(e.text)}" ` : ''; // option lists are not a description
    return `the ${hint}${role}${e.imageFile ? ` (image ${e.imageFile})` : ''}`;
  };

  const walk = await keyboardWalk(page, goalIds);
  const focusVisible = {};
  for (const id of goalIds) if (walk.reachedAt[id]) focusVisible[id] = await hasVisibleFocus(page, id);
  const lowContrast = await contrastProblems(page, goalIds, report);

  const kbIssues = [];
  for (const id of walk.unreached) kbIssues.push(`${cap(label(id))} cannot be reached with the Tab key.`);
  for (const id of goalIds) if (focusVisible[id] === false) kbIssues.push(`When ${label(id)} has keyboard focus, nothing changes on screen, so the customer can't see where they are.`);
  if (walk.stuck) kbIssues.push('Keyboard focus got stuck on one element.');

  const srIssues = [];
  for (const id of goalIds) {
    const e = byId.get(id);
    if (!e.name) srIssues.push(`A screen reader announces ${label(id)} only as "${announce(e)}", so a blind customer can't tell what it does.`);
  }

  const lvIssues = lowContrast.map((id) => `${cap(label(id))} has low colour contrast and may be unreadable for customers with low vision.`);

  // Transcript: what a screen-reader user hears tabbing from the top of the page to the last task element.
  const lastStep = Math.max(0, ...Object.values(walk.reachedAt));
  const steps = (lastStep ? walk.sequence.slice(0, lastStep) : walk.sequence.slice(0, 12)).filter((x) => typeof x === 'number').slice(0, 30);
  const transcript = steps.map((id) => ({ id, text: announce(byId.get(id)), isGoal: goalIds.includes(id) }));

  // Mechanical, code-generated fix for invisible focus (no AI): add a visible focus outline. Owner still approves it.
  const taskFixes = goalIds
    .filter((id) => focusVisible[id] === false)
    .map((id, i) => ({
      id: `task-fix-${i + 1}`,
      rule_id: 'focus-visible (keyboard test)',
      selector: byId.get(id).cssPath,
      action: 'add_focus_style',
      name: 'outline',
      value: '3px solid #1a1a1a',
      explanation: `OpenRamp's keyboard test found that ${label(id)} shows no change when it has keyboard focus. Adding a clear outline lets keyboard users see where they are. (Automated rule scanners can't detect this.)`,
      confidence: 'high',
      source: 'keyboard-test',
    }));

  const profiles = [
    { key: 'keyboard', title: 'Keyboard-only customer', pass: kbIssues.length === 0, issues: kbIssues, evidence: lastStep ? `Reached the last task element after ${lastStep} Tab presses.` : `Pressed Tab ${walk.presses} times.` },
    { key: 'screenreader', title: 'Blind customer (screen reader)', pass: srIssues.length === 0, issues: srIssues, evidence: 'Names and roles read from the browser accessibility tree.' },
    { key: 'lowvision', title: 'Low-vision customer', pass: lvIssues.length === 0, issues: lvIssues, evidence: 'Colour contrast measured by axe-core on the task elements.' },
  ];
  for (const p of profiles) p.issues = groupRepeats(p.issues);
  return {
    taskFixes,
    profiles,
    transcript,
    goals: goalIds.map((id) => ({ id, announcement: announce(byId.get(id)), tag: byId.get(id).tag, tabPresses: walk.reachedAt[id] || null, focusVisible: focusVisible[id] ?? null })),
  };
}

/** "X" ×3 instead of the same sentence three times. */
function groupRepeats(issues) {
  const counts = new Map();
  for (const i of issues) counts.set(i, (counts.get(i) || 0) + 1);
  return [...counts].map(([text, n]) => (n > 1 ? `${text} (${n} elements)` : text));
}

function short(s, max = 40) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Step 1: pick the task elements on the original page (AI), then measure (no AI). */
export async function checkTaskOnPage(page, task, report, { client } = {}) {
  const elements = await collectInteractive(page);
  if (!elements.length) throw new TaskCheckError('NO_ELEMENTS', 'This page has no interactive elements to test.');
  const pick = await pickGoalElements(task, elements, client);
  const signature = pick.goalIds.map((id) => elements.find((e) => e.id === id).tag);
  if (!pick.taskFound) return { task, taskFound: false, explanation: pick.explanation, goalIds: [], signature, result: null, usage: pick.usage };
  const result = await measure(page, elements, pick.goalIds, report);
  return { task, taskFound: true, explanation: pick.explanation, goalIds: pick.goalIds, signature, result, usage: pick.usage };
}

/** Step 2: re-measure the SAME elements on the fixed copy (no AI call). */
export async function recheckTaskOnPage(page, goalIds, signature, report) {
  const elements = await collectInteractive(page);
  const same = goalIds.every((id, i) => elements.find((e) => e.id === id)?.tag === signature[i]);
  if (!same) throw new TaskCheckError('MISMATCH', 'Could not match the task elements on the fixed copy.');
  return measure(page, elements, goalIds, report);
}
