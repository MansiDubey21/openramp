# Research and Competitors

_Last updated: 2026-11-14. Research done with web search on that date. Most market figures come from vendor blogs, so treat them as estimates. Labels: **[Verified]** means reported by a primary or official source. **[Vendor claim]** means it comes from a company selling in that market. **[Assumption]** is my own analysis._

## Candidate A: AI accessibility fixer for small-business websites (RECOMMENDED)

**Problem**
- **[Verified]** The WebAIM Million 2026 report found detectable WCAG 2 failures on 95.9% of the top 1M home pages, averaging 56.1 errors per page. The six most common errors (low-contrast text, missing alt text, missing form labels, empty links, empty buttons, missing page language) have led the list for 7 years running. Sources: [Nexer summary](https://nexerdigital.com/news-and-thoughts/the-webaim-million-report-2026-what-it-tells-us/), [Priority Pixels](https://prioritypixels.co.uk/insights/web-accessibility-is-getting-worse-according-to-the-2026-webaim-million-report/)
- **[Vendor claim / tracker]** ADA website lawsuits rose sharply in 2025: +37% in H1 2025, and about 3,117 federal filings for the full year (Seyfarth figure as cited). Roughly 70% targeted e-commerce, many of them small businesses. Sources: [KEYT/Stacker](https://keyt.com/news/money-and-business/stacker-money/2026/01/14/accessibility-lawsuits-rose-by-37-in-2025-why-small-businesses-can-no-longer-ignore-their-websites/), [TestParty trends](https://testparty.ai/blog/ada-title-iii-lawsuit-trends)
- **[Verified]** The FTC fined accessiBe $1M (April 2025) over deceptive claims about its overlay product. The National Federation of the Blind opposes overlays. Source: [WebAbility](https://www.webability.io/blog/accessibility-overlay-lawsuit), [UserWay FAQ](https://userway.org/llm-info/)
- **[Verified]** The European Accessibility Act has applied since 28 June 2025. Microenterprises providing services are exempt, but product sellers are not exempt in the same way. Sources: [iubenda](https://www.iubenda.com/en/help/179096-eaa-compliance), [Sharetribe](https://www.sharetribe.com/academy/european-accessibility-act-for-online-marketplaces/)

**Existing alternatives**
| Tool | What it does well | Gap for a small-business owner |
|---|---|---|
| WAVE / axe DevTools / Lighthouse (free scanners) | Accurate automated detection | Output is technical. They tell you *what* is wrong, not *how to fix it* in your code, and give no plain-language guidance |
| accessiBe / UserWay / AudioEye (overlays) | Cheap and quick to install. UserWay from $49/mo [Vendor claim] | Fixes run at the JavaScript/presentation layer, not the source code. Criticized by disability groups, FTC action against accessiBe, and overlays are named in lawsuits |
| TestParty | Fixes source code (Shopify-focused) | Mainly Shopify. Its own comparison table lists $1k–5k/mo [Vendor claim, unverified] |
| Accessibility consultants | Thorough manual audits | Expensive and slow for micro-businesses [Assumption] |

**Gap [Assumption, supported by the above]:** No affordable tool takes a non-technical owner from "scan" to *verified, source-level fixes* with plain-language explanations for a generic site (static/HTML/WordPress-exported). "Underserved", not "no competitor".

### Differentiation re-validation (2026-11-14, session 3). **Correction to the claim above**
New research shows that **AI-generated code-fix suggestions already exist**, so OpenRamp is *not* the first AI accessibility fixer and must not be pitched that way:
| Tool | What it does | Audience / price | Source |
|---|---|---|---|
| Siteimprove "AI Remediate" | Generates a code suggestion per supported issue. User reviews, then applies | Enterprise. Quote-based, with reported averages around $15.6k/yr and the accessibility module at $12k–70k/yr **[Competitor-reported estimates]** | [Siteimprove help](https://help.siteimprove.com/support/solutions/articles/80001129640-how-to-use-ai-remediate-to-fix-accessibility-issues), [TestParty pricing guide](https://testparty.ai/blog/siteimprove-pricing), [A11yProof](https://a11yproof.pages.dev/compare/alternatives/siteimprove) |
| BrowserStack Accessibility "AI Remediate" | AI code suggestions that need developer review | Developer/QA teams. Pricing unclear (free tier listed on G2) | [ToolJunction](https://www.tooljunction.io/blog/best-ai-accessibility-testing-tools), [G2](https://www.g2.com/products/browserstack/pricing) |
| AccessibilityChecker.org SmartFix | AI fixes **injected by JavaScript** (overlay-style, not source) | SMB | [SmartFix](https://www.accessibilitychecker.org/ace/smartfix/) |
| Auditica (WordPress) | Scanner. AI remediation is a Pro feature that needs your own OpenAI/Anthropic key | WordPress only | [WP.org listing](https://wordpress.org/plugins/?p=331853) |
| Equalize Digital Accessibility Checker (WordPress) | In-editor scanning, one-click fixes for some issues. Full-site scan about $129/yr | WordPress only | [Shift Web Studio](https://shiftwebstudio.com/blog/best-ada-compliance-wordpress-plugins/), [Jotform](https://www.jotform.com/blog/best-wordpress-accessibility-plugin/) |
| Ally by Elementor | Free tier. AI fixes paid | WordPress/Elementor | [Shift Web Studio](https://shiftwebstudio.com/blog/best-ada-compliance-wordpress-plugins/) |
| TestParty | Humans write code fixes, delivered as GitHub PRs | Shopify / higher price | [TestParty](https://testparty.ai/blog/best-ai-driven-accessibility-tool-that-fixes-code) |
| GoDaddy Airo | Builds sites with AI. **No accessibility checker found** in its listed tools. A third-party review says Airo sites aren't guaranteed ADA-compliant | GoDaddy customers | [GoDaddy help (via search; direct fetch returned 403)](https://www.godaddy.com/help/what-is-godaddy-airo-42891), [VisionEFX review](https://www.visionefx.net/godaddy-airo-website-builder-review-2025/) |

**Validated positioning (what is genuinely different, stated carefully):**
1. **Proof, not just suggestions.** OpenRamp applies the owner-approved fixes to a copy and **re-runs the same engine** to show before → after per rule. The tools above present suggestions for review. I found no evidence that they show an automatic re-scan of the patched page. *[Not exhaustively verified; say "we show proof by re-scan", not "others don't"]*
2. **Any website, no install, no developer account.** It works on any public page regardless of builder, unlike the WordPress-only plugins and the enterprise/developer platforms.
3. **Plain language for owners**, vision-based alt text, and exact contrast maths, with explicit "needs a person" hand-offs instead of guesses.
4. **Source-level, not overlay** (unlike SmartFix and the overlay vendors).
5. **Fills a gap in the GoDaddy journey.** Airo builds the site, and OpenRamp is the pre-launch accessibility check before go-live. This is complementary to GoDaddy, not competing with it.

### Differentiation round 2 (2026-11-14, session 4): what is genuinely missing
User asked for genuine originality. Further research:
| Existing capability | Who has it | Source |
|---|---|---|
| Screen-reader **simulator** for sighted owners (explore any page by hand) | Silktide Toolbar (free Chrome extension) | [Silktide](https://silktide.com/tools/screen-reader-simulator), [limitations](https://help.silktide.com/en/articles/13699961-limitations-of-the-silktide-toolbar-screen-reader-simulator) |
| Keyboard focus-order testing | Silktide Toolbar. LambdaTest automated focus checks. Manual protocols (Siteimprove) | [Silktide toolbar](https://silktide.com/toolbar/), [LambdaTest docs PR](https://github.com/LambdaTest/documentation/pull/1640/files), [Siteimprove](https://www.siteimprove.com/blog/keyboard-navigation-accessibility-testing/) |
| Rule scanners miss tab order, focus traps and focus visibility | Stated by Siteimprove's own comparison | [Siteimprove](https://www.siteimprove.com/blog/keyboard-navigation-accessibility-testing/) |
| Automated rules cover about 57% of issues (vendor figure) | Deque | [Deque](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues) |
| Accessibility reports in Indian languages | None found (NIC SugamyaWeb is for government; output language not confirmed) | [search results](https://www.w3.org/2024/09/breakouts/recording-19.html), [SugamyaWeb](https://informatics.nic.in/uploads/pdfs/ebee8075_30_32_egov_sugamyaweb_jul_23.pdf) |

**Verdict:** the core "scan + AI fix suggestions" is *not* unique on its own. Simulators and focus-order testers exist as **general, manual exploration tools**. I found **no tool** that:
- takes the owner's **business task in plain words** ("order a custom cake"),
- automatically identifies the elements that complete it,
- **measures** whether a keyboard-only, a screen-reader and a low-vision customer can complete it (real Tab presses, screenshot-based focus visibility, the browser accessibility tree, contrast),
- and **re-verifies the same task after owner-approved fixes**, including the before/after "what a blind customer hears" with audio playback.
Stated carefully: *"We found no existing tool that does task-based, before/after verified accessibility checks for small-business owners"* (absence of evidence after targeted searches, not proof of absence).

**Built (session 4): Customer Task Check.** Evidence that it adds value beyond rule scanners: on the UW AccessComputing demo it detected invisible keyboard focus on 5 checkboxes. Manual inspection confirmed the page CSS `input:focus { outline: none; }`, and axe-core reported nothing for it.

**Honest weaknesses vs competitors:** single page per scan, no continuous monitoring, no CMS integration (the owner must copy fixes into their builder), and limited fix types (attributes and colours only, so no layout changes).

## Candidate B: Voice-first vernacular "idea → website" builder

- **[Vendor claim]** The space is already crowded: Pagevala (voice, 11 Indian languages), ShopIQ (Hindi voice storefront, 7 languages), Appy Pie Hindi builder (Nov 2025), Hostinger AI builder (80+ languages, Hindi UI), and **GoDaddy's own Airo** (agentic one-conversation site builder, "any language"). Sources: [Product Hunt – Pagevala](https://www.producthunt.com/p/pagevala/we-built-a-website-builder-with-zero-typing-voice-first-what-would-break-first), [YourStory – ShopIQ](https://yourstory.com/ai-story/from-local-lanes-to-digital-domains-how-shopiq-is-), [Zoutons – Airo](https://www.zoutons.com/news/godaddy-airo-ai-agentic-website-builder-india), [GoDaddy Airo](https://www.godaddy.com/en/airo/ai-builder)
- **[Verified-ish, survey]** Real need: in India only 13% of women entrepreneurs have a social-media presence vs 30% of men, and there is a 58-point gender gap in smartphone ownership. Sources: [ThePrint](https://theprint.in/opinion/women-entrepreneurs-need-digital-readiness-heres-how-to-help-them/1993012), [Women's World Banking](https://www.womensworldbanking.org/?p=103816)
- **Verdict:** High impact, but weak differentiation, and it directly duplicates the host's (GoDaddy's) own product.

## Candidate C: AI inquiry-and-lead agent on the business mailbox

- Claude reads incoming contact-form and mailbox messages, classifies them (lead / support / spam), drafts replies, and a human approves before sending.
- **[Assumption]** Alternatives are crowded: Gmail/Outlook built-in AI, Front, Help Scout, HubSpot. Not separately researched in depth because differentiation was weak from the start.
- **Verdict:** Easy to build, but a generic "AI inbox" with low originality.

## Comparison (1–5, my analysis)
| Criterion | A: Accessibility fixer | B: Vernacular builder | C: Inbox agent |
|---|---|---|---|
| User value / impact | 5 | 5 | 3 |
| Originality vs market | 4 | 2 | 2 |
| Evidence of demand | 4 | 4 | 3 |
| Feasibility (1 person, 6 days) | 4 | 3 | 5 |
| Demo strength (measurable) | 5 (violations drop X → Y, re-verified) | 4 | 3 |
| Fit with "Inclusive" + idea→launch | 5 / 3 (positioned as pre-launch gate) | 4 / 5 | 2 / 3 |
| Meaningful Claude use | 5 (tools, vision alt-text, structured fixes, verify loop) | 4 | 3 |
| **Total** | **35** | 26 | 21 |

## Open validation items
- No interviews with real small-business owners yet. Claims about willingness to use or pay are assumptions.
- Lawsuit statistics come from vendor sources. Cite them with that caveat in the project brief.
- Automated scanners catch only part of WCAG. The product must say so honestly and must not claim "fully compliant".
