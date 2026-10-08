---
name: bharat-gst-sentinel
description: Autonomous Indian GST Compliance Auditor, 2026 IMS Action Classifier, & GSTR-2B Reconciler. Use whenever processing Indian tax invoices, validating GSTIN checksums (Luhn Mod-36), checking intra-state vs inter-state (CGST/SGST vs IGST) tax splits, generating statutory vendor demand letters under Section 34, or reconciling purchase registers with GSTR-2B.
version: 2.0.0
author: Agentic AI Engineer
tags:
  - finance
  - india
  - gst
  - compliance
  - invoice-audit
  - gstr2b
  - mcp
  - ims-2026
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
mcp-servers:
  - name: bharat-gst-sentinel
    command: node
    args: ["scripts/mcp_server.js"]
---

# 🛡️ Bharat GST Sentinel (2026 Edition)
### Autonomous Indian GST Auditor, GSTR-2B Reconciler & Statutory Notice Drafter

A specialized agent skill designed to audit, validate, reconcile, and remediate Indian B2B Goods & Services Tax (GST) invoices with zero mathematical hallucination, adhering strictly to the CGST/IGST Act and the 2026 GST 2.0 Invoice Management System (IMS) framework.

---

## 1. When to Activate This Skill

Activate this skill when:
- Validating any 15-character Indian Goods and Services Tax Identification Number (GSTIN).
- Determining tax liability splits: Intra-state (CGST + SGST) vs Inter-state (IGST) based on Place of Supply (POS).
- Reconciling internal purchase registers against government GSTR-2B / GSTR-1 returns to identify Input Tax Credit (ITC) discrepancies under Section 16(2)(aa).
- Determining 2026 GST Portal IMS (Invoice Management System) action: `ACCEPT`, `REJECT`, or `PENDING_AMENDMENT_GSTR1A`.
- Drafting legally compliant Section 34 statutory demand/rectification notices for vendors with billing errors.

---

## 2. Core Operational Workflow

When processing an invoice or reconciliation request, follow this exact 5-phase protocol:

```
[Phase 1: Ingestion & Field Extraction]
              │
              ▼
[Phase 2: Offline Deterministic Engine Validation]  <-- CRITICAL: Use scripts/gst_engine.js
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
1. `supplier_gstin`: 15-character string
2. `recipient_gstin`: 15-character string
3. `invoice_number`: String (alphanumeric, max 16 chars)
4. `invoice_date`: YYYY-MM-DD
5. `place_of_supply`: 2-digit state code or State Name
6. `line_items`: Array of items containing `description`, `hsn_sac`, `taxable_value`, `tax_rate`, `cgst`, `sgst`, `igst`.
7. `total_invoice_value`: Numerical value.

---

### Phase 2: Deterministic Validation (Zero LLM Guesswork)

> **AGENT GUARDRAIL:** Never attempt to mentally compute the Luhn Mod-36 checksum or tax calculations directly within the LLM prompt. Always execute the deterministic engine.

**Terminal Execution:**
```bash
node scripts/gst_engine.js validate --json '<JSON_PAYLOAD>'
```
Or with Python:
```bash
python scripts/gst_engine.py validate --json '<JSON_PAYLOAD>'
```
Or via native MCP Tool Calling:
```json
{
  "tool": "gst_validate_invoice",
  "arguments": { ... }
}
```

The engine deterministically evaluates:
1. **Luhn Mod-36 GSTIN Checksum**:
   - Calculates 15th check character using ISO/IEC 7064 Mod-36.
   - Detects character transpositions and malformed PAN entity types (C, P, H, F, A, T, etc.).
2. **State Code Legitimacy**:
   - Matches the first 2 digits against official Indian state codes (01 to 38, 97).
3. **Jurisdictional Tax Split (IGST Act Sec 7 & 8)**:
   - **Intra-State Supply**: If `supplier_state == place_of_supply`, equal CGST and SGST must apply. IGST MUST be `0.00`.
   - **Inter-State Supply**: If `supplier_state != place_of_supply`, IGST applies in full. CGST and SGST MUST be `0.00`.
4. **Section 170 Rounding Precision**:
   - Tax amount differences greater than ₹1.00 are flagged as critical discrepancies.
5. **Rule 138 E-Way Bill Consignment Threshold**:
   - Inter-state movements over ₹50,000 without an E-Way bill number trigger statutory warnings.

---

### Phase 3: 2026 GST Portal IMS Action Assignment

Under the GST 2.0 framework, every supplier invoice received must be classified into one of 3 IMS actions:
- **`ACCEPT`**: Clean invoice; zero discrepancies. Safe to auto-populate into GSTR-2B and claim ITC in GSTR-3B.
- **`REJECT`**: Checksum failed, supplier unregistered, or illegal tax type charged. Invoice rejected; vendor must issue Credit Note.
- **`PENDING_AMENDMENT_GSTR1A`**: Value/tax discrepancy within reasonable bounds. Held pending amendment in vendor's GSTR-1A return.

---

### Phase 4: GSTR-2B Automated 3-Way Reconciliation

When matching purchase books against government returns:
```bash
node scripts/gstr2b_reconciler.js --purchase purchase.json --gstr2b gstr2b.json
```
Classifies records into:
1. `MATCHED`: Invoice Number, GSTIN, and Tax Values match within ₹1.00 tolerance (ITC Eligible).
2. `MISMATCH_TAX`: Tax amounts differ (Claim lower value; demand difference).
3. `MISSING_IN_GSTR2B`: Unfiled by vendor (ITC Blocked under Section 16(2)(aa)).
4. `MISSING_IN_PURCHASE`: Recorded on portal but missing in ERP books.

---

### Phase 5: Statutory Remediation & Vendor Notice

When an invoice fails compliance checks, the agent automatically provides a pre-drafted bilingual notice ready to send to the vendor's finance team under Section 34 of the CGST Act.

---

## 3. Standard Audit Output Format

```markdown
# 🛡️ Bharat GST Compliance & Audit Report

### 1. Executive Summary
- **Overall Status**: [PASSED | PASSED_WITH_WARNINGS | REJECTED]
- **2026 IMS Portal Action**: [ACCEPT | REJECT | PENDING_AMENDMENT_GSTR1A]
- **Risk Score**: [0 - 100%]
- **Total Invoices Audited**: [N]
- **Input Tax Credit (ITC) at Risk**: ₹ [Amount]

### 2. Entity & Jurisdictional Analysis
| Entity | GSTIN | Registered State | Checksum Status |
| :--- | :--- | :--- | :--- |
| **Supplier** | `27AAPFU0939F1ZV` | Maharashtra (27) | ✅ VALID (Luhn Mod-36) |
| **Recipient** | `29AABCU9603R1ZJ` | Karnataka (29) | ✅ VALID |
| **Place of Supply (POS)** | `29` (Karnataka) | Inter-State Supply | ✅ IGST Applicable |

### 3. Discrepancy Matrix
| Invoice No. | Severity | Issue Detected | Statutory Rule | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `INV-2026-004` | 🔴 CRITICAL | Illegal CGST/SGST on Inter-State Supply | IGST Act Sec 7 | Reject on IMS; Demand revised invoice |

### 4. GSTR-2B ITC Eligibility Summary
- **Eligible ITC**: ₹ [Amount]
- **Blocked ITC (Sec 16(2)(aa))**: ₹ [Amount]

### 5. Official Vendor Rectification Demand Notice (Sec 34 CGST Act)
[Included in English & Hindi for immediate dispatch]
```
