// Dati di partenza della prova, ripresi dal foglio «Drink & food cost repub 2024-25-26».
// Prezzi senza IVA, come nel foglio. Data dei prezzi: quella del foglio.
window.DATI_INIZIALI = (function () {
  const D = '2026-11-01';
  const F = (id, nome, extra) => Object.assign({ id, nome, piva: '', telefono: '', email: '', referente: '', giorniConsegna: '', note: '' }, extra || {});
  const fornitori = [
    F('f_zonzini', 'Zonzini', { giorniConsegna: '' }),
    F('f_turci', 'Turci'),
    F('f_ciacia', 'Ciacia'),
    F('f_doreca', 'Doreca'),
    F('f_mixer', 'Mixer'),
    F('f_mix', 'Mix'),
    F('f_sebar', 'Sebar'),
    F('f_partesa', 'Partesa'),
    F('f_realice', 'Real ice'),
    F('f_gava', 'Gava'),
    F('f_fontetto', 'Fontetto', { piva: '' }),
    F('f_casalini', 'Casalini'),
    F('f_marr', 'Marr'),
    F('f_finefood', 'Fine food'),
    F('f_metro', 'Metro'),
    F('f_pieri', 'Pieri')
  ];

  // p(id, nomeBreve, nomeCompleto, categoria, unita, contenuto, confezione, prezzo, fornitoreId, extra)
  function p(id, nomeBreve, nomeCompleto, categoria, unita, contenuto, confezione, prezzo, fornitoreId, extra) {
    const o = {
      id, nomeBreve, nomeCompleto, categoria, unita, contenuto, confezione,
      iva: 22, giacenza: 0, scortaMinima: 0, resa: 100, allergeni: [],
      venditaDiretta: null, fornitoreId: fornitoreId || '', articoli: [],
      prezzi: prezzo != null ? [{ data: D, fornitoreId: fornitoreId || '', prezzo, origine: 'Foglio 2024-26' }] : [],
      note: '', interno: !fornitoreId
    };
    return Object.assign(o, extra || {});
  }
  const SOLF = ['Solfiti'];
  const prodotti = [
    // Distillati, liquori, vini
    p('p_altos', 'Altos blanco', 'Tequila Altos Plata 70 cl', 'Tequila e mezcal', 'ml', 700, 'bottiglia', 18.9, 'f_turci', { giacenza: 4.7, scortaMinima: 2 }),
    p('p_plymouth', 'Plymouth', 'Gin Plymouth 1 litro', 'Gin', 'ml', 1000, 'bottiglia', 23.9, 'f_turci', { giacenza: 1.8, scortaMinima: 1 }),
    p('p_beefeater', 'Beefeater', 'Gin Beefeater 1 litro', 'Gin', 'ml', 1000, 'bottiglia', 11.21, 'f_turci', { giacenza: 14.5, scortaMinima: 6 }),
    p('p_hendricks', "Hendrick's", "Gin Hendrick's 1 litro", 'Gin', 'ml', 1000, 'bottiglia', 33.3, 'f_zonzini', { giacenza: 3.7, scortaMinima: 2, articoli: [{ fornitoreId: 'f_zonzini', codice: 'HEN1000', descrizione: "GIN HENDRICK'S LT 1", confezioniPerUnita: 1 }] }),
    p('p_ginmare', 'Gin Mare', 'Gin Mare 1 litro', 'Gin', 'ml', 1000, 'bottiglia', 34.2, 'f_zonzini', { giacenza: 4.3, scortaMinima: 2 }),
    p('p_malfy', 'Malfy rosa', 'Gin Malfy Rosa 70 cl', 'Gin', 'ml', 700, 'bottiglia', 21.06, 'f_turci', { giacenza: 6.5, scortaMinima: 2 }),
    p('p_monkey', 'Monkey 47', 'Gin Monkey 47 50 cl', 'Gin', 'ml', 500, 'bottiglia', 33.9, 'f_turci', { giacenza: 1.4, scortaMinima: 1 }),
    p('p_wiborowa', 'Wiborowa', 'Vodka Wiborowa 1 litro', 'Vodka', 'ml', 1000, 'bottiglia', 8.65, 'f_turci', { giacenza: 6.2, scortaMinima: 4 }),
    p('p_havana', 'Havana 3', 'Rum Havana Club 3 anni 1 litro', 'Rum e cachaça', 'ml', 1000, 'bottiglia', 12.7, 'f_turci', { giacenza: 4.9, scortaMinima: 3 }),
    p('p_cachaca', 'Cachaça Janeiro', 'Cachaça Janeiro 70 cl', 'Rum e cachaça', 'ml', 700, 'bottiglia', 11.4, 'f_turci', { giacenza: 0.5, scortaMinima: 1 }),
    p('p_aperol', 'Aperol', 'Aperol 1 litro', 'Bitter e vermouth', 'ml', 1000, 'bottiglia', 11.55, 'f_zonzini', { giacenza: 8.9, scortaMinima: 10, articoli: [{ fornitoreId: 'f_zonzini', codice: 'APE1000', descrizione: 'APEROL LT 1 CT 6', confezioniPerUnita: 6 }] }),
    p('p_campari', 'Campari', 'Campari Bitter 1 litro', 'Bitter e vermouth', 'ml', 1000, 'bottiglia', 14.7, 'f_zonzini', { giacenza: 30.2, scortaMinima: 6 }),
    p('p_carpano', 'Carpano', 'Vermouth Carpano Classico 1 litro', 'Bitter e vermouth', 'ml', 1000, 'bottiglia', 9.1, 'f_zonzini', { giacenza: 13.2, scortaMinima: 4 }),
    p('p_montenegro', 'Montenegro', 'Amaro Montenegro 1 litro', 'Amari e liquori', 'ml', 1000, 'bottiglia', 18.4, 'f_zonzini', { giacenza: 2, scortaMinima: 1, venditaDiretta: { nomePorzione: 'bicchierino', porzione: 50, prezzoPorzione: 3.5, prezzoIntero: null } }),
    p('p_jefferson', 'Jefferson', 'Amaro Jefferson 70 cl', 'Amari e liquori', 'ml', 700, 'bottiglia', 22.5, 'f_zonzini', { giacenza: 1.5, scortaMinima: 1, venditaDiretta: { nomePorzione: 'bicchierino', porzione: 50, prezzoPorzione: 3.5, prezzoIntero: null } }),
    p('p_prosecco', 'Prosecco', 'Prosecco 75 cl', 'Vino', 'ml', 750, 'bottiglia', 5.85, 'f_ciacia', { giacenza: 27, scortaMinima: 24, allergeni: SOLF, venditaDiretta: { nomePorzione: 'calice', porzione: 150, prezzoPorzione: 5, prezzoIntero: 18 } }),
    p('p_mazapegul', 'Mazapegul', 'Mazapegul Sangiovese 75 cl', 'Vino', 'ml', 750, 'bottiglia', 7.5, 'f_ciacia', { giacenza: 5, scortaMinima: 3, allergeni: SOLF, venditaDiretta: { nomePorzione: 'calice', porzione: 150, prezzoPorzione: 5, prezzoIntero: 18 } }),
    p('p_sangue', 'Sangue di Giuda', 'Sangue di Giuda 75 cl', 'Vino', 'ml', 750, 'bottiglia', 3.25, 'f_ciacia', { giacenza: 5, scortaMinima: 3, allergeni: SOLF, venditaDiretta: { nomePorzione: 'calice', porzione: 150, prezzoPorzione: 5, prezzoIntero: null } }),
    // Mixer, succhi, fatti in casa
    p('p_sodarosa', 'Soda rosa', 'Soda al pompelmo rosa 20 cl', 'Sode e succhi', 'ml', 200, 'bottiglia', 1.03, 'f_doreca', { giacenza: 70, scortaMinima: 24 }),
    p('p_tonica', 'Tonica Goldberg', 'Tonica Goldberg 15 cl', 'Sode e succhi', 'pz', 1, 'bottiglietta', 0.75, 'f_partesa', { giacenza: 48, scortaMinima: 24, articoli: [{ fornitoreId: 'f_partesa', codice: '', descrizione: 'GOLDBERG TONIC 15CL CT 24', confezioniPerUnita: 24 }] }),
    p('p_mango', 'Mango', 'Purea di mango 1 litro', 'Sode e succhi', 'ml', 1000, 'brick', 3.835, 'f_mixer', { giacenza: 26, scortaMinima: 6 }),
    p('p_succomela', 'Succo di mela', 'Succo di mela 1 litro', 'Sode e succhi', 'ml', 1000, 'brick', 2.9, 'f_mix', { giacenza: 2, scortaMinima: 4 }),
    p('p_cocco', 'Cocco Real', 'Cocco Real crema di cocco 50 cl', 'Sode e succhi', 'ml', 500, 'flacone', 8.21, 'f_sebar', { giacenza: 1, scortaMinima: 2, note: 'Nel foglio era l\'unico con IVA al 22% già messa nel «prezzo finito».' }),
    p('p_granatina', 'Granatina', 'Granatina (fatta in casa)', 'Fatti in casa', 'ml', 5000, 'tanica', 10, '', { giacenza: 0.5 }),
    p('p_cordial', 'Cordial lime', 'Cordial al lime (fatto in casa)', 'Fatti in casa', 'ml', 1000, 'bottiglia', 0.397, '', { note: 'Nel foglio costa 0,40 € al litro: sembra basso, da verificare.' }),
    p('p_succolime', 'Succo di lime', 'Succo di lime spremuto', 'Fatti in casa', 'ml', 500, 'bottiglia', 4, '', {}),
    p('p_lamponi', 'Lamponi', 'Lamponi freschi (al chilo)', 'Frutta e verdura', 'g', 1000, 'kg', 28, 'f_gava', { iva: 4 }),
    p('p_kiwi', 'Kiwi', 'Kiwi (al chilo)', 'Frutta e verdura', 'g', 1000, 'kg', 3.2, 'f_gava', { iva: 4 }),
    p('p_zucchero', 'Zucchero', 'Zucchero semolato buste da 1 kg', 'Dispensa', 'g', 1000, 'kg', 1.3, 'f_zonzini', { iva: 10 }),
    // Ghiaccio
    p('p_hoshizaki', 'Ghiaccio', 'Ghiaccio Hoshizaki cartone 6 sacchi da 2,5 kg', 'Ghiaccio', 'g', 15000, 'cartone', 11.25, 'f_realice', { iva: 10 }),
    p('p_tower10', 'Tower 4410', 'Ghiaccio Tower 4410 cartone da 15', 'Ghiaccio', 'pz', 15, 'cartone', 11.25, 'f_realice', { iva: 10 }),
    p('p_tower12', 'Tower 4412', 'Ghiaccio Tower 4412 cartone da 11', 'Ghiaccio', 'pz', 11, 'cartone', 8.25, 'f_realice', { iva: 10 }),
    // Cucina
    p('p_pane', 'Pane burger', 'Pane per hamburger (al chilo)', 'Pane', 'g', 1000, 'kg', 2.1, 'f_casalini', { iva: 4, allergeni: ['Glutine'] }),
    p('p_carne', 'Carne', 'Hamburger di bovino (al chilo)', 'Carne', 'g', 1000, 'kg', 9.65, 'f_fontetto', { iva: 10, scortaMinima: 0, articoli: [{ fornitoreId: 'f_fontetto', codice: 'HB180', descrizione: 'HAMBURGER BOVINO 180 G KG', confezioniPerUnita: 1 }] }),
    p('p_cheddar', 'Cheddar', 'Cheddar a fette, confezione da 176', 'Formaggi', 'pz', 176, 'confezione', 19.5, 'f_marr', { iva: 10, allergeni: ['Latte'], note: 'Nel foglio «Food cost» il cheddar non aveva il prezzo al grammo: per questo Resmash e Cheesebacon non avevano un costo. Qui si conta a fette.' }),
    p('p_halloumi', 'Halloumi', 'Halloumi (pezzo da 4,5 kg)', 'Formaggi', 'g', 4500, 'confezione', 68.67, 'f_finefood', { iva: 10, allergeni: ['Latte'] }),
    p('p_scamorza', 'Scamorza', 'Scamorza affumicata (al chilo)', 'Formaggi', 'g', 1000, 'kg', 7.95, 'f_marr', { iva: 10, allergeni: ['Latte'] }),
    p('p_bacon', 'Bacon', 'Pancetta affumicata a fette (al chilo)', 'Carne', 'g', 1000, 'kg', 8.59, 'f_marr', { iva: 10 }),
    p('p_guanciale', 'Guanciale', 'Guanciale (al chilo)', 'Carne', 'g', 1000, 'kg', 9.29, 'f_marr', { iva: 10 }),
    p('p_baconcr', 'Bacon croccante', 'Bacon fritto croccante (fatto in casa)', 'Fatti in casa', 'g', 1000, 'kg', 49.36, '', { note: 'Costo ripreso dal foglio (0,35 € per 7 g).' }),
    p('p_insalata', 'Insalata', 'Insalata brasiliana (al chilo)', 'Frutta e verdura', 'g', 1000, 'kg', 2.9, 'f_gava', { iva: 4 }),
    p('p_pomodoro', 'Pomodoro', 'Pomodoro a grappolo (al chilo)', 'Frutta e verdura', 'g', 1000, 'kg', 2.5, 'f_gava', { iva: 4 }),
    p('p_cipolla', 'Cipolla', 'Cipolla bianca (al chilo)', 'Frutta e verdura', 'g', 1000, 'kg', 0.7, 'f_gava', { iva: 4 }),
    p('p_cipcrispy', 'Cipolla crispy', 'Cipolla sbriciolata croccante 5 kg', 'Dispensa', 'g', 5000, 'confezione', 34, 'f_finefood', { iva: 10, allergeni: ['Glutine'] }),
    p('p_cetriolini', 'Cetriolini', 'Cetriolini in agrodolce 1,55 kg', 'Dispensa', 'g', 1550, 'barattolo', 5.79, 'f_marr', { iva: 10 }),
    p('p_baconnaise', 'Baconnaise', 'Salsa Baconnaise 880 g', 'Salse', 'g', 880, 'barattolo', 6.09, 'f_metro', { iva: 10, allergeni: ['Uova', 'Senape'] }),
    p('p_salsagrana', 'Salsa grana e tartufo', 'Salsa grana e tartufo (fatta in casa)', 'Fatti in casa', 'g', 1250, 'preparazione', 8.95, '', { allergeni: ['Latte', 'Uova'] }),
    p('p_senapemiele', 'Senape e miele', 'Salsa senape e miele (fatta in casa)', 'Fatti in casa', 'g', 700, 'preparazione', 2.75, '', { allergeni: ['Senape', 'Uova'] }),
    p('p_patatine', 'Patatine', 'Patatine fritte surgelate (al chilo)', 'Surgelati', 'g', 1000, 'kg', 1.99, 'f_marr', { iva: 10 }),
    p('p_patamericane', 'Patate americane', 'Patate americane con buccia (al chilo)', 'Surgelati', 'g', 1000, 'kg', 4.29, 'f_marr', { iva: 10 }),
    p('p_bocconcini', 'Bocconcini di pollo', 'Bocconcini di pollo impanati, cartone da 300', 'Surgelati', 'pz', 300, 'cartone', 128, 'f_finefood', { iva: 10, allergeni: ['Glutine'] }),
    p('p_jalapenos', 'Jalapeños', 'Jalapeños ripieni al formaggio, confezione da 25', 'Surgelati', 'pz', 25, 'confezione', 12.99, 'f_marr', { iva: 10, allergeni: ['Glutine', 'Latte'] }),
    p('p_olio', 'Olio di frittura', 'Olio di frittura (costo per grammo di cibo fritto)', 'Dispensa', 'g', 1, 'grammo fritto', null, '', { speciale: 'olio', note: 'Il costo si calcola da solo in «Costo olio»: spesa annua divisa per i grammi fritti in un anno.' }),
    // Materiale non alimentare
    p('p_portapanino', 'Porta panino', 'Porta panino, confezione da 50', 'Non alimentare', 'pz', 50, 'confezione', 10.98, 'f_pieri'),
    p('p_portafritti', 'Porta fritti', 'Porta fritti, confezione da 50', 'Non alimentare', 'pz', 50, 'confezione', 7.6, 'f_pieri'),
    p('p_antigrasso', 'Carta antigrasso', 'Carta antigrasso, confezione da 500', 'Non alimentare', 'pz', 500, 'confezione', 18.59, 'f_pieri'),
    p('p_spiedini', 'Spiedini bambù', 'Spiedini di bambù, confezione da 200', 'Non alimentare', 'pz', 200, 'confezione', 4.85, 'f_pieri'),
    p('p_tovagliolo', 'Tovagliolo', 'Tovagliolo 38x38, confezione da 40', 'Non alimentare', 'pz', 40, 'confezione', 1.29, 'f_pieri'),
    p('p_busta', 'Busta asporto', 'Busta Dely grande, confezione da 250', 'Non alimentare', 'pz', 250, 'confezione', 60.73, 'f_pieri'),
    p('p_bicchiere400', 'Bicchiere plastica 400', 'Bicchiere in plastica 400 ml, confezione da 50', 'Non alimentare', 'pz', 50, 'confezione', 2.51, 'f_pieri'),
    p('p_sacconero', 'Sacco nero', 'Sacchi immondizia neri, rotolo da 10', 'Non alimentare', 'pz', 10, 'rotolo', 1.54, 'f_pieri', { giacenza: 3, scortaMinima: 5 }),
    p('p_saccobianco', 'Sacco bianco', 'Sacchi immondizia bianchi, rotolo da 20', 'Non alimentare', 'pz', 20, 'rotolo', 2.37, 'f_pieri', { giacenza: 6, scortaMinima: 4 })
  ];

  const R = (id, nome, tipo, prezzo, righe, extra) => Object.assign({
    id, nome, tipo, prezzo, righe: righe.map(([rif, quantita, nota]) => ({ rif, quantita, nota: nota || '' })),
    resa: null, asporto: [], costiExtra: [], vendite: {}, note: ''
  }, extra || {});
  const ASP_PANINO = [{ rif: 'p:p_portapanino', quantita: 1 }, { rif: 'p:p_busta', quantita: 1 }, { rif: 'p:p_tovagliolo', quantita: 1 }];
  const ASP_FRITTI = [{ rif: 'p:p_portafritti', quantita: 1 }, { rif: 'p:p_tovagliolo', quantita: 1 }];
  const ricette = [
    // Preparazioni (semilavorati)
    R('r_jeegsoda', 'Jeeg soda', 'semilavorato', null, [['p:p_lamponi', 75], ['p:p_sodarosa', 400], ['p:p_cordial', 140], ['p:p_granatina', 120]], { resa: 1060, unita: 'ml' }),
    R('r_kiwisciroppo', 'Sciroppo di kiwi', 'semilavorato', null, [['p:p_kiwi', 300], ['p:p_zucchero', 260]], { resa: 320, unita: 'ml' }),
    R('r_melakiwi', 'Mela kiwi soda', 'semilavorato', null, [['r:r_kiwisciroppo', 90], ['p:p_succomela', 420], ['p:p_cordial', 240]], { resa: 750, unita: 'ml' }),
    R('r_blendnami', 'Blend Nami', 'semilavorato', null, [['p:p_cachaca', 250], ['p:p_mango', 350], ['p:p_cocco', 100]], { resa: 700, unita: 'ml' }),
    // Drink
    R('r_jeeg', 'Jeeg robot', 'drink', 10, [['p:p_altos', 45], ['r:r_jeegsoda', 120], ['p:p_tower12', 1]], { vendite: { 'Nov-dic 2024': 75, '2025': 153, 'Gen-feb 2026': 40, 'Mar-ago 2026': 64 } }),
    R('r_kenshiro', 'Kenshiro', 'drink', 9, [['p:p_plymouth', 45], ['r:r_melakiwi', 120], ['p:p_tower10', 1]], { vendite: { 'Nov-dic 2024': 79, '2025': 173, 'Gen-feb 2026': 20, 'Mar-ago 2026': 48 } }),
    R('r_nami', 'Nami', 'drink', 10, [['r:r_blendnami', 140], ['p:p_succolime', 20], ['p:p_hoshizaki', 180]], { vendite: { 'Nov-dic 2024': 57, '2025': 147, 'Gen-feb 2026': 24, 'Mar-ago 2026': 51 } }),
    R('r_spritz', 'Spritz Aperol', 'drink', 6, [['p:p_aperol', 75], ['p:p_prosecco', 150], ['p:p_hoshizaki', 180]], { vendite: { '2025': 182 } }),
    R('r_gthendricks', "Gin tonic Hendrick's", 'premium', 10, [['p:p_hendricks', 50], ['p:p_tonica', 1], ['p:p_hoshizaki', 180]]),
    R('r_gtmare', 'Gin tonic Gin Mare', 'premium', 10, [['p:p_ginmare', 50], ['p:p_tonica', 1], ['p:p_hoshizaki', 180]]),
    R('r_gtmalfy', 'Gin tonic Malfy rosa', 'premium', 10, [['p:p_malfy', 50], ['p:p_tonica', 1], ['p:p_hoshizaki', 180]]),
    R('r_gtmonkey', 'Gin tonic Monkey 47', 'premium', 11, [['p:p_monkey', 50], ['p:p_tonica', 1], ['p:p_hoshizaki', 180]]),
    // Panini
    R('r_crispy', 'Crispy', 'panino', 12.5, [['p:p_pane', 80], ['p:p_carne', 180], ['p:p_halloumi', 35], ['p:p_baconcr', 7], ['p:p_olio', 60, 'halloumi fritto'], ['p:p_cipcrispy', 10], ['p:p_baconnaise', 30], ['p:p_spiedini', 1]], { asporto: ASP_PANINO, vendite: { '2025': 1928 } }),
    R('r_reale', 'Reale', 'panino', 12, [['p:p_pane', 80], ['p:p_carne', 180], ['p:p_scamorza', 40], ['p:p_guanciale', 25], ['p:p_insalata', 40], ['p:p_salsagrana', 25], ['p:p_spiedini', 1]], { asporto: ASP_PANINO, vendite: { '2025': 1125 } }),
    R('r_resmash', 'Resmash', 'panino', 12, [['p:p_pane', 80], ['p:p_carne', 180], ['p:p_cheddar', 2, 'fette'], ['p:p_bacon', 35], ['p:p_cipolla', 25], ['p:p_cetriolini', 20], ['p:p_senapemiele', 25], ['p:p_spiedini', 1]], { asporto: ASP_PANINO, vendite: { '2025': 2042 }, note: 'Nel foglio il costo non usciva perché mancava il prezzo del cheddar.' }),
    R('r_cheesebacon', 'Cheesebacon', 'panino', 10.5, [['p:p_pane', 80], ['p:p_carne', 180], ['p:p_cheddar', 2, 'fette'], ['p:p_bacon', 35], ['p:p_insalata', 40], ['p:p_pomodoro', 25], ['p:p_cipolla', 25], ['p:p_spiedini', 1]], { asporto: ASP_PANINO, vendite: { '2025': 1932 }, note: 'Nel foglio il costo non usciva perché mancava il prezzo del cheddar.' }),
    // Fritti
    R('r_patatine', 'Patatine', 'fritto', 4.5, [['p:p_patatine', 340], ['p:p_olio', 255], ['p:p_antigrasso', 1]], { asporto: ASP_FRITTI, costiExtra: [{ nome: 'Sale e condimento', costo: 0.01 }], vendite: { '2025': 5933 }, note: 'Nel foglio le patate sono 340 g ma l\'olio è contato su 255 g: da decidere quale porzione è giusta.' }),
    R('r_americane', 'Patatine americane', 'fritto', 6, [['p:p_patamericane', 340], ['p:p_olio', 340], ['p:p_antigrasso', 1]], { asporto: ASP_FRITTI, costiExtra: [{ nome: 'Sale e condimento', costo: 0.01 }], vendite: { '2025': 1910 } }),
    R('r_bocconcini', 'Bocconcini', 'fritto', 5.5, [['p:p_bocconcini', 5], ['p:p_olio', 200], ['p:p_antigrasso', 1]], { asporto: ASP_FRITTI, costiExtra: [{ nome: 'Sale e condimento', costo: 0.01 }], vendite: { '2025': 1126 }, note: 'Nel foglio «Food cost» ai bocconcini mancava il costo dell\'olio.' }),
    R('r_jalapenos', 'Jalapeños', 'fritto', 6, [['p:p_jalapenos', 5], ['p:p_olio', 200], ['p:p_antigrasso', 1]], { asporto: ASP_FRITTI, costiExtra: [{ nome: 'Sale e condimento', costo: 0.01 }], vendite: { '2025': 433 }, note: 'Nel foglio «Food cost» ai jalapeños mancava il costo dell\'olio.' }),
    // Combinazioni
    R('r_crispypata', 'Crispy con patatine', 'combo', 15, [['r:r_crispy', 1], ['r:r_patatine', 1]], { note: 'Nel foglio «Hamburger con patatine» prendeva il costo dell\'Hot Dogo: qui il costo nasce dalle due ricette.' })
  ];

  const eventi = [{
    id: 'e_abbronzatissima', nome: 'Abbronzatissima', data: '2027-04-01',
    righe: [
      { ricettaId: 'r_spritz', prezzo: 6, previsti: 300 },
      { ricettaId: 'r_gthendricks', prezzo: 8, previsti: 80 }
    ],
    extraPerPezzo: [{ rif: 'p:p_bicchiere400', quantita: 1 }],
    note: 'Bicchieri di plastica al posto del vetro.'
  }];

  return {
    versione: 1,
    impostazioni: {
      ivaVendita: 10,
      soglie: { drink: 4, premium: 3.5, panino: 3.5, fritto: 3.5, combo: 3.5 },
      metodoPrezzo: 'ultimo',
      sogliaAumento: 3,
      olio: { spesaAnnua: 5387, grammiFritti: 4203490, dettaglio: [
        ['Patatine', 8626, 255], ['Americane', 1851, 340], ['Bocconcini', 1130, 200], ['Jalapeños', 483, 200], ['Mozzarelline', 481, 100],
        ['Misto', 446, 500], ['Alette', 395, 200], ['Anelli', 394, 100], ['Halloumi stick', 44, 100], ['Senza nome nel foglio', 852, 120],
        ['Halloumi e bacon', 2228, 60], ['Anelli per 2', 1362, 20], ['Cotolette', 1453, 200], ['Bitcoin', 504, 180], ['Cheddar fritto', 295, 40], ['Tuorlo', 174, 10]
      ] },
      chiaveClaude: '',
      modelloClaude: 'claude-sonnet-5-5'
    },
    periodiVendita: ['Nov-dic 2024', '2025', 'Gen-feb 2026', 'Mar-ago 2026'],
    fornitori, prodotti, ricette, fatture: [], conte: [], eventi, ignorati: []
  };
})();

// Fatture di esempio per la prova (inventate, segnate come ESEMPIO).
window.FATTURE_ESEMPIO = [
  { nome: 'Esempio carne (Fontetto)', xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
<FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000001</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Fontetto (ESEMPIO)</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader>
<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-11-14</Data><Numero>ESEMPIO-1</Numero><ImportoTotaleDocumento>280.28</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali>
<DatiBeniServizi>
<DettaglioLinee><NumeroLinea>1</NumeroLinea><CodiceArticolo><CodiceTipo>INT</CodiceTipo><CodiceValore>HB180</CodiceValore></CodiceArticolo><Descrizione>HAMBURGER BOVINO 180 G KG</Descrizione><Quantita>20.00</Quantita><UnitaMisura>KG</UnitaMisura><PrezzoUnitario>10.40</PrezzoUnitario><PrezzoTotale>208.00</PrezzoTotale><AliquotaIVA>10.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>2</NumeroLinea><CodiceArticolo><CodiceTipo>INT</CodiceTipo><CodiceValore>SAL01</CodiceValore></CodiceArticolo><Descrizione>SALSICCIA DI SUINO KG</Descrizione><Quantita>5.00</Quantita><UnitaMisura>KG</UnitaMisura><PrezzoUnitario>8.80</PrezzoUnitario><PrezzoTotale>44.00</PrezzoTotale><AliquotaIVA>10.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>3</NumeroLinea><Descrizione>SPESE DI TRASPORTO</Descrizione><Quantita>1.00</Quantita><PrezzoUnitario>2.80</PrezzoUnitario><PrezzoTotale>2.80</PrezzoTotale><AliquotaIVA>10.00</AliquotaIVA></DettaglioLinee>
<DatiRiepilogo><AliquotaIVA>10.00</AliquotaIVA><ImponibileImporto>254.80</ImponibileImporto><Imposta>25.48</Imposta></DatiRiepilogo>
</DatiBeniServizi>
<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-12-14</DataScadenzaPagamento><ImportoPagamento>280.28</ImportoPagamento></DettaglioPagamento></DatiPagamento>
</FatturaElettronicaBody></p:FatturaElettronica>` },
  { nome: 'Esempio bar (Zonzini)', xml: `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
<FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000002</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>Zonzini (ESEMPIO)</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader>
<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-11-12</Data><Numero>ESEMPIO-2</Numero><ImportoTotaleDocumento>294.63</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali>
<DatiBeniServizi>
<DettaglioLinee><NumeroLinea>1</NumeroLinea><CodiceArticolo><CodiceTipo>INT</CodiceTipo><CodiceValore>APE1000</CodiceValore></CodiceArticolo><Descrizione>APEROL LT 1 CT 6</Descrizione><Quantita>2.00</Quantita><UnitaMisura>CT</UnitaMisura><PrezzoUnitario>72.00</PrezzoUnitario><ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>5.00</Percentuale></ScontoMaggiorazione><PrezzoTotale>136.80</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>2</NumeroLinea><CodiceArticolo><CodiceTipo>INT</CodiceTipo><CodiceValore>APE1000</CodiceValore></CodiceArticolo><Descrizione>APEROL LT 1 CT 6 OMAGGIO</Descrizione><Quantita>1.00</Quantita><UnitaMisura>BT</UnitaMisura><PrezzoUnitario>0.00</PrezzoUnitario><PrezzoTotale>0.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><NumeroLinea>3</NumeroLinea><CodiceArticolo><CodiceTipo>INT</CodiceTipo><CodiceValore>HEN1000</CodiceValore></CodiceArticolo><Descrizione>GIN HENDRICK'S LT 1</Descrizione><Quantita>3.00</Quantita><UnitaMisura>BT</UnitaMisura><PrezzoUnitario>34.90</PrezzoUnitario><PrezzoTotale>104.70</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>241.50</ImponibileImporto><Imposta>53.13</Imposta></DatiRiepilogo>
</DatiBeniServizi>
<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>2026-11-30</DataScadenzaPagamento><ImportoPagamento>294.63</ImportoPagamento></DettaglioPagamento></DatiPagamento>
</FatturaElettronicaBody></p:FatturaElettronica>` }
];
