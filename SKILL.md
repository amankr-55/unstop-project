---
name: bharat-gst-sentinel
description: >
  Use when checking Indian B2B GST invoices, verifying tax calculations, or matching purchase bills with GSTR-2B.
  Trigger when the user asks to "validate this GST number", "check invoice tax split", "verify GSTIN checksum",
  "audit vendor bill", or "reconcile purchase register with GSTR-2B". Also use when reviewing Indian vendor bills,
  CGST, SGST, IGST splits, HSN codes, E-Way bills, or Place of Supply rules even if the user does not explicitly mention GST.
license: MIT
metadata:
  llmskillhub:
    version: 2.0.0
    categories: [finance, compliance, agents]
    keywords: [gst, india, tax, compliance, invoice-audit, gstr2b, luhn-mod36]
    repository: https://github.com/amankr-55/unstop-project
    capabilities:
      network: false
      filesystem: read-write
      shell: true
      secrets: []
compatibility: claude-code, cursor, gemini-cli, antigravity, codex
allowed-tools: run_command view_file write_to_file
---

# Bharat GST Sentinel
### Practical Indian GST & Invoice Audit Helper for AI Agents

Most AI models make two big mistakes when looking at Indian bills:
1. They cannot do the Modulo-36 math required to check if a 15-character GSTIN is real or fake, so they just guess.
2. They get confused between local state tax (CGST + SGST) and inter-state tax (IGST), which leads to illegal tax claims.

This skill fixes that by having the agent run a fast, offline verification script instead of doing mental math, catching real errors in milliseconds.

---

## 1. When to Use This Skill

Use when:
- The user pastes an Indian invoice or bill (in text, JSON, CSV, or table format).
- The user asks to "validate this GST number", "check invoice tax split", "verify GSTIN checksum", or "audit vendor bill".
- The user asks to "reconcile purchase register with GSTR-2B" to see which tax credits are safe and which are blocked.
- Checking vendor bills, tax rates, CGST/SGST/IGST splits, or Place of Supply rules even if GST is not explicitly mentioned.
- Determining whether to Accept or Reject an invoice on the 2026 GST portal IMS system.
- Drafting a quick correction letter to send to a vendor when their bill has tax mistakes.

---

## 2. Step-by-Step Agent Workflow

Follow these 4 practical steps:

### Step 1: Read the Bill Details
Pull out the key fields from the user's text or file:
- Supplier GSTIN (15 characters)
- Recipient GSTIN (if present)
- Invoice Number and Date
- Place of Supply (POS state code or state name)
- Line items: taxable value, tax rate, CGST, SGST, IGST charged.

### Step 2: Run the Verification Script (Do NOT guess the math)
Never try to calculate the 15th checksum character in your head. Run the local script:

```bash
node scripts/gst_engine.js validate --json '<INVOICE_JSON>'
```
Or with Python:
```bash
python scripts/gst_engine.py validate --json '<INVOICE_JSON>'
```

The script checks:
- GSTIN Checksum: Uses the official Luhn Mod-36 formula to catch typos and fake IDs.
- State Code: Checks if the first 2 digits match a real Indian state (01 to 38).
- Tax Split:
  - If Supplier State == Place of Supply: Must charge equal CGST + SGST. IGST must be 0.
  - If Supplier State != Place of Supply: Must charge IGST only. CGST and SGST must be 0.
- Rounding: Flags differences over 1 Rupee under Section 170.
- E-Way Bill: Reminds the user if an inter-state goods shipment exceeds 50,000 INR without an E-Way bill.

### Step 3: GSTR-2B Matching (When user provides purchase books)
If the user wants to reconcile their purchase register against GSTR-2B data:

```bash
node scripts/gstr2b_reconciler.js --purchase purchase.json --gstr2b gstr2b.json
```
This tells the user:
- Matched bills: Safe to claim input tax credit (ITC).
- Missing in GSTR-2B: Vendor did not file their return. Credit is blocked under Section 16(2)(aa).
- Tax difference: Discrepancy between internal records and portal filings.

### Step 4: Present Findings & Next Steps
Give the user a clear summary:
- Is the bill clean or rejected?
- What specific mistakes were found (with plain-English reasons)?
- If the bill has errors, offer the ready-to-send correction note (available in English and Hindi) so the user can easily forward it to their vendor.

---

## 3. Real Examples

### Example 1: Checking a GST Number
User says: "Is 27AAPFU0939F1ZV a valid GSTIN?"
Agent runs: `node scripts/gst_engine.js validate-gstin 27AAPFU0939F1ZV`
Agent responds:
- Valid: Yes
- Registered State: Maharashtra (Code 27)
- Business Type: Partnership Firm / LLP
- Checksum: Matches official Mod-36 check character ('V').

### Example 2: Catching a Wrong Tax Type
User pastes a bill where a Mumbai seller billed a Bengaluru client and charged CGST 9% + SGST 9%.
Agent runs the validator and flags:
- Issue: Inter-state sale (Maharashtra to Karnataka).
- Error: Seller incorrectly charged local CGST + SGST instead of IGST. Under Section 7 of the IGST Act, this credit will be rejected by the tax portal.
- Action: Ask the seller for a corrected invoice with IGST.

---

## 4. Response Format

When answering the user, keep your report clean and easy to scan:

```markdown
### Invoice Audit Summary
- Status: [Clean / Warning / Rejected]
- Invoice Number: [Number]
- Total Value: INR [Amount]

### Key Checks
- Supplier GSTIN: [Valid / Invalid reason]
- Tax Type: [Correct / Wrong tax charged]
- Math Check: [Accurate / Rounding difference]

### Issues Found (if any)
1. [Explain the exact error simply]

### Next Action
[Clear recommendation: e.g., "Safe to pay and claim credit" OR "Ask vendor for revised invoice with IGST"]
```
