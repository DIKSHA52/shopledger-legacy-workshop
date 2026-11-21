'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

const orders = [
  {
    id: 1001, customer: 'Meera Joshi', status: 'completed', coupon: '',
    subtotal: 610, discount: 0, tax: 66.9, total: 676.9,
    items: [
      { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 2 },
      { id: 2, sku: 'GRN-002', name: 'Unpolished Toor Dal 1kg', hsn: '0713', price: 165, qty: 2 }
    ]
  },
  {
    id: 1002, customer: 'Anil Kulkarni', status: 'completed', coupon: 'SAVE10',
    subtotal: 1020, discount: 102, tax: 45.9, total: 963.9,
    items: [
      { id: 1, sku: 'GRN-001', name: 'Indrayani Basmati Rice 5kg', hsn: '1006', price: 640, qty: 1 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  },
  {
    id: 1004, customer: 'Kalyani Foods (Wholesale)', status: 'completed', coupon: 'SAVE10',
    subtotal: 2240, discount: 150, tax: 104.5, total: 2194.5,
    items: [
      { id: 5, sku: 'OIL-002', name: 'Cold-Pressed Groundnut Oil 5L', hsn: '1508', price: 1120, qty: 2 }
    ]
  },
  {
    id: 1007, customer: 'Suresh Deshmukh', status: 'pending', coupon: '',
    subtotal: 1280, discount: 0, tax: 127, total: 1407,
    items: [
      { id: 6, sku: 'DRY-001', name: 'A2 Gir Cow Ghee 500ml', hsn: '0405', price: 450, qty: 2 },
      { id: 4, sku: 'OIL-001', name: 'Cold-Pressed Sunflower Oil 1L', hsn: '1512', price: 190, qty: 2 }
    ]
  },
  {
    id: 1008, customer: 'Walk-in', status: 'completed', coupon: '',
    subtotal: 500, discount: 0, tax: 90, total: 590,
    items: [
      { id: 8, sku: 'BEV-001', name: 'Assam CTC Masala Chai 250g', hsn: '0902', price: 140, qty: 1 },
      { id: 12, sku: 'BEV-003', name: 'Kokum Sherbet Concentrate 750ml', hsn: '2106', price: 180, qty: 2 }
    ]
  }
];

const expectedLines = {
  1001: [{ gstPercent: 18, taxable: 280, tax: 50.4 }, { gstPercent: 5, taxable: 330, tax: 16.5 }],
  1002: [{ gstPercent: 5, taxable: 576, tax: 28.8 }, { gstPercent: 5, taxable: 342, tax: 17.1 }],
  1004: [{ gstPercent: 5, taxable: 2090, tax: 104.5 }],
  1007: [{ gstPercent: 12, taxable: 900, tax: 108 }, { gstPercent: 5, taxable: 380, tax: 19 }],
  1008: [{ gstPercent: 18, taxable: 140, tax: 25.2 }, { gstPercent: 18, taxable: 360, tax: 64.8 }]
};

for (const order of orders) {
  test(`invoice equals checkout for order #${order.id}`, () => {
    const checkout = pricing.computeTotals(order.items, order.coupon);
    const printed = invoice.computeInvoiceFigures(order);

    assert.equal(printed.subtotal, checkout.subtotal);
    assert.equal(printed.discount, checkout.discount);
    assert.equal(printed.taxable, checkout.taxable);
    assert.equal(printed.tax, checkout.tax);
    assert.equal(printed.total, checkout.total);
    assert.deepEqual(printed.rows.map((line) => ({
      gstPercent: line.gstPercent,
      taxable: line.taxable,
      lineTax: line.lineTax
    })), expectedLines[order.id].map((line) => ({
      gstPercent: line.gstPercent,
      taxable: line.taxable,
      lineTax: line.tax
    })));
  });
}

test('invoice order #1002 uses SAVE10 discount and GST on ₹918 taxable value', () => {
  const printed = invoice.computeInvoiceFigures(orders.find((order) => order.id === 1002));
  assert.equal(printed.discount, 102);
  assert.equal(printed.taxable, 918);
  assert.equal(printed.tax, 45.9);
  assert.equal(printed.total, 963.9);
});

test('invoice order #1004 respects SAVE10 ₹150 cap', () => {
  const printed = invoice.computeInvoiceFigures(orders.find((order) => order.id === 1004));
  assert.equal(printed.discount, 150);
  assert.equal(printed.tax, 104.5);
  assert.equal(printed.total, 2194.5);
});

test('GST audit reports no mismatches for the five characterized orders', () => {
  const audit = reports.getGstReconciliation({ orders });
  assert.equal(audit.totalChecked, 5);
  assert.equal(audit.mismatchCount, 0);
  assert.ok(audit.rows.every((row) => row.matched));
});
