/** Shared by the admin list and its select-all snapshot. */
export function adminProductSearch(search?: string): { sql: string; values: Array<string | number> } {
  const term = search?.trim();
  if (!term) return { sql: '', values: [] };
  const pattern = `%${term.replace(/[!%_]/g, '!$&')}%`;
  const id = /^\d+$/.test(term) ? Number(term) : null;
  return id !== null && Number.isSafeInteger(id)
    ? { sql: " AND (id_produto = ? OR codigo LIKE ? ESCAPE '!' OR produto LIKE ? ESCAPE '!')", values: [id, pattern, pattern] }
    : { sql: " AND (codigo LIKE ? ESCAPE '!' OR produto LIKE ? ESCAPE '!')", values: [pattern, pattern] };
}

export const ADMIN_PRODUCT_EXCLUSION_MAX_LENGTH = 500;
export const ADMIN_PRODUCT_EXCLUSION_MAX_TERMS = 20;
export const ADMIN_PRODUCT_EXCLUSION_MAX_TERM_LENGTH = 100;

function invalidExclusion(message: string): never {
  throw Object.assign(new Error(message), { code: 'INVALID_EXCLUSION', statusCode: 400 });
}

/** Excludes literal comma-separated terms from the product name only. */
export function adminProductExclusion(exclude?: string): { sql: string; values: string[]; terms: string[] } {
  const raw = exclude?.trim() || '';
  if (!raw) return { sql: '', values: [], terms: [] };
  if (raw.length > ADMIN_PRODUCT_EXCLUSION_MAX_LENGTH) {
    invalidExclusion(`Informe ate ${ADMIN_PRODUCT_EXCLUSION_MAX_LENGTH} caracteres no filtro de exclusao`);
  }

  const uniqueTerms = new Map<string, string>();
  for (const term of raw.split(',').map((item) => item.trim()).filter(Boolean)) {
    const key = term.toLocaleLowerCase('pt-BR');
    if (!uniqueTerms.has(key)) uniqueTerms.set(key, term);
  }
  const terms = [...uniqueTerms.values()];
  if (terms.length > ADMIN_PRODUCT_EXCLUSION_MAX_TERMS) {
    invalidExclusion(`Informe ate ${ADMIN_PRODUCT_EXCLUSION_MAX_TERMS} termos para excluir`);
  }
  if (terms.some((term) => term.length > ADMIN_PRODUCT_EXCLUSION_MAX_TERM_LENGTH)) {
    invalidExclusion(`Cada termo de exclusao deve ter ate ${ADMIN_PRODUCT_EXCLUSION_MAX_TERM_LENGTH} caracteres`);
  }

  const values = terms.map((term) => `%${term.replace(/[!%_]/g, '!$&')}%`);
  return {
    sql: terms.map(() => " AND produto NOT LIKE ? ESCAPE '!'").join(''),
    values,
    terms,
  };
}
