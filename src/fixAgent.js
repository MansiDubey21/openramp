// Claude tool-use agent: turns REAL axe-core findings into reviewable, allow-listed fix proposals.
// Claude never sees invented scan data and cannot apply anything itself: it only proposes.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { checkContrast, suggestAccessibleColor } from './contrast.js';
import { ALLOWED_ATTRIBUTES, ALLOWED_CSS } from './scanner.js';

export const FIX_MODEL = process.env.FIX_MODEL || 'claude-sonnet-5-5';
// USD per million tokens for claude-sonnet-5-5 (from Anthropic pricing, Nov 2026). Used only for an on-screen estimate.
const PRICE = { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.1 };
const MAX_TURNS = 8;
const MAX_NODES_PER_RULE = 40;
const MAX_NODES_TOTAL = 120; // keeps one AI pass affordable; anything beyond is reported as "not sent", never hidden

export class FixAgentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const SYSTEM_PROMPT = `You are OpenRamp's accessibility remediation engineer. A small-business owner (not a developer) is preparing their website for launch and wants it to be usable by people with disabilities.

You receive REAL results from the axe-core accessibility engine for one web page. Your job is to propose minimal, safe fixes the owner can review.

Hard rules:
- Only address the violations provided. Never invent new problems or claim results the engine did not report.
- Only use these fix actions:
  * set_attribute: name must be one of alt, aria-label, lang, title, content. "content" is only for the meta viewport tag.
  * set_css: name must be "color" or "background-color"; value must be a 6-digit hex colour like #1a2b3c.
  * set_document_title: value is the page title text; selector must be "html".
- The selector of every fix must be copied exactly from the violation's "selector" field.
- Colour contrast: always call check_contrast and/or suggest_accessible_color. Never estimate ratios yourself. Prefer changing the text colour and keep it as close to the brand colour as possible.
- Images: call view_image before writing alt text for any image that has an image_id. Alt text should describe what matters for a customer in under 120 characters, without "image of". Decorative images get alt="" (empty string). For logos, use the business name.
- Icon-only links and buttons: add an aria-label that says what the control does (e.g. "Bakery on Instagram", "Subscribe"), inferred from the link URL, nearby text and page content. If you cannot tell what it does, put it in needs_human instead of guessing.
- Page language: infer from page text (e.g. "en" for English).
- meta-viewport: remove user-scalable=no and maximum-scale limits, keeping the rest of the content value.
- If a violation cannot be fixed safely with these actions, list it in needs_human with a short reason.
- explanation: 1-2 plain-language sentences for the owner saying what was wrong and who it helps. No jargon.
- confidence: "high" when the fix is mechanical, "medium" when it involves judgement (alt text, labels), "low" if unsure.

When finished, call submit_fixes exactly once with all fixes.`;

const TOOLS = [
  {
    name: 'check_contrast',
    description: 'Compute the exact WCAG 2 contrast ratio between two colours and whether it passes level AA for the given text size.',
    input_schema: {
      type: 'object',
      properties: {
        foreground: { type: 'string', description: 'Text colour, hex like #777777' },
        background: { type: 'string', description: 'Background colour, hex like #ffffff' },
        font_size_px: { type: 'number', description: 'Font size in CSS pixels' },
        bold: { type: 'boolean', description: 'Whether the text is bold' },
      },
      required: ['foreground', 'background', 'font_size_px', 'bold'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'suggest_accessible_color',
    description: 'Find the closest text colour to the original (darker or lighter) that reaches the minimum contrast ratio on the given background.',
    input_schema: {
      type: 'object',
      properties: {
        foreground: { type: 'string', description: 'Original text colour, hex' },
        background: { type: 'string', description: 'Background colour, hex' },
        min_ratio: { type: 'number', description: '4.5 for normal text, 3 for large text' },
      },
      required: ['foreground', 'background', 'min_ratio'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'view_image',
    description: 'Look at an image from the page (by image_id) so you can write accurate alt text.',
    input_schema: {
      type: 'object',
      properties: { image_id: { type: 'string', description: 'e.g. img-1' } },
      required: ['image_id'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'submit_fixes',
    description: 'Submit the final list of proposed fixes and the issues that need a human. Call exactly once, at the end.',
    input_schema: {
      type: 'object',
      properties: {
        fixes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rule_id: { type: 'string' },
              selector: { type: 'string' },
              action: { type: 'string', enum: ['set_attribute', 'set_css', 'set_document_title'] },
              name: { type: 'string', description: 'Attribute or CSS property name; empty string for set_document_title' },
              value: { type: 'string' },
              explanation: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['rule_id', 'selector', 'action', 'name', 'value', 'explanation', 'confidence'],
            additionalProperties: false,
          },
        },
        needs_human: {
          type: 'array',
          items: {
            type: 'object',
            properties: { rule_id: { type: 'string' }, selector: { type: 'string' }, reason: { type: 'string' } },
            required: ['rule_id', 'selector', 'reason'],
            additionalProperties: false,
          },
        },
      },
      required: ['fixes', 'needs_human'],
      additionalProperties: false,
    },
    strict: true,
  },
];

const FixSchema = z.object({
  rule_id: z.string().max(100),
  selector: z.string().max(500),
  action: z.enum(['set_attribute', 'set_css', 'set_document_title']),
  name: z.string().max(50),
  value: z.string().max(300),
  explanation: z.string().max(600),
  confidence: z.enum(['high', 'medium', 'low']),
});
const SubmitSchema = z.object({
  fixes: z.array(z.unknown()).max(200),
  needs_human: z.array(z.object({ rule_id: z.string().max(100), selector: z.string().max(500), reason: z.string().max(600) })).max(200),
});

/** Server-side validation: every fix must target a reported element and use an allowed operation. */
export function validateFix(raw, allowedSelectors) {
  const parsed = FixSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'Malformed fix' };
  const f = parsed.data;
  if (f.action === 'set_document_title') {
    if (f.selector !== 'html' || !f.value.trim()) return { ok: false, reason: 'Invalid title fix' };
    return { ok: true, fix: { ...f, name: '' } };
  }
  if (!allowedSelectors.has(f.selector)) return { ok: false, reason: 'Selector was not reported by the scan' };
  if (f.action === 'set_attribute' && !ALLOWED_ATTRIBUTES.has(f.name)) return { ok: false, reason: `Attribute "${f.name}" is not allowed` };
  if (f.action === 'set_css') {
    if (!ALLOWED_CSS.has(f.name)) return { ok: false, reason: `CSS property "${f.name}" is not allowed` };
    if (!/^#[0-9a-f]{6}$/i.test(f.value)) return { ok: false, reason: 'Colour must be a 6-digit hex value' };
  }
  if (f.name === 'lang' && !/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(f.value)) return { ok: false, reason: 'Invalid language code' };
  return { ok: true, fix: f };
}

/** Elements the AI can work on (simple selectors), capped per rule and overall. Also reports what was left out. */
export function selectNodesForAi(report) {
  let budget = MAX_NODES_TOTAL;
  let notSent = 0;
  const byRule = report.violations.map((v) => {
    const eligible = v.nodes.filter((n) => n.simpleSelector);
    const take = eligible.slice(0, Math.min(MAX_NODES_PER_RULE, budget));
    budget -= take.length;
    notSent += v.nodes.length - take.length;
    return { v, nodes: take };
  });
  return { byRule, notSent };
}

function buildPromptInput(selection, pageInfo, imageCandidates) {
  const imageIdBySelector = new Map(imageCandidates.map((img, i) => [img.selector, `img-${i + 1}`]));
  const violations = selection.byRule
    .filter((r) => r.nodes.length)
    .map(({ v, nodes }) => ({
    rule_id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: nodes
      .map((n) => ({
        selector: n.simpleSelector,
        html: n.html.slice(0, 300),
        failure: n.failureSummary.slice(0, 400),
        ...(n.contrast ? { contrast: n.contrast } : {}),
        ...(imageIdBySelector.has(n.simpleSelector) ? { image_id: imageIdBySelector.get(n.simpleSelector) } : {}),
      })),
  }));
  return JSON.stringify({ page: { title: pageInfo.title, lang: pageInfo.lang, visible_text_excerpt: pageInfo.text.slice(0, 1500) }, violations }, null, 1);
}

function runTool(name, input, images) {
  if (name === 'check_contrast') return JSON.stringify(checkContrast(input));
  if (name === 'suggest_accessible_color') return JSON.stringify(suggestAccessibleColor(input));
  if (name === 'view_image') {
    const img = images.get(String(input.image_id));
    if (!img) return { error: true, content: 'Unknown image_id' };
    return [
      { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } },
      { type: 'text', text: `Image ${input.image_id} (element ${img.selector})` },
    ];
  }
  return { error: true, content: `Unknown tool ${name}` };
}

/**
 * Runs the agent loop. Returns { fixes, needsHuman, rejected, usage }.
 * @param {{report:object, pageInfo:object, imageCandidates:Array}} scan
 */
export async function proposeFixes(scan, { client } = {}) {
  if (!client && !process.env.ANTHROPIC_API_KEY) {
    throw new FixAgentError('NOT_CONFIGURED', 'AI fixes are not configured on this server (missing API key).');
  }
  const anthropic = client || new Anthropic();
  const { report, pageInfo, imageCandidates } = scan;
  if (!report.violations.length) return { fixes: [], needsHuman: [], rejected: [], notSentCount: 0, usage: emptyUsage() };

  const selection = selectNodesForAi(report);
  const images = new Map(imageCandidates.map((img, i) => [`img-${i + 1}`, img]));
  const allowedSelectors = new Set(selection.byRule.flatMap((r) => r.nodes.map((n) => n.simpleSelector)));
  const messages = [{ role: 'user', content: `Here are the axe-core results for the page. Propose fixes.\n\n${buildPromptInput(selection, pageInfo, imageCandidates)}` }];
  const usage = emptyUsage();

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let response;
    try {
      response = await anthropic.beta.messages.create({
        model: FIX_MODEL,
        max_tokens: 16000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        messages,
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new FixAgentError('AUTH', 'The AI service rejected the API key.');
      if (e instanceof Anthropic.RateLimitError) throw new FixAgentError('RATE_LIMIT', 'The AI service is busy. Please try again in a minute.');
      if (e instanceof Anthropic.APIError) throw new FixAgentError('API_ERROR', `The AI service returned an error (${e.status ?? 'network'}).`);
      throw e;
    }
    addUsage(usage, response.usage);

    if (response.stop_reason === 'refusal') throw new FixAgentError('REFUSAL', 'The AI declined to process this page.');
    if (response.stop_reason === 'max_tokens') throw new FixAgentError('TOO_LONG', 'The page has too many issues for one AI pass.');

    messages.push({ role: 'assistant', content: response.content });
    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    const submit = toolUses.find((t) => t.name === 'submit_fixes');
    if (submit) return { ...finalize(submit.input, allowedSelectors, usage), notSentCount: selection.notSent };

    if (!toolUses.length) {
      messages.push({ role: 'user', content: 'Please call submit_fixes now with your proposed fixes.' });
      continue;
    }
    const results = toolUses.map((t) => {
      const out = runTool(t.name, t.input || {}, images);
      if (out && out.error) return { type: 'tool_result', tool_use_id: t.id, content: out.content, is_error: true };
      return { type: 'tool_result', tool_use_id: t.id, content: out };
    });
    messages.push({ role: 'user', content: results });
  }
  throw new FixAgentError('NO_RESULT', 'The AI did not finish proposing fixes. Please try again.');
}

function finalize(input, allowedSelectors, usage) {
  const parsed = SubmitSchema.safeParse(input);
  if (!parsed.success) throw new FixAgentError('BAD_OUTPUT', 'The AI returned an unexpected format.');
  const fixes = [];
  const rejected = [];
  parsed.data.fixes.forEach((raw) => {
    const r = validateFix(raw, allowedSelectors);
    if (r.ok) fixes.push({ id: `fix-${fixes.length + 1}`, ...r.fix });
    else rejected.push({ fix: raw, reason: r.reason });
  });
  return { fixes, needsHuman: parsed.data.needs_human, rejected, usage };
}

function emptyUsage() {
  return { model: FIX_MODEL, calls: 0, inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, estimatedCostUsd: 0 };
}

function addUsage(acc, u) {
  if (!u) return;
  acc.calls++;
  acc.inputTokens += u.input_tokens || 0;
  acc.outputTokens += u.output_tokens || 0;
  acc.cacheWriteTokens += u.cache_creation_input_tokens || 0;
  acc.cacheReadTokens += u.cache_read_input_tokens || 0;
  acc.estimatedCostUsd =
    Math.round(
      ((acc.inputTokens * PRICE.input + acc.outputTokens * PRICE.output + acc.cacheWriteTokens * PRICE.cacheWrite + acc.cacheReadTokens * PRICE.cacheRead) / 1e6) * 10000,
    ) / 10000;
}
