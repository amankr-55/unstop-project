#!/usr/bin/env node
/**
 * Bharat GST Sentinel - Automated GSTR-2B vs Purchase Register Reconciler
 * Categorizes ITC eligibility, tax mismatches, and generates statutory audit reports.
 */

const fs = require('fs');
const path = require('path');
const { validateGSTIN } = require('./gst_engine');

function normalizeInvNum(num) {
  if (!num) return '';
  return String(num).trim().toUpperCase().replace(/[\/\-_]/g, '');
}

function reconcile(purchaseRegister, gstr2bList) {
  const purchaseMap = new Map();
  const gstr2bMap = new Map();

  let totalPurchaseITC = 0;
  let totalGSTR2BITC = 0;
  let eligibleITC = 0;
  let blockedITC = 0;

  // Index purchase records
  purchaseRegister.forEach(rec => {
    const normKey = `${rec.supplier_gstin.toUpperCase()}_${normalizeInvNum(rec.invoice_number)}`;
    const taxTotal = parseFloat(rec.cgst || 0) + parseFloat(rec.sgst || 0) + parseFloat(rec.igst || 0);
    totalPurchaseITC += taxTotal;
    purchaseMap.set(normKey, { ...rec, taxTotal });
  });

  // Index GSTR-2B records
  gstr2bList.forEach(rec => {
    const normKey = `${rec.supplier_gstin.toUpperCase()}_${normalizeInvNum(rec.invoice_number)}`;
    const taxTotal = parseFloat(rec.cgst || 0) + parseFloat(rec.sgst || 0) + parseFloat(rec.igst || 0);
    totalGSTR2BITC += taxTotal;
    gstr2bMap.set(normKey, { ...rec, taxTotal });
  });

  const matched = [];
  const taxMismatches = [];
  const missingIn2B = [];
  const missingInPurchase = [];
  const vendorActions = new Map();

  // Audit Purchase against GSTR-2B
  for (const [key, pRec] of purchaseMap.entries()) {
    const gRec = gstr2bMap.get(key);
    const gstinValidation = validateGSTIN(pRec.supplier_gstin);

    if (!gstinValidation.valid) {
      missingIn2B.push({
        invoice_number: pRec.invoice_number,
        supplier_gstin: pRec.supplier_gstin,
        reason: 'INVALID_GSTIN_CHECKSUM',
        tax_claimed: pRec.taxTotal,
        action: 'Reject invoice. Supplier GSTIN checksum is invalid.'
      });
      blockedITC += pRec.taxTotal;
      continue;
    }

    if (!gRec) {
      missingIn2B.push({
        invoice_number: pRec.invoice_number,
        supplier_gstin: pRec.supplier_gstin,
        invoice_date: pRec.invoice_date,
        tax_claimed: pRec.taxTotal,
        reason: 'NOT_FILED_BY_VENDOR',
        action: 'Hold ITC claim under CGST Act Sec 16(2)(aa). Contact vendor to file GSTR-1.'
      });
      blockedITC += pRec.taxTotal;

      const vList = vendorActions.get(pRec.supplier_gstin) || [];
      vList.push(`Invoice ${pRec.invoice_number} (₹${pRec.taxTotal.toFixed(2)}) missing in GSTR-2B`);
      vendorActions.set(pRec.supplier_gstin, vList);
    } else {
      const diff = Math.abs(pRec.taxTotal - gRec.taxTotal);
      if (diff <= 1.0) {
        matched.push({
          invoice_number: pRec.invoice_number,
          supplier_gstin: pRec.supplier_gstin,
          purchase_tax: pRec.taxTotal,
          gstr2b_tax: gRec.taxTotal,
          status: 'ELIGIBLE_FOR_ITC'
        });
        eligibleITC += pRec.taxTotal;
      } else {
        taxMismatches.push({
          invoice_number: pRec.invoice_number,
          supplier_gstin: pRec.supplier_gstin,
          purchase_tax: pRec.taxTotal,
          gstr2b_tax: gRec.taxTotal,
          tax_difference: diff,
          action: pRec.taxTotal > gRec.taxTotal
            ? `Claim only ₹${gRec.taxTotal.toFixed(2)}. Difference of ₹${diff.toFixed(2)} cannot be claimed.`
            : `Book extra eligible credit of ₹${diff.toFixed(2)}.`
        });
        eligibleITC += Math.min(pRec.taxTotal, gRec.taxTotal);
        if (pRec.taxTotal > gRec.taxTotal) {
          blockedITC += (pRec.taxTotal - gRec.taxTotal);
        }
      }
    }
  }

  // Audit records in GSTR-2B missing from Purchase Register
  for (const [key, gRec] of gstr2bMap.entries()) {
    if (!purchaseMap.has(key)) {
      missingInPurchase.push({
        invoice_number: gRec.invoice_number,
        supplier_gstin: gRec.supplier_gstin,
        gstr2b_tax: gRec.taxTotal,
        action: 'Verify if bill was received but not booked in accounting ERP.'
      });
    }
  }

  return {
    summary: {
      total_purchase_invoices: purchaseRegister.length,
      total_gstr2b_invoices: gstr2bList.length,
      matched_count: matched.length,
      tax_mismatch_count: taxMismatches.length,
      missing_in_2b_count: missingIn2B.length,
      missing_in_purchase_count: missingInPurchase.length,
      total_itc_claimed_books: totalPurchaseITC,
      total_itc_in_gstr2b: totalGSTR2BITC,
      itc_eligible: eligibleITC,
      itc_at_risk_blocked: blockedITC
    },
    matched,
    tax_mismatches: taxMismatches,
    missing_in_2b: missingIn2B,
    missing_in_purchase: missingInPurchase,
    vendor_action_list: Array.from(vendorActions.entries()).map(([gstin, issues]) => ({
      supplier_gstin: gstin,
      pending_issues: issues
    }))
  };
}

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const pIdx = args.indexOf('--purchase');
  const gIdx = args.indexOf('--gstr2b');

  if (pIdx === -1 || gIdx === -1) {
    console.log(`
Bharat GST Sentinel - GSTR-2B Reconciler
Usage:
  node scripts/gstr2b_reconciler.js --purchase <purchase_register.json> --gstr2b <gstr2b.json>
    `);
    process.exit(1);
  }

  try {
    const purchase = JSON.parse(fs.readFileSync(args[pIdx + 1], 'utf8'));
    const gstr2b = JSON.parse(fs.readFileSync(args[gIdx + 1], 'utf8'));
    const result = reconcile(purchase, gstr2b);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Reconciliation error:', e.message);
    process.exit(1);
  }
}

module.exports = { reconcile };
