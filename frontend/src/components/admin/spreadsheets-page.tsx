"use client";

import { listResource } from "@/lib/api";
import { useEffect, useState } from "react";

type Category = { id_categoria: number; categoria: string };
type Model = "produtos" | "categorias" | "subcategorias" | "publicos-alvos";
const models: { value: Model; label: string; description: string }[] = [
  { value: "produtos", label: "Todos os produtos", description: "Dados completos dos produtos, com filtros combináveis." },
  { value: "categorias", label: "Produtos e categorias", description: "Uma linha para cada categoria vinculada." },
  { value: "subcategorias", label: "Produtos e subcategorias", description: "Uma linha para cada subcategoria vinculada." },
  { value: "publicos-alvos", label: "Produtos e públicos alvo", description: "Uma linha para cada público alvo vinculado." },
];
const inputClass = "w-full rounded-md border border-stroke bg-gray-2 px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white";

export function SpreadsheetsPage() {
  const [model, setModel] = useState<Model>("produtos");
  const [search, setSearch] = useState("");
  const [habilitado, setHabilitado] = useState("");
  const [site, setSite] = useState("");
  const [promocao, setPromocao] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        const first = await listResource<Category>("/api/v1/categorias", { page: 1, limit: 100 });
        const all = [...first.items];
        for (let page = 2; page <= first.totalPages; page++) {
          const next = await listResource<Category>("/api/v1/categorias", { page, limit: 100 });
          all.push(...next.items);
        }
        if (active) setCategories(all);
      } catch {
        if (active) setError("Não foi possível carregar as categorias.");
      }
    }
    void loadCategories();
    return () => { active = false; };
  }, []);

  async function download() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (model === "produtos") {
        if (search.trim()) query.set("search", search.trim());
        if (habilitado) query.set("habilitado", habilitado);
        if (site) query.set("site", site);
        if (promocao) query.set("promocao", promocao);
        if (selectedCategories.length) query.set("categorias", selectedCategories.join(","));
      }
      const response = await fetch(`/api/v1/produtos/planilhas/${model}?${query}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Não foi possível gerar a planilha.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `produtos-${model}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar a planilha.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-5">
    <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">Catálogo Pepperone</p>
      <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Gerar planilhas</h1>
      <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">Exporte produtos em Excel. Todas as planilhas incluem a URL da imagem principal.</p>
    </section>
    <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
      <h2 className="font-semibold text-dark dark:text-white">Modelo</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {models.map((item) => <label key={item.value} className={`flex cursor-pointer gap-3 rounded-md border p-4 ${model === item.value ? "border-primary bg-primary/5" : "border-stroke dark:border-dark-3"}`}>
          <input type="radio" name="model" value={item.value} checked={model === item.value} onChange={() => setModel(item.value)} />
          <span><span className="block font-semibold text-dark dark:text-white">{item.label}</span><span className="mt-1 block text-sm text-dark-4 dark:text-dark-6">{item.description}</span></span>
        </label>)}
      </div>
    </section>
    {model === "produtos" && <section className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
      <h2 className="font-semibold text-dark dark:text-white">Filtros</h2>
      <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">Os filtros selecionados são combinados. Sem filtros, todos os produtos são incluídos.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="sm:col-span-2 lg:col-span-4"><span className="mb-1 block text-sm font-medium">Busca por ID, código ou nome</span><input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} maxLength={200} placeholder="Ex.: mochila" /></label>
        <label><span className="mb-1 block text-sm font-medium">Habilitado</span><select className={inputClass} value={habilitado} onChange={(event) => setHabilitado(event.target.value)}><option value="">Todos</option><option value="S">Sim</option><option value="N">Não</option></select></label>
        <label><span className="mb-1 block text-sm font-medium">No site</span><select className={inputClass} value={site} onChange={(event) => setSite(event.target.value)}><option value="">Todos</option><option value="S">Sim</option><option value="N">Não</option></select></label>
        <label><span className="mb-1 block text-sm font-medium">Promoção</span><select className={inputClass} value={promocao} onChange={(event) => setPromocao(event.target.value)}><option value="">Todas</option><option value="S">Sim</option><option value="N">Não</option></select></label>
      </div>
      <fieldset className="mt-4"><legend className="text-sm font-medium">Categorias (qualquer uma das selecionadas)</legend><div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-stroke p-3 dark:border-dark-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <label key={category.id_categoria} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedCategories.includes(category.id_categoria)} onChange={(event) => setSelectedCategories((current) => event.target.checked ? [...current, category.id_categoria] : current.filter((id) => id !== category.id_categoria))} />{category.categoria}</label>)}</div>{!categories.length && <span className="text-sm text-dark-4">Nenhuma categoria disponível.</span>}</div></fieldset>
    </section>}
    {error && <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <button type="button" onClick={download} disabled={loading} className="rounded-md bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? "Gerando planilha..." : "Baixar planilha .xlsx"}</button>
  </div>;
}
