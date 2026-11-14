# Demo Script (about 3 minutes)

Audience: hackathon judges (recorded video and/or live finale). Uses the bundled demo site, so it works without depending on any external site.

| Time | Do | Say |
|---|---|---|
| 0:00 | Show the home page | "Nearly every website has accessibility barriers, and small-business owners can't see them. OpenRamp checks whether every customer can actually complete your key task." |
| 0:20 | Click **try the demo bakery website** | "A real accessibility engine (axe-core) runs in a sandboxed browser: 21 issues, each with evidence." Open one issue to show the element. |
| 0:45 | Type **Order a custom cake**, then **Test this task** | "Claude finds the buttons and fields for this task. Then OpenRamp *really* tests them: it presses Tab like a keyboard user, reads like a screen reader, and checks contrast." Point at the three red cards, especially "nothing changes on screen", which rule scanners can't detect. |
| 1:15 | Click **▶ Play** under "What a blind customer hears" | Let it say "...combo box... button". "That's all a blind customer hears. They can't order." |
| 1:35 | Click **हिन्दी** in "Explain these results" | "Owners get a plain-language summary in Hindi or English, with numbers from the scan, not invented by AI." |
| 1:50 | Click **Propose fixes with AI** | "Claude uses tools: exact contrast maths, and it *looks* at images to write descriptions. The keyboard test adds its own fix. Every fix is explained, and the owner decides." |
| 2:15 | Click **Apply selected fixes to a copy and re-test** | "We never touch the live site. The copy is re-scanned: 21 → 0. And the same task again: all three customers *blocked → can complete*." Play the **After** transcript: "Subscribe, button". |
| 2:45 | Show the downloads + disclaimer | "The owner gets the fixed HTML and a report. We're honest: automated testing isn't a certificate." |
| 2:55 | Contact form | "Hosted on GoDaddy, our own domain over HTTPS, and the contact form delivers to our Titan mailbox." _(After deployment.)_ |

**Before recording:** check the API key works (`/api/health` shows `ai: true`). Speech uses the computer's voices, so test the Hindi voice on the recording machine.
