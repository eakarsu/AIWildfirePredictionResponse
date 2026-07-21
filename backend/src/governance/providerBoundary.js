'use strict';

class IntegrationError extends Error {
  constructor(code, message, { retryable = false, retryAfterMs = null, status = 502 } = {}) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    this.status = status;
  }
}

async function executeAdapter(adapters, capability, command, context = {}) {
  const adapter = adapters[capability];
  if (!adapter || typeof adapter.execute !== 'function') {
    throw new IntegrationError('adapter_not_configured', `${capability} adapter is not configured`, { status: 503 });
  }
  if (!context.tenantId || !context.idempotencyKey) {
    throw new IntegrationError('integration_context_invalid', 'Tenant and idempotency context are required', { status: 400 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Number(context.timeoutMs || 15_000), 60_000));
  try {
    const result = await adapter.execute(command, {
      tenantId: context.tenantId, idempotencyKey: context.idempotencyKey, signal: controller.signal,
    });
    if (!result?.receiptId || !result?.status) {
      throw new IntegrationError('adapter_receipt_invalid', 'Adapter response requires a typed status and receipt');
    }
    return Object.freeze({
      capability, provider: adapter.name || 'unnamed', receiptId: result.receiptId,
      externalId: result.externalId || null, status: result.status, occurredAt: result.occurredAt || new Date().toISOString(),
      usage: Object.freeze(result.usage || {}),
    });
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    if (error.name === 'AbortError') throw new IntegrationError('adapter_timeout', `${capability} adapter timed out`, { retryable: true, status: 504 });
    throw new IntegrationError(error.code || 'adapter_failure', `${capability} adapter failed`, {
      retryable: Boolean(error.retryable), retryAfterMs: error.retryAfterMs || null,
    });
  } finally { clearTimeout(timeout); }
}

function retryDelay(attempt, retryAfterMs = 0) {
  if (attempt >= 5) return null;
  return Math.max(Number(retryAfterMs), Math.min(60_000, 1_000 * (2 ** attempt)));
}

module.exports = { IntegrationError, executeAdapter, retryDelay };
