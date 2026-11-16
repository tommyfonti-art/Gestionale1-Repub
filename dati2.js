// Ricette in più (novembre 2026), riprese dal foglio «Drink & food cost repub 2024-25-26»:
// drink da «Consumi e costi», panini e fritti da «Food cost» e «Food pezzo», prezzi da «Inventario mescita» e «Food».
// Si aggiungono ai dati di partenza e, una volta sola, ai dati già salvati online (solo quello che manca).
window.AGGIUNTE_RICETTE = (function () {
  const D = '2026-11-01';
  const F = (id, nome) => ({ id, nome, piva: '', telefono: '', email: '', referente: '', giorniConsegna: '', note: '' });
  const fornitori = [F('f_giulianelli', 'Giulianelli'), F('f_decafood', 'Decafood'), F('f_imola', 'Imola'), F('f_sunice', 'Sun ice')];

  function p(id, nomeBreve, nomeCompleto, categoria, unita, contenuto, confezione, prezzo, fornitoreId, extra) {
    return Object.assign({
      id, nomeBreve, nomeCompleto, categoria, unita, contenuto, confezione,
      iva: 22, giacenza: 0, scortaMinima: 0, resa: 100, allergeni: [],
      venditaDiretta: null, fornitoreId: fornitoreId || '', articoli: [],
      prezzi: prezzo != null ? [{ data: D, fornitoreId: fornitoreId || '', prezzo, origine: 'Foglio 2024-26' }] : [],
      note: '', interno: !fornitoreId
    }, extra || {});
  }
  const AMARO = { venditaDiretta: { nomePorzione: 'bicchierino', porzione: 50, prezzoPorzione: 3.5, prezzoIntero: null } };
  const I10 = { iva: 10 }, I4 = { iva: 4 };
  const CASA = 'Fatti in casa';
  const prodotti = [
    // Distillati e liquori
    p('p_select', 'Select', 'Select aperitivo 1 litro', 'Bitter e vermouth', 'ml', 1000, 'bottiglia', 13, 'f_zonzini'),
    p('p_dolin', 'Dolin dry', 'Vermouth Dolin Dry 75 cl', 'Bitter e vermouth', 'ml', 750, 'bottiglia', 9.45, 'f_giulianelli'),
    p('p_jameson', 'Jameson', 'Whiskey Jameson 1 litro', 'Whisky', 'ml', 1000, 'bottiglia', 21.5, 'f_zonzini'),
    p('p_wildturkey', 'Wild Turkey', 'Bourbon Wild Turkey 1 litro', 'Whisky', 'ml', 1000, 'bottiglia', 25, 'f_zonzini'),
    p('p_jack', 'Jack Daniel\'s', 'Whiskey Jack Daniel\'s 1 litro', 'Whisky', 'ml', 1000, 'bottiglia', 23, 'f_zonzini'),
    p('p_havanaesp', 'Havana Especial', 'Rum Havana Club Especial 1 litro', 'Rum e cachaça', 'ml', 1000, 'bottiglia', 14.11, 'f_turci'),
    p('p_gosling', 'Gosling', 'Rum Gosling\'s Black Seal 1 litro', 'Rum e cachaça', 'ml', 1000, 'bottiglia', 19.06, 'f_giulianelli'),
    p('p_wray', 'Wray & Nephew', 'Rum Wray & Nephew 70 cl', 'Rum e cachaça', 'ml', 700, 'bottiglia', 24, 'f_giulianelli'),
    p('p_mezcal', 'Mezcal Burrito', 'Mezcal Burrito Fiestero 70 cl', 'Tequila e mezcal', 'ml', 700, 'bottiglia', 34, 'f_partesa'),
    p('p_tanq0', 'Tanqueray 0%', 'Tanqueray 0,0% 70 cl', 'Gin', 'ml', 700, 'bottiglia', 12.1, 'f_zonzini'),
    p('p_kahlua', 'Kahlúa', 'Liquore Kahlúa 1 litro', 'Amari e liquori', 'ml', 1000, 'bottiglia', 15.9, 'f_zonzini', AMARO),
    p('p_fernet', 'Fernet', 'Fernet-Branca 1 litro', 'Amari e liquori', 'ml', 1000, 'bottiglia', 17.95, 'f_zonzini', AMARO),
    p('p_jager', 'Jägermeister', 'Jägermeister 1 litro', 'Amari e liquori', 'ml', 1000, 'bottiglia', 14.03, 'f_zonzini', AMARO),
    p('p_chartreuse', 'Chartreuse verde', 'Chartreuse verde 70 cl', 'Amari e liquori', 'ml', 700, 'bottiglia', 38.46, 'f_zonzini', AMARO),
    p('p_italicus', 'Italicus', 'Italicus Rosolio di Bergamotto 70 cl', 'Amari e liquori', 'ml', 700, 'bottiglia', 27.9, 'f_turci', AMARO),
    p('p_banana', 'Banana Giffard', 'Liquore Banane du Brésil Giffard 70 cl', 'Amari e liquori', 'ml', 700, 'bottiglia', 17, 'f_partesa'),
    p('p_aurum', 'Aurum', 'Liquore Aurum 70 cl', 'Amari e liquori', 'ml', 700, 'bottiglia', 16.9, 'f_zonzini', AMARO),
    p('p_angostura', 'Angostura', 'Angostura bitter 20 cl', 'Amari e liquori', 'ml', 200, 'bottiglia', 12.8, 'f_zonzini'),
    p('p_sambuco', 'Sambuco Monin', 'Sciroppo di sambuco Monin 1 litro', 'Sciroppi', 'ml', 1000, 'bottiglia', 11.9, 'f_zonzini'),
    p('p_agave', 'Agave Real', 'Sciroppo d\'agave Real 50 cl', 'Sciroppi', 'ml', 500, 'flacone', 9, 'f_sebar'),
    // Bibite, succhi, fusti
    p('p_gingerbeer', 'Ginger beer Fever', 'Ginger beer Fever-Tree 20 cl', 'Sode e succhi', 'ml', 200, 'bottiglietta', 0.971, 'f_zonzini', { articoli: [{ fornitoreId: 'f_zonzini', codice: '', descrizione: 'FEVER TREE GINGER BEER 20CL CT 24', confezioniPerUnita: 24 }] }),
    p('p_gingerschw', 'Ginger beer Schweppes', 'Ginger beer Schweppes 18 cl', 'Sode e succhi', 'ml', 180, 'bottiglietta', 0.775, 'f_zonzini'),
    p('p_gingerale', 'Ginger ale', 'Ginger ale 18 cl', 'Sode e succhi', 'ml', 180, 'bottiglietta', 0.7625, 'f_zonzini'),
    p('p_tonicaschw', 'Tonica Schweppes', 'Tonica Schweppes vetro 18 cl', 'Sode e succhi', 'pz', 1, 'bottiglietta', 0.6625, 'f_zonzini'),
    p('p_lemonsoda', 'Lemonsoda', 'Lemonsoda 20 cl', 'Sode e succhi', 'pz', 1, 'bottiglietta', 0.496, 'f_zonzini'),
    p('p_redbull', 'Red Bull', 'Red Bull lattina 25 cl', 'Sode e succhi', 'ml', 250, 'lattina', 1.017, 'f_zonzini'),
    p('p_cocolattina', 'Latte di cocco', 'Latte di cocco in lattina 25 cl', 'Sode e succhi', 'ml', 250, 'lattina', 1.155, 'f_decafood'),
    p('p_ananas', 'Ananas', 'Succo di ananas 1 litro', 'Sode e succhi', 'ml', 1000, 'brick', 3.84, 'f_mixer'),
    p('p_passionsucco', 'Succo passion', 'Succo di frutto della passione 1 litro', 'Sode e succhi', 'ml', 1000, 'brick', 3.835, 'f_mixer'),
    p('p_fustococa', 'Coca alla spina', 'Fusto Coca-Cola 18 litri', 'Fusti', 'ml', 18000, 'fusto', 42.76, 'f_doreca'),
    p('p_fustospritz', 'Spritz alla spina', 'Fusto Spritz 20 litri', 'Fusti', 'ml', 20000, 'fusto', 59.11, 'f_imola'),
    p('p_chunk', 'Chunk 557', 'Ghiaccio Chunk 557 cartone da 16', 'Ghiaccio', 'pz', 16, 'cartone', 10.88, 'f_realice', I10),
    p('p_sfere', 'Ghiaccio a sfera', 'Ghiaccio a sfera, confezione da 4', 'Ghiaccio', 'pz', 4, 'confezione', 2.56, 'f_sunice', I10),
    p('p_passionfrutto', 'Frutto della passione', 'Frutto della passione, cassetta da 22', 'Frutta e verdura', 'pz', 22, 'cassetta', 10, 'f_gava', I4),
    // Fatti in casa (bar)
    p('p_zuccheroliq', 'Zucchero liquido', 'Zucchero liquido (fatto in casa)', CASA, 'ml', 850, 'bottiglia', 1.4, ''),
    p('p_honeymix', 'Honeymix', 'Honeymix, miele e acqua (fatto in casa)', CASA, 'ml', 500, 'bottiglia', 5, ''),
    p('p_orzata', 'Orzata', 'Orzata (fatta in casa)', CASA, 'ml', 600, 'bottiglia', 2.06, '', { allergeni: ['Frutta a guscio'] }),
    p('p_passionsciroppo', 'Sciroppo passion', 'Sciroppo di frutto della passione (fatto in casa)', CASA, 'ml', 150, 'bottiglia', 3.5, ''),
    p('p_vaniglia', 'Sciroppo vaniglia', 'Sciroppo alla vaniglia (fatto in casa)', CASA, 'ml', 1000, 'bottiglia', 4.65, ''),
    p('p_pickled', 'Pickled soda', 'Pickled soda (fatta in casa)', CASA, 'ml', 600, 'bottiglia', 2.94, ''),
    p('p_cordialgiganti', 'Cordial dei giganti', 'Cordial dei giganti (fatto in casa)', CASA, 'ml', 380, 'bottiglia', 1.82, ''),
    p('p_blendvegeta', 'Blend Vegeta', 'Blend Vegeta (fatto in casa)', CASA, 'ml', 580, 'bottiglia', 12.11, ''),
    p('p_blendsakura', 'Blend Sakura', 'Blend Sakura (fatto in casa)', CASA, 'ml', 580, 'bottiglia', 6.34, ''),
    p('p_blenderen', 'Blend Eren', 'Blend Eren (fatto in casa)', CASA, 'ml', 375, 'bottiglia', 5.5, ''),
    p('p_blenddrago', 'Blend Drago bianco', 'Blend Drago bianco (fatto in casa)', CASA, 'ml', 480, 'bottiglia', 6.12, ''),
    p('p_blendzombie', 'Blend Zombie', 'Blend Zombie (fatto in casa)', CASA, 'ml', 450, 'bottiglia', 8.73, ''),
    p('p_blendmaitai', 'Blend Mai Tai', 'Blend Mai Tai (fatto in casa)', CASA, 'ml', 500, 'bottiglia', 13.81, ''),
    p('p_blendasuka', 'Blend Asuka', 'Blend Asuka analcolico (fatto in casa)', CASA, 'ml', 970, 'bottiglia', 3.82, ''),
    p('p_blenddoraemon', 'Blend Doraemon', 'Blend Doraemon analcolico (fatto in casa)', CASA, 'ml', 1000, 'bottiglia', 5.92, ''),
    p('p_blendlong', 'Blend Long Island', 'Blend Long Island (fatto in casa)', CASA, 'ml', 750, 'bottiglia', 6.57, ''),
    p('p_blendamericano', 'Blend Americano', 'Blend Americano (fatto in casa)', CASA, 'ml', 700, 'bottiglia', 8.55, ''),
    // Cucina
    p('p_cotoletta', 'Cotoletta', 'Cotoletta di pollo impanata, cartone da 33', 'Surgelati', 'pz', 33, 'cartone', 69.96, 'f_finefood', { iva: 10, allergeni: ['Glutine', 'Uova'] }),
    p('p_wurstel', 'Würstel', 'Würstel, confezione da 14', 'Carne', 'pz', 14, 'confezione', 15.65, 'f_finefood', I10),
    p('p_panehotdog', 'Pane hot dog', 'Pane per hot dog, cartone da 48', 'Pane', 'pz', 48, 'cartone', 10.69, 'f_finefood', { iva: 4, allergeni: ['Glutine'] }),
    p('p_tortilla', 'Tortilla', 'Tortilla per wrap, confezione da 18', 'Pane', 'pz', 18, 'confezione', 5.89, 'f_metro', { iva: 4, allergeni: ['Glutine'] }),
    p('p_cipaffettate', 'Cipolla stufata', 'Cipolle affettate per stufare 2,5 kg', 'Surgelati', 'g', 2500, 'busta', 4.98, 'f_marr', I10),
    p('p_fossa', 'Formaggio di fossa', 'Formaggio di fossa (al chilo)', 'Formaggi', 'g', 1000, 'kg', 24.5, 'f_ciacia', { iva: 4, allergeni: ['Latte'] }),
    p('p_caciocavallo', 'Caciocavallo', 'Caciocavallo (al chilo)', 'Formaggi', 'g', 1000, 'kg', 9.9, 'f_marr', { iva: 4, allergeni: ['Latte'] }),
    p('p_speck', 'Speck', 'Speck (al chilo)', 'Carne', 'g', 1000, 'kg', 9.2, 'f_marr', I10),
    p('p_miele', 'Miele', 'Miele 1 kg', 'Dispensa', 'g', 1000, 'barattolo', 8.94, 'f_metro', I10),
    p('p_salsayogurt', 'Salsa yogurt', 'Salsa allo yogurt', 'Salse', 'g', 1000, 'confezione', 6.14, 'f_metro', { iva: 10, allergeni: ['Latte'] }),
    p('p_cipcaramellata', 'Cipolla caramellata', 'Cipolla caramellata (fatta in casa)', CASA, 'g', 1000, 'preparazione', 1.54, ''),
    p('p_mayogenovese', 'Mayo genovese', 'Maionese al basilico (fatta in casa)', CASA, 'g', 1000, 'preparazione', 2.3, '', { allergeni: ['Uova', 'Frutta a guscio'] }),
    p('p_guacamole', 'Guacamole', 'Guacamole 1 kg', 'Salse', 'g', 1000, 'confezione', 16.02, 'f_finefood', I10),
    p('p_nachos', 'Nachos', 'Nachos di mais (al chilo)', 'Dispensa', 'g', 1000, 'kg', 4.79, 'f_metro', I10),
    p('p_alette', 'Alette di pollo', 'Alette di pollo impanate, confezione da 56', 'Surgelati', 'pz', 56, 'confezione', 5.9, 'f_marr', { iva: 10, allergeni: ['Glutine'] }),
    p('p_anelli', 'Anelli di cipolla', 'Anelli di cipolla impanati, cartone da 275', 'Surgelati', 'pz', 275, 'cartone', 55.28, 'f_finefood', { iva: 10, allergeni: ['Glutine'] }),
    p('p_mozzarelline', 'Mozzarelline', 'Mozzarelline panate al tartufo, busta da 45', 'Surgelati', 'pz', 45, 'busta', 7.49, 'f_marr', { iva: 10, allergeni: ['Glutine', 'Latte'] }),
    p('p_halloumistick', 'Halloumi stick', 'Bastoncini di halloumi impanati, confezione da 50', 'Surgelati', 'pz', 50, 'confezione', 14.9, 'f_marr', { iva: 10, allergeni: ['Glutine', 'Latte'] }),
    p('p_gelato', 'Gelato vaniglia', 'Gelato alla vaniglia (al chilo)', 'Surgelati', 'g', 1000, 'vaschetta', 3.33, 'f_marr', { iva: 10, allergeni: ['Latte'] }),
    p('p_caramello', 'Caramello', 'Topping al caramello 1 kg', 'Dispensa', 'g', 1000, 'flacone', 9, '', { iva: 10, allergeni: ['Latte'] }),
    p('p_mistobosco', 'Frutti di bosco', 'Misto frutti di bosco surgelati 1 kg', 'Surgelati', 'g', 1000, 'busta', 4.39, 'f_marr', I10),
    p('p_brownies', 'Brownies', 'Brownies (fatti in casa, teglia da 30)', CASA, 'pz', 30, 'teglia', 17.3, '', { allergeni: ['Glutine', 'Uova', 'Latte'] }),
    p('p_cheesecake', 'Cheesecake', 'Cheesecake (fatta in casa, torta da 12 fette)', CASA, 'pz', 12, 'torta', 13.48, '', { allergeni: ['Glutine', 'Uova', 'Latte'] })
  ];

  const R = (id, nome, tipo, prezzo, righe, extra) => Object.assign({
    id, nome, tipo, prezzo, righe: righe.map(([rif, quantita, nota]) => ({ rif, quantita, nota: nota || '' })),
    resa: null, asporto: [], costiExtra: [], vendite: {}, note: ''
  }, extra || {});
  // vendite: [nov-dic 2024, 2025, gen-feb 2026, mar-ago 2026]
  const V = (a, b, c, d) => { const o = {}; [['Nov-dic 2024', a], ['2025', b], ['Gen-feb 2026', c], ['Mar-ago 2026', d]].forEach(([k, n]) => { if (n) o[k] = n; }); return { vendite: o }; };
  const V25 = (n) => ({ vendite: { '2025': n } });
  const X = (o, nota) => Object.assign({}, o || {}, nota ? { note: nota } : {});
  const ex = (nome, costo) => ({ costiExtra: [{ nome, costo }] });
  const G = ['p:p_hoshizaki', 180];
  const ASP_PANINO = [{ rif: 'p:p_portapanino', quantita: 1 }, { rif: 'p:p_busta', quantita: 1 }, { rif: 'p:p_tovagliolo', quantita: 1 }];
  const ASP_FRITTI = [{ rif: 'p:p_portafritti', quantita: 1 }, { rif: 'p:p_tovagliolo', quantita: 1 }];
  const pan = (o) => Object.assign({ asporto: ASP_PANINO }, o || {});
  const fri = (o) => Object.assign({ asporto: ASP_FRITTI, costiExtra: [{ nome: 'Sale e condimento', costo: 0.01 }] }, o || {});
  const PANE = ['p:p_pane', 80], CARNE = ['p:p_carne', 180], SPIEDO = ['p:p_spiedini', 1];
  const MANCA = 'Ricetta da completare: nel foglio «Food cost» c\'erano solo pane e carne.';

  const ricette = [
    // ---------- Drink della casa (menu manga) ----------
    R('r_vegeta', 'Vegeta', 'drink', 9, [['p:p_blendvegeta', 90], ['p:p_sfere', 1]], V(56, 103, 9, 14)),
    R('r_sakura', 'Sakura', 'drink', 10, [['p:p_blendsakura', 150], G], V(53, 113, 31, 49)),
    R('r_drago', 'Drago bianco', 'drink', 10, [['p:p_blenddrago', 60], ['p:p_prosecco', 150], G], V(25, 63, 15, 18)),
    R('r_eren', 'Eren', 'drink', 9, [['p:p_blenderen', 75], ['p:p_cordialgiganti', 50], ['p:p_chunk', 1]], V(71, 136, 15, 29)),
    R('r_fujiko', 'Fujiko', 'drink', 9, [['p:p_wiborowa', 45], ['p:p_pickled', 100], ['p:p_passionsciroppo', 10], ['p:p_tower12', 1]], V(28, 76, 26, 70)),
    R('r_asuka', 'Asuka (analcolico)', 'drink', 7, [['p:p_blendasuka', 180], G, ['p:p_passionfrutto', 0.25, 'un quarto per guarnire']], V(72, 321, 56, 104)),
    R('r_doraemon', 'Doraemon (analcolico)', 'drink', 7, [['p:p_blenddoraemon', 150], G], V(45, 220, 40, 61)),
    R('r_pollon', 'Pollon (analcolico)', 'drink', 7, [['r:r_melakiwi', 170], ['p:p_gingerschw', 90], G], V(29, 181, 32, 52)),
    R('r_holly', 'Holly e Benji (analcolico)', 'drink', 7, [['p:p_tanq0', 60], ['p:p_tonica', 1], G], V(11, 66, 12, 8)),
    // ---------- Menu mitologia ----------
    R('r_arpia', 'Arpia', 'drink', 9, [['p:p_select', 25], ['p:p_dolin', 25], ['r:r_jeegsoda', 150]]),
    R('r_medusa', 'Medusa', 'drink', 9, [['p:p_altos', 40], ['p:p_succolime', 25], ['r:r_kiwisciroppo', 15], ['p:p_chartreuse', 10]]),
    R('r_minotauro', 'Minotauro', 'drink', 9, [['p:p_beefeater', 50], ['p:p_sambuco', 15], ['p:p_cordial', 10], ['p:p_sodarosa', 150], ['p:p_chunk', 1]], ex('Guarnizione', 0.1)),
    R('r_cerbero', 'Cerbero', 'drink', 9, [['p:p_jameson', 60], ['p:p_honeymix', 10], ['p:p_banana', 20], ['p:p_cordial', 30]], ex('Guarnizione', 0.06)),
    R('r_eros', 'Eros', 'drink', 9, [['p:p_wiborowa', 40], ['p:p_succolime', 20], ['p:p_passionsucco', 15], ['p:p_passionsciroppo', 30], ['p:p_vaniglia', 10], ['p:p_prosecco', 75], ['p:p_chunk', 1]]),
    R('r_ciclope', 'Ciclope (analcolico)', 'drink', 7, [['p:p_mango', 60], ['p:p_ananas', 40], ['p:p_cocco', 20], ['p:p_cordial', 20]]),
    R('r_centauro', 'Centauro (analcolico)', 'drink', 7, [['p:p_succomela', 150], ['p:p_agave', 15], ['p:p_gingerale', 75]], ex('Guarnizione', 0.02)),
    // ---------- I più venduti ----------
    R('r_agrumi', 'Agrumi', 'drink', 10, [['p:p_wiborowa', 30], ['p:p_italicus', 25], ['p:p_cordial', 15], ['p:p_sodarosa', 100], ['p:p_tower12', 1]], V(4, 38, 9, 18)),
    R('r_rio', 'Rio', 'drink', 10, [['p:p_altos', 30], ['p:p_mezcal', 25], ['p:p_passionsciroppo', 30], ['p:p_cordial', 30], ['p:p_tower12', 1]], V(8, 31, 5, 10)),
    R('r_coconut', 'Coconut', 'drink', 10, [['p:p_altos', 45], ['p:p_cocolattina', 50], ['p:p_zuccheroliq', 10], ['p:p_banana', 20], ['p:p_cordial', 30], ['p:p_chunk', 1]], V(4, 15, 1, 6)),
    R('r_zombie', 'Zombie', 'drink', 11, [['p:p_blendzombie', 90], ['p:p_ananas', 30], ['p:p_passionsciroppo', 30], ['p:p_succolime', 60], ['p:p_zuccheroliq', 7.5], ['p:p_angostura', 2, '2 spruzzi'], ['p:p_hoshizaki', 360]], V(14, 50, 11, 37)),
    R('r_maitai', 'Mai Tai', 'drink', 9, [['p:p_blendmaitai', 75], ['p:p_orzata', 30], ['p:p_succolime', 30], ['p:p_hoshizaki', 360]], V(11, 33, 6, 9)),
    R('r_128', '128', 'drink', 8, [['p:p_chartreuse', 45], ['p:p_succolime', 15], ['p:p_gingerbeer', 120], G], V(9, 21, 3, 7)),
    R('r_kentucky', 'Kentucky mule', 'drink', 8, [['p:p_wildturkey', 50], ['p:p_succolime', 15], ['p:p_gingerbeer', 120], G], V(16, 14, 5, 10)),
    R('r_darkstormy', 'Dark \'n\' Stormy', 'drink', 8, [['p:p_gosling', 50], ['p:p_succolime', 15], ['p:p_gingerbeer', 120], G], V(10, 16, 3, 7)),
    // ---------- Classici ----------
    R('r_spritzcampari', 'Spritz Campari', 'drink', 6, [['p:p_campari', 60], ['p:p_prosecco', 150], G]),
    R('r_spritzspina', 'Spritz alla spina', 'drink', 6, [['p:p_fustospritz', 200], G]),
    R('r_hugo', 'Hugo', 'drink', 6, [['p:p_sambuco', 40], ['p:p_prosecco', 150], G]),
    R('r_americano', 'Americano', 'drink', 8, [['p:p_blendamericano', 100], G]),
    R('r_negroni', 'Negroni', 'drink', 8, [['p:p_campari', 40], ['p:p_carpano', 40], ['p:p_beefeater', 40], ['p:p_chunk', 1], G]),
    R('r_sbagliato', 'Negroni sbagliato', 'drink', 7, [['p:p_campari', 50], ['p:p_carpano', 50], ['p:p_prosecco', 50], G]),
    R('r_gtbeefeater', 'Gin tonic Beefeater', 'drink', 7, [['p:p_beefeater', 50], ['p:p_tonicaschw', 1], G]),
    R('r_ginlemon', 'Gin lemon', 'drink', 7, [['p:p_beefeater', 50], ['p:p_lemonsoda', 1], G]),
    R('r_vodkatonic', 'Vodka tonic', 'drink', 7, [['p:p_wiborowa', 50], ['p:p_tonicaschw', 1], G]),
    R('r_vodkalemon', 'Vodka lemon', 'drink', 7, [['p:p_wiborowa', 50], ['p:p_lemonsoda', 1], G]),
    R('r_moscow', 'Moscow mule', 'drink', 7, [['p:p_wiborowa', 50], ['p:p_succolime', 15], ['p:p_gingerbeer', 120], G]),
    R('r_longisland', 'Long Island', 'drink', 7, [['p:p_blendlong', 75], ['p:p_succolime', 30], ['p:p_fustococa', 60], G]),
    R('r_cubalibre', 'Cuba libre', 'drink', 7, [['p:p_havana', 50], ['p:p_succolime', 15], ['p:p_fustococa', 150], G]),
    R('r_cocarum', 'Coca e rum', 'drink', 7, [['p:p_havanaesp', 50], ['p:p_fustococa', 150], G]),
    R('r_jackcoca', 'Jack e coca', 'drink', 8, [['p:p_jack', 50], ['p:p_fustococa', 150], G]),
    R('r_fernandito', 'Fernandito', 'drink', 7, [['p:p_fernet', 50], ['p:p_fustococa', 150], G]),
    R('r_jagerbull', 'Jäger e Red Bull', 'drink', 8, [['p:p_jager', 50], ['p:p_redbull', 150], G]),
    R('r_vodkabull', 'Vodka e Red Bull', 'drink', 8, [['p:p_wiborowa', 50], ['p:p_redbull', 120], G]),
    R('r_mojito', 'Mojito', 'drink', 7, [['p:p_havana', 50], ['p:p_succolime', 30], ['p:p_zuccheroliq', 20], G], X(null, 'Nel foglio la menta non era contata.')),
    R('r_daiquiri', 'Daiquiri', 'drink', 7, [['p:p_havana', 60], ['p:p_succolime', 30], ['p:p_zuccheroliq', 20], G]),
    R('r_caipiroska', 'Caipiroska al passion', 'drink', 7, [['p:p_wiborowa', 50], ['p:p_succolime', 25], ['p:p_passionsciroppo', 30], ['p:p_passionfrutto', 1], G]),
    R('r_margarita', 'Margarita', 'drink', 7, [['p:p_altos', 50], ['p:p_succolime', 30], ['p:p_aurum', 15], G]),
    R('r_tommys', 'Tommy\'s margarita', 'drink', 8, [['p:p_altos', 60], ['p:p_agave', 25], ['p:p_succolime', 30], ['p:p_chunk', 1], G]),
    R('r_paloma', 'Paloma', 'drink', 7, [['p:p_altos', 50], ['p:p_succolime', 15], ['p:p_agave', 10], ['p:p_sodarosa', 120], G]),
    R('r_oldfashioned', 'Old fashioned', 'drink', 8, [['p:p_wildturkey', 60], ['p:p_zuccheroliq', 10], ['p:p_angostura', 10, '10 spruzzi'], ['p:p_chunk', 1]]),
    R('r_ginfizz', 'Gin fizz', 'drink', 8, [['p:p_beefeater', 60], ['p:p_succolime', 40], ['p:p_zuccheroliq', 30], ['p:p_hoshizaki', 360]]),
    R('r_jamaican', 'Jamaican best', 'drink', 8, [['p:p_wray', 45], ['p:p_sodarosa', 120], ['p:p_succolime', 15], ['p:p_zuccheroliq', 10], G]),
    R('r_blackrussian', 'Black russian', 'drink', 7, [['p:p_wiborowa', 60], ['p:p_kahlua', 35], ['p:p_chunk', 1], G]),
    R('r_pinacolada', 'Piña colada', 'drink', 7, [['p:p_havana', 50], ['p:p_succolime', 10], ['p:p_cocco', 30], ['p:p_ananas', 100], G]),
    R('r_martini', 'Martini cocktail', 'drink', 7, [['p:p_plymouth', 60], ['p:p_dolin', 15], G]),

    // ---------- Panini ----------
    R('r_americanoburger', 'Americano', 'panino', 11.5, [PANE, CARNE, SPIEDO], pan(X(V25(1181), MANCA))),
    R('r_tyson', 'Tyson', 'panino', 12.5, [PANE, CARNE, SPIEDO], pan(X(V25(1127), MANCA))),
    R('r_oklahoma', 'Oklahoma', 'panino', 12.5, [PANE, CARNE, SPIEDO], pan(X(null, MANCA))),
    R('r_bauscia', 'Bauscia', 'panino', 12, [PANE, CARNE, SPIEDO], pan(X(null, MANCA))),
    R('r_bibitaro', 'Bibitaro', 'panino', 12, [PANE, CARNE, SPIEDO], pan(X(null, MANCA))),
    R('r_gianduyotto', 'Gianduyotto', 'panino', 12, [PANE, CARNE, SPIEDO], pan(X(null, MANCA))),
    R('r_hamburger', 'Hamburger', 'panino', 10.5, [PANE, CARNE, ['p:p_insalata', 40], ['p:p_pomodoro', 25], ['p:p_cipaffettate', 35, 'stufata'], SPIEDO], pan(V25(239))),
    R('r_cheese', 'Cheese', 'panino', 10.5, [PANE, CARNE, ['p:p_cheddar', 2, 'fette'], ['p:p_insalata', 40], ['p:p_pomodoro', 25], ['p:p_cipaffettate', 25, 'stufata'], SPIEDO], pan(X(V25(366), 'Le 2 fette di cheddar le ho aggiunte io: nel foglio mancavano.'))),
    R('r_bacon', 'Bacon', 'panino', 10.5, [PANE, CARNE, ['p:p_bacon', 35], ['p:p_insalata', 40], ['p:p_pomodoro', 25], ['p:p_cipaffettate', 35, 'stufata'], SPIEDO], pan(X(V25(163), 'Il bacon (35 g come nel Cheesebacon) l\'ho aggiunto io: nel foglio mancava.'))),
    R('r_blt', 'BLT', 'panino', 11.5, [PANE, ['p:p_cotoletta', 1], ['p:p_insalata', 40], ['p:p_pomodoro', 25], ['p:p_baconnaise', 30], SPIEDO], pan(V25(978))),
    R('r_chicken', 'Chicken burger', 'panino', 11.5, [PANE, ['p:p_cotoletta', 1], ['p:p_insalata', 40], ['p:p_pomodoro', 25], ['p:p_salsayogurt', 30], SPIEDO], pan(V25(185))),
    R('r_ciaccia', 'Ciaccia', 'panino', 12.5, [PANE, CARNE, ['p:p_fossa', 40], ['p:p_speck', 30], ['p:p_miele', 25], ['p:p_cipaffettate', 10, 'stufata'], SPIEDO], pan(V25(413))),
    R('r_kaciotto', 'Kaciotto', 'panino', 12, [PANE, ['p:p_caciocavallo', 50], ['p:p_cipcaramellata', 40], ['p:p_mayogenovese', 25], SPIEDO], pan(Object.assign(ex('Porzione (come nel foglio)', 2.2), { note: 'Nel foglio c\'era una «porzione» da 2,20 € senza dire cosa fosse: sostituiscila con l\'ingrediente giusto.' }))),
    R('r_hotdogo', 'Hot Dogo', 'panino', 10, [['p:p_panehotdog', 1], ['p:p_wurstel', 1], SPIEDO], pan(X(V25(250), 'Ho preso pane e würstel dal foglio «Food pezzo»: le salse sono da aggiungere.'))),
    R('r_bitcoin', 'Bitcoin (vegetariano)', 'panino', 12, [PANE, SPIEDO], pan(X(V25(349), 'Ricetta da completare: nel foglio mancava il burger vegetale.'))),
    R('r_pitagora', 'Pitagora (vegetariano)', 'panino', 12, [PANE, SPIEDO], pan(X(null, 'Ricetta da completare: nel foglio mancava il burger vegetale.'))),
    R('r_dondiego', 'Don Diego (vegano)', 'panino', 12, [PANE, SPIEDO], pan(X(null, 'Ricetta da completare: nel foglio mancava il burger vegano.'))),
    R('r_wrap', 'Wrap', 'panino', 10, [['p:p_tortilla', 1], ['p:p_cotoletta', 1], ['p:p_insalata', 40], ['p:p_pomodoro', 25], ['p:p_salsayogurt', 30]], pan(X(V25(71), 'Nel foglio il wrap era vuoto: ho messo tortilla, cotoletta, insalata, pomodoro e salsa yogurt, da controllare.'))),
    R('r_babyh', 'Baby H', 'panino', 8, [['p:p_pane', 50], ['p:p_carne', 90], ['p:p_patatine', 160], ['p:p_olio', 160, 'patatine'], SPIEDO], X(null, 'Menu bambini con patatine.')),
    R('r_babycheese', 'Baby cheese', 'panino', 9, [['p:p_pane', 50], ['p:p_carne', 90], ['p:p_cheddar', 1, 'fetta'], ['p:p_patatine', 160], ['p:p_olio', 160, 'patatine'], SPIEDO], X(null, 'Menu bambini con patatine.')),
    R('r_babybacon', 'Baby bacon', 'panino', 9, [['p:p_pane', 50], ['p:p_carne', 90], ['p:p_bacon', 20], ['p:p_patatine', 160], ['p:p_olio', 160, 'patatine'], SPIEDO], X(null, 'Menu bambini con patatine.')),
    R('r_babycb', 'Baby cheesebacon', 'panino', 9, [['p:p_pane', 50], ['p:p_carne', 90], ['p:p_cheddar', 1, 'fetta'], ['p:p_bacon', 20], ['p:p_patatine', 160], ['p:p_olio', 160, 'patatine'], SPIEDO], X(null, 'Menu bambini con patatine.')),
    R('r_cotolettapatate', 'Cotoletta e patate', 'panino', 10, [['p:p_cotoletta', 1], ['p:p_patatine', 160], ['p:p_olio', 160, 'patatine']], X(null, 'Piatto, non panino: lo tengo qui per comodità.')),

    // ---------- Fritti ----------
    R('r_alette', 'Alette di pollo (5)', 'fritto', 5.5, [['p:p_alette', 5], ['p:p_olio', 200], ['p:p_antigrasso', 1]], fri()),
    R('r_anelli', 'Anelli di cipolla (5)', 'fritto', 5.5, [['p:p_anelli', 5], ['p:p_olio', 150], ['p:p_antigrasso', 1]], fri(V25(354))),
    R('r_anelli10', 'Anelli di cipolla (10)', 'fritto', 10, [['p:p_anelli', 10], ['p:p_olio', 300], ['p:p_antigrasso', 1]], fri(V25(12))),
    R('r_mozzarelline', 'Mozzarelline al tartufo (5)', 'fritto', 5.5, [['p:p_mozzarelline', 5], ['p:p_olio', 150], ['p:p_antigrasso', 1]], fri(V25(399))),
    R('r_mozzarelline10', 'Mozzarelline al tartufo (10)', 'fritto', 10, [['p:p_mozzarelline', 10], ['p:p_olio', 300], ['p:p_antigrasso', 1]], fri(V25(15))),
    R('r_halloumistick', 'Halloumi stick (5)', 'fritto', 5.5, [['p:p_halloumistick', 5], ['p:p_olio', 150], ['p:p_antigrasso', 1]], fri()),
    R('r_bocconcini10', 'Bocconcini (10)', 'fritto', 10, [['p:p_bocconcini', 10], ['p:p_olio', 400], ['p:p_antigrasso', 1]], fri()),
    R('r_jalapenos10', 'Jalapeños (10)', 'fritto', 11, [['p:p_jalapenos', 10], ['p:p_olio', 400], ['p:p_antigrasso', 1]], fri(V25(22))),
    R('r_misto', 'Misto fritto (15)', 'fritto', 14.5, [['p:p_bocconcini', 3], ['p:p_jalapenos', 3], ['p:p_mozzarelline', 3], ['p:p_anelli', 3], ['p:p_alette', 3], ['p:p_olio', 550], ['p:p_antigrasso', 1]], fri(X(V25(329), 'Tre pezzi per tipo: nel foglio i 15 pezzi costavano 4,26 €, come qui (olio escluso).'))),
    R('r_mistoxxl', 'Misto fritto XXL (30)', 'fritto', 19.5, [['r:r_misto', 2]], { asporto: ASP_FRITTI, vendite: { '2025': 117 } }),
    R('r_nachos', 'Nachos con guacamole', 'fritto', 6, [['p:p_nachos', 100], ['p:p_guacamole', 60], ['p:p_pomodoro', 10], ['p:p_cipolla', 5]], { asporto: ASP_FRITTI, vendite: { '2025': 362 } }),
    R('r_patatinespecial', 'Patatine special', 'fritto', 6, [['p:p_patatine', 330], ['p:p_baconcr', 15], ['p:p_olio', 255], ['p:p_antigrasso', 1]], fri(V25(1536))),
    R('r_patatinepasticciate', 'Patatine pasticciate', 'fritto', 6, [['p:p_patatine', 330], ['p:p_olio', 255], ['p:p_antigrasso', 1]], fri(X(null, 'Ricetta da completare: nel foglio mancava il condimento che le «pasticcia».'))),

    // ---------- Dolci ----------
    R('r_browniesgelato', 'Brownies con gelato', 'dolce', 6, [['p:p_brownies', 1], ['p:p_gelato', 60], ['p:p_caramello', 10]]),
    R('r_cheesecakefrutti', 'Cheesecake ai frutti di bosco', 'dolce', 5, [['p:p_cheesecake', 1], ['p:p_mistobosco', 30]]),
    R('r_cheesecakecaramello', 'Cheesecake al caramello', 'dolce', 5, [['p:p_cheesecake', 1], ['p:p_caramello', 15]]),

    // ---------- Con patatine ----------
    R('r_cheesebaconpata', 'Cheesebacon con patatine', 'combo', 13, [['r:r_cheesebacon', 1], ['r:r_patatine', 1]], V25(119)),
    R('r_realepata', 'Reale con patatine', 'combo', 14.5, [['r:r_reale', 1], ['r:r_patatine', 1]], V25(85)),
    R('r_resmashpata', 'Resmash con patatine', 'combo', 14.5, [['r:r_resmash', 1], ['r:r_patatine', 1]], V25(77)),
    R('r_americanopata', 'Americano con patatine', 'combo', 14, [['r:r_americanoburger', 1], ['r:r_patatine', 1]], V25(101)),
    R('r_tysonpata', 'Tyson con patatine', 'combo', 15, [['r:r_tyson', 1], ['r:r_patatine', 1]], V25(66)),
    R('r_oklahomapata', 'Oklahoma con patatine', 'combo', 15, [['r:r_oklahoma', 1], ['r:r_patatine', 1]], V25(126)),
    R('r_blTpata', 'BLT con patatine', 'combo', 14, [['r:r_blt', 1], ['r:r_patatine', 1]], V25(41)),
    R('r_wrappata', 'Wrap con patatine', 'combo', 12.5, [['r:r_wrap', 1], ['r:r_patatine', 1]], V25(495))
  ];

  // i dati di partenza (per chi comincia da zero) prendono anche queste
  const D0 = window.DATI_INIZIALI;
  if (D0) {
    fornitori.forEach(x => { if (!D0.fornitori.some(y => y.id === x.id)) D0.fornitori.push(x); });
    prodotti.forEach(x => { if (!D0.prodotti.some(y => y.id === x.id)) D0.prodotti.push(x); });
    ricette.forEach(x => { if (!D0.ricette.some(y => y.id === x.id)) D0.ricette.push(x); });
    D0.impostazioni.soglie.dolce = D0.impostazioni.soglie.dolce || 3.5;
    D0.versioneRicette = 2;
  }
  return { versione: 2, fornitori, prodotti, ricette };
})();
