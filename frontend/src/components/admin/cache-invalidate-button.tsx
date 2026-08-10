"use client";

import { apiRequest } from "@/lib/api";
import { useState } from "react";

export function CacheInvalidateButton({ onInvalidated }: { onInvalidated?: () => void | Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function invalidate() {
    setLoading(true);
    setMessage("");
    try {
      await apiRequest("/api/v1/cache/invalidate/all", { method: "POST", body: "{}" });
      await onInvalidated?.();
      setMessage("Cache limpo");
      window.setTimeout(() => setMessage(""), 2500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao limpar cache");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button className="whitespace-nowrap rounded-md border border-stroke px-3 py-2.5 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-3 dark:text-white" disabled={loading} onClick={invalidate} type="button">
        {loading ? "Limpando..." : "Limpar cache"}
      </button>
      {message && <span className="absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-md bg-dark px-3 py-2 text-xs text-white shadow-2 dark:bg-white dark:text-dark">{message}</span>}
    </div>
  );
}
