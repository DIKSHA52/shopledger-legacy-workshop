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

test('invoice matches checkout GST and SAVE10 discount (#1002)', () => {
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
      subtotal: 1020, discount: 102, taxable: 918, tax: 45.9, total: 963.9,
      lines: [
        { gstPercent: 5, line: 640, lineTax: 28.8 },
        { gstPercent: 5, line: 380, lineTax: 17.1 }
      ]
    }
  });
});

test('invoice respects SAVE10 ₹150 discount cap (#1004)', () => {
  const order = orders.find((item) => item.id === 1004);
  assertFigures(order, {
    checkout: {
      subtotal: 2240, discount: 150, taxable: 2090, tax: 104.5, total: 2194.5,
      lines: [{ gstPercent: 5, gross: 2240, taxable: 2090, tax: 104.5 }]
    },
    invoice: {
      subtotal: 2240, discount: 150, taxable: 2090, tax: 104.5, total: 2194.5,
      lines: [{ gstPercent: 5, line: 2240, lineTax: 104.5 }]
    }
  });
});

test('invoice applies each HSN rate (#1001)', () => {
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
      subtotal: 610, discount: 0, taxable: 610, tax: 66.9, total: 676.9,
      lines: [
        { gstPercent: 18, line: 280, lineTax: 50.4 },
        { gstPercent: 5, line: 330, lineTax: 16.5 }
      ]
    }
  });
});

test('invoice applies 12% and 5% HSN rates (#1007)', () => {
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
      subtotal: 1280, discount: 0, taxable: 1280, tax: 127, total: 1407,
      lines: [
        { gstPercent: 12, line: 900, lineTax: 108 },
        { gstPercent: 5, line: 380, lineTax: 19 }
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

test('GST audit: reports no mismatches after invoice matches checkout', () => {
  const audit = reports.getGstReconciliation({ orders });
  const matchedById = Object.fromEntries(audit.rows.map((row) => [row.orderId, row.matched]));

  assert.equal(audit.totalChecked, 5);
  assert.equal(audit.mismatchCount, 0);
  assert.deepEqual(matchedById, {
    1001: true,
    1002: true,
    1004: true,
    1007: true,
    1008: true
  });
});
