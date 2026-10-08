# 2-Minute Demo Video Walkthrough Script
**Project:** Bharat GST Sentinel: Autonomous Indian GST Compliance & Reconciler  
**Target Duration:** Under 2 minutes (120 seconds max)  
**Tools Recommended for Recording:** Loom, OBS Studio, or Windows Game Bar (`Win + Alt + R`)

---

### Video Flow Breakdown

#### Scene 1: The Problem (0:00 – 0:25)
- **Visual:** Open a regular AI chatbot / agent session. Paste a prompt with a fake GSTIN (`27AAPFU0939F1Z8`) and ask: *"Is this invoice valid?"*
- **On Screen:** The regular chatbot says: *"Yes! This is a valid 15-character GSTIN from Maharashtra."* (Hallucination!)
- **Voiceover:**  
  *"AI agents are transforming workflows, but in mission-critical domains like Indian GST compliance, they fail disastrously. Large language models cannot calculate the 15th-character Luhn Mod-36 checksum, and they frequently confuse interstate IGST with local CGST—leading to denied tax credits and penalties. Watch what happens when we give our agent a dedicated skill: Bharat GST Sentinel."*

---

#### Scene 2: The Skill in Action — Deterministic Audit (0:25 – 0:55)
- **Visual:** Switch to an agent environment with `bharat-gst-sentinel` activated (or run the CLI tool in terminal).
- **Command Run on Screen:**
  ```bash
  node scripts/gst_engine.js validate-file --file evals/test_cases.json
  ```
- **On Screen:** The terminal instantly outputs the audit report in milliseconds:
  - Catches the tampered checksum character immediately.
  - Flags the illegal CGST+SGST split on the interstate supply under Section 7 of the IGST Act.
  - Flags mandatory E-Way Bill requirement for consignments over ₹50,000.
- **Voiceover:**  
  *"Bharat GST Sentinel is an agent skill packaged with progressive disclosure. When an invoice is processed, the agent invokes our deterministic offline engine. In under 15 milliseconds, it validates the Luhn Mod-36 checksum, checks official state jurisdictions across all 36 Indian states and UTs, and enforces Section 170 rounding rules with 100% precision."*

---

#### Scene 3: GSTR-2B 3-Way ITC Reconciliation (0:55 – 1:30)
- **Visual:** Run the reconciliation command:
  ```bash
  node scripts/gstr2b_reconciler.js --purchase purchase.json --gstr2b gstr2b.json
  ```
- **On Screen:** Display the clean Markdown summary table showing:
  - Eligible ITC vs Blocked ITC.
  - Specific invoices missing from GSTR-2B (vendor did not file return).
  - Clear, automated vendor action plan.
- **Voiceover:**  
  *"For accountants and business owners, the skill automates GSTR-2B reconciliation. It matches purchase books against government returns, isolates blocked Input Tax Credit under Section 16(2)(aa), and generates an actionable follow-up list for non-compliant vendors."*

---

#### Scene 4: Evals, Token Savings & Conclusion (1:30 – 2:00)
- **Visual:** Show the benchmark report (`evals/EVAL_SCORECARD.md` or run `node evals/eval_suite.js`).
- **On Screen:** Display:
  - **100% Pass Rate** across all benchmark test cases.
  - **79.7% Token Reduction** (~3,850 tokens down to ~780 tokens).
  - **Zero Checksum Hallucinations**.
- **Voiceover:**  
  *"In our comprehensive evaluation benchmarks, Bharat GST Sentinel achieved a 100% pass rate across edge cases, eliminated checksum hallucinations completely, and cut agent token consumption by nearly 80%. This is the power of teaching AI agents deterministic, reliable skills. Check out the skill publicly on LLM SkillHub and give it a try!"*

---

### Tips for Recording
1. Set terminal font size to 16px or 18px so judges can clearly read the output.
2. Use dark mode terminal with colors enabled.
3. Keep the background clean without notifications or clutter.
