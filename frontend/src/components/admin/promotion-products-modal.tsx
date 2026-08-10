"use client";

import { apiRequest, type PaginatedData } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Row = Record<string, unknown>;

async function fetchAll(path: string, limit = 500) {
  const first = await apiRequest<PaginatedData<Row>>(path, { query: { page: 1, limit } });
  const items = [...first.items];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await apiRequest<PaginatedData<Row>>(path, { query: { page, limit } });
    items.push(...next.items);
  }
  return items;
}

export function PromotionProductsModal({ promotion, onClose }: { promotion: Row; onClose: () => void }) {
  const id = Number(promotion.id_data_promocional);
  const [products, setProducts] = useState<Row[]>([]);
  const [linked, setLinked] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [allProducts, links] = await Promise.all([fetchAll("/api/v1/produtos"), fetchAll(`/api/v1/datas-promocionais/${id}/produtos`, 100)]);
      setProducts(allProducts);
      setLinked(new Set(links.map((item) => Number(item.id_produto))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar produtos");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return products;
    return products.filter((product) => `${product.id_produto} ${product.codigo} ${product.produto}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [products, search]);

  async function toggle(productId: number) {
    const wasLinked = linked.has(productId);
    setPending((current) => new Set(current).add(productId));
    setLinked((current) => { const next = new Set(current); wasLinked ? next.delete(productId) : next.add(productId); return next; });
    try {
      await apiRequest(`/api/v1/datas-promocionais/${id}/produtos${wasLinked ? `/${productId}` : ""}`, {
        method: wasLinked ? "DELETE" : "POST",
        body: wasLinked ? undefined : JSON.stringify({ id_produto: productId }),
      });
    } catch (err) {
      setLinked((current) => { const next = new Set(current); wasLinked ? next.add(productId) : next.delete(productId); return next; });
      setError(err instanceof Error ? err.message : "Falha ao alterar vínculo");
    } finally {
      setPending((current) => { const next = new Set(current); next.delete(productId); return next; });
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2 dark:bg-gray-dark" onMouseDown={(event) => event.stopPropagation()}>
        <header className="border-b border-stroke p-5 dark:border-dark-3">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Produtos da data promocional</p><h2 className="mt-1 text-2xl font-bold text-dark dark:text-white">{String(promotion.data_promocional)}</h2><p className="mt-1 text-sm text-dark-4">{linked.size} produtos vinculados</p></div>
            <button className="rounded-md border border-stroke px-3 py-2 text-sm font-semibold dark:border-dark-3" onClick={onClose} type="button">Fechar</button>
          </div>
          <input className="mt-4 w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto por nome, código ou ID" value={search} />
        </header>
        <main className="overflow-y-auto p-5">
          {error && <div className="mb-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {loading ? <p className="py-12 text-center text-dark-4">Carregando produtos...</p> : (
            <div className="divide-y divide-stroke rounded-md border border-stroke dark:divide-dark-3 dark:border-dark-3">
              {visible.map((product) => { const productId = Number(product.id_produto); const active = linked.has(productId); return (
                <div className="flex items-center justify-between gap-4 px-4 py-3" key={productId}>
                  <div className="min-w-0"><p className="truncate font-semibold text-dark dark:text-white">{String(product.produto || "Produto sem nome")}</p><p className="text-xs text-dark-4">#{productId} · {String(product.codigo || "Sem código")}</p></div>
                  <button aria-label={`${active ? "Remover" : "Adicionar"} ${String(product.produto || "produto")}`} aria-pressed={active} className={`relative h-7 w-12 shrink-0 rounded-full transition ${active ? "bg-primary" : "bg-gray-4"} disabled:opacity-50`} disabled={pending.has(productId)} onClick={() => toggle(productId)} type="button"><span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${active ? "left-6" : "left-1"}`} /></button>
                </div>
              ); })}
              {!visible.length && <p className="py-10 text-center text-sm text-dark-4">Nenhum produto encontrado.</p>}
            </div>
          )}
        </main>
      </div>
    </div>, document.body,
  );
}
