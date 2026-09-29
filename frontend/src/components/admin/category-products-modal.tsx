"use client";

import { apiRequest, type PaginatedData } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Product = { id_produto: number; produto: string; codigo: string };
type Page = PaginatedData<Product> & { linked_ids: number[] };

export function CategoryProductsModal({
  categoryId,
  categoryName,
  onClose,
  productsEndpoint,
  entityLabel = "categoria",
}: {
  categoryId: number;
  categoryName: string;
  onClose: () => void;
  productsEndpoint?: string;
  entityLabel?: "categoria" | "subcategoria";
}) {
  const endpoint = productsEndpoint || `/api/v1/categorias/${categoryId}/produtos`;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [exclude, setExclude] = useState("");
  const [excludeFilter, setExcludeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const selectController = useRef<AbortController | null>(null);
  const initialLinked = useRef<Set<number>>(new Set());
  const initializedSubcategory = useRef(false);
  const savingRef = useRef(false);
  const selectingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    if (!savingRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      selectController.current?.abort();
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilter(search.trim());
      setExcludeFilter(exclude.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, exclude]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    apiRequest<Page>(`${endpoint}/disponiveis`, {
      query: { search: filter, exclude: excludeFilter, page },
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setData(response);
          if (entityLabel === "subcategoria" && !initializedSubcategory.current) {
            const linkedProducts = new Set(response.linked_ids);
            initialLinked.current = linkedProducts;
            initializedSubcategory.current = true;
            setSelected(new Set(linkedProducts));
          }
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            err instanceof Error ? err.message : "Falha ao carregar produtos",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, entityLabel, filter, excludeFilter, page, revision]);

  async function selectAll() {
    if (selectingRef.current || savingRef.current) return;
    selectingRef.current = true;
    const controller = new AbortController();
    selectController.current = controller;
    setSelecting(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest<{ produto_ids: number[] }>(
        `${endpoint}/disponiveis`,
        {
          query: { search: filter, exclude: excludeFilter, ids_only: 1 },
          signal: controller.signal,
        },
      );
      if (!controller.signal.aborted)
        setSelected((current) => new Set([...current, ...result.produto_ids]));
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof Error ? err.message : "Falha ao selecionar produtos",
        );
    } finally {
      selectingRef.current = false;
      if (!controller.signal.aborted) setSelecting(false);
    }
  }

  async function save() {
    const addedIds = entityLabel === "subcategoria"
      ? [...selected].filter((id) => !initialLinked.current.has(id))
      : [...selected];
    const removedIds = entityLabel === "subcategoria"
      ? [...initialLinked.current].filter((id) => !selected.has(id))
      : [];
    if (savingRef.current || selectingRef.current || (!addedIds.length && !removedIds.length)) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest<{ processed: number; changed: number; added?: number; removed?: number }>(
        `${endpoint}/lote`,
        {
          method: "POST",
          body: JSON.stringify({
            produto_ids: addedIds,
            ...(entityLabel === "subcategoria" ? { remover_produto_ids: removedIds } : {}),
          }),
        },
      );
      setSelected(new Set());
      if (entityLabel === "subcategoria") {
        setMessage(`${result.added || 0} produtos adicionados e ${result.removed || 0} removidos da subcategoria.`);
        initialLinked.current = new Set();
        initializedSubcategory.current = false;
        setData(null);
      } else {
        setMessage(`${result.processed} produtos cadastrados na categoria. ${result.changed} alterados.`);
      }
      setRevision((value) => value + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Falha ao cadastrar produtos",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const busy = saving || selecting;
  const linked = new Set(data?.linked_ids || []);
  const addedCount = entityLabel === "subcategoria"
    ? [...selected].filter((id) => !initialLinked.current.has(id)).length
    : selected.size;
  const removedCount = entityLabel === "subcategoria"
    ? [...initialLinked.current].filter((id) => !selected.has(id)).length
    : 0;
  const hasChanges = addedCount > 0 || removedCount > 0;
  const waitingFilter = search.trim() !== filter || exclude.trim() !== excludeFilter;
  const buttonClass =
    "rounded-md border border-stroke px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-dark-3";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={close}
    >
      <div
        aria-labelledby="category-products-title"
        aria-modal="true"
        role="dialog"
        tabIndex={-1}
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2 dark:bg-gray-dark"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          }
          if (event.key === "Tab") {
            const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
            );
            const first = controls?.[0],
              last = controls?.[controls.length - 1];
            if (
              event.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialogRef.current)
            ) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header className="border-b border-stroke p-5 dark:border-dark-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                Produtos da {entityLabel}
              </p>
              <h2
                id="category-products-title"
                className="mt-1 text-2xl font-bold text-dark dark:text-white"
              >
                {categoryName}
              </h2>
              <p className="mt-1 text-sm text-dark-4">
                {linked.size} produtos vinculados
              </p>
            </div>
            <button
              type="button"
              className={buttonClass}
              disabled={saving}
              onClick={close}
            >
              Fechar
            </button>
          </div>
          <input
            aria-label="Buscar produtos por nome, código ou ID"
            placeholder="Buscar produto por nome, código ou ID"
            className="mt-4 w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            value={search}
            disabled={busy}
            onChange={(event) => {
              setSearch(event.target.value);
              setMessage("");
            }}
          />
          <input
            aria-label="Excluir produtos por palavras no nome"
            placeholder="Excluir palavras do nome, separadas por vírgula (ex.: caneta, ecológica)"
            className="mt-3 w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            value={exclude}
            disabled={busy}
            onChange={(event) => {
              setExclude(event.target.value);
              setMessage("");
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={busy || loading || waitingFilter || !data?.total}
              onClick={selectAll}
            >
              {selecting
                ? "Selecionando..."
                : `Selecionar todos do filtro${data ? ` (${data.total})` : ""}`}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy || !selected.size}
              onClick={() => setSelected(new Set())}
            >
              {entityLabel === "subcategoria" ? "Desmarcar todos" : "Limpar seleção"}
            </button>
            <span className="text-sm font-semibold" aria-live="polite">
              {entityLabel === "subcategoria"
                ? `${addedCount} para adicionar · ${removedCount} para remover`
                : `${selected.size} selecionados`}
            </span>
          </div>
        </header>
        <main className="min-h-0 overflow-y-auto p-5">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="mb-3 rounded-md bg-green-50 p-3 text-sm text-green-800"
            >
              {message}
            </p>
          )}
          {loading || waitingFilter ? (
            <p className="py-10 text-center">Carregando produtos...</p>
          ) : (
            <div className="divide-y divide-stroke rounded-md border border-stroke dark:divide-dark-3 dark:border-dark-3">
              {data?.items.map((product) => (
                <label
                  key={product.id_produto}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(product.id_produto)}
                    disabled={busy}
                    aria-label={`Selecionar ${product.produto}`}
                    className="size-5 shrink-0 accent-primary"
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(product.id_produto))
                          next.delete(product.id_produto);
                        else next.add(product.id_produto);
                        return next;
                      })
                    }
                  />
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-dark dark:text-white">
                      {product.produto || "Produto sem nome"}
                    </p>
                    <p className="text-xs text-dark-4">
                      #{product.id_produto} · {product.codigo || "Sem código"}
                      {entityLabel === "subcategoria" && linked.has(product.id_produto) && !selected.has(product.id_produto)
                        ? " · Remover ao salvar"
                        : entityLabel === "subcategoria" && !linked.has(product.id_produto) && selected.has(product.id_produto)
                          ? " · Adicionar ao salvar"
                          : linked.has(product.id_produto) ? " · Vinculado" : ""}
                    </p>
                  </div>
                </label>
              ))}
              {!data?.items.length && (
                <p className="py-10 text-center text-sm">
                  Nenhum produto encontrado.
                </p>
              )}
            </div>
          )}
        </main>
        <footer className="space-y-3 border-t border-stroke p-5 dark:border-dark-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              Página {page} de {data?.totalPages || 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={busy || loading || waitingFilter || page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={
                  busy ||
                  loading ||
                  waitingFilter ||
                  page >= (data?.totalPages || 1)
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
          <p className="text-sm text-dark-4">
            {entityLabel === "categoria"
              ? "Os selecionados terão suas categorias substituídas por esta. Subcategorias de outras categorias serão removidas."
              : "Marque para adicionar e desmarque para remover desta subcategoria. Categorias e outras subcategorias serão preservadas."}{" "}
            Selecionar não altera os produtos.
          </p>
          <button
            type="button"
            disabled={busy || !hasChanges}
            onClick={save}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-40 sm:w-auto"
          >
            {saving
              ? entityLabel === "categoria" ? "Cadastrando..." : "Salvando..."
              : entityLabel === "categoria"
                ? `Cadastrar selecionados na categoria (${selected.size})`
                : `Salvar alterações (${addedCount + removedCount})`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
