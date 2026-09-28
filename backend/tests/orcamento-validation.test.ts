import { describe, expect, it } from 'vitest';
import { orcamentoSchema } from '@/utils/validation';

const minimalSiteQuote = {
  data_orcamento: '2026-09-28',
  fantasia: '',
  endereco: '',
  endereco_n: '',
  endereco_compl: '',
  bairro: '',
  cep: '',
  cidade: '',
  uf: '',
  tel: '(11) 99999-9999',
  email: 'cliente@example.com',
  contato: 'Cliente de teste',
  obs: '',
  nivel: 'SITE',
  entrega: 'A combinar',
};

describe('orcamentoSchema site contract', () => {
  it('accepts the minimum payload produced by the public checkout', () => {
    const result = orcamentoSchema.validate(minimalSiteQuote, {
      abortEarly: false,
      stripUnknown: true,
    });

    expect(result.error).toBeUndefined();
    expect(result.value.endereco).toBe('');
  });

  it('defaults a missing optional address to an empty database-safe value', () => {
    const { endereco: _endereco, ...withoutAddress } = minimalSiteQuote;
    const result = orcamentoSchema.validate(withoutAddress);

    expect(result.error).toBeUndefined();
    expect(result.value.endereco).toBe('');
  });

  it.each([
    ['data_orcamento', { data_orcamento: undefined }],
    ['email', { email: '' }],
    ['contato', { contato: '' }],
  ])('continues rejecting a quote without %s', (_field, replacement) => {
    const result = orcamentoSchema.validate({ ...minimalSiteQuote, ...replacement });
    expect(result.error).toBeDefined();
  });
});
