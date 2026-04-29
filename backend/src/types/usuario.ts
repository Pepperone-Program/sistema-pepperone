export interface Usuario {
  id_empresa: number;
  id_usuario: number;
  usuario: string;
  nome: string;
  email: string;
  ramal: string;
  tel: string;
  cel: string;
  endereco: string;
  endereco_n: string;
  endereco_compl: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  senha: string;
  comissao: string;
  data_inicial: string;
  data_final: string;
  last_login: string;
  habilitado: string;
  last_online: string;
  last_ip: string;
}

export interface CreateUsuarioDTO {
  usuario: string;
  nome: string;
  email: string;
  senha: string;
  ramal?: string;
  tel?: string;
  cel?: string;
  endereco?: string;
  endereco_n?: string;
  endereco_compl?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  comissao?: string;
  data_inicial?: string;
  data_final?: string;
  habilitado?: string;
}

export interface UpdateUsuarioDTO {
  nome?: string;
  email?: string;
  senha?: string;
  ramal?: string;
  tel?: string;
  cel?: string;
  endereco?: string;
  endereco_n?: string;
  endereco_compl?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  comissao?: string;
  data_final?: string;
  habilitado?: string;
}

export interface LoginDTO {
  usuario: string;
  senha: string;
  id_empresa?: number;
}

export interface AuthPayload {
  id_usuario: number;
  id_empresa: number;
  usuario: string;
  email: string;
}
