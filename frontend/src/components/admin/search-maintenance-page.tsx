"use client";

import { apiRequest } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

type Coverage = {
  publicProducts: number;
  publicDocuments: number;
  validDocuments: number;
  ready: boolean;
};

type MaintenanceResult = {
  origin: "manual" | "cron" | "script";
  finishedAt: string;
  elapsedMs: number;
  skipped: boolean;
  synchronized: number;
  removed: number;
  coverage: Coverage;
  error?: string;
};

type MaintenanceStatus = {
  running: boolean;
  coverage: Coverage;
  lastResult: MaintenanceResult | null;
  cron: { enabled: boolean; expression: string };
};

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(new Date(value))
    : "Ainda não executado";

const originLabel = (origin?: MaintenanceResult["origin"]) =>
  ({
    manual: "Acionamento manual",
    cron: "Verificação automática",
    script: "Terminal",
  })[origin || "manual"];

export function SearchMaintenancePage() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiRequest<MaintenanceStatus>(
        "/api/v1/produtos/search/maintenance",
      );
      setStatus(data);
      setError("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível consultar a busca.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const repair = async () => {
    setRepairing(true);
    setError("");
    try {
      const result = await apiRequest<MaintenanceResult>(
        "/api/v1/produtos/search/maintenance/repair",
        { method: "POST", body: "{}" },
      );
      if (!result.coverage.ready) {
        throw new Error(
          "O reparo terminou, mas a cobertura ainda está incompleta.",
        );
      }
      await loadStatus();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível reparar a busca.",
      );
      await loadStatus();
    } finally {
      setRepairing(false);
    }
  };

  const coveragePercent = useMemo(() => {
    if (!status?.coverage.publicProducts) return 100;
    return Math.min(
      100,
      Math.round(
        (status.coverage.validDocuments / status.coverage.publicProducts) * 100,
      ),
    );
  }, [status]);

  const isRunning = repairing || Boolean(status?.running);
  const ready = Boolean(status?.coverage.ready);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_280px] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Integridade do catálogo
            </p>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-dark dark:text-white sm:text-4xl">
              Busca do site
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-dark-4 dark:text-dark-6">
              Acompanhe se todos os produtos públicos estão disponíveis na
              busca. A verificação automática corrige diferenças sem interromper
              o site.
            </p>
          </div>

          <div className="rounded-lg bg-[#f7f8fa] p-5 dark:bg-dark-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-dark dark:text-white">
                Cobertura válida
              </span>
              <strong className="font-mono text-3xl text-dark dark:text-white">
                {loading ? "—" : `${coveragePercent}%`}
              </strong>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-stroke dark:bg-dark-3">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${ready ? "bg-emerald-600" : "bg-primary"}`}
                style={{ width: `${loading ? 0 : coveragePercent}%` }}
              />
            </div>
          </div>
        </div>

        <div
          className={`flex flex-col gap-4 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 ${ready ? "border-emerald-200 bg-emerald-50/70" : "border-red-200 bg-red-50/70"}`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`size-2.5 rounded-full ${ready ? "bg-emerald-600" : "bg-primary"} ${isRunning ? "animate-pulse" : ""}`}
            />
            <div>
              <p className="font-bold text-dark">
                {loading
                  ? "Verificando a busca..."
                  : isRunning
                    ? "Reparo em andamento"
                    : ready
                      ? "Busca saudável"
                      : "Reparo necessário"}
              </p>
              <p className="text-sm text-dark-4">
                {status?.cron.enabled
                  ? "Verificação automática ativa a cada 5 minutos."
                  : "A verificação automática está desativada."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={repair}
            disabled={loading || isRunning}
            className="rounded-md bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? "Reparando busca..." : "Reparar busca agora"}
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800"
        >
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Produtos públicos", status?.coverage.publicProducts],
          ["Documentos públicos", status?.coverage.publicDocuments],
          ["Documentos válidos", status?.coverage.validDocuments],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg border border-stroke bg-white p-5 dark:border-dark-3 dark:bg-gray-dark"
          >
            <p className="text-sm text-dark-4 dark:text-dark-6">{label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-dark dark:text-white">
              {loading ? "—" : Number(value || 0).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="text-lg font-bold text-dark dark:text-white">
            Automação
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-stroke pb-4 dark:border-dark-3">
              <dt className="text-dark-4 dark:text-dark-6">Cron</dt>
              <dd className="font-semibold text-dark dark:text-white">
                {status?.cron.enabled ? "Ativo" : "Desativado"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-dark-4 dark:text-dark-6">Frequência</dt>
              <dd className="font-semibold text-dark dark:text-white">
                A cada 5 minutos
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="text-lg font-bold text-dark dark:text-white">
            Última execução
          </h2>
          {status?.lastResult ? (
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2 border-b border-stroke pb-4 dark:border-dark-3">
                <dt className="text-dark-4 dark:text-dark-6">Quando</dt>
                <dd className="mt-1 font-semibold text-dark dark:text-white">
                  {formatDate(status.lastResult.finishedAt)} ·{" "}
                  {originLabel(status.lastResult.origin)}
                </dd>
              </div>
              <div>
                <dt className="text-dark-4 dark:text-dark-6">Sincronizados</dt>
                <dd className="mt-1 font-mono text-lg font-bold text-dark dark:text-white">
                  {status.lastResult.synchronized}
                </dd>
              </div>
              <div>
                <dt className="text-dark-4 dark:text-dark-6">Removidos</dt>
                <dd className="mt-1 font-mono text-lg font-bold text-dark dark:text-white">
                  {status.lastResult.removed}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-5 text-sm text-dark-4 dark:text-dark-6">
              A cobertura está sendo acompanhada. A primeira execução aparecerá
              aqui.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
