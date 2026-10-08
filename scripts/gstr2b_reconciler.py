#!/usr/bin/env python3
"""
Bharat GST Sentinel - Python GSTR-2B Reconciler
Matches purchase register against GSTR-2B returns with statutory ITC eligibility checks.
"""

import sys
import json
import re
from gst_engine import validate_gstin

def normalize_inv_num(num):
    if not num:
        return ""
    return re.sub(r"[\/\-_]", "", str(num).strip().upper())

def reconcile(purchase_register, gstr2b_list):
    purchase_map = {}
    gstr2b_map = {}

    total_purchase_itc = 0.0
    total_gstr2b_itc = 0.0
    eligible_itc = 0.0
    blocked_itc = 0.0

    for rec in purchase_register:
        norm_key = f"{rec.get('supplier_gstin', '').upper()}_{normalize_inv_num(rec.get('invoice_number', ''))}"
        tax_total = float(rec.get("cgst", 0)) + float(rec.get("sgst", 0)) + float(rec.get("igst", 0))
        total_purchase_itc += tax_total
        item = dict(rec)
        item["taxTotal"] = tax_total
        purchase_map[norm_key] = item

    for rec in gstr2b_list:
        norm_key = f"{rec.get('supplier_gstin', '').upper()}_{normalize_inv_num(rec.get('invoice_number', ''))}"
        tax_total = float(rec.get("cgst", 0)) + float(rec.get("sgst", 0)) + float(rec.get("igst", 0))
        total_gstr2b_itc += tax_total
        item = dict(rec)
        item["taxTotal"] = tax_total
        gstr2b_map[norm_key] = item

    matched = []
    tax_mismatches = []
    missing_in_2b = []
    missing_in_purchase = []
    vendor_actions = {}

    for key, p_rec in purchase_map.items():
        g_rec = gstr2b_map.get(key)
        gstin_val = validate_gstin(p_rec.get("supplier_gstin", ""))

        if not gstin_val["valid"]:
            missing_in_2b.append({
                "invoice_number": p_rec.get("invoice_number"),
                "supplier_gstin": p_rec.get("supplier_gstin"),
                "reason": "INVALID_GSTIN_CHECKSUM",
                "tax_claimed": p_rec["taxTotal"],
                "action": "Reject invoice. Supplier GSTIN checksum is invalid."
            })
            blocked_itc += p_rec["taxTotal"]
            continue

        if not g_rec:
            missing_in_2b.append({
                "invoice_number": p_rec.get("invoice_number"),
                "supplier_gstin": p_rec.get("supplier_gstin"),
                "invoice_date": p_rec.get("invoice_date"),
                "tax_claimed": p_rec["taxTotal"],
                "reason": "NOT_FILED_BY_VENDOR",
                "action": "Hold ITC claim under CGST Act Sec 16(2)(aa). Contact vendor to file GSTR-1."
            })
            blocked_itc += p_rec["taxTotal"]
            v_gstin = p_rec.get("supplier_gstin", "")
            vendor_actions.setdefault(v_gstin, []).append(
                f"Invoice {p_rec.get('invoice_number')} (₹{p_rec['taxTotal']:.2f}) missing in GSTR-2B"
            )
        else:
            diff = abs(p_rec["taxTotal"] - g_rec["taxTotal"])
            if diff <= 1.0:
                matched.append({
                    "invoice_number": p_rec.get("invoice_number"),
                    "supplier_gstin": p_rec.get("supplier_gstin"),
                    "purchase_tax": p_rec["taxTotal"],
                    "gstr2b_tax": g_rec["taxTotal"],
                    "status": "ELIGIBLE_FOR_ITC"
                })
                eligible_itc += p_rec["taxTotal"]
            else:
                tax_mismatches.append({
                    "invoice_number": p_rec.get("invoice_number"),
                    "supplier_gstin": p_rec.get("supplier_gstin"),
                    "purchase_tax": p_rec["taxTotal"],
                    "gstr2b_tax": g_rec["taxTotal"],
                    "tax_difference": diff,
                    "action": f"Claim only ₹{g_rec['taxTotal']:.2f}." if p_rec["taxTotal"] > g_rec["taxTotal"] else f"Book extra credit ₹{diff:.2f}."
                })
                eligible_itc += min(p_rec["taxTotal"], g_rec["taxTotal"])
                if p_rec["taxTotal"] > g_rec["taxTotal"]:
                    blocked_itc += (p_rec["taxTotal"] - g_rec["taxTotal"])

    for key, g_rec in gstr2b_map.items():
        if key not in purchase_map:
            missing_in_purchase.append({
                "invoice_number": g_rec.get("invoice_number"),
                "supplier_gstin": g_rec.get("supplier_gstin"),
                "gstr2b_tax": g_rec["taxTotal"],
                "action": "Verify if bill was received but not booked in accounting ERP."
            })

    return {
        "summary": {
            "total_purchase_invoices": len(purchase_register),
            "total_gstr2b_invoices": len(gstr2b_list),
            "matched_count": len(matched),
            "tax_mismatch_count": len(tax_mismatches),
            "missing_in_2b_count": len(missing_in_2b),
            "missing_in_purchase_count": len(missing_in_purchase),
            "total_itc_claimed_books": total_purchase_itc,
            "total_itc_in_gstr2b": total_gstr2b_itc,
            "itc_eligible": eligible_itc,
            "itc_at_risk_blocked": blocked_itc
        },
        "matched": matched,
        "tax_mismatches": tax_mismatches,
        "missing_in_2b": missing_in_2b,
        "missing_in_purchase": missing_in_purchase,
        "vendor_action_list": [
            {"supplier_gstin": k, "pending_issues": v} for k, v in vendor_actions.items()
        ]
    }

if __name__ == "__main__":
    args = sys.argv[1:]
    if "--purchase" not in args or "--gstr2b" not in args:
        print("Usage: python gstr2b_reconciler.py --purchase <purchase.json> --gstr2b <gstr2b.json>")
        sys.exit(1)

    p_idx = args.index("--purchase")
    g_idx = args.index("--gstr2b")
    with open(args[p_idx + 1], "r", encoding="utf-8") as f:
        purchase = json.load(f)
    with open(args[g_idx + 1], "r", encoding="utf-8") as f:
        gstr2b = json.load(f)

    result = reconcile(purchase, gstr2b)
    print(json.dumps(result, indent=2))
