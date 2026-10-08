const desc = `Audits Indian B2B GST invoices, verifies Luhn Mod-36 checksums, and reconciles purchase registers with GSTR-2B returns. Use when checking Indian tax bills, verifying tax math, or reviewing Place of Supply rules. Trigger when asked to "validate this GST number", "check invoice tax split", "verify GSTIN checksum", or "reconcile GSTR-2B", even if GST is not explicitly mentioned.`;

console.log("Length:", desc.length);
console.log("Under 500?:", desc.length <= 500);
