"use client";

import { apiRequest, listResource, type PaginatedData } from "@/lib/api";
import type { EstatisticasResumo, ProdutoRanking } from "@/types/admin";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type AnyRow = Record<string, unknown>;

type DashboardState = {
  estatisticas: EstatisticasResumo | null;
  produtos: PaginatedData<AnyRow> | null;
  clientes: PaginatedData<AnyRow> | null;
  orcamentos: PaginatedData<AnyRow> | null;
  categorias: PaginatedData<AnyRow> | null;
};

const initialState: DashboardState = {
  estatisticas: null,
  produtos: null,
  clientes: null,
  orcamentos: null,
  categorias: null,
};

const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const addDaysToDateInput = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  target.setDate(target.getDate() + days);

  return formatDateInput(target);
};

const today = new Date();
const defaultStartDate = formatDateInput(
  new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
);
const defaultEndDate = formatDateInput(today);

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
      <p className="text-sm font-medium text-dark-4 dark:text-dark-6">{label}</p>
      <strong className="mt-3 block text-3xl font-bold text-dark dark:text-white">
        {value}
      </strong>
      <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">{detail}</p>
    </div>
  );
}

function RankingTable({
  title,
  data,
  actions,
}: {
  title: string;
  data: ProdutoRanking[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white shadow-1 dark:bg-gray-dark">
      <div className="flex flex-col gap-4 border-b border-stroke px-5 py-4 dark:border-dark-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-bold text-dark dark:text-white">{title}</h2>
        {actions}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-dark-4 dark:text-dark-6">
              <th className="px-5 py-3">Produto</th>
              <th className="px-5 py-3">Codigo</th>
              <th className="px-5 py-3 text-right">Qtde</th>
            </tr>
          </thead>
          <tbody>
            {data.length ? (
              data.map((item) => (
                <tr
                  className="border-t border-stroke text-dark dark:border-dark-3 dark:text-white"
                  key={`${item.id_produto}-${title}`}
                >
                  <td className="max-w-[360px] px-5 py-3">
                    <span className="font-semibold">
                      {item.produto || `Produto #${item.id_produto}`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-dark-4 dark:text-dark-6">
                    {item.codigo || "-"}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-primary">
                    {item.total_qtde}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-5 py-8 text-center text-dark-4" colSpan={3}>
                  Sem dados para este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customStartDate, setCustomStartDate] = useState(defaultStartDate);
  const [customEndDate, setCustomEndDate] = useState(defaultEndDate);
  const [customRanking, setCustomRanking] = useState<ProdutoRanking[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState("");

  async function loadCustomRanking(startDate = customStartDate, endDate = customEndDate) {
    setCustomError("");

    if (!startDate || !endDate) {
      setCustomError("Informe a data inicial e final.");
      return;
    }

    if (startDate > endDate) {
      setCustomError("A data inicial deve ser menor ou igual a data final.");
      return;
    }

    setCustomLoading(true);

    try {
      const ranking = await apiRequest<ProdutoRanking[]>(
        "/api/v1/estatisticas-produtos/ranking",
        {
          query: {
            limit: 8,
            startDate,
            endDate: addDaysToDateInput(endDate, 1),
          },
        },
      );
      setCustomRanking(ranking);
    } catch (err) {
      setCustomError(
        err instanceof Error ? err.message : "Falha ao carregar ranking personalizado",
      );
    } finally {
      setCustomLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [estatisticas, produtos, clientes, orcamentos, categorias] =
        await Promise.all([
          apiRequest<EstatisticasResumo>("/api/v1/estatisticas-produtos/resumo", {
            query: { limit: 8 },
          }),
          listResource<AnyRow>("/api/v1/produtos", { limit: 1 }),
          listResource<AnyRow>("/api/v1/clientes", { limit: 1 }),
          listResource<AnyRow>("/api/v1/orcamentos", { limit: 1 }),
          listResource<AnyRow>("/api/v1/categorias", { limit: 1 }),
        ]);

      setState({ estatisticas, produtos, clientes, orcamentos, categorias });
      await loadCustomRanking(defaultStartDate, defaultEndDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const chartData = state.estatisticas?.mais_orcados || [];
  const chartOptions = useMemo<ApexOptions>(
    () => ({
      chart: { toolbar: { show: false }, fontFamily: "inherit" },
      colors: ["#b91c1c"],
      dataLabels: { enabled: false },
      grid: { strokeDashArray: 5 },
      plotOptions: { bar: { borderRadius: 6, columnWidth: "45%" } },
      xaxis: {
        categories: chartData.map((item) => item.codigo || `#${item.id_produto}`),
      },
    }),
    [chartData],
  );

  return (
    <div className="space-y-6">

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail="Catalogo cadastrado"
          label="Produtos"
          value={loading ? "..." : state.produtos?.total || 0}
        />
        <StatCard
          detail="Base comercial"
          label="Clientes"
          value={loading ? "..." : state.clientes?.total || 0}
        />
        <StatCard
          detail="Propostas registradas"
          label="Orçamentos"
          value={loading ? "..." : state.orcamentos?.total || 0}
        />
        <StatCard
          detail="Organizacao do catalogo"
          label="Categorias"
          value={loading ? "..." : state.categorias?.total || 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-dark dark:text-white">
              Produtos mais orcados
            </h2>
            <p className="text-sm text-dark-4 dark:text-dark-6">
              Ranking historico vindo de estatisticas_produtos.
            </p>
          </div>
          <div className="h-[330px]">
            {chartData.length ? (
              <Chart
                height={330}
                options={chartOptions}
                series={[
                  {
                    name: "Qtde",
                    data: chartData.map((item) => item.total_qtde),
                  },
                ]}
                type="bar"
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-stroke text-sm text-dark-4 dark:border-dark-3">
                Sem estatisticas disponiveis.
              </div>
            )}
          </div>
        </div>

        <RankingTable
          data={state.estatisticas?.melhores_do_dia || []}
          title="Melhores do dia"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingTable
          actions={
            <form
              className="grid gap-3 sm:grid-cols-[minmax(0,150px)_minmax(0,150px)_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                loadCustomRanking();
              }}
            >
              <label className="text-xs font-medium text-dark-4 dark:text-dark-6">
                Inicio
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-stroke bg-transparent px-3 text-sm font-medium text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  type="date"
                  value={customStartDate}
                />
              </label>
              <label className="text-xs font-medium text-dark-4 dark:text-dark-6">
                Fim
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-stroke bg-transparent px-3 text-sm font-medium text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white"
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  type="date"
                  value={customEndDate}
                />
              </label>
              <button
                className="h-10 self-end rounded-lg bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={customLoading}
                type="submit"
              >
                {customLoading ? "Carregando..." : "Carregar"}
              </button>
            </form>
          }
          data={customRanking}
          title="Mais orcados por periodo"
        />
        {customError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 xl:col-span-2">
            {customError}
          </div>
        )}
        <RankingTable
          data={state.estatisticas?.melhores_do_mes || []}
          title="Melhores do mes"
        />
        <RankingTable
          data={state.estatisticas?.melhores_do_ano || []}
          title="Melhores do ano"
        />
      </div>
    </div>
  );
}
