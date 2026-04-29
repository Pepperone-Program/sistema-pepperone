export interface EstatisticaProduto {
  id_produto: number;
  data: string;
  qtde: number;
}

export interface ProdutoRanking {
  id_produto: number;
  codigo: string | null;
  produto: string | null;
  total_qtde: number;
  total_registros: number;
}

export interface EstatisticasProdutosResumo {
  mais_orcados: ProdutoRanking[];
  melhores_do_dia: ProdutoRanking[];
  melhores_do_mes: ProdutoRanking[];
  melhores_do_ano: ProdutoRanking[];
}
