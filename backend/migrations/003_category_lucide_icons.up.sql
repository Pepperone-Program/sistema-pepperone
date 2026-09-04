ALTER TABLE categorias MODIFY COLUMN icon TEXT NULL;

UPDATE categorias
SET icon = CONCAT(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-',
  CASE id_categoria
    WHEN 1 THEN 'utensils-crossed' WHEN 2 THEN 'cpu' WHEN 3 THEN 'cup-soda'
    WHEN 4 THEN 'notebook' WHEN 5 THEN 'handbag' WHEN 6 THEN 'usb'
    WHEN 7 THEN 'pen' WHEN 8 THEN 'briefcase-business' WHEN 9 THEN 'paw-print'
    WHEN 10 THEN 'user-round' WHEN 11 THEN 'key-round' WHEN 12 THEN 'luggage'
    WHEN 13 THEN 'beer' WHEN 14 THEN 'wrench' WHEN 15 THEN 'monitor'
    WHEN 16 THEN 'contact' WHEN 17 THEN 'umbrella' WHEN 18 THEN 'baby'
    WHEN 20 THEN 'book-open' WHEN 21 THEN 'leaf' WHEN 22 THEN 'notebook-pen'
    WHEN 23 THEN 'battery-charging' WHEN 24 THEN 'headphones' WHEN 25 THEN 'speaker'
    WHEN 26 THEN 'bottle' WHEN 27 THEN 'snowflake' WHEN 28 THEN 'shopping-bag'
    WHEN 29 THEN 'dumbbell' WHEN 30 THEN 'pen-line' WHEN 31 THEN 'beef'
    WHEN 32 THEN 'wine' WHEN 33 THEN 'pizza' WHEN 34 THEN 'handbag'
    WHEN 35 THEN 'pencil-ruler' WHEN 36 THEN 'car' WHEN 37 THEN 'tree-pine'
    WHEN 38 THEN 'layers' WHEN 41 THEN 'shapes' WHEN 42 THEN 'package'
    WHEN 43 THEN 'gift' WHEN 44 THEN 'flask-conical' WHEN 45 THEN 'test-tube'
    WHEN 46 THEN 'box' WHEN 47 THEN 'factory' WHEN 48 THEN 'footprints'
    WHEN 50 THEN 'sprout'
  END,
  '">',
  CASE
    WHEN id_categoria IN (5,34) THEN '<path d="M2.048 18.566A2 2 0 0 0 4 21h16a2 2 0 0 0 1.952-2.434l-2-9A2 2 0 0 0 18 8H6a2 2 0 0 0-1.952 1.566z"/><path d="M8 11V6a4 4 0 0 1 8 0v5"/>'
    WHEN id_categoria IN (4,22) THEN '<path d="M2 6h4M2 10h4M2 14h4M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M16 2v20"/>'
    WHEN id_categoria IN (7,30,35) THEN '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
    WHEN id_categoria IN (12,28) THEN '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>'
    WHEN id_categoria IN (31,32,33) THEN '<path d="M8 22h8M12 11v11"/><path d="M19 3H5l2 5.5a5.5 5.5 0 0 0 10 0Z"/>'
    WHEN id_categoria IN (42,43,46) THEN '<path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>'
    WHEN id_categoria IN (21,37,50) THEN '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 18 2 18 2c1 5-1 9-4.5 10.5C11 13.5 9 15 8 18"/><path d="M2 21c0-3 1.85-5.36 5.08-6.94C9.73 12.76 12 11 13 9"/>'
    WHEN id_categoria IN (44,45) THEN '<path d="M14 2v6.5l5.73 9.94A1.71 1.71 0 0 1 18.25 21H5.75a1.71 1.71 0 0 1-1.48-2.56L10 8.5V2"/><path d="M8.5 2h7M7 16h10"/>'
    WHEN id_categoria = 1 THEN '<path d="m16 2-2 2.8A3 3 0 0 0 18.2 9L21 6M15 15 3.3 3.3M2.1 21.8l6.4-6.3M19 5l-7 7M14 17l5.7 5.7"/>'
    WHEN id_categoria = 2 THEN '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>'
    WHEN id_categoria IN (3,13,26) THEN '<path d="m6 8 1.5 13h9L18 8M5 8h14M7 4h10M12 4v4"/>'
    WHEN id_categoria = 6 THEN '<circle cx="10" cy="7" r="1"/><circle cx="4" cy="20" r="1"/><path d="M4.7 19.3 19 5m2-2-3 1 2 2Z"/>'
    WHEN id_categoria IN (8,15,16) THEN '<rect width="20" height="14" x="2" y="6" rx="2"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M12 12h.01"/>'
    WHEN id_categoria = 9 THEN '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>'
    WHEN id_categoria IN (10,18) THEN '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>'
    WHEN id_categoria = 11 THEN '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3.172a2 2 0 0 0 1.414-.586l8.704-8.704a6.5 6.5 0 1 0-5-5z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>'
    WHEN id_categoria = 14 THEN '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>'
    WHEN id_categoria = 17 THEN '<path d="M22 12a10.06 10.06 0 0 0-20 0ZM12 12v8a2 2 0 0 0 4 0M12 2v1"/>'
    WHEN id_categoria = 20 THEN '<path d="M12 7v14M3 18a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2h5a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3ZM21 18a1 1 0 0 0 1-1V5a2 2 0 0 0-2-2h-5a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3Z"/>'
    WHEN id_categoria = 23 THEN '<path d="m11 7-3 5h4l-3 5M15 6h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3M22 14v-4M6 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>'
    WHEN id_categoria = 24 THEN '<path d="M3 14h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a9 9 0 0 1 18 0v8a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h3"/>'
    WHEN id_categoria = 25 THEN '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M12 6h.01"/><circle cx="12" cy="14" r="4"/>'
    WHEN id_categoria = 27 THEN '<path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07 19.07 4.93"/>'
    WHEN id_categoria = 29 THEN '<path d="m6.5 6.5 11 11M3 10l7-7M14 21l7-7M2 8l4-4M18 20l4-4"/>'
    WHEN id_categoria = 36 THEN '<path d="M19 17h2v-5l-2-5H5l-2 5v5h2M5 17h14M5 12h14"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'
    WHEN id_categoria = 38 THEN '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83zM22 12.5l-9.17 4.17a2 2 0 0 1-1.66 0L2 12.5M22 17.5l-9.17 4.17a2 2 0 0 1-1.66 0L2 17.5"/>'
    WHEN id_categoria = 41 THEN '<rect width="8" height="8" x="2" y="2" rx="2"/><circle cx="17" cy="7" r="5"/><path d="m6 14-4 8h8ZM17 14l5 8H12Z"/>'
    WHEN id_categoria = 47 THEN '<path d="M12 16h.01M16 16h.01M3 21h18M5 21V10l5 3V10l5 3V4h4v17"/>'
    WHEN id_categoria = 48 THEN '<path d="M4 16v-2.38C4 10.6 5.8 8 8 8s4 2.6 4 5.62V16a4 4 0 0 1-8 0ZM12 8a4 4 0 0 1 8 0v2.38C20 13.4 18.2 16 16 16M8 3v1M16 20v1"/>'
  END,
  '</svg>'
)
WHERE id_empresa = 1
  AND id_categoria IN (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,50);
