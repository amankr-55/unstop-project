#!/usr/bin/env node
/**
 * Bharat GST Sentinel - Core Deterministic Engine
 * Implements ISO/IEC 7064 & Luhn Mod-36 GSTIN checksum, Indian State Code lookup,
 * CGST/SGST vs IGST jurisdictional validation, and Section 170 rounding checks.
 */

const fs = require('fs');
const path = require('path');

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Load State Codes
let STATE_CODES = {};
try {
  const stateCodesPath = path.join(__dirname, '..', 'references', 'state_codes.json');
  STATE_CODES = JSON.parse(fs.readFileSync(stateCodesPath, 'utf8'));
} catch (e) {
  STATE_CODES = {
    "27": {"state_name": "Maharashtra"},
    "29": {"state_name": "Karnataka"},
    "07": {"state_name": "Delhi"},
    "24": {"state_name": "Gujarat"},
    "33": {"state_name": "Tamil Nadu"}
  };
}

const PAN_ENTITY_TYPES = {
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
};

/**
 * Calculates official Luhn Mod-36 check digit for a 14-char GSTIN prefix
 */
function calculateChecksumDigit(gstin14) {
  if (!gstin14 || gstin14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = CHARS.indexOf(gstin14[i].toUpperCase());
    if (val === -1) return null;
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = val * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const remainder = sum % 36;
  const checksum = (36 - remainder) % 36;
  return CHARS[checksum];
}

/**
 * Validates 15-character GSTIN structure, state code, and checksum
 */
function validateGSTIN(gstin) {
  if (!gstin || typeof gstin !== 'string') {
    return { valid: false, error: 'GSTIN is missing or not a string' };
  }
  const cleanGstin = gstin.trim().toUpperCase();

  if (cleanGstin.length !== 15) {
    return { valid: false, gstin: cleanGstin, error: `Invalid length (${cleanGstin.length}). Must be exactly 15 characters.` };
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(cleanGstin)) {
    return { valid: false, gstin: cleanGstin, error: 'Format violation: Does not match standard Indian GSTIN syntax [2-digit state][10-char PAN][1 entity][Z][1 check digit].' };
  }

  const stateCode = cleanGstin.substring(0, 2);
  const stateInfo = STATE_CODES[stateCode];
  if (!stateInfo) {
    return { valid: false, gstin: cleanGstin, error: `Invalid State Code '${stateCode}'. Not recognized in Indian GST jurisdiction.` };
  }

  const panEntityTypeChar = cleanGstin.charAt(5);
  const entityType = PAN_ENTITY_TYPES[panEntityTypeChar] || 'Unknown Entity';

  const expectedCheckDigit = calculateChecksumDigit(cleanGstin.substring(0, 14));
  const actualCheckDigit = cleanGstin.charAt(14);

  if (expectedCheckDigit !== actualCheckDigit) {
    return {
      valid: false,
      gstin: cleanGstin,
      state_code: stateCode,
      state_name: stateInfo.state_name,
      entity_type: entityType,
      expected_checksum: expectedCheckDigit,
      actual_checksum: actualCheckDigit,
      error: `Checksum verification failed. Expected character '${expectedCheckDigit}', found '${actualCheckDigit}'. (Luhn Mod-36 mismatch)`
    };
  }

  return {
    valid: true,
    gstin: cleanGstin,
    state_code: stateCode,
    state_name: stateInfo.state_name,
    entity_type: entityType,
    checksum: actualCheckDigit
  };
}

/**
 * Normalizes state code (handles 2-digit code string, number, or state name)
 */
function normalizeStateCode(input) {
  if (!input) return null;
  const str = String(input).trim().toUpperCase();
  if (/^[0-9]{1,2}$/.test(str)) {
    return str.padStart(2, '0');
  }
  for (const [code, info] of Object.entries(STATE_CODES)) {
    if (info.state_name.toUpperCase() === str) {
      return code;
    }
  }
  return null;
}

/**
 * Validates full Invoice Data Payload
 */
function validateInvoice(invoice) {
  const issues = [];
  let riskScore = 0;

  // 1. Supplier GSTIN
  const supplierCheck = validateGSTIN(invoice.supplier_gstin);
  if (!supplierCheck.valid) {
    issues.push({
      severity: 'CRITICAL',
      field: 'supplier_gstin',
      issue: supplierCheck.error,
      rule: 'CGST Act Section 22 - Valid Supplier Registration'
    });
    riskScore += 55; // Outright rejection threshold
  }

  // 2. Recipient GSTIN
  let recipientCheck = null;
  if (invoice.recipient_gstin) {
    recipientCheck = validateGSTIN(invoice.recipient_gstin);
    if (!recipientCheck.valid) {
      issues.push({
        severity: 'HIGH',
        field: 'recipient_gstin',
        issue: recipientCheck.error,
        rule: 'CGST Act Section 25 - Recipient Registration'
      });
      riskScore += 25;
    }
  }

  // 3. Place of Supply & Tax Jurisdiction
  const supplierState = supplierCheck.valid ? supplierCheck.state_code : normalizeStateCode(invoice.supplier_state);
  const posState = normalizeStateCode(invoice.place_of_supply);

  if (!posState) {
    issues.push({
      severity: 'CRITICAL',
      field: 'place_of_supply',
      issue: `Unrecognized or missing Place of Supply: '${invoice.place_of_supply}'`,
      rule: 'IGST Act Section 10/12 - Determination of Place of Supply'
    });
    riskScore += 50;
  }

  const isIntraState = supplierState && posState && (supplierState === posState);
  const expectedTaxType = isIntraState ? 'INTRA_STATE (CGST + SGST)' : 'INTER_STATE (IGST)';

  // 4. Line Items Validation
  let calculatedTaxable = 0;
  let calculatedCGST = 0;
  let calculatedSGST = 0;
  let calculatedIGST = 0;
  let chargedCGST = 0;
  let chargedSGST = 0;
  let chargedIGST = 0;

  const lineItems = invoice.line_items || [];
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    issues.push({
      severity: 'CRITICAL',
      field: 'line_items',
      issue: 'No line items provided in invoice payload.',
      rule: 'Invoice Rules 2017 - Rule 46(f)'
    });
    riskScore += 50;
  } else {
    lineItems.forEach((item, idx) => {
      const taxable = parseFloat(item.taxable_value || 0);
      const rate = parseFloat(item.tax_rate || 0);
      const totalTaxForRate = (taxable * rate) / 100;

      calculatedTaxable += taxable;

      const itemCGST = parseFloat(item.cgst || 0);
      const itemSGST = parseFloat(item.sgst || 0);
      const itemIGST = parseFloat(item.igst || 0);

      chargedCGST += itemCGST;
      chargedSGST += itemSGST;
      chargedIGST += itemIGST;

      if (isIntraState) {
        const expectedHalf = totalTaxForRate / 2;
        calculatedCGST += expectedHalf;
        calculatedSGST += expectedHalf;

        if (itemIGST > 0) {
          issues.push({
            severity: 'CRITICAL',
            field: `line_items[${idx}]`,
            issue: `Illegal IGST charged (₹${itemIGST.toFixed(2)}) on Intra-State supply (Supplier: ${supplierState}, POS: ${posState}). Must only charge CGST + SGST.`,
            rule: 'IGST Act Section 8 - Intra-State Supply Definition'
          });
          riskScore += 50;
        }

        const cgstDiff = Math.abs(itemCGST - expectedHalf);
        const sgstDiff = Math.abs(itemSGST - expectedHalf);
        if (cgstDiff > 1.0 || sgstDiff > 1.0) {
          issues.push({
            severity: 'HIGH',
            field: `line_items[${idx}]`,
            issue: `Tax calculation mismatch on item '${item.description || idx}'. Expected CGST: ₹${expectedHalf.toFixed(2)}, SGST: ₹${expectedHalf.toFixed(2)}. Charged: CGST ₹${itemCGST}, SGST ₹${itemSGST}.`,
            rule: 'CGST Act Section 170 - Rounding & Valuation Rules'
          });
          riskScore += 20;
        }
      } else {
        // Inter-State
        calculatedIGST += totalTaxForRate;

        if (itemCGST > 0 || itemSGST > 0) {
          issues.push({
            severity: 'CRITICAL',
            field: `line_items[${idx}]`,
            issue: `Illegal CGST/SGST charged on Inter-State supply (Supplier: ${supplierState}, POS: ${posState}, Charged CGST: ₹${itemCGST}, SGST: ₹${itemSGST}). Must only charge IGST.`,
            rule: 'IGST Act Section 7 - Inter-State Supply Definition'
          });
          riskScore += 50;
        }

        const igstDiff = Math.abs(itemIGST - totalTaxForRate);
        if (igstDiff > 1.0) {
          issues.push({
            severity: 'HIGH',
            field: `line_items[${idx}]`,
            issue: `IGST mismatch on item '${item.description || idx}'. Expected: ₹${totalTaxForRate.toFixed(2)}, Charged: ₹${itemIGST}.`,
            rule: 'CGST Act Section 170 - Rounding Rules'
          });
          riskScore += 20;
        }
      }
    });
  }

  // 5. Total Invoice Value Check
  const expectedTotal = calculatedTaxable + (isIntraState ? (calculatedCGST + calculatedSGST) : calculatedIGST);
  const reportedTotal = parseFloat(invoice.total_invoice_value || 0);

  if (reportedTotal > 0 && Math.abs(reportedTotal - expectedTotal) > 1.0) {
    issues.push({
      severity: 'HIGH',
      field: 'total_invoice_value',
      issue: `Total invoice amount discrepancy. Reported: ₹${reportedTotal.toFixed(2)}, Computed: ₹${expectedTotal.toFixed(2)} (Diff: ₹${Math.abs(reportedTotal - expectedTotal).toFixed(2)}).`,
      rule: 'CGST Act Section 170 - Precision Threshold exceeded'
    });
    riskScore += 15;
  }

  // 6. E-Way Bill Advisory Check
  const effectiveInvoiceTotal = reportedTotal || expectedTotal;
  if (!isIntraState && effectiveInvoiceTotal > 50000.0) {
    if (!invoice.eway_bill_number) {
      issues.push({
        severity: 'MEDIUM',
        field: 'eway_bill_number',
        issue: `Inter-state consignment value (₹${effectiveInvoiceTotal.toFixed(2)}) exceeds statutory limit of ₹50,000. E-Way Bill generation is mandatory.`,
        rule: 'CGST Rules 2017 - Rule 138'
      });
      riskScore += 10;
    }
  }

  riskScore = Math.min(riskScore, 100);

  let status = 'PASSED';
  if (riskScore >= 50) {
    status = 'REJECTED';
  } else if (riskScore > 0) {
    status = 'PASSED_WITH_WARNINGS';
  }

  return {
    status,
    risk_score: riskScore,
    invoice_number: invoice.invoice_number || 'UNKNOWN',
    supplier: supplierCheck,
    recipient: recipientCheck,
    place_of_supply: {
      code: posState,
      name: STATE_CODES[posState] ? STATE_CODES[posState].state_name : 'Unknown',
      tax_type: expectedTaxType
    },
    totals: {
      taxable_value: calculatedTaxable,
      expected_tax: isIntraState ? { cgst: calculatedCGST, sgst: calculatedSGST } : { igst: calculatedIGST },
      charged_tax: { cgst: chargedCGST, sgst: chargedSGST, igst: chargedIGST },
      grand_total: effectiveInvoiceTotal
    },
    issues
  };
}

// CLI Handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'validate-gstin') {
    const gstin = args[1];
    const res = validateGSTIN(gstin);
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.valid ? 0 : 1);
  } else if (cmd === 'validate') {
    const jsonFlagIdx = args.indexOf('--json');
    if (jsonFlagIdx === -1 || !args[jsonFlagIdx + 1]) {
      console.error("Error: Please provide --json '<JSON_STRING>'");
      process.exit(1);
    }
    try {
      const data = JSON.parse(args[jsonFlagIdx + 1]);
      const res = validateInvoice(data);
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.status === 'REJECTED' ? 2 : 0);
    } catch (e) {
      console.error("Error parsing JSON:", e.message);
      process.exit(1);
    }
  } else if (cmd === 'validate-file') {
    const fileFlagIdx = args.indexOf('--file');
    if (fileFlagIdx === -1 || !args[fileFlagIdx + 1]) {
      console.error("Error: Please provide --file <PATH>");
      process.exit(1);
    }
    try {
      const data = JSON.parse(fs.readFileSync(args[fileFlagIdx + 1], 'utf8'));
      const res = validateInvoice(data);
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.status === 'REJECTED' ? 2 : 0);
    } catch (e) {
      console.error("Error reading/validating file:", e.message);
      process.exit(1);
    }
  } else {
    console.log(`
Bharat GST Sentinel - CLI Engine
Usage:
  node scripts/gst_engine.js validate-gstin <15_CHAR_GSTIN>
  node scripts/gst_engine.js validate --json '<JSON_PAYLOAD>'
  node scripts/gst_engine.js validate-file --file <FILE_PATH>
    `);
    process.exit(0);
  }
}

module.exports = {
  CHARS,
  STATE_CODES,
  calculateChecksumDigit,
  validateGSTIN,
  normalizeStateCode,
  validateInvoice
};
