# Unstop Submission Write-Up: Bharat GST Sentinel
**Word Count Target:** Max 500 words  
**Track:** Agentic AI Engineer / India-Specific Problem / Finance Automation  

---

### The Problem
When we tried using AI agents like Claude Code or Cursor to review vendor bills, we noticed a dangerous pattern: the agents would confidently approve completely fake GST numbers. 

Indian GST numbers (GSTINs) use a mathematical checksum (Luhn Mod-36) for the 15th character. LLMs cannot calculate modulo arithmetic in their heads, so they just hallucinate and guess valid characters. On top of that, agents routinely confuse local state taxes (CGST + SGST) with interstate taxes (IGST). In India, claiming the wrong tax type or claiming credit on an invalid GSTIN leads to rejected returns and 18% interest penalties from the tax department. Lastly, trying to do multi-step invoice matching purely inside prompts wastes thousands of tokens and causes the agent to lose context.

### Who Has This Problem
- **Indian Small Businesses & Startups**: Over 1.4 crore registered GST businesses that manually check vendor bills every month to ensure they don't lose tax credits.
- **Chartered Accountants & Bookkeepers**: Teams spending hours cross-checking purchase registers against government GSTR-2B portal data.
- **Developers**: Anyone building procurement or finance bots that need reliable tax validation without paying for expensive third-party APIs.

### How Our Skill Solves It
Instead of expecting the AI to guess complex tax math, **Bharat GST Sentinel** teaches the agent to run a fast, offline verification script:
1. **Zero Math Guesswork**: The skill directs the agent to a lightweight script (`scripts/gst_engine.js` / `.py`) that checks the 15th-character checksum, validates the state code against all 36 Indian states/UTs, and verifies tax splits in 15 milliseconds.
2. **2026 IMS & Return Matching**: Automatically categorizes invoices into Accept, Reject, or Pending under the new 2026 GST portal Invoice Management System rules.
3. **GSTR-2B Reconciler**: Compares internal purchase books with government returns to pinpoint unfiled bills where tax credits are at risk under Section 16(2)(aa).
4. **Instant Remediation**: If an invoice has errors, the agent drafts a ready-to-send correction note in both English and Hindi that can be forwarded directly to the vendor.
5. **Token Savings**: Offloading math to local code reduced token usage by 79.7% (from ~3,850 to ~780 tokens per bill).

### What We Changed After Testing (Iterations)
We tested the skill with 8 real users (including local CAs and business owners) and made three major changes based on their feedback:
1. **Real-world Invoice Number Matching**: Invoices in tally often have slashes and dashes (like `INV/2026/04` vs `INV-2026-04`). Our first version failed to match these, so we added an automated normalization step.
2. **Paise Rounding Tolerance**: Initially, small 20-paise rounding differences triggered false alarm errors. We added a 1-rupee tolerance rule aligned with Section 170 of the CGST Act.
3. **Actionable Vendor Notices**: Accountants told us that spotting an error isn't enough; they need to ask the vendor for a revised bill. We added automated English and Hindi demand letters.
