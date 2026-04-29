export interface OrcamentoItem {
  id_item: number;
  id_orcamento: number;
  data_orcamento: string;
  id_produto: number;
  codigo: string;
  produto: string;
  produto_cor: string | null;
  id_tipo_gravacao: string | null;
  gravacao_cores: string;
  quantidade: number;
  bv: string | null;
  preco_unitario: string | null;
  margem_lucro: string | null;
  preco_unitario_final: string | null;
  preco_unitario_aprovado: string | null;
  preco_unitario_frete: string | null;
  frete_diluido: string;
  data_aprovacao: string | null;
  usuario_aprovacao: string | null;
  data_solicitacao_aprovacao: string | null;
}

export interface CreateOrcamentoItemDTO {
  id_orcamento: number;
  data_orcamento: string;
  id_produto: number;
  codigo: string;
  produto: string;
  produto_cor?: string;
  id_tipo_gravacao?: string;
  gravacao_cores: string;
  quantidade: number;
  bv?: string;
  preco_unitario?: string;
  margem_lucro?: string;
  preco_unitario_final?: string;
  preco_unitario_aprovado?: string;
  preco_unitario_frete?: string;
  frete_diluido?: string;
}

export type UpdateOrcamentoItemDTO = Partial<CreateOrcamentoItemDTO>;
