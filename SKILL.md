---
name: bharat-gst-sentinel
description: >
  Use when auditing Indian B2B tax invoices, checking Goods and Services Tax compliance, or reconciling Input Tax Credit.
  Trigger when the user asks to "validate this GST number", "check invoice tax split", "verify GSTIN checksum",
  "audit vendor bill", or "reconcile purchase register with GSTR-2B". Also use when reviewing Indian vendor invoices,
  tax calculations, CGST, SGST, IGST splits, HSN codes, E-Way bills, or Place of Supply rules even if the user does not explicitly name GST.
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

# Bharat GST Sentinel (2026 Edition)
### Autonomous Indian GST Auditor, GSTR-2B Reconciler and Statutory Notice Drafter

A specialized agent skill designed to audit, validate, reconcile, and remediate Indian B2B Goods & Services Tax (GST) invoices with zero mathematical hallucination, adhering strictly to the CGST/IGST Act and the 2026 GST 2.0 Invoice Management System (IMS) framework.

---

## 1. When to Activate This Skill

Use when:
- The user provides an Indian invoice, bill, or purchase register in text, JSON, CSV, or markdown.
- The user asks to "validate this GST number", "check invoice tax split", "verify GSTIN checksum", or "audit vendor bill".
- The user asks to "reconcile purchase register with GSTR-2B" or check Input Tax Credit (ITC) eligibility.
- Reviewing Indian vendor invoices, tax calculations, CGST/SGST/IGST splits, HSN codes, or Place of Supply rules even if the user does not explicitly mention GST.
- Determining 2026 GST Portal IMS (Invoice Management System) action: ACCEPT, REJECT, or PENDING_AMENDMENT_GSTR1A.
- Drafting legally compliant Section 34 statutory demand/rectification notices for vendors with billing errors.

---

## 2. Core Operational Workflow

When processing an invoice or reconciliation request, follow this exact 5-phase protocol:

```
[Phase 1: Ingestion & Field Extraction]
              │
              ▼
[Phase 2: Offline Deterministic Engine Validation]
              │
              ▼
[Phase 3: 2026 IMS Action Classification]
              │
              ▼
[Phase 4: GSTR-2B 3-Way Reconciliation]
              │
              ▼
[Phase 5: Statutory Notice & Remediation Dispatch]
```

### Phase 1: Ingestion & Field Extraction
Extract mandatory invoice metadata:
1. supplier_gstin: 15-character string
2. recipient_gstin: 15-character string
3. invoice_number: String (alphanumeric, max 16 chars)
4. invoice_date: YYYY-MM-DD
5. place_of_supply: 2-digit state code or State Name
6. line_items: Array of items containing description, hsn_sac, taxable_value, tax_rate, cgst, sgst, igst.
7. total_invoice_value: Numerical value.

---

### Phase 2: Deterministic Validation (Zero LLM Guesswork)

AGENT GUARDRAIL: Never attempt to mentally compute the Luhn Mod-36 checksum or tax calculations directly within the LLM prompt. Always execute the deterministic engine.

Terminal Execution:
```bash
node scripts/gst_engine.js validate --json '<JSON_PAYLOAD>'
```
Or with Python:
```bash
python scripts/gst_engine.py validate --json '<JSON_PAYLOAD>'
```

The engine deterministically evaluates:
1. Luhn Mod-36 GSTIN Checksum:
   - Calculates 15th check character using ISO/IEC 7064 Mod-36.
   - Detects character transpositions and malformed PAN entity types (C, P, H, F, A, T, etc.).
2. State Code Legitimacy:
   - Matches the first 2 digits against official Indian state codes (01 to 38, 97).
3. Jurisdictional Tax Split (IGST Act Sec 7 & 8):
   - Intra-State Supply: If supplier_state == place_of_supply, equal CGST and SGST must apply. IGST MUST be 0.00.
   - Inter-State Supply: If supplier_state != place_of_supply, IGST applies in full. CGST and SGST MUST be 0.00.
4. Section 170 Rounding Precision:
   - Tax amount differences greater than 1.00 INR are flagged as critical discrepancies.
5. Rule 138 E-Way Bill Consignment Threshold:
   - Inter-state movements over 50,000 INR without an E-Way bill number trigger statutory warnings.

---

### Phase 3: 2026 GST Portal IMS Action Assignment

Under the GST 2.0 framework, every supplier invoice received must be classified into one of 3 IMS actions:
- ACCEPT: Clean invoice; zero discrepancies. Safe to auto-populate into GSTR-2B and claim ITC in GSTR-3B.
- REJECT: Checksum failed, supplier unregistered, or illegal tax type charged. Invoice rejected; vendor must issue Credit Note.
- PENDING_AMENDMENT_GSTR1A: Value/tax discrepancy within reasonable bounds. Held pending amendment in vendor's GSTR-1A return.

---

### Phase 4: GSTR-2B Automated 3-Way Reconciliation

When matching purchase books against government returns:
```bash
node scripts/gstr2b_reconciler.js --purchase purchase.json --gstr2b gstr2b.json
```
Classifies records into:
1. MATCHED: Invoice Number, GSTIN, and Tax Values match within 1.00 INR tolerance (ITC Eligible).
2. MISMATCH_TAX: Tax amounts differ (Claim lower value; demand difference).
3. MISSING_IN_GSTR2B: Unfiled by vendor (ITC Blocked under Section 16(2)(aa)).
4. MISSING_IN_PURCHASE: Recorded on portal but missing in ERP books.

---

### Phase 5: Statutory Remediation & Vendor Notice

When an invoice fails compliance checks, the agent automatically provides a pre-drafted bilingual notice ready to send to the vendor's finance team under Section 34 of the CGST Act.

---

## 3. Concrete Usage Examples

### Example 1: Validating a GSTIN Checksum
User Prompt:
"Please validate this GSTIN: 27AAPFU0939F1ZV"

Agent Action:
Executes `node scripts/gst_engine.js validate-gstin 27AAPFU0939F1ZV`
Returns:
- Status: VALID
- State: Maharashtra (Code 27)
- Entity: Partnership Firm / LLP
- Checksum: V (Luhn Mod-36 Verified)

### Example 2: Detecting Illegal Interstate Tax Split
User Prompt:
"Check this bill: Supplier in Maharashtra (27) billed goods to Karnataka (29) with CGST 900 and SGST 900 on 10,000 INR."

Agent Action:
Executes `node scripts/gst_engine.js validate --json '{"supplier_gstin":"27AAPFU0939F1ZV","place_of_supply":"29","line_items":[{"taxable_value":10000,"tax_rate":18,"cgst":900,"sgst":900}]}'`
Returns:
- Status: REJECTED (Risk Score: 50%)
- 2026 IMS Action: REJECT
- Violation: Illegal CGST/SGST charged on Inter-State supply (IGST Act Section 7). Only IGST is applicable.
- Remediation: Issues Section 34 Credit Note demand notice to vendor.

---

## 4. Standard Audit Output Format

```markdown
# Bharat GST Compliance & Audit Report

### 1. Executive Summary
- Overall Status: [PASSED | PASSED_WITH_WARNINGS | REJECTED]
- 2026 IMS Portal Action: [ACCEPT | REJECT | PENDING_AMENDMENT_GSTR1A]
- Risk Score: [0 - 100%]
- Total Invoices Audited: [N]
- Input Tax Credit (ITC) at Risk: INR [Amount]

### 2. Entity & Jurisdictional Analysis
| Entity | GSTIN | Registered State | Checksum Status |
| :--- | :--- | :--- | :--- |
| Supplier | `27AAPFU0939F1ZV` | Maharashtra (27) | VALID (Luhn Mod-36) |
| Recipient | `29AABCU9603R1ZJ` | Karnataka (29) | VALID |
| Place of Supply (POS) | 29 (Karnataka) | Inter-State Supply | IGST Applicable |

### 3. Discrepancy Matrix
| Invoice No. | Severity | Issue Detected | Statutory Rule | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| INV-2026-004 | CRITICAL | Illegal CGST/SGST on Inter-State Supply | IGST Act Sec 7 | Reject on IMS; Demand revised invoice |

### 4. GSTR-2B ITC Eligibility Summary
- Eligible ITC: INR [Amount]
- Blocked ITC (Sec 16(2)(aa)): INR [Amount]

### 5. Official Vendor Rectification Demand Notice (Sec 34 CGST Act)
[Included in English & Hindi for immediate dispatch]
```
