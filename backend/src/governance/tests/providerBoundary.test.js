'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { executeAdapter, retryDelay } = require('../providerBoundary');

test('unconfigured or unscoped operational adapters fail closed', async () => {
  await assert.rejects(() => executeAdapter({}, 'cad', {}, { tenantId: 't', idempotencyKey: 'k' }), (error) => error.code === 'adapter_not_configured');
  await assert.rejects(() => executeAdapter({ cad: { execute() {} } }, 'cad', {}, {}), (error) => error.code === 'integration_context_invalid');
});

test('adapter result requires a typed durable receipt', async () => {
  const result = await executeAdapter({ cad: { name: 'cad-sandbox', async execute() { return { receiptId: 'receipt-1', status: 'acknowledged', externalId: 'cad-9' }; } } },
    'cad', { operation: 'dispatch' }, { tenantId: 'tenant-a', idempotencyKey: 'key-1' });
  assert.equal(result.receiptId, 'receipt-1');
  await assert.rejects(() => executeAdapter({ cad: { async execute() { return {}; } } }, 'cad', {}, { tenantId: 't', idempotencyKey: 'k' }),
    (error) => error.code === 'adapter_receipt_invalid');
});

test('integration retry is bounded and honors provider recovery delay', () => {
  assert.equal(retryDelay(0), 1000);
  assert.equal(retryDelay(2, 9000), 9000);
  assert.equal(retryDelay(5), null);
});
