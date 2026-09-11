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
