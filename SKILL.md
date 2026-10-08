---
name: bharat-gst-sentinel
description: Autonomous Indian GST Compliance, Invoice Auditor & GSTR-2B Reconciler. Use whenever processing Indian tax invoices, validating GSTIN checksums (Luhn Mod-36), checking intra-state vs inter-state (CGST/SGST vs IGST) tax splits, or reconciling purchase registers with GSTR-2B.
version: 1.0.0
author: Agentic AI Engineer
tags:
  - finance
  - india
  - gst
  - compliance
  - invoice-audit
  - gstr2b
compatibility:
  - claude-code
  - cursor
  - gemini-cli
  - antigravity
  - codex
allowed-tools:
  - run_command
  - view_file
  - write_to_file
---

# Bharat GST Sentinel: Autonomous Indian GST Auditor & Reconciler

A specialized agent skill designed to audit, validate, and reconcile Indian B2B Goods & Services Tax (GST) invoices with zero mathematical hallucination, strictly adhering to the CGST/IGST Act guidelines.

---

## 1. When to Activate This Skill

Activate this skill when:
- The user provides an Indian invoice, bill, or purchase register (in text, JSON, CSV, or markdown).
- Validating any 15-character Indian Goods and Services Tax Identification Number (GSTIN).
- Determining tax liability splits: Intra-state (CGST + SGST) vs Inter-state (IGST) based on Place of Supply (POS).
- Reconciling internal purchase registers against government GSTR-2B / GSTR-1 returns to identify Input Tax Credit (ITC) discrepancies.
- Checking HSN/SAC codes and tax rate slabs (0%, 5%, 12%, 18%, 28%).

---

## 2. Core Operational Workflow

When processing an invoice or reconciliation request, follow this exact 5-phase protocol:

```
[Phase 1: Ingestion & Extraction]
              │
              ▼
[Phase 2: Offline Deterministic Engine Validation]  <-- CRITICAL: Use scripts/gst_engine.py
              │
              ▼
[Phase 3: Legal & Jurisdictional Analysis]
              │
              ▼
[Phase 4: GSTR-2B Reconciliation (if data provided)]
              │
              ▼
[Phase 5: Structured Audit Report Generation]
```

### Phase 1: Ingestion & Field Extraction
Extract the following mandatory fields from the source data:
1. `supplier_gstin`: 15-character string
2. `recipient_gstin`: 15-character string
3. `invoice_number`: String (alphanumeric, max 16 chars)
4. `invoice_date`: YYYY-MM-DD
5. `place_of_supply`: 2-digit state code or State Name
6. `line_items`: Array of items containing `description`, `hsn_sac`, `taxable_value`, `tax_rate`, `cgst`, `sgst`, `igst`, `cess`.
7. `total_invoice_value`: Numerical value.

---

### Phase 2: Offline Deterministic Validation (Do NOT Calculate Mentally)

> **AGENT GUARDRAIL:** Never attempt to mentally compute the Luhn Mod-36 checksum or tax calculations directly within the LLM generation loop. LLMs suffer from high arithmetic and character transposition error rates.

Always invoke the bundled deterministic validation script:
```bash
python scripts/gst_engine.py validate --json '<JSON_PAYLOAD>'
```
Or for files:
```bash
python scripts/gst_engine.py validate-file --file path/to/invoice.json
```

The script deterministically evaluates:
1. **GSTIN Checksum (Luhn Mod-36)**:
   - Validates the 15th check character against ISO/IEC 7064 Mod-36.
   - Detects transposed digits and invalid entity types.
2. **State Code Legitimacy**:
   - Matches the first 2 digits against official Indian state codes (01 to 38, 97).
3. **Jurisdictional Tax Split (IGST Act Sec 7 & 8)**:
   - **Intra-State Supply**: If `supplier_state == place_of_supply`, CGST and SGST must apply in equal halves (e.g., 9% + 9% for 18% slab). IGST MUST be `0.00`.
   - **Inter-State Supply**: If `supplier_state != place_of_supply`, IGST applies in full (18%). CGST and SGST MUST be `0.00`.
4. **Rounding & Mathematical Tolerance (CGST Act Sec 170)**:
   - Tax amount differences greater than ₹1.00 are flagged as critical discrepancies.

---

### Phase 3: GSTR-2B Automated Reconciliation

When the user asks to reconcile a Purchase Register with GSTR-2B:
Run the reconciler script:
```bash
python scripts/gstr2b_reconciler.py --purchase purchase_register.json --gstr2b gstr2b_export.json
```

The engine classifies each record into one of 5 standard categories:
1. `MATCHED`: Invoice Number, GSTIN, and Tax Values match within ₹1.00 tolerance. (ITC fully eligible)
2. `MISMATCH_TAX`: Invoice exists in both, but tax amounts differ. (Flagged for vendor review)
3. `MISSING_IN_GSTR2B`: Present in internal records but NOT filed by vendor in GSTR-1/2B. (Risk of ITC denial under Section 16(2)(aa))
4. `MISSING_IN_PURCHASE`: Present in GSTR-2B but missing in internal books. (Unclaimed ITC or rogue invoice)
5. `INVALID_GSTIN`: Vendor GSTIN failed checksum verification.

---

### Phase 4: Audit Report Generation

Generate the final output in the following standardized format:

```markdown
# 🛡️ Bharat GST Compliance & Audit Report

### 1. Executive Summary
- **Overall Status**: [PASSED | PASSED_WITH_WARNINGS | REJECTED]
- **Risk Score**: [0 - 100%] (0 = Clean, 100 = Critical Compliance Breach)
- **Total Invoices Audited**: [N]
- **Total Input Tax Credit (ITC) at Risk**: ₹ [Amount]

### 2. Entity & Jurisdictional Analysis
| Entity | GSTIN | Registered State | Checksum Status |
| :--- | :--- | :--- | :--- |
| **Supplier** | `27AABCU9603R1ZM` | Maharashtra (27) | ✅ VALID |
| **Recipient** | `29AABCU9603R1ZK` | Karnataka (29) | ✅ VALID |
| **Place of Supply (POS)** | `29` (Karnataka) | Inter-State Supply | ✅ IGST Applicable |

### 3. Discrepancy Matrix
| Invoice No. | Severity | Issue Detected | Legal / Statutory Rule | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `INV-2026-081` | 🔴 CRITICAL | Wrong Tax Type: Charged CGST+SGST instead of IGST | IGST Act Sec 7 & 8 | Request revised tax invoice from vendor |
| `INV-2026-092` | 🟡 WARNING | Tax rounding off exceeds ₹1.00 threshold | CGST Act Sec 170 | Book ₹2.10 to Rounding Off Ledger |

### 4. GSTR-2B ITC Eligibility Summary
- **Eligible ITC (Matched)**: ₹ [Amount]
- **Ineligible / Blocked ITC**: ₹ [Amount]
- **Vendor Follow-up Required**: [N] vendors

### 5. Corrective Action Plan
1. [Action Item 1]
2. [Action Item 2]
```

---

## 3. Agent Guardrails & Failure Prevention

1. **NO Hardcoded Hallucinations**: Never assume a GSTIN is valid just because it is 15 characters long. Always pass it through `scripts/gst_engine.py`.
2. **Reverse Charge Mechanism (RCM)**: If the invoice indicates RCM = "Y", remind the user that the recipient must pay tax directly to the government under CGST Act Sec 9(3)/9(4).
3. **E-Way Bill Threshold**: If invoice value exceeds ₹50,000 for inter-state movement of goods, flag mandatory requirement of E-Way Bill Generation under Rule 138 of CGST Rules.
4. **Token Preservation**: For multi-invoice datasets, avoid dumping raw JSON lines into response text. Always output the condensed Markdown audit table.

---

## 4. References & Tools

- Helper Engine: `scripts/gst_engine.py` (Validation & Tax math)
- Reconciler: `scripts/gstr2b_reconciler.py` (GSTR-2B vs Purchase matching)
- State Code Reference: `references/state_codes.json`
- GST Tax Rate Guide: `references/gst_slabs.json`
