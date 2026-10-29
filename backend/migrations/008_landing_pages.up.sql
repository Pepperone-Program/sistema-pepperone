CREATE TABLE IF NOT EXISTS landing_pages (
  id_landing_page INT NOT NULL AUTO_INCREMENT,
  id_empresa INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  descricao TEXT NULL,
  habilitado CHAR(1) NOT NULL DEFAULT 'S',
  PRIMARY KEY (id_landing_page),
  KEY idx_landing_pages_empresa (id_empresa, id_landing_page)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
