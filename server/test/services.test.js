import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentStatus, createPaymentSession, processRefund } from '../src/services/payment.js';
import { shippingStatus, quoteShipping } from '../src/services/shipping.js';
import { calculateTax } from '../src/services/tax.js';

test('payment integration clearly reports disabled and never pretends to charge', async () => {
  assert.equal(paymentStatus().configured, false);
  await assert.rejects(() => createPaymentSession({}), e => e.status === 503 && e.code === 'PAYMENT_PROVIDER_DISABLED');
  await assert.rejects(() => processRefund({}), e => e.status === 503 && e.code === 'REFUND_PROVIDER_DISABLED');
});
test('shipping estimate requires country and does not claim carrier quote', async () => {
  await assert.rejects(() => quoteShipping({ countryCode: 'USA' }), e => e.status === 400);
  const q = await quoteShipping({ countryCode: 'ZZ', currency: 'USD', subtotal: 20 });
  assert.equal(q.available, false);
  assert.equal(q.source, 'UNCONFIGURED');
});
test('tax quote is zero and unconfigured if no reviewed rule exists', async () => {
  const fakeDb = { taxRule: { findMany: async () => [] } };
  const q = await calculateTax(fakeDb, { countryCode: 'US', taxableAmount: 100 });
  assert.equal(q.amount, 0);
  assert.equal(q.configured, false);
});
test('tax quote uses only explicitly active reviewed rules returned by database', async () => {
  const fakeDb = { taxRule: { findMany: async () => [{ id: 'rule1', regionCode: 'CA', postalPrefix: '90', rate: 0.1, inclusive: false, source: 'REVIEWED_MANUAL' }] } };
  const q = await calculateTax(fakeDb, { countryCode: 'US', regionCode: 'CA', postalCode: '90001', taxableAmount: 100 });
  assert.equal(q.amount, 10);
  assert.equal(q.configured, true);
});
