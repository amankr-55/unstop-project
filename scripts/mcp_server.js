#!/usr/bin/env node
/**
 * Bharat GST Sentinel - Model Context Protocol (MCP) Stdio Server
 * Provides native tool calling interface for Claude Code, Cursor, and Agentic AI systems.
 */

const readline = require('readline');
const { validateGSTIN, validateInvoice, generateVendorNotice } = require('./gst_engine');
const { reconcile } = require('./gstr2b_reconciler');

const TOOLS = [
  {
    name: 'gst_validate_gstin',
    description: 'Validates 15-character Indian GSTIN structure, state code (01-38), and ISO/IEC 7064 Luhn Mod-36 checksum.',
    inputSchema: {
      type: 'object',
      properties: {
        gstin: { type: 'string', description: '15-character Indian GSTIN (e.g., 27AAPFU0939F1ZV)' }
      },
      required: ['gstin']
    }
  },
  {
    name: 'gst_validate_invoice',
    description: 'Audits Indian B2B GST invoice against IGST Act Sec 7/8, Place of Supply rules, and assigns 2026 IMS actions.',
    inputSchema: {
      type: 'object',
      properties: {
        supplier_gstin: { type: 'string' },
        recipient_gstin: { type: 'string' },
        invoice_number: { type: 'string' },
        invoice_date: { type: 'string' },
        place_of_supply: { type: 'string' },
        line_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              taxable_value: { type: 'number' },
              tax_rate: { type: 'number' },
              cgst: { type: 'number' },
              sgst: { type: 'number' },
              igst: { type: 'number' }
            },
            required: ['taxable_value', 'tax_rate']
          }
        },
        total_invoice_value: { type: 'number' },
        eway_bill_number: { type: 'string' }
      },
      required: ['supplier_gstin', 'place_of_supply', 'line_items']
    }
  },
  {
    name: 'gst_reconcile_gstr2b',
    description: 'Automated 3-way matching of purchase register against GSTR-2B returns for ITC eligibility (Sec 16(2)(aa)).',
    inputSchema: {
      type: 'object',
      properties: {
        purchase_register: { type: 'array', items: { type: 'object' } },
        gstr2b_records: { type: 'array', items: { type: 'object' } }
      },
      required: ['purchase_register', 'gstr2b_records']
    }
  },
  {
    name: 'gst_generate_vendor_notice',
    description: 'Generates bilingual (English and Hindi) Section 34 legal rectification demand notice for vendor.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice: { type: 'object' },
        issues: { type: 'array' }
      },
      required: ['invoice', 'issues']
    }
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    handleRequest(req);
  } catch (err) {
    console.error('Failed to parse JSON-RPC request:', err);
  }
});

function sendResponse(id, result, error = null) {
  const res = { jsonrpc: '2.0', id };
  if (error) {
    res.error = error;
  } else {
    res.result = result;
  }
  process.stdout.write(JSON.stringify(res) + '\n');
}

function handleRequest(req) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'bharat-gst-sentinel-mcp',
        version: '1.0.0'
      },
      capabilities: {
        tools: {}
      }
    });
  } else if (method === 'tools/list') {
    sendResponse(id, { tools: TOOLS });
  } else if (method === 'tools/call') {
    const toolName = params.name;
    const args = params.arguments || {};

    try {
      let content = [];
      if (toolName === 'gst_validate_gstin') {
        const out = validateGSTIN(args.gstin);
        content = [{ type: 'text', text: JSON.stringify(out, null, 2) }];
      } else if (toolName === 'gst_validate_invoice') {
        const out = validateInvoice(args);
        content = [{ type: 'text', text: JSON.stringify(out, null, 2) }];
      } else if (toolName === 'gst_reconcile_gstr2b') {
        const out = reconcile(args.purchase_register, args.gstr2b_records);
        content = [{ type: 'text', text: JSON.stringify(out, null, 2) }];
      } else if (toolName === 'gst_generate_vendor_notice') {
        const out = generateVendorNotice(args.invoice, args.issues);
        content = [{ type: 'text', text: JSON.stringify(out, null, 2) }];
      } else {
        return sendResponse(id, null, { code: -32601, message: `Tool '${toolName}' not found` });
      }

      sendResponse(id, { content });
    } catch (e) {
      sendResponse(id, null, { code: -32000, message: e.message });
    }
  } else {
    sendResponse(id, null, { code: -32601, message: `Method '${method}' not implemented` });
  }
}
