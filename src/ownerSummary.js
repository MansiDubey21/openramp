// Plain-language owner summary in English or Hindi.
// Facts (counts, verdicts) are assembled in code from real results; Claude only explains them in plain words.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'claude-haiku-5-5';
const PRICE = { input: 0.1, output: 0.5 }; // USD per million tokens, claude-haiku-5-5 (prompts <100K)

export const LANGUAGES = {
  en: { name: 'simple English', bcp47: 'en' },
  hi: { name: 'simple Hindi written in Devanagari script (use common everyday words; English technical words like "website" may stay in English)', bcp47: 'hi' },
};
export const LangSchema = z.enum(Object.keys(LANGUAGES));

export class SummaryError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** The only facts the model may use. Built from real scan/task/re-scan data. */
export function buildFacts(s) {
  const facts = {
    page: s.target,
    issues_found: s.before.issueCount,
    by_severity: s.before.byImpact,
    items_needing_manual_review: s.before.needsReviewCount,
    top_problems: s.before.violations.slice(0, 6).map((v) => ({ problem: v.help, elements: v.nodes.length, severity: v.impact })),
  };
  if (s.task?.taskFound && s.task.before) {
    facts.customer_task = {
      task: s.task.text,
      before_fixes: s.task.before.profiles.map((p) => ({ customer: p.title, can_complete: p.pass, problems: p.issues })),
      ...(s.task.after ? { after_fixes: s.task.after.profiles.map((p) => ({ customer: p.title, can_complete: p.pass })) } : {}),
    };
  } else if (s.task && !s.task.taskFound) {
    facts.customer_task = { task: s.task.text, found_on_page: false };
  }
  if (s.after) facts.after_approved_fixes = { issues_remaining: s.after.issueCount, issues_resolved: Math.max(0, s.before.issueCount - s.after.issueCount) };
  if (s.proposal) facts.issues_ai_could_not_fix_safely = s.proposal.needsHuman.length;
  return facts;
}

export async function writeOwnerSummary(session, lang, { client } = {}) {
  if (!client && !process.env.ANTHROPIC_API_KEY) throw new SummaryError('NOT_CONFIGURED', 'AI is not configured on this server (missing API key).');
  const anthropic = client || new Anthropic();
  const facts = buildFacts(session);
  let response;
  try {
    response = await anthropic.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 2000,
      system:
        `You explain website accessibility test results to a small-business owner who is not technical. Write in ${LANGUAGES[lang].name}. ` +
        'Use ONLY the facts provided; never add, change or estimate numbers, and do not claim legal compliance. ' +
        'Explain briefly what a term means when you must use it (for example, a screen reader is software that reads the screen aloud for blind people). ' +
        'Focus on what it means for their customers and what to do next. Keep the headline under 15 words, the summary to 3-5 short sentences, and give exactly 3 next steps.',
      messages: [{ role: 'user', content: `Facts:\n${JSON.stringify(facts)}` }],
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              headline: { type: 'string' },
              summary: { type: 'string' },
              next_steps: { type: 'array', items: { type: 'string' } },
            },
            required: ['headline', 'summary', 'next_steps'],
            additionalProperties: false,
          },
        },
      },
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new SummaryError('RATE_LIMIT', 'The AI service is busy. Please try again in a minute.');
    if (e instanceof Anthropic.APIError) throw new SummaryError('API_ERROR', `The AI service returned an error (${e.status ?? 'network'}).`);
    throw e;
  }
  if (response.stop_reason === 'refusal') throw new SummaryError('REFUSAL', 'The AI declined this request.');
  let parsed;
  try {
    parsed = JSON.parse(response.content.find((b) => b.type === 'text')?.text || '');
  } catch {
    throw new SummaryError('BAD_OUTPUT', 'The AI returned an unexpected format.');
  }
  const out = z
    .object({ headline: z.string().min(1).max(200), summary: z.string().min(1).max(1500), next_steps: z.array(z.string().min(1).max(400)).min(1).max(5) })
    .safeParse(parsed);
  if (!out.success) throw new SummaryError('BAD_OUTPUT', 'The AI returned an unexpected format.');
  const u = response.usage || {};
  return {
    lang,
    bcp47: LANGUAGES[lang].bcp47,
    ...out.data,
    usage: {
      model: SUMMARY_MODEL,
      estimatedCostUsd: Math.round((((u.input_tokens || 0) * PRICE.input + (u.output_tokens || 0) * PRICE.output) / 1e6) * 10000) / 10000,
    },
  };
}
