# Project overview

ShopLedger is a browser-based point-of-sale app for product billing, inventory, customer credit (Khata), settlements, and reports. An Express server provides the API and serves the frontend; records are stored in `data/db.json`.

## Stack

- Runtime: Node.js (version is not specified in `package.json`).
- Framework and dependencies: Express `^4.17.1`; body-parser `^1.19.0`.
- Frontend: plain HTML, CSS, and browser JavaScript using `XMLHttpRequest`.
- Data storage: local JSON file, `data/db.json`.
- Test framework: none configured. The `test` script is a placeholder that exits with an error.

## Module map

- `server.js`: entry point; configures JSON parsing and static `public/`, mounts all four routers at `/api`, and defines `GET /orders/:id/invoice`.
- `routes/products.js`: `GET /products`, `GET /coupons`.
- `routes/orders.js`: `GET /orders`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/cancel`.
- `routes/customers.js`: `GET /customers`, `POST /customers/:id/settle`.
- `routes/reports.js`: `GET /reports/dashboard`, `GET /reports/gst-reconciliation`, `POST /pricing/preview`, `GET /admin/export`.
- `lib/coupons.js`: coupon lookup, validation and discount calculation (`normalizeCode`, `getCoupon`, `validate`, `calculateDiscount`, `listActive`); reads `config.js`.
- `lib/dates.js`: date formatting and fiscal-year helpers (`today`, `normalizeDateKey`, `getFiscalYear`).
- `lib/inventory.js`: product lookup, stock checks and summaries (`find`, `getSellableStock`, `check`, `reserve`, `release`, `summarize`); reads inventory defaults from `config.js`.
- `lib/invoice.js`: invoice totals and printable HTML (`computeInvoiceFigures`, `render`); reads shop, tax and coupon settings from `config.js`.
- `lib/ledger.js`: customer balances, Khata debits/reversals and settlements (`findCustomer`, `listCustomers`, `chargeOrderToKhata`, `reverseOrderDebit`, `recordSettlement`).
- `lib/orders.js`: order creation, lookup, cancellation and filtering (`add`, `get`, `cancel`, `list`).
- `lib/pricing.js`: subtotal, discount and tax-inclusive totals (`round2`, `subtotal`, `discount`, `computeTotals`); calls `tax.js` and `coupons.js`.
- `lib/reports.js`: dashboard and GST reconciliation (`getDashboardSummary`, `getGstReconciliation`); calls inventory, ledger and invoice modules.
- `lib/store.js`: reads/writes `data/db.json` and appends audit records (`read`, `write`, `appendAudit`).
- `lib/tax.js`: tax rate lookup, GST split and rounding (`round2`, `getRateForItem`, `getSlabPercent`, `splitCgstSgst`); reads tax settings from `config.js`.
- `config.js`: port, shop identity, admin key, tax rates/HSN slabs, inventory defaults and coupon definitions.
- `data/db.json`: order and settlement ID counters plus `products`, `customers`, `orders`, `settlements`, and `auditLog`; `lib/store.js` is the file reader/writer.
- `public/index.html`: single-page application structure and POS, orders, Khata and audit/report views.
- `public/js/app.js`: browser UI behavior and calls to the `/api` endpoints listed above, plus the invoice URL.
- `public/css/style.css`: frontend styles.

## Commands

- `npm start`: runs `node server.js`.
- `npm test`: placeholder script; prints “Error: no test specified” and exits with status 1. No test runner is configured.

## Rules for agents (follow these on every task)

1. Characterization tests first: before changing any behaviour, write tests that capture the CURRENT behaviour, run them, and confirm they pass. Then make the change and update only the tests that the ticket says should change.
2. Stay in scope: change only the module(s) the ticket is about. No unrelated refactors, renames, or formatting changes. If a fix truly needs another module, stop and explain why before touching it.
3. Never touch `data/db.json` in tests: tests must use their own fixtures or an in-memory or temporary copy, and must never read from or write to `data/db.json`. Do not edit `db.json` as part of a fix.
4. No new dependencies: do not add, remove, or upgrade packages, and do not modify `package.json` or `package-lock.json`. Use only what's already installed and Node built-ins.
5. Before finishing: run the tests, run `git status`, confirm only the intended files changed, and summarise the changes.
