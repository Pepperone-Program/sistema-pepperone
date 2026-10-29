"use client";

import { useEffect, useState } from "react";
import type { ResourceConfig } from "@/types/admin";
import { ResourcePage } from "./resource-page";

type Row = Record<string, unknown>;
const config: ResourceConfig = {
  title: "Landing pages",
  description: "Gerencie as páginas e visualize o endereço cadastrado.",
  endpoint: "/api/v1/landing-pages",
  idField: "id_landing_page",
  searchPlaceholder: "Buscar por título ou endereço",
  columns: [
    { name: "id_landing_page", label: "ID" },
    { name: "titulo", label: "Título" },
    { name: "url", label: "URL" },
    { name: "habilitado", label: "Status" },
  ],
  formFields: [
    { name: "titulo", label: "Título", required: true },
    { name: "url", label: "URL", required: true },
    { name: "descricao", label: "Descrição", type: "textarea" },
    { name: "habilitado", label: "Status", type: "select", options: [{ value: "S", label: "Ativa" }, { value: "N", label: "Inativa" }] },
  ],
  defaultValues: { habilitado: "S" },
};

function validUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function LandingPages() {
  const [selected, setSelected] = useState<Row | null>(null);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);
  const url = validUrl(selected?.url);
  return <>
    <ResourcePage config={config} onRowClick={setSelected} />
    {selected && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-3" onMouseDown={() => setSelected(null)}>
      <div role="dialog" aria-modal="true" aria-labelledby="landing-title" className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-lg bg-white p-4 shadow-2 dark:bg-gray-dark" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4"><h2 id="landing-title" className="text-xl font-bold">{String(selected.titulo || "Landing page")}</h2><button type="button" onClick={() => setSelected(null)} className="rounded border px-3 py-1">Fechar</button></div>
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <dl className="space-y-3 text-sm">{Object.entries(selected).map(([key, value]) => <div key={key}><dt className="font-semibold">{key === "id_landing_page" ? "ID" : key === "habilitado" ? "Status" : key === "descricao" ? "Descrição" : key === "titulo" ? "Título" : key === "url" ? "URL" : key}</dt><dd className="break-words text-dark-4 dark:text-dark-6">{String(value ?? "—")}</dd></div>)}
            {url && <div><a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Abrir em nova aba</a></div>}
          </dl>
          <div><p className="mb-2 text-sm text-dark-4">Alguns sites podem bloquear a visualização incorporada.</p>{url ? <iframe title={`Visualização de ${String(selected.titulo || "landing page")}`} src={url} sandbox="allow-scripts allow-forms allow-popups" className="h-[60vh] min-h-[300px] w-full rounded border border-stroke bg-white" /> : <p className="rounded border p-6 text-sm">URL ausente ou inválida.</p>}</div>
        </div>
      </div>
    </div>}
  </>;
}
