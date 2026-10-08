#!/usr/bin/env python3
"""
Bharat GST Sentinel - Python Deterministic Engine
Implements ISO/IEC 7064 & Luhn Mod-36 GSTIN checksum, Indian State Code lookup,
CGST/SGST vs IGST jurisdictional validation, and Section 170 rounding checks.
"""

import sys
import os
import json
import re

CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

def load_state_codes():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ref_path = os.path.join(base_dir, "..", "references", "state_codes.json")
    try:
        with open(ref_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "27": {"state_name": "Maharashtra"},
            "29": {"state_name": "Karnataka"},
            "07": {"state_name": "Delhi"},
            "24": {"state_name": "Gujarat"},
            "33": {"state_name": "Tamil Nadu"}
        }

STATE_CODES = load_state_codes()

PAN_ENTITY_TYPES = {
    'C': 'Company',
    'P': 'Individual / Proprietorship',
    'H': 'Hindu Undivided Family (HUF)',
    'F': 'Partnership Firm / LLP',
    'A': 'Association of Persons (AOP)',
    'T': 'Trust',
    'B': 'Body of Individuals (BOI)',
    'L': 'Local Authority',
    'J': 'Artificial Juridical Person',
    'G': 'Government Entity'
}

def calculate_checksum_digit(gstin14):
    if not gstin14 or len(gstin14) != 14:
        return None
    total = 0
    for i, char in enumerate(gstin14.upper()):
        if char not in CHARS:
            return None
        val = CHARS.index(char)
        factor = 1 if (i % 2 == 0) else 2
        product = val * factor
        total += (product // 36) + (product % 36)
    remainder = total % 36
    checksum = (36 - remainder) % 36
    return CHARS[checksum]

def validate_gstin(gstin):
    if not gstin or not isinstance(gstin, str):
        return {"valid": False, "error": "GSTIN missing or not a string"}
    clean_gstin = gstin.strip().upper()
    if len(clean_gstin) != 15:
        return {
            "valid": False,
            "gstin": clean_gstin,
            "error": f"Invalid length ({len(clean_gstin)}). Must be exactly 15 characters."
        }

    pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    if not re.match(pattern, clean_gstin):
        return {
            "valid": False,
            "gstin": clean_gstin,
            "error": "Format violation: Does not match standard Indian GSTIN syntax."
        }

    state_code = clean_gstin[:2]
    state_info = STATE_CODES.get(state_code)
    if not state_info:
        return {
            "valid": False,
            "gstin": clean_gstin,
            "error": f"Invalid State Code '{state_code}'. Not recognized in Indian GST jurisdiction."
        }

    pan_char = clean_gstin[5]
    entity_type = PAN_ENTITY_TYPES.get(pan_char, "Unknown Entity")

    expected_char = calculate_checksum_digit(clean_gstin[:14])
    actual_char = clean_gstin[14]

    if expected_char != actual_char:
        return {
            "valid": False,
            "gstin": clean_gstin,
            "state_code": state_code,
            "state_name": state_info.get("state_name", "Unknown"),
            "entity_type": entity_type,
            "expected_checksum": expected_char,
            "actual_checksum": actual_char,
            "error": f"Checksum verification failed. Expected '{expected_char}', found '{actual_char}'. (Luhn Mod-36 mismatch)"
        }

    return {
        "valid": True,
        "gstin": clean_gstin,
        "state_code": state_code,
        "state_name": state_info.get("state_name", "Unknown"),
        "entity_type": entity_type,
        "checksum": actual_char
    }

def normalize_state_code(inp):
    if not inp:
        return None
    s = str(inp).strip().upper()
    if re.match(r"^[0-9]{1,2}$", s):
        return s.zfill(2)
    for code, info in STATE_CODES.items():
        if info.get("state_name", "").upper() == s:
            return code
    return None

def validate_invoice(invoice):
    issues = []
    risk_score = 0

    supplier_check = validate_gstin(invoice.get("supplier_gstin", ""))
    if not supplier_check["valid"]:
        issues.append({
            "severity": "CRITICAL",
            "field": "supplier_gstin",
            "issue": supplier_check.get("error"),
            "rule": "CGST Act Section 22 - Valid Supplier Registration"
        })
        risk_score += 35

    recipient_check = None
    if invoice.get("recipient_gstin"):
        recipient_check = validate_gstin(invoice.get("recipient_gstin"))
        if not recipient_check["valid"]:
            issues.append({
                "severity": "HIGH",
                "field": "recipient_gstin",
                "issue": recipient_check.get("error"),
                "rule": "CGST Act Section 25 - Recipient Registration"
            })
            risk_score += 25

    supplier_state = supplier_check.get("state_code") if supplier_check.get("valid") else normalize_state_code(invoice.get("supplier_state"))
    pos_state = normalize_state_code(invoice.get("place_of_supply"))

    if not pos_state:
        issues.append({
            "severity": "CRITICAL",
            "field": "place_of_supply",
            "issue": f"Unrecognized Place of Supply: '{invoice.get('place_of_supply')}'",
            "rule": "IGST Act Section 10/12 - Determination of Place of Supply"
        })
        risk_score += 30

    is_intra_state = supplier_state and pos_state and (supplier_state == pos_state)
    expected_tax_type = "INTRA_STATE (CGST + SGST)" if is_intra_state else "INTER_STATE (IGST)"

    calc_taxable = 0.0
    calc_cgst = 0.0
    calc_sgst = 0.0
    calc_igst = 0.0
    charged_cgst = 0.0
    charged_sgst = 0.0
    charged_igst = 0.0

    line_items = invoice.get("line_items", [])
    if not isinstance(line_items, list) or len(line_items) == 0:
        issues.append({
            "severity": "CRITICAL",
            "field": "line_items",
            "issue": "No line items found in invoice.",
            "rule": "Invoice Rules 2017 - Rule 46(f)"
        })
        risk_score += 40
    else:
        for idx, item in enumerate(line_items):
            taxable = float(item.get("taxable_value", 0))
            rate = float(item.get("tax_rate", 0))
            tax_amount = (taxable * rate) / 100.0
            calc_taxable += taxable

            icgst = float(item.get("cgst", 0))
            isgst = float(item.get("sgst", 0))
            iigst = float(item.get("igst", 0))

            charged_cgst += icgst
            charged_sgst += isgst
            charged_igst += iigst

            if is_intra_state:
                expected_half = tax_amount / 2.0
                calc_cgst += expected_half
                calc_sgst += expected_half

                if iigst > 0:
                    issues.append({
                        "severity": "CRITICAL",
                        "field": f"line_items[{idx}]",
                        "issue": f"Illegal IGST charged (₹{iigst:.2f}) on Intra-State supply. Must charge CGST + SGST.",
                        "rule": "IGST Act Section 8"
                    })
                    risk_score += 30
                if abs(icgst - expected_half) > 1.0 or abs(isgst - expected_half) > 1.0:
                    issues.append({
                        "severity": "HIGH",
                        "field": f"line_items[{idx}]",
                        "issue": f"Tax split mismatch. Expected CGST/SGST ₹{expected_half:.2f} each. Charged: CGST ₹{icgst}, SGST ₹{isgst}.",
                        "rule": "CGST Act Section 170"
                    })
                    risk_score += 20
            else:
                calc_igst += tax_amount
                if icgst > 0 or isgst > 0:
                    issues.append({
                        "severity": "CRITICAL",
                        "field": f"line_items[{idx}]",
                        "issue": f"Illegal CGST/SGST charged on Inter-State supply. Must charge IGST.",
                        "rule": "IGST Act Section 7"
                    })
                    risk_score += 30
                if abs(iigst - tax_amount) > 1.0:
                    issues.append({
                        "severity": "HIGH",
                        "field": f"line_items[{idx}]",
                        "issue": f"IGST mismatch. Expected: ₹{tax_amount:.2f}, Charged: ₹{iigst}.",
                        "rule": "CGST Act Section 170"
                    })
                    risk_score += 20

    expected_total = calc_taxable + (calc_cgst + calc_sgst if is_intra_state else calc_igst)
    reported_total = float(invoice.get("total_invoice_value", 0))

    if reported_total > 0 and abs(reported_total - expected_total) > 1.0:
        issues.append({
            "severity": "HIGH",
            "field": "total_invoice_value",
            "issue": f"Invoice total discrepancy. Reported: ₹{reported_total:.2f}, Computed: ₹{expected_total:.2f}",
            "rule": "CGST Act Section 170"
        })
        risk_score += 15

    effective_total = reported_total or expected_total
    if not is_intra_state and effective_total > 50000.0 and not invoice.get("eway_bill_number"):
        issues.append({
            "severity": "MEDIUM",
            "field": "eway_bill_number",
            "issue": f"Inter-state movement > ₹50,000 without mandatory E-Way Bill.",
            "rule": "CGST Rules 2017 - Rule 138"
        })
        risk_score += 10

    risk_score = min(risk_score, 100)
    status = "REJECTED" if risk_score >= 50 else ("PASSED_WITH_WARNINGS" if risk_score > 0 else "PASSED")

    return {
        "status": status,
        "risk_score": risk_score,
        "invoice_number": invoice.get("invoice_number", "UNKNOWN"),
        "supplier": supplier_check,
        "recipient": recipient_check,
        "place_of_supply": {
            "code": pos_state,
            "name": STATE_CODES.get(pos_state, {}).get("state_name", "Unknown"),
            "tax_type": expected_tax_type
        },
        "totals": {
            "taxable_value": calc_taxable,
            "expected_tax": {"cgst": calc_cgst, "sgst": calc_sgst} if is_intra_state else {"igst": calc_igst},
            "charged_tax": {"cgst": charged_cgst, "sgst": charged_sgst, "igst": charged_igst},
            "grand_total": effective_total
        },
        "issues": issues
    }

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("Usage: python gst_engine.py validate-gstin <GSTIN> | validate --json '<JSON>' | validate-file --file <PATH>")
        sys.exit(0)

    cmd = args[0]
    if cmd == "validate-gstin":
        res = validate_gstin(args[1])
        print(json.dumps(res, indent=2))
        sys.exit(0 if res.get("valid") else 1)
    elif cmd == "validate" and "--json" in args:
        idx = args.index("--json")
        data = json.loads(args[idx + 1])
        res = validate_invoice(data)
        print(json.dumps(res, indent=2))
        sys.exit(2 if res["status"] == "REJECTED" else 0)
    elif cmd == "validate-file" and "--file" in args:
        idx = args.index("--file")
        with open(args[idx + 1], "r", encoding="utf-8") as f:
            data = json.load(f)
        res = validate_invoice(data)
        print(json.dumps(res, indent=2))
        sys.exit(2 if res["status"] == "REJECTED" else 0)
