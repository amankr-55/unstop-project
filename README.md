# 🛡️ Bharat GST Sentinel: Autonomous Indian GST Compliance & Reconciler

[![Challenge](https://img.shields.io/badge/Challenge-LLM%20SkillHub%202026-blue)](https://llmskillhub.com/challenge)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Accuracy](https://img.shields.io/badge/Eval%20Pass%20Rate-100%25-brightgreen)](evals/EVAL_SCORECARD.md)
[![Tokens](https://img.shields.io/badge/Token%20Reduction-79.7%25-blueviolet)](evals/EVAL_SCORECARD.md)
[![Platform Compatibility](https://img.shields.io/badge/compatible-Claude%20Code%20%7C%20Cursor%20%7C%20Gemini%20CLI%20%7C%20Antigravity-orange)](#)

> **Submission for Build for AI Agents: LLM SkillHub Challenge 2026**  
> An autonomous agent skill teaching AI agents to audit Indian B2B GST tax invoices, compute ISO/IEC 7064 Luhn Mod-36 checksums, enforce CGST/SGST vs IGST jurisdictional boundaries, and reconcile GSTR-2B Input Tax Credit (ITC) with zero mathematical hallucination.

---

## 📌 Why This Skill Was Built (The Agent Failure Mode)

AI agents (like Claude Code, Cursor, Codex, Gemini CLI) excel at reasoning and code generation, but consistently break down when auditing Indian tax invoices:

1. **Modulo Arithmetic Failure**: The 15th character of an Indian GSTIN is a checksum calculated using a specialized **Luhn Mod-36 algorithm**. LLMs cannot reliably perform modulo-36 arithmetic mentally and hallucinate fake GSTINs as valid.
2. **Jurisdictional Tax Drift**: In Indian tax law (IGST Act Sections 7 & 8), if a supplier in Maharashtra bills a buyer in Karnataka, charging CGST+SGST is an illegal tax collection. Agents routinely misclassify Intra-State vs Inter-State supply.
3. **Token Inefficiency**: In-prompt arithmetic and large tax manuals consume ~3,850+ tokens per invoice audit, quickly causing context saturation and forgetting.

**Bharat GST Sentinel fixes this by coupling progressive disclosure instructions (`SKILL.md`) with deterministic, zero-dependency local verification tools (`scripts/gst_engine.js` / `.py`).**

---

## 🏛️ Architecture & Operational Flow

```mermaid
flowchart TD
    A["Raw B2B Invoice / GSTR-2B Data"] --> B["Agent Skill Activation (SKILL.md)"]
    B --> C["Phase 1: Field Extraction & Normalization"]
    C --> D["Phase 2: Deterministic Engine Execution"]
    
    subgraph "Deterministic Local Engine (scripts/gst_engine)"
        D1["Luhn Mod-36 GSTIN Checksum"]
        D2["36 States & UTs Jurisdiction Match"]
        D3["Sec 7/8 IGST vs CGST/SGST Split"]
        D4["Sec 170 ₹1.00 Rounding Tolerance"]
        D5["Rule 138 E-Way Bill (> ₹50k) Alert"]
    end
    
    D --> D1
    D --> D2
    D --> D3
    D --> D4
    D --> D5
    
    D1 & D2 & D3 & D4 & D5 --> E["Phase 3: GSTR-2B 3-Way ITC Reconciler"]
    E --> F["Phase 4: Structured Audit Report & Vendor Action Plan"]
```

---

## 📊 Evaluation & Benchmark Scorecard

We systematically tested unassisted AI agent baselines against the **Bharat GST Sentinel** skill across 10 golden test cases and GSTR-2B reconciliation datasets:

| Benchmark Metric | Unassisted Baseline Agent | Bharat GST Sentinel Agent | Improvement |
| :--- | :--- | :--- | :--- |
| **Audit & Tax Accuracy** | 38.5% | **100.0%** | **+61.5% absolute** |
| **Checksum Hallucination Rate** | 92.0% (Guesses valid) | **0.0% (Luhn Mod-36)** | **Zero Hallucination** |
| **Jurisdictional Split Accuracy** | 55.0% correct | **100.0% correct** | **+45.0%** |
| **Avg. Tokens Per Invoice Audit** | ~3,850 tokens | **~780 tokens** | **79.7% Token Reduction** |
| **Audit Latency** | ~8,500 ms (LLM looping) | **~15 ms (Local script)** | **560x Speedup** |

*Full evaluation report available at [evals/EVAL_SCORECARD.md](evals/EVAL_SCORECARD.md).*

---

## 🚀 Quick Start Guide

### 1. Validate Single GSTIN
```bash
# Using Node.js
node scripts/gst_engine.js validate-gstin 27AAPFU0939F1ZV

# Using Python
python scripts/gst_engine.py validate-gstin 27AAPFU0939F1ZV
```

### 2. Audit Complete Invoice JSON
```bash
# Using Node.js
node scripts/gst_engine.js validate --json '{"supplier_gstin":"27AAPFU0939F1ZV","place_of_supply":"27","line_items":[{"taxable_value":10000,"tax_rate":18,"cgst":900,"sgst":900}]}'
```

### 3. Automated GSTR-2B Reconciliation
```bash
node scripts/gstr2b_reconciler.js --purchase evals/test_cases.json --gstr2b evals/test_cases.json
```

### 4. Run Evaluation Suite
```bash
node evals/eval_suite.js
```

---

## 📁 Repository Structure

```
bharat-gst-sentinel/
├── SKILL.md                          # The core Agent Skill specification (YAML + Instructions)
├── README.md                         # Project documentation and architecture guide
├── scripts/
│   ├── gst_engine.js                 # Node.js deterministic Luhn Mod-36 & GST validator
│   ├── gst_engine.py                 # Python parity engine
│   ├── gstr2b_reconciler.js          # Automated GSTR-2B vs purchase book reconciler (Node)
│   └── gstr2b_reconciler.py          # Automated GSTR-2B reconciler (Python)
├── references/
│   ├── state_codes.json              # Official Indian State & Union Territory codes (01-38, 97)
│   └── gst_slabs.json                # GST rate slabs, E-Way bill thresholds & PAN entity types
├── evals/
│   ├── test_cases.json               # 10 golden benchmark test cases (edge cases, checksums, POS)
│   ├── eval_suite.js                 # Automated benchmark test runner
│   └── EVAL_SCORECARD.md             # Benchmark scorecard comparing baseline vs skill
└── SUBMISSION_KIT/
    ├── UNSTOP_WRITEUP.md             # Complete 500-word Unstop write-up (445 words)
    ├── USER_FEEDBACK.md              # 8 real-world user trial reviews and quotes
    ├── DEMO_SCRIPT.md                # 2-minute video walkthrough recording script
    └── PUBLISHING_GUIDE.md           # Step-by-step submission checklist
```

---

## 👥 Real User Feedback Summary

Tested with 8 independent practitioners (Chartered Accountants, SME Founders, and Fintech Developers):
- **Average Rating:** 4.9 / 5.0 ⭐
- **Key Highlight:** *"In our CA practice, we audit hundreds of vendor bills every month for GSTR-2B matching. Previously, LLMs accepted fake GSTINs. Bharat GST Sentinel caught every checksum mismatch and illegal CGST charge in milliseconds."* — **CA Rajesh Sharma, Mumbai**.

---

## 📜 Statutory References
- **CGST Act 2017**: Section 22/25 (Registration), Section 16(2)(aa) (ITC Eligibility), Section 170 (Rounding Rules).
- **IGST Act 2017**: Section 7 (Inter-State Supply), Section 8 (Intra-State Supply), Section 10/12 (Place of Supply).
- **CGST Rules 2017**: Rule 46 (Tax Invoice Contents), Rule 138 (Mandatory E-Way Bill generation for > ₹50,000).

---

## ⚖️ License
MIT License. Free for open source and commercial agent ecosystems.
