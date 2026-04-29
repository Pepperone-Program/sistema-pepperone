"use client";

import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/api";
import { useEffect, useState } from "react";

type Props = {
  onChange?: () => void;
};

export function TokenPanel({ onChange }: Props) {
  const [token, setToken] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setToken(getStoredToken());
  }, []);

  return (
    <div className="rounded-lg border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-dark dark:text-white">
            Conexao com API
          </p>
          <p className="text-xs text-dark-4 dark:text-dark-6">
            Informe um JWT temporario ate o login ser conectado.
          </p>
        </div>

        <button
          className="rounded-md border border-stroke px-3 py-2 text-sm font-medium text-dark hover:border-primary hover:text-primary dark:border-dark-3 dark:text-white"
          onClick={() => setIsOpen((value) => !value)}
          type="button"
        >
          {token ? "Token configurado" : "Configurar token"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            className="rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            onChange={(event) => setToken(event.target.value)}
            placeholder="Cole o JWT aqui"
            type="password"
            value={token}
          />
          <button
            className="rounded-md bg-primary px-4 py-3 text-sm font-semibold text-white"
            onClick={() => {
              setStoredToken(token);
              onChange?.();
            }}
            type="button"
          >
            Salvar
          </button>
          <button
            className="rounded-md border border-stroke px-4 py-3 text-sm font-semibold text-dark dark:border-dark-3 dark:text-white"
            onClick={() => {
              clearStoredToken();
              setToken("");
              onChange?.();
            }}
            type="button"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
