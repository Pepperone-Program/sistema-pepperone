"use client";

import { apiRequest } from "@/lib/api";
import { useState } from "react";
import { toast } from "@/components/ui/toast";

export function CacheInvalidateButton({ onInvalidated }: { onInvalidated?: () => void | Promise<void> }) {
  const [loading, setLoading] = useState(false);

  async function invalidate() {
    setLoading(true);
    try {
      await apiRequest("/api/v1/cache/invalidate/all", { method: "POST", body: "{}" });
      await onInvalidated?.();
      toast.add({ type: "success", description: "Cache limpo." });
    } catch (error) {
      toast.add({ type: "error", description: error instanceof Error ? error.message : "Falha ao limpar cache", priority: "high" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button className="whitespace-nowrap rounded-md border border-stroke px-3 py-2.5 text-sm font-semibold hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-3 dark:text-white" disabled={loading} onClick={invalidate} type="button">
        {loading ? "Limpando..." : "Limpar cache"}
      </button>
    </div>
  );
}
