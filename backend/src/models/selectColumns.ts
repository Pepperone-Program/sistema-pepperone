// Centralized allowlists keep database-only columns out of API responses and
// make schema changes explicit instead of silently exposing them via SELECT *.
export const USUARIO_COLUMNS = `
  id_empresa, id_usuario, usuario, nome, email, ramal, tel, cel,
  endereco, endereco_n, endereco_compl, bairro, cep, cidade, uf, senha,
  comissao, data_inicial, data_final, last_login, habilitado, last_online, last_ip
`;

export const USUARIO_PUBLIC_COLUMNS = `
  id_empresa, id_usuario, usuario, nome, email, ramal, tel, cel,
  endereco, endereco_n, endereco_compl, bairro, cep, cidade, uf, comissao,
  data_inicial, data_final, last_login, habilitado, last_online, last_ip
`;

export const CLIENTE_COLUMNS = `
  id_empresa, id_cliente, pessoa, cnpj_cpf, ie_rg, razao_social, fantasia,
  endereco, endereco_n, endereco_compl, bairro, cep, cidade, uf, pais, tel,
  tel2, tel3, fax, site, email, logotipo, obs, consumidor_final, cadastro_site,
  id_transportadora, id_vendedor, id_captacao, habilitado, data_inclusao, ultima_venda
`;

export const CLIENTE_CONTATO_COLUMNS = `
  id_empresa, id_cliente, contato_email, contato_nome, contato_depto,
  contato_cargo, contato_tel, contato_celular, contato_nascimento, contato_obs,
  habilitado
`;

export const PRODUTO_COLUMNS = `
  id_empresa, id_produto, id_tipo_produto, produto, descricao, codigo,
  id_tipo_gravacao_padrao, altura, largura, profundidade, peso, caixa1, caixa2,
  caixa3, caixa4, caixa5, ncm, imagem, data_inclusao, data_inicial, data_final,
  data_modificacao, obs, site, sugerir_sempre, lancamento, promocao, premium,
  marketplace, video, habilitado, cod_forn, quantidade_minima
`;

// Public site contract documented in src/docs/dados-utilizados.json.
export const SITE_PRODUTO_COLUMNS = `
  id_produto, id_tipo_produto, produto, descricao, codigo, altura, largura,
  profundidade, peso, ncm, imagem, data_inclusao, obs, site, lancamento,
  promocao, premium, video, habilitado, quantidade_minima
`;

export const SITE_PRODUTO_COLUMNS_P = `
  p.id_produto, p.id_tipo_produto, p.produto, p.descricao, p.codigo, p.altura,
  p.largura, p.profundidade, p.peso, p.ncm, p.imagem, p.data_inclusao, p.obs,
  p.site, p.lancamento, p.promocao, p.premium, p.video, p.habilitado,
  p.quantidade_minima
`;

export const ORCAMENTO_COLUMNS = `
  id_empresa, id_objeto, id_orcamento, id_cliente, data_orcamento, fantasia,
  endereco, endereco_n, endereco_compl, bairro, cep, cidade, uf, pais, tel,
  tel2, site, email, obs, contato, id_condicao, id_vendedor, frete, frete_valor,
  diluir_frete, nivel, entrega, id_captacao, logotipo, layout, layout_aprovado,
  data_finalizado, cancelamento, agendamento, primeiro_contato, recepcao,
  gerencia, total_geral_pdf, texto_email, ultimo_contato, motivo_desconto
`;

export const ORCAMENTO_ITEM_COLUMNS = `
  id_item, id_orcamento, data_orcamento, id_produto, codigo, produto,
  produto_cor, id_tipo_gravacao, gravacao_cores, quantidade, bv, preco_unitario,
  margem_lucro, preco_unitario_final, preco_unitario_aprovado,
  preco_unitario_frete, frete_diluido, data_aprovacao, usuario_aprovacao,
  data_solicitacao_aprovacao
`;
