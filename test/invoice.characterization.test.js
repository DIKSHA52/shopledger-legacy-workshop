'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

// These are in-memory copies of the recorded order lines. HSN values resolve
// through the application's current tax configuration; no database file is used.
const orders = [
  {
    id: 1001,
    customer: 'Meera Joshi',
    status: 'completed',
    coupon: '',
    subtotal: 610,
    discount: 0,
    tax: 66.9,
    total: 676.9,
    items: [
      { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
      { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
    ]
  },
  {
    id: 1002,
    customer: 'Anil Kulkarni',
    status: 'completed',
    coupon: 'SAVE10',
    subtotal: 1020,
    discount: 102,
    tax: 45.9,
    total: 963.9,
    items: [
      { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  },
  {
    id: 1004,
    customer: 'Kalyani Foods (Wholesale)',
    status: 'completed',
    coupon: 'SAVE10',
    subtotal: 2240,
    discount: 150,
    tax: 104.5,
    total: 2194.5,
    items: [
      { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
    ]
  },
  {
    id: 1007,
    customer: 'Suresh Deshmukh',
    status: 'pending',
    coupon: '',
    subtotal: 1280,
    discount: 0,
    tax: 127,
    total: 1407,
    items: [
      { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  },
  {
    id: 1008,
    customer: 'Walk-in',
    status: 'completed',
    coupon: '',
    subtotal: 500,
    discount: 0,
    tax: 90,
    total: 590,
    items: [
      { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
      { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
    ]
  }
];

function round2(value) {
  // Calculations use binary floating point; compare currency values rounded to paise.
  return Math.round((value + 1e-9) * 100) / 100;
}

function figuresFor(order) {
  return {
    checkout: pricing.computeTotals(order.items, order.coupon),
    invoice: invoice.computeInvoiceFigures(order)
  };
}

function assertFigures(order, expected) {
  const { checkout, invoice: printed } = figuresFor(order);

  assert.equal(checkout.subtotal, expected.checkout.subtotal);
  assert.equal(checkout.discount, expected.checkout.discount);
  assert.equal(checkout.taxable, expected.checkout.taxable);
  assert.equal(round2(checkout.tax), expected.checkout.tax);
  assert.equal(round2(checkout.total), expected.checkout.total);
  assert.deepEqual(checkout.lines.map((line) => ({
    gstPercent: line.gstPercent,
    gross: line.gross,
    taxable: line.taxable,
    tax: line.tax
  })), expected.checkout.lines);

  assert.equal(printed.subtotal, expected.invoice.subtotal);
  assert.equal(printed.discount, expected.invoice.discount);
  assert.equal(round2(printed.subtotal - printed.discount), expected.invoice.taxable);
  assert.equal(printed.tax, expected.invoice.tax);
  assert.equal(printed.total, expected.invoice.total);
  assert.deepEqual(printed.rows.map((line) => ({
    gstPercent: line.gstPercent,
    line: line.line,
    lineTax: line.lineTax
  })), expected.invoice.lines);
}

// Correct invoice values after the fix: ₹918.00 taxable, ₹45.90 GST, ₹963.90 total.
test('CURRENT BEHAVIOUR: invoice applies 18% GST before the SAVE10 discount (#1002)', () => {
  const order = orders.find((item) => item.id === 1002);
  assertFigures(order, {
    checkout: {
      subtotal: 1020, discount: 102, taxable: 918, tax: 45.9, total: 963.9,
      lines: [
        { gstPercent: 5, gross: 640, taxable: 576, tax: 28.8 },
        { gstPercent: 5, gross: 380, taxable: 342, tax: 17.1 }
      ]
    },
    invoice: {
      subtotal: 1020, discount: 120.36, taxable: 899.64, tax: 183.6, total: 1083.24,
      lines: [
        { gstPercent: 18, line: 640, lineTax: 115.2 },
        { gstPercent: 18, line: 380, lineTax: 68.4 }
      ]
    }
  });
});

// Correct invoice values after the fix: ₹2,090.00 taxable, ₹104.50 GST, ₹2,194.50 total.
test('CURRENT BEHAVIOUR: invoice ignores SAVE10 ₹150 discount cap (#1004)', () => {
  const order = orders.find((item) => item.id === 1004);
  assertFigures(order, {
    checkout: {
      subtotal: 2240, discount: 150, taxable: 2090, tax: 104.5, total: 2194.5,
      lines: [{ gstPercent: 5, gross: 2240, taxable: 2090, tax: 104.5 }]
    },
    invoice: {
      subtotal: 2240, discount: 264.32, taxable: 1975.68, tax: 403.2, total: 2378.88,
      lines: [{ gstPercent: 18, line: 2240, lineTax: 403.2 }]
    }
  });
});

// Correct invoice values after the fix: ₹610.00 taxable, ₹66.90 GST, ₹676.90 total.
test('CURRENT BEHAVIOUR: invoice uses 18% for the 5% HSN item (#1001)', () => {
  const order = orders.find((item) => item.id === 1001);
  assertFigures(order, {
    checkout: {
      subtotal: 610, discount: 0, taxable: 610, tax: 66.9, total: 676.9,
      lines: [
        { gstPercent: 18, gross: 280, taxable: 280, tax: 50.4 },
        { gstPercent: 5, gross: 330, taxable: 330, tax: 16.5 }
      ]
    },
    invoice: {
      subtotal: 610, discount: 0, taxable: 610, tax: 109.8, total: 719.8,
      lines: [
        { gstPercent: 18, line: 280, lineTax: 50.4 },
        { gstPercent: 18, line: 330, lineTax: 59.4 }
      ]
    }
  });
});

// Correct invoice values after the fix: ₹1,280.00 taxable, ₹127.00 GST, ₹1,407.00 total.
test('CURRENT BEHAVIOUR: invoice uses 18% for 5% and 12% HSN items (#1007)', () => {
  const order = orders.find((item) => item.id === 1007);
  assertFigures(order, {
    checkout: {
      subtotal: 1280, discount: 0, taxable: 1280, tax: 127, total: 1407,
      lines: [
        { gstPercent: 12, gross: 900, taxable: 900, tax: 108 },
        { gstPercent: 5, gross: 380, taxable: 380, tax: 19 }
      ]
    },
    invoice: {
      subtotal: 1280, discount: 0, taxable: 1280, tax: 230.4, total: 1510.4,
      lines: [
        { gstPercent: 18, line: 900, lineTax: 162 },
        { gstPercent: 18, line: 380, lineTax: 68.4 }
      ]
    }
  });
});

test('checkout and invoice: #1008 all-18% order totals match', () => {
  const order = orders.find((item) => item.id === 1008);
  assertFigures(order, {
    checkout: {
      subtotal: 500, discount: 0, taxable: 500, tax: 90, total: 590,
      lines: [
        { gstPercent: 18, gross: 140, taxable: 140, tax: 25.2 },
        { gstPercent: 18, gross: 360, taxable: 360, tax: 64.8 }
      ]
    },
    invoice: {
      subtotal: 500, discount: 0, taxable: 500, tax: 90, total: 590,
      lines: [
        { gstPercent: 18, line: 140, lineTax: 25.2 },
        { gstPercent: 18, line: 360, lineTax: 64.8 }
      ]
    }
  });
});

test('GST audit: flags #1001, #1002, #1004 and #1007; matches #1008', () => {
  const audit = reports.getGstReconciliation({ orders });
  const matchedById = Object.fromEntries(audit.rows.map((row) => [row.orderId, row.matched]));

  assert.equal(audit.totalChecked, 5);
  assert.equal(audit.mismatchCount, 4);
  assert.deepEqual(matchedById, {
    1001: false,
    1002: false,
    1004: false,
    1007: false,
    1008: true
  });
});
