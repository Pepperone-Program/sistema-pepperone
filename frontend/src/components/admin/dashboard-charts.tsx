"use client";

import { apiRequest } from "@/lib/api";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
type Category = { id_categoria: number; categoria: string; total: number };
type Day = { dia: string; total: number };
type DashboardChartsData = { categorias_orcamentos: Category[]; categorias_produtos: Category[]; orcamentos_dia: Day[] };

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DashboardCharts() {
  const [data, setData] = useState<DashboardChartsData | null>(null);
  const [error, setError] = useState("");
  const [start, setStart] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 29); return dateInput(date); });
  const [end, setEnd] = useState(() => dateInput(new Date()));
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [rangeError, setRangeError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    apiRequest<DashboardChartsData>("/api/v1/dashboard", { query: range || undefined })
      .then((response) => { if (active) setData(response); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Falha ao carregar gráficos"); });
    return () => { active = false; };
  }, [range]);

  const panel = (title: string, description: string, content: React.ReactNode, empty: boolean) => (
    <section className="min-w-0 rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark">
      <h2 className="text-lg font-bold text-dark dark:text-white">{title}</h2>
      <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">{description}</p>
      <div className="mt-3 min-h-[280px]">
        {error ? <p role="alert" className="py-12 text-center text-sm text-red-600">{error}</p> : !data ? <p className="py-12 text-center text-sm text-dark-4">Carregando gráficos...</p> : empty ? <p className="py-12 text-center text-sm text-dark-4">Nenhum dado disponível.</p> : content}
      </div>
    </section>
  );
  const quotes = data?.categorias_orcamentos || [];
  const products = data?.categorias_produtos || [];
  const days = data?.orcamentos_dia || [];
  return <div className="grid gap-4 xl:grid-cols-2">
    {panel("Categorias com mais orçamentos", "Um orçamento pode pertencer a mais de uma categoria.", <Chart type="pie" height={300} series={quotes.map((row) => Number(row.total))} options={{ labels: quotes.map((row) => row.categoria), legend: { position: "bottom" }, chart: { fontFamily: "inherit" } }} />, !quotes.length)}
    {panel("Categorias com mais produtos", "Produtos vinculados diretamente ou por subcategorias.", <Chart type="bar" height={300} series={[{ name: "Produtos", data: products.map((row) => Number(row.total)) }]} options={{ chart: { toolbar: { show: false }, fontFamily: "inherit" }, plotOptions: { bar: { horizontal: true } }, xaxis: { categories: products.map((row) => row.categoria) }, colors: ["#b91c1c"] }} />, !products.length)}
    <div className="xl:col-span-2">
      <form className="mb-2 flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        const count = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
        if (!start || !end || !Number.isFinite(count) || count < 1 || count > 366) { setRangeError("Escolha um período válido de até 366 dias."); return; }
        setRangeError(""); setRange({ start, end });
      }}>
        <label className="text-sm">Início<input required type="date" value={start} onChange={(event) => setStart(event.target.value)} className="ml-2 rounded border border-stroke px-2 py-1 dark:bg-dark-2" /></label>
        <label className="text-sm">Fim<input required type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="ml-2 rounded border border-stroke px-2 py-1 dark:bg-dark-2" /></label>
        <button type="submit" className="rounded bg-primary px-3 py-1.5 text-sm font-semibold text-white">Aplicar período</button>
        {rangeError && <span role="alert" className="text-sm text-red-600">{rangeError}</span>}
      </form>
      {panel("Orçamentos por dia", "Inclui dias sem registros; período inicial de 30 dias.", <>{!days.some((day) => Number(day.total) > 0) && <p className="text-sm text-dark-4">Nenhum orçamento no período.</p>}<Chart type="bar" height={300} series={[{ name: "Orçamentos", data: days.map((row) => Number(row.total)) }]} options={{ chart: { toolbar: { show: false }, fontFamily: "inherit" }, xaxis: { categories: days.map((row) => `${row.dia.slice(8, 10)}/${row.dia.slice(5, 7)}`) }, colors: ["#b91c1c"], dataLabels: { enabled: false } }} /></>, !days.length)}
    </div>
  </div>;
}
