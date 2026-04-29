export interface Grupo {
  id_empresa: number;
  grupo: string;
  total_permissoes: number;
  total_usuarios: number;
}

export interface GrupoPermissao {
  id_empresa: number;
  grupo: string;
  permissao: string;
}

export interface GrupoUsuario {
  id_empresa: number;
  id_usuario: number;
  grupo: string;
}

export interface CreateGrupoPermissaoDTO {
  permissao: string;
}

export interface CreateGrupoUsuarioDTO {
  id_usuario: number;
}
