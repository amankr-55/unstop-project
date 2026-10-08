---
name: bharat-gst-sentinel
description: >
  Audits Indian B2B Goods and Services Tax invoices, verifies 15-character GSTIN checksums via Luhn Mod-36, and reconciles purchase registers against GSTR-2B returns.
  Use when checking Indian tax invoices, verifying tax calculations, or matching vendor bills with government returns.
  Trigger when the user asks to "validate this GST number", "check invoice tax split", "verify GSTIN checksum",
  "audit vendor bill", or "reconcile purchase register with GSTR-2B".
  Also use when reviewing Indian vendor bills, CGST, SGST, IGST calculations, HSN codes, E-Way bills, or Place of Supply rules even if the user does not explicitly mention GST.
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

Audits Indian B2B Goods and Services Tax invoices, verifies 15-character GSTIN checksums using the official Luhn Mod-36 algorithm, and reconciles purchase registers against GSTR-2B.

---

## Overview

Most AI models make two critical mistakes when evaluating Indian tax invoices:
1. They cannot compute Modulo-36 math to verify whether a 15-character GSTIN checksum is genuine, leading to hallucinated numbers.
2. They confuse local intra-state taxes (CGST + SGST) with inter-state taxes (IGST), creating illegal tax credit claims.

This skill equips the agent with a deterministic local engine to validate invoices and reconcile returns without guesswork.

---

## When to Use

Use when:
- The user provides an Indian invoice, bill, or purchase register in text, JSON, CSV, or table format.
- The user asks to "validate this GST number", "check invoice tax split", "verify GSTIN checksum", or "audit vendor bill".
- The user asks to "reconcile purchase register with GSTR-2B" to determine eligible versus blocked Input Tax Credit.
- Reviewing Indian vendor bills, tax calculations, CGST/SGST/IGST splits, or Place of Supply rules even if GST is not explicitly mentioned.
- Determining whether to Accept or Reject an invoice on the 2026 GST portal IMS system.
- Drafting a formal Section 34 rectification notice for vendors with incorrect bills.

---

## Instructions

Follow this structured workflow when auditing invoices:

### 1. Ingestion and Field Extraction
Extract the essential invoice metadata from the user's input:
- Supplier GSTIN (15 alphanumeric characters)
- Recipient GSTIN (if provided)
- Invoice Number and Invoice Date
- Place of Supply (POS state code or state name)
- Line items: description, taxable value, tax rate, CGST, SGST, IGST
- Total invoice amount

### 2. Deterministic Verification
Do not calculate checksums mentally. Run the local validation script:

```bash
node scripts/gst_engine.js validate --json '<INVOICE_JSON>'
```
Or with Python:
```bash
python scripts/gst_engine.py validate --json '<INVOICE_JSON>'
```

The script verifies:
- GSTIN Checksum: Validates the 15th character via ISO/IEC 7064 Luhn Mod-36.
- State Code: Checks if the first two digits represent a valid Indian state (01 to 38).
- Tax Split Rules:
  - If Supplier State matches Place of Supply: Must charge equal CGST and SGST. IGST must be 0.
  - If Supplier State differs from Place of Supply: Must charge IGST only. CGST and SGST must be 0.
- Rounding Rules: Flags discrepancies exceeding 1.00 INR under Section 170.
- E-Way Bill Rule: Flags inter-state shipments over 50,000 INR without an E-Way bill number.

### 3. GSTR-2B Reconciliation
When the user provides a purchase register and GSTR-2B records:

```bash
node scripts/gstr2b_reconciler.js --purchase purchase.json --gstr2b gstr2b.json
```
Classifies invoices into:
- Matched: Invoices matching in both books (safe for ITC).
- Missing in GSTR-2B: Bills present in books but unfiled by vendor (credit blocked under Section 16(2)(aa)).
- Tax Discrepancy: Bills where tax values differ between internal records and portal filings.

### 4. Statutory Remediation
If an invoice has errors, generate a formal correction notice under Section 34 of the CGST Act (available in English and Hindi) so the user can send it to the vendor.

---

## Examples

### Example 1: Validating a GST Number
User prompt:
"Please validate this GSTIN: 27AAPFU0939F1ZV"

Agent command:
`node scripts/gst_engine.js validate-gstin 27AAPFU0939F1ZV`

Agent output:
- Status: VALID
- State: Maharashtra (Code 27)
- Entity Type: Partnership Firm / LLP
- Checksum: Matches expected check character ('V')

### Example 2: Catching an Illegal Tax Split
User prompt:
"Check this bill: Mumbai supplier billed a Bengaluru client and charged CGST 900 and SGST 900 on 10,000 INR."

Agent command:
`node scripts/gst_engine.js validate --json '{"supplier_gstin":"27AAPFU0939F1ZV","place_of_supply":"29","line_items":[{"taxable_value":10000,"tax_rate":18,"cgst":900,"sgst":900}]}'`

Agent output:
- Status: REJECTED
- Violation: Inter-state supply from Maharashtra (27) to Karnataka (29).
- Statutory Rule: IGST Act Section 7 mandates IGST. Local CGST and SGST are illegal.
- Recommendation: Request revised invoice with 18% IGST from vendor.

---

## Output Format

Format the final response clearly for the user:

```markdown
### Invoice Audit Summary
- Status: [Clean / Warning / Rejected]
- Invoice Number: [Number]
- Total Value: INR [Amount]

### Key Checks
- Supplier GSTIN: [Valid / Invalid reason]
- Tax Split: [Correct / Wrong tax charged]
- Math Check: [Accurate / Rounding difference]

### Issues Detected
1. [Explain the exact error and statutory rule]

### Next Action
[Clear recommendation: e.g., "Safe to claim credit" OR "Demand revised invoice under Section 34"]
```

---

## Guardrails

1. Never hallucinate GSTIN check digits. Always run the script.
2. Never approve local CGST+SGST on inter-state sales.
3. Always advise holding tax credit if an invoice is absent from GSTR-2B.
