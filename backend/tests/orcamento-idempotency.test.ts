import { describe, expect, it } from 'vitest';
import {
  quoteIdempotencyFingerprint,
  quoteItemFingerprint,
  sanitizeIdempotencyKey,
} from '@/utils/orcamentoIdempotency';

const base = {
  email: ' Cliente@Example.com ',
  contato: 'Maria',
  endereco: 'Rua A',
  data_orcamento: '2026-09-28',
};

describe('orcamento idempotency identity', () => {
  it('normalizes equivalent retries without an explicit key', () => {
    expect(quoteIdempotencyFingerprint(1, base).fingerprint).toBe(
      quoteIdempotencyFingerprint(1, { ...base, email: 'cliente@example.com' }).fingerprint
    );
  });

  it('isolates identities by company', () => {
    expect(quoteIdempotencyFingerprint(1, base).fingerprint).not.toBe(
      quoteIdempotencyFingerprint(2, base).fingerprint
    );
  });

  it('keeps an explicit logical submission stable', () => {
    expect(quoteIdempotencyFingerprint(1, base, 'checkout-123').fingerprint).toBe(
      quoteIdempotencyFingerprint(1, { ...base, contato: 'Outro' }, 'checkout-123').fingerprint
    );
  });

  it('rejects oversized explicit keys', () => {
    expect(sanitizeIdempotencyKey('x'.repeat(201))).toBeNull();
  });

  it('keeps equivalent item retries stable and real changes distinct', () => {
    const item = {
      id_orcamento: 10,
      data_orcamento: '2026-09-28',
      id_produto: 20,
      codigo: 'ABC',
      produto: 'Produto',
      gravacao_cores: '0',
      quantidade: 100,
    };

    expect(quoteItemFingerprint(1, 10, item)).toBe(quoteItemFingerprint(1, 10, { ...item }));
    expect(quoteItemFingerprint(1, 10, item)).not.toBe(
      quoteItemFingerprint(1, 10, { ...item, quantidade: 200 })
    );
  });
});
