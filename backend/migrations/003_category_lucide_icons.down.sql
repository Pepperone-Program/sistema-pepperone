UPDATE categorias
SET icon = CASE id_categoria
  WHEN 1 THEN '<i class="fas fa-utensils"></i>' WHEN 2 THEN '<i class="fas fa-cogs"></i>'
  WHEN 3 THEN '<i class="fab fa-gulp"></i>' WHEN 4 THEN '<i class="fas fa-book"></i>'
  WHEN 5 THEN '<i class="fas fa-female"></i>' WHEN 6 THEN '<i class="fas fa-hdd"></i>'
  WHEN 7 THEN '<i class="fas fa-pen"></i>' WHEN 8 THEN '<i class="fas fa-male"></i>'
  WHEN 9 THEN '<i class="fas fa-paw"></i>' WHEN 10 THEN '<i class="fas fa-medkit"></i>'
  WHEN 11 THEN '<i class="fas fa-key"></i>' WHEN 12 THEN '<i class="fas fa-suitcase"></i>'
  WHEN 13 THEN '<i class="fas fa-beer"></i>' WHEN 14 THEN '<i class="fas fa-wrench"></i>'
  WHEN 15 THEN '<i class="fas fa-desktop"></i>' WHEN 16 THEN '<i class="fas fa-ticket-alt"></i>'
  WHEN 17 THEN '<i class="fas fa-umbrella"></i>' WHEN 18 THEN '<i class="fas fa-child"></i>'
  WHEN 20 THEN '<i class="fas fa-book-open"></i>'
  WHEN 23 THEN '<i class="fas fa-battery-three-quarters"></i>'
  WHEN 24 THEN '<i class="fas fa-headphones"></i>' WHEN 25 THEN '<i class="fas fa-volume-up"></i>'
  WHEN 26 THEN '<i class="fas fa-wine-bottle"></i>' WHEN 27 THEN '<i class="fas fa-fill"></i>'
  WHEN 28 THEN '<i class="fas fa-shopping-bag"></i>' WHEN 29 THEN '<i class="fas fa-dumbbell"></i>'
  WHEN 30 THEN '<i class="fas fa-pen-alt"></i>' WHEN 31 THEN '<i class="fas fa-utensils"></i>'
  WHEN 32 THEN '<i class="fas fa-wine-glass-alt"></i>' WHEN 33 THEN '<i class="fas fa-glass-martini-alt"></i>'
  WHEN 34 THEN '<i class="fas fa-shopping-bag"></i>' WHEN 47 THEN '<i class="fa fa-fw fa-industry"></i>'
  WHEN 50 THEN NULL
  ELSE ''
END
WHERE id_empresa = 1
  AND id_categoria IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,50);

ALTER TABLE categorias MODIFY COLUMN icon VARCHAR(50) NULL;
