#!/usr/bin/env node
/**
 * Bharat GST Sentinel - Core Deterministic Engine (2026 GST 2.0 & IMS Compliant)
 * Implements:
 * 1. ISO/IEC 7064 & Luhn Mod-36 GSTIN Checksum Engine
 * 2. 36 Indian States & UTs Jurisdiction Matcher
 * 3. IGST Act Sec 7 & 8 Jurisdictional Tax Split Logic
 * 4. CGST Act Sec 170 (₹1.00 Rounding Precision)
 * 5. Rule 138 (₹50k E-Way Bill Consignment Mandate)
 * 6. 2026 Invoice Management System (IMS) Action Classifier (ACCEPT / REJECT / PENDING)
 * 7. Statutory Vendor Rectification Notice Generator (CGST Act Sec 34 Credit/Debit Note)
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
 * Calculates official Luhn Mod-36 check digit with step-by-step breakdown
 */
function calculateChecksumDigitWithSteps(gstin14) {
  if (!gstin14 || gstin14.length !== 14) return null;
  const steps = [];
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = gstin14[i].toUpperCase();
    const val = CHARS.indexOf(char);
    if (val === -1) return null;
    const factor = (i % 2 === 0) ? 1 : 2;
    const product = val * factor;
    const quotient = Math.floor(product / 36);
    const remainder = product % 36;
    const digitSum = quotient + remainder;
    sum += digitSum;

    steps.push({
      position: i + 1,
      char,
      code_point: val,
      factor,
      product,
      quotient,
      remainder,
      digit_sum: digitSum,
      running_sum: sum
    });
  }
  const remainder = sum % 36;
  const checksumIndex = (36 - remainder) % 36;
  const checkChar = CHARS[checksumIndex];

  return {
    checkChar,
    totalSum: sum,
    remainder,
    checksumIndex,
    steps
  };
}

function calculateChecksumDigit(gstin14) {
  const res = calculateChecksumDigitWithSteps(gstin14);
  return res ? res.checkChar : null;
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

  const checkDetails = calculateChecksumDigitWithSteps(cleanGstin.substring(0, 14));
  const expectedCheckDigit = checkDetails ? checkDetails.checkChar : null;
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
      calculation_steps: checkDetails ? checkDetails.steps : [],
      error: `Checksum verification failed. Expected character '${expectedCheckDigit}', found '${actualCheckDigit}'. (Luhn Mod-36 mismatch)`
    };
  }

  return {
    valid: true,
    gstin: cleanGstin,
    state_code: stateCode,
    state_name: stateInfo.state_name,
    entity_type: entityType,
    checksum: actualCheckDigit,
    calculation_steps: checkDetails ? checkDetails.steps : []
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
 * Generates official Statutory Rectification Notice for vendor (Bilingual EN/HI)
 */
function generateVendorNotice(invoice, issues, recipientInfo = {}) {
  const invNo = invoice.invoice_number || 'UNKNOWN';
  const invDate = invoice.invoice_date || 'N/A';
  const supplierGstin = invoice.supplier_gstin || 'N/A';

  const issuesListEN = issues.map((i, idx) => `${idx + 1}. [${i.severity}] ${i.issue} (Ref: ${i.rule})`).join('\n');
  const issuesListHI = issues.map((i, idx) => `${idx + 1}. [${i.severity}] ${i.issue}`).join('\n');

  const noticeEN = `
OFFICIAL NOTICE OF TAX INVOICE DISCREPANCY & RECTIFICATION DEMAND
Issued under Section 34 of Central Goods & Services Tax (CGST) Act, 2017

To: Vendor Accounts Department
GSTIN: ${supplierGstin}
Invoice Reference: ${invNo} dated ${invDate}

Dear Accounts Team,

During statutory Input Tax Credit (ITC) compliance verification conducted by our automated GST compliance system, the subject tax invoice was FLAGGED WITH STATUTORY DISCREPANCIES:

DISCREPANCIES IDENTIFIED:
${issuesListEN}

STATUTORY IMPLICATION:
Under Section 16(2)(aa) of the CGST Act read with Rule 36(4), credit for the tax charged on the above invoice cannot be claimed in our GSTR-3B due to the above non-compliance.

REQUIRED ACTION WITHIN 7 WORKING DAYS:
1. Issue a formal Credit/Debit Note under Section 34 of the CGST Act to rectify the discrepancies.
2. File/amend the outward supply in your GSTR-1 / GSTR-1A return for the current tax period so that the rectified data populates in our Invoice Management System (IMS).
3. If this invoice was issued under Reverse Charge Mechanism (RCM) or Composition Scheme, provide immediate written clarification.

Please treat this notice as urgent to avoid commercial payment holds.

Regards,
Tax & Compliance Cell
  `.trim();

  const noticeHI = `
कर चालान (Tax Invoice) विसंगति एवं संशोधन सूचना
(CGST अधिनियम 2017 की धारा 34 के अंतर्गत जारी)

सेवा में: वेंडर लेखा विभाग
GSTIN: ${supplierGstin}
बिल संदर्भ: ${invNo} दिनांक ${invDate}

महोदय,

हमारी आंतरिक GST अनुपालन प्रणाली द्वारा किए गए वैधानिक ऑडिट में आपके उपर्युक्त इनवॉइस में निम्नलिखित गंभीर विसंगतियाँ पाई गई हैं:

विसंगतियाँ:
${issuesListHI}

कानूनी प्रभाव:
CGST अधिनियम की धारा 16(2)(aa) के तहत, इन गलतियों के कारण हम इस इनवॉइस पर इनपुट टैक्स क्रेडिट (ITC) का दावा नहीं कर सकते।

आवश्यक कार्रवाई (7 कार्यदिवसों के भीतर):
1. CGST अधिनियम की धारा 34 के तहत तुरंत संशोधित इनवॉइस या क्रेडिट नोट जारी करें।
2. चालू कर अवधि के लिए अपने GSTR-1 / GSTR-1A में आवश्यक सुधार करें ताकि यह हमारे IMS (Invoice Management System) पोर्टल पर सही प्रदर्शित हो सके।

धन्यवाद,
लेखा एवं अनुपालन विभाग
  `.trim();

  return { english: noticeEN, hindi: noticeHI };
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
    riskScore += 55;
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
  let imsAction = 'ACCEPT'; // 2026 GST Portal Invoice Management System Action

  if (riskScore >= 50) {
    status = 'REJECTED';
    imsAction = 'REJECT';
  } else if (riskScore > 0) {
    status = 'PASSED_WITH_WARNINGS';
    imsAction = 'PENDING_AMENDMENT_GSTR1A';
  }

  const statutoryNotice = issues.length > 0 ? generateVendorNotice(invoice, issues) : null;

  return {
    status,
    risk_score: riskScore,
    ims_action_2026: imsAction,
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
    issues,
    vendor_statutory_notice: statutoryNotice
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
Bharat GST Sentinel - CLI Engine (2026 GST 2.0 Compliant)
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
  calculateChecksumDigitWithSteps,
  validateGSTIN,
  normalizeStateCode,
  generateVendorNotice,
  validateInvoice
};
