export type HabilitadoFlag = 'S' | 'N';
export type PessoaTipo = 'F' | 'J';

export interface Cliente {
  id_empresa: number;
  id_cliente: number;
  pessoa: PessoaTipo | string | null;
  cnpj_cpf: string | null;
  ie_rg: string | null;
  razao_social: string | null;
  fantasia: string | null;
  endereco: string | null;
  endereco_n: string | null;
  endereco_compl: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string | null;
  tel: string | null;
  tel2: string | null;
  tel3: string | null;
  fax: string | null;
  site: string | null;
  email: string | null;
  logotipo: string | null;
  obs: string | null;
  consumidor_final: string | null;
  cadastro_site: string | null;
  id_transportadora: number | null;
  id_vendedor: number | null;
  id_captacao: number | null;
  habilitado: HabilitadoFlag;
  data_inclusao: string | null;
  ultima_venda: string | null;
}

export interface ClienteContato {
  id_empresa: number;
  id_cliente: number;
  contato_email: string;
  contato_nome: string | null;
  contato_depto: string | null;
  contato_cargo: string | null;
  contato_tel: string | null;
  contato_celular: string | null;
  contato_nascimento: string | null;
  contato_obs: string | null;
  habilitado: HabilitadoFlag;
}

export interface CreateClienteDTO {
  id_cliente?: number;
  pessoa?: PessoaTipo;
  cnpj_cpf?: string | null;
  ie_rg?: string | null;
  razao_social?: string | null;
  fantasia: string;
  endereco?: string | null;
  endereco_n?: string | null;
  endereco_compl?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cidade?: string | null;
  uf?: string | null;
  pais?: string | null;
  tel?: string | null;
  tel2?: string | null;
  tel3?: string | null;
  fax?: string | null;
  site?: string | null;
  email?: string | null;
  logotipo?: string | null;
  obs?: string | null;
  consumidor_final?: string | null;
  cadastro_site?: string | null;
  id_transportadora?: number | null;
  id_vendedor?: number | null;
  id_captacao?: number | null;
  habilitado?: HabilitadoFlag;
  ultima_venda?: string | null;
}

export type UpdateClienteDTO = Partial<CreateClienteDTO>;

export interface CreateClienteContatoDTO {
  contato_email: string;
  contato_nome?: string | null;
  contato_depto?: string | null;
  contato_cargo?: string | null;
  contato_tel?: string | null;
  contato_celular?: string | null;
  contato_nascimento?: string | null;
  contato_obs?: string | null;
  habilitado?: HabilitadoFlag;
}

export type UpdateClienteContatoDTO = Partial<CreateClienteContatoDTO>;
