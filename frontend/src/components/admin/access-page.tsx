"use client";

import { apiRequest } from "@/lib/api";
import { FormEvent, useEffect, useState } from "react";

type Grupo = {
  grupo: string;
  total_permissoes: number;
  total_usuarios: number;
};

type GrupoPermissao = {
  grupo: string;
  permissao: string;
};

type GrupoUsuario = {
  grupo: string;
  id_usuario: number;
};

export function AccessPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedGrupo, setSelectedGrupo] = useState("admin");
  const [permissoes, setPermissoes] = useState<GrupoPermissao[]>([]);
  const [usuarios, setUsuarios] = useState<GrupoUsuario[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const gruposData = await apiRequest<{ items: Grupo[] }>("/api/v1/grupos", {
        query: { limit: 100 },
      });
      setGrupos(gruposData.items);

      const grupo = selectedGrupo || gruposData.items[0]?.grupo || "admin";
      const [permissoesData, usuariosData] = await Promise.all([
        apiRequest<{ items: GrupoPermissao[] }>(`/api/v1/grupos/${grupo}/permissoes`, {
          query: { limit: 100 },
        }),
        apiRequest<{ items: GrupoUsuario[] }>(`/api/v1/grupos/${grupo}/usuarios`, {
          query: { limit: 100 },
        }),
      ]);
      setPermissoes(permissoesData.items);
      setUsuarios(usuariosData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar permissoes");
    }
  }

  useEffect(() => {
    load();
  }, [selectedGrupo]);

  async function addPermissao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const permissao = String(form.get("permissao") || "").trim();
    if (!permissao) return;

    await apiRequest(`/api/v1/grupos/${selectedGrupo}/permissoes`, {
      method: "POST",
      body: JSON.stringify({ permissao }),
    });
    event.currentTarget.reset();
    load();
  }

  async function addUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id_usuario = Number(form.get("id_usuario"));
    if (!id_usuario) return;

    await apiRequest(`/api/v1/grupos/${selectedGrupo}/usuarios`, {
      method: "POST",
      body: JSON.stringify({ id_usuario }),
    });
    event.currentTarget.reset();
    load();
  }

  async function removePermissao(permissao: string) {
    await apiRequest(`/api/v1/grupos/${selectedGrupo}/permissoes/${permissao}`, {
      method: "DELETE",
    });
    load();
  }

  async function removeUsuario(idUsuario: number) {
    await apiRequest(`/api/v1/grupos/${selectedGrupo}/usuarios/${idUsuario}`, {
      method: "DELETE",
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Controle de acesso
        </p>
        <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
          Grupos e permissoes
        </h1>
        <p className="mt-2 text-sm text-dark-4 dark:text-dark-6">
          Defina permissoes por grupo e associe usuarios a grupos operacionais.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-lg bg-white p-4 shadow-1 dark:bg-gray-dark">
          <label className="text-sm font-semibold text-dark dark:text-white">
            Grupo
          </label>
          <input
            className="mt-2 w-full rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            onChange={(event) => setSelectedGrupo(event.target.value)}
            value={selectedGrupo}
          />

          <div className="mt-4 space-y-2">
            {grupos.map((grupo) => (
              <button
                className="flex w-full items-center justify-between rounded-md border border-stroke px-3 py-2 text-left text-sm hover:border-primary dark:border-dark-3"
                key={grupo.grupo}
                onClick={() => setSelectedGrupo(grupo.grupo)}
                type="button"
              >
                <span className="font-semibold text-dark dark:text-white">
                  {grupo.grupo}
                </span>
                <span className="text-xs text-dark-4">
                  {grupo.total_permissoes} perm. / {grupo.total_usuarios} usuarios
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
            <h2 className="text-lg font-bold text-dark dark:text-white">Permissoes</h2>
            <form className="mt-4 flex gap-2" onSubmit={addPermissao}>
              <input
                className="min-w-0 flex-1 rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                name="permissao"
                placeholder="ex: administrador"
              />
              <button className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white">
                Adicionar
              </button>
            </form>
            <div className="mt-4 divide-y divide-stroke dark:divide-dark-3">
              {permissoes.map((item) => (
                <div className="flex items-center justify-between py-3" key={item.permissao}>
                  <span className="font-medium text-dark dark:text-white">
                    {item.permissao}
                  </span>
                  <button
                    className="text-sm font-semibold text-red-600"
                    onClick={() => removePermissao(item.permissao)}
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-1 dark:bg-gray-dark">
            <h2 className="text-lg font-bold text-dark dark:text-white">Usuarios</h2>
            <form className="mt-4 flex gap-2" onSubmit={addUsuario}>
              <input
                className="min-w-0 flex-1 rounded-md border border-stroke bg-gray-2 px-4 py-3 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                name="id_usuario"
                placeholder="ID do usuario"
                type="number"
              />
              <button className="rounded-md bg-primary px-4 py-3 text-sm font-bold text-white">
                Vincular
              </button>
            </form>
            <div className="mt-4 divide-y divide-stroke dark:divide-dark-3">
              {usuarios.map((item) => (
                <div className="flex items-center justify-between py-3" key={item.id_usuario}>
                  <span className="font-medium text-dark dark:text-white">
                    Usuario #{item.id_usuario}
                  </span>
                  <button
                    className="text-sm font-semibold text-red-600"
                    onClick={() => removeUsuario(item.id_usuario)}
                    type="button"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
