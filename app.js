// Gestionale Repub — interfaccia
(function () {
  'use strict';
  const M = window.Motore;
  const CHIAVE = 'gestionaleRepub.v1';
  let S;
  const ui = { filtroProdotti: '', categoria: 'Tutte', tipoRicette: '*tutto', filtroRicette: '', bozza: null, conta: null, mappaPeriodo: null, mappaGruppo: 'cucina', sim: { modo: 'prodotto', prodottoId: '', valore: '', ricettaId: '', prezzo: '' } };

  // ---------- Utilità ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n2 = (n, d) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('it-IT', { useGrouping: 'always', minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const euro = (n, d) => (n == null || isNaN(n)) ? '—' : n2(n, d == null ? 2 : Math.min(d, 2)) + ' €';
  const perc = (n, d) => (n == null || isNaN(n)) ? '—' : n2(n * 100, d == null ? 1 : d) + '%';
  const qta = (n) => n == null ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 3 });
  const dataIt = (d) => d ? d.split('-').reverse().join('/') : '—';
  const numDa = (v) => { const x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? null : x; };
  function avviso(t) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = t;
    document.body.appendChild(el); setTimeout(() => el.classList.add('via'), 2200); setTimeout(() => el.remove(), 2700);
  }
  const vai = (h) => { location.hash = h; };

  // ---------- Archivio ----------
  function carica() {
    try { const t = localStorage.getItem(CHIAVE); if (t) return JSON.parse(t); } catch (e) { /* niente */ }
    return JSON.parse(JSON.stringify(window.DATI_INIZIALI));
  }
  const OCCHIO = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  // l'occhio accanto alle password: mostra o nasconde quello che hai scritto
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-occhio]'); if (!b) return;
    e.preventDefault();
    const i = document.getElementById(b.dataset.occhio); if (!i) return;
    i.type = i.type === 'password' ? 'text' : 'password';
    b.classList.toggle('aperto', i.type === 'text');
  });
  const CLOUD = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey);
  function salva() {
    M.svuota();
    if (CLOUD) { if (utente) salvaCloud(); return; }
    try { localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch (e) { avviso('Attenzione: non riesco a salvare sul dispositivo.'); }
  }
  // sistema uno stato appena caricato (campi mancanti, aggiornamenti una tantum)
  function prepara(stato) {
    S = stato;
    ['fatture', 'conte', 'eventi', 'ignorati', 'fornitori', 'prodotti', 'ricette'].forEach(k => { S[k] = S[k] || []; });
    S.periodiScaricati = S.periodiScaricati || [];
    S.periodiVendita = S.periodiVendita || [];
    S.casella = S.casella || { url: '', chiave: '', ultimoControllo: null, visti: [] };
    M.usa(S);
    // prodotti senza categoria (comparivano come un bottone vuoto con solo il numero): vanno in «Da classificare»
    S.prodotti.forEach(p => { if (!String(p.categoria || '').trim()) p.categoria = 'Da classificare'; });
    // una volta: i fornitori di bollette e servizi già caricati non devono avere prodotti
    S.fornitori.forEach(f => { if (f.servizi === undefined && M.pareServizi(f.nome) && S.fatture.some(x => x.fornitoreId === f.id)) M.segnaServizi(f.id, true); });
    S.migrazioneServizi = true;
    // una volta: le ricette in più (drink, panini, fritti, dolci) entrano anche nei dati già salvati
    S.impostazioni = S.impostazioni || {}; S.impostazioni.soglie = S.impostazioni.soglie || {};
    if (S.impostazioni.soglie.dolce == null) S.impostazioni.soglie.dolce = 3.5;
    if (S.impostazioni.soglie.bevanda == null) S.impostazioni.soglie.bevanda = 3;
    M.aggiornaTipi(); Object.keys(M.TIPI).forEach(k => { if (k !== 'semilavorato' && S.impostazioni.soglie[k] == null) S.impostazioni.soglie[k] = 3.5; });
    if (S.impostazioni.soglie.altro == null) S.impostazioni.soglie.altro = 3;
    S.periodiCassa = S.periodiCassa || {};
    // cestino: quello che elimini resta lì finché non lo svuoti tu (mai da solo)
    S.cestino = (S.cestino || []).filter(c => c && c.x && !((S[c.tipo] || []).some && (S[c.tipo] || []).some(y => y.id === c.x.id)));
    const AG = window.AGGIUNTE_RICETTE;
    if (AG && (S.versioneRicette || 1) < AG.versione) {
      const nn = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim();
      const fid = {};
      const fornitoreDi = (id) => {
        if (!id || fid[id] !== undefined) return fid[id] || '';
        if (S.fornitori.some(f => f.id === id)) return (fid[id] = id);
        const base = AG.fornitori.find(f => f.id === id) || (window.DATI_INIZIALI.fornitori || []).find(f => f.id === id);
        if (!base) return (fid[id] = '');
        const c = M.trovaFornitore({ fornitoreNome: base.nome });
        if (c) return (fid[id] = c.id);
        S.fornitori.push(JSON.parse(JSON.stringify(base))); return (fid[id] = id);
      };
      const pid = {};
      AG.prodotti.forEach(p0 => {
        if (S.prodotti.some(p => p.id === p0.id)) return;
        const doppio = S.prodotti.find(p => nn(p.nomeBreve) === nn(p0.nomeBreve) && p.unita === p0.unita);
        if (doppio) { pid[p0.id] = doppio.id; return; }
        const p = JSON.parse(JSON.stringify(p0));
        p.fornitoreId = fornitoreDi(p.fornitoreId);
        p.prezzi.forEach(x => { x.fornitoreId = p.fornitoreId; });
        p.articoli.forEach(x => { x.fornitoreId = p.fornitoreId; });
        S.prodotti.push(p);
      });
      // servono anche gli ingredienti di partenza usati dalle ricette nuove, se nel frattempo sono stati tolti
      const usati = new Set(); AG.ricette.forEach(r => r.righe.concat(r.asporto || []).forEach(rg => usati.add(rg.rif)));
      (window.DATI_INIZIALI.prodotti || []).forEach(p0 => {
        if (!usati.has('p:' + p0.id) || S.prodotti.some(p => p.id === p0.id) || pid[p0.id]) return;
        const p = JSON.parse(JSON.stringify(p0)); p.fornitoreId = fornitoreDi(p.fornitoreId); p.prezzi.forEach(x => { x.fornitoreId = p.fornitoreId; }); p.articoli.forEach(x => { x.fornitoreId = p.fornitoreId; }); S.prodotti.push(p);
      });
      (window.DATI_INIZIALI.ricette || []).forEach(r0 => {
        if (!usati.has('r:' + r0.id) || S.ricette.some(r => r.id === r0.id)) return;
        S.ricette.push(JSON.parse(JSON.stringify(r0)));
      });
      const rif = (x) => { const m = /^p:(.+)$/.exec(x); return m && pid[m[1]] ? 'p:' + pid[m[1]] : x; };
      AG.ricette.forEach(r0 => {
        if (S.ricette.some(r => r.id === r0.id)) return;
        const r = JSON.parse(JSON.stringify(r0));
        r.righe.forEach(rg => { rg.rif = rif(rg.rif); }); (r.asporto || []).forEach(rg => { rg.rif = rif(rg.rif); });
        S.ricette.push(r);
      });
      ['Nov-dic 2024', '2025', 'Gen-feb 2026', 'Mar-ago 2026'].forEach(k => { if (!S.periodiVendita.includes(k)) S.periodiVendita.push(k); });
      S.versioneRicette = AG.versione;
    }
    // fornitori di servizi: le loro fatture non devono avere prodotti e restano registrate
    S.fornitori.forEach(f => { if (f.servizi && S.fatture.some(x => x.fornitoreId === f.id && (x.stato !== 'registrata' || x.righe.some(rg => !rg.ignora)))) M.segnaServizi(f.id, true); });
    // una volta: righe pagate saltate per sbaglio (succedeva quando lo stesso prodotto era arrivato anche in omaggio)
    if (!S.correzioneOmaggi) {
      const prova = (x) => M.trovaArticolo({ codice: x.codice, descrizione: x.descrizione, um: '', totale: 1 }, x.fornitoreId);
      S.fatture.forEach(f => {
        const forn = M.fornitore(f.fornitoreId); if (!forn || forn.servizi || f.servizi) return;
        let cambiata = false;
        f.righe.forEach(rg => {
          if (!rg.ignora || rg.prodottoId || rg.totale < 0 || /^(SC|PR|AB|AC)$/.test(rg.tipoRiga || '')) return;
          if (rg.totale > 0 && M.nonMerce(rg)) return;
          if (M.trovaArticolo(rg, f.fornitoreId)) { rg.ignora = false; cambiata = true; }
        });
        if (cambiata && f.stato === 'registrata') { M.annullaFattura(f); M.registraFattura(f); M.svuota(); }
      });
      S.ignorati = (S.ignorati || []).filter(x => !prova(x));
      // prodotti nati da righe di sconto o abbuono (importi negativi) e mai usati: via
      S.prodotti.filter(p => p.creatoDa && !M.usatoIn('p:' + p.id).dirette.length).forEach(p => {
        const sue = []; S.fatture.forEach(f => f.righe.forEach(rg => { if (rg.prodottoId === p.id) sue.push(rg); }));
        if (sue.length && sue.every(rg => rg.totale < 0)) { sue.forEach(rg => { rg.prodottoId = null; rg.ignora = true; rg.automatico = true; }); S.prodotti = S.prodotti.filter(x => x !== p); }
      });
      S.correzioneOmaggi = true; M.svuota();
    }
    // una volta: la frutteria (accordo) scrive le casse a metà prezzo: segno il fornitore e raddoppio i prezzi a cassa già registrati
    if (!S.casseFrutteria) {
      S.fornitori.forEach(fo => { if (fo.piva === '04686340409' || /frutteria/i.test(fo.nome || '')) fo.casseAMeta = true; });
      S.casseFrutteria = true;
    }
    // i prezzi delle fatture di questi fornitori seguono la regola: doppio solo dove la riga dice CASSA (rifaccio il conto se è cambiato)
    S.fornitori.filter(fo => fo.casseAMeta || fo.casseRicontrollo !== 2).forEach(fo => {
      S.fatture.filter(f => f.fornitoreId === fo.id && f.stato === 'registrata').forEach(f => {
        const an = M.analizzaFattura(f);
        an.prodotti.forEach(x => {
          const p = M.prodotto(x.prodottoId); const e = p && (p.prezzi || []).find(v => v.fatturaId === f.id); if (!e || x.nuovo == null) return;
          if (x.raddoppiata && (!e.raddoppiato || Math.abs(e.prezzo - x.nuovo) > 0.0001)) { e.prezzo = x.nuovo; e.listino = x.listino; e.raddoppiato = true; }
          else if (!x.raddoppiata && e.raddoppiato) { e.prezzo = x.nuovo; e.listino = x.listino; delete e.raddoppiato; }
        });
      });
      fo.casseRicontrollo = 2;
    });
    // una volta: i prodotti del foglio scambiati con quelli delle fatture riprendono il nome della fattura (il nome del foglio resta per la ricerca)
    if (!S.nomiDaFattura) {
      const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      const base = [].concat(((window.DATI_INIZIALI || {}).prodotti) || [], ((window.AGGIUNTE_RICETTE || {}).prodotti) || []);
      const nomiFoglio = new Set(base.filter(x => (x.prezzi || []).some(e => /^Foglio/.test(e.origine || ''))).map(x => nn(x.nomeBreve)));
      S.prodotti.forEach(x => {
        if (!x.nomeCompleto || M.daFoglio(x) || !(x.prezzi || []).some(e => e.fatturaId) || !nomiFoglio.has(nn(x.nomeBreve))) return;
        const nuovo = M.indovinaProdotto({ descrizione: x.nomeCompleto, um: '' }).nomeBreve;
        if (nuovo && nn(nuovo) !== nn(x.nomeBreve)) { x.nomeFoglio = x.nomeBreve; x.nomeBreve = nuovo; }
      });
      S.nomiDaFattura = true; M.svuota();
    }
    // una volta: i gruppi «lisci» della cassa (whisky, vermouth, tequila, rum, grappa, amari) con dentro i loro prodotti, 60 ml, costo = media
    if (!S.gruppiLisci2) { creaGruppiLisci(); S.gruppiLisci = true; S.gruppiLisci2 = true; M.svuota(); }
    // una volta: gruppi e categorie in ordine (birre insieme, cocktail insieme, niente «Distillati», vermouth e vodka con amari e liquori)
    if (!S.riordino1) { riordinaGruppi(); S.riordino1 = true; M.svuota(); }
    // una volta: Bibite, Bevande e Acqua insieme in «Bevande» (anche acqua e bibite rimaste in «Vini e bibite»)
    if (!S.riordino2) { unisciBevande(); S.riordino2 = true; M.svuota(); }
    // una volta: il gruppo «Panini» non serve (i panini sono nei gruppi dei burger della cassa)
    if (!S.riordino3) { togliGruppoPanini(); S.riordino3 = true; M.svuota(); }
    // una volta: un gin tonic per ogni gin (50 ml + 1 tonica Goldberg) nel gruppo «Gin tonic»
    if (!S.ginTonic1) { creaGinTonic(); S.ginTonic1 = true; M.svuota(); }
    // una volta: i prezzi del listino Zonzini che Tommi ha controllato (solo bar, solo prodotti senza fattura)
    // una volta: soglie del moltiplicatore per gruppo, dalla ricerca (prezzo con IVA ÷ costo senza IVA)
    // una volta: il coperto della cassa sulla ricetta «Coperto» che c'è già; «Sherlocl hops» scritto male nella cassa: prende anche «Sherlock hops»
    if (!S.dopoVenduto2) {
      const nn = (t) => normCassa(t);
      const cop = S.ricette.find(r => r.tipo !== 'semilavorato' && /^coperto\b/.test(nn(r.nome)));
      if (cop && !(cop.nomeCassa && nn(cop.nomeCassa) === 'coperto') && !(cop.aliasCassa || []).some(a => nn(a) === 'coperto')) cop.aliasCassa = (cop.aliasCassa || []).concat('COPERTO');
      S.ricette.forEach(r => { if (/^sherlocl hops\b/.test(nn(r.nome))) { r.nome = r.nome.replace(/sherlocl/i, 'Sherlock'); if (r.nomeCassa) { const giusto = r.nomeCassa.replace(/SHERLOCL/i, 'SHERLOCK'); if (!(r.aliasCassa || []).includes(giusto)) r.aliasCassa = (r.aliasCassa || []).concat(giusto); } } });
      S.dopoVenduto2 = true; M.svuota();
    }
    // una volta: dopo il venduto 2026 (amari e grappe generici, mezza nat doppia, fritti in «Da spizzicare»)
    if (!S.dopoVenduto1) { S.esitoDopoVenduto = sistemaDopoVenduto(); S.dopoVenduto1 = true; M.svuota(); }
    if (!S.soglieRicerca1) { S.esitoSoglie = soglieDaRicerca(); S.soglieRicerca1 = true; }
    if (!S.listinoZonz1) { S.esitoListinoZonz = prezziListinoZonzini(); S.listinoZonz1 = true; M.svuota(); }
    // una volta: seconda tornata (nomi indicati da Tommi) e bottiglie già comprate da Turci al posto di quelle create senza prezzo
    if (!S.listinoZonz2) { S.esitoListinoZonz2 = Object.assign(prezziListinoZonzini(LISTINO_ZONZINI_2), { collegati: collegaBottiglieDaFattura() }); S.listinoZonz2 = true; M.svuota(); }
    // una volta: i prezzi del foglio di Tommi erano IVA compresa (pagati al banco); i costi si fanno senza IVA, come in fattura
    if (!S.ivaFoglioTolta) {
      S.prodotti.forEach(p => (p.prezzi || []).forEach(e => { if (/^Foglio/.test(e.origine || '') && !e.ivaTolta) { e.prezzo = Math.round(e.prezzo / (1 + (p.iva != null ? p.iva : 22) / 100) * 10000) / 10000; e.ivaTolta = true; } }));
      S.ivaFoglioTolta = true; M.svuota();
    }
    // una volta: le scorte minime erano numeri d'esempio della prova, non del Repub: le azzero
    if (!S.scortePulite) { S.prodotti.forEach(p => { p.scortaMinima = 0; }); S.scortePulite = true; }
    // una volta: «bianco» e «rosso» da soli facevano finire nel vino anche aceto e altro
    if (!S.correzioneVino) {
      S.prodotti.forEach(p => { if (p.creatoDa && p.categoria === 'Vino' && !p.reparto) { const c = M.categoriaDa(p.nomeCompleto); if (c !== 'Vino') p.categoria = c; } });
      S.correzioneVino = true;
    }
    // fatture già complete rimaste in sospeso: le registro
    if ((S.impostazioni || {}).autoRegistra !== false) S.fatture.forEach(f => { if (f.stato !== 'registrata' && !f.daVerificare && f.righe.length && !M.daAbbinare(f)) { M.registraFattura(f); M.svuota(); } });
    // una volta: il magazzino lo fa solo l'inventario, si riparte da zero
    if (!S.magazzinoSoloInventario) { S.prodotti.forEach(p => { p.giacenza = 0; }); S.fatture.forEach(f => { f.magazzino = false; }); S.magazzinoSoloInventario = true; }
    // i prodotti dei fornitori già confermati non vanno ricontrollati
    S.fornitori.forEach(f => { if (f.controllato) confermaProdottiDi(f); });
    // fatture doppie (es. lette insieme da due dispositivi): ne tengo una
    const viste = new Set();
    S.fatture = S.fatture.filter(f => { const k = [f.piva || f.fornitoreNome, f.numero, f.data].join('|'); if (viste.has(k)) return false; viste.add(k); return true; });
    // prezzi rimasti attaccati a fatture che non ci sono più
    const idFatt = new Set(S.fatture.map(f => f.id));
    S.prodotti.forEach(p => { if ((p.prezzi || []).some(e => e.fatturaId && !idFatt.has(e.fatturaId))) p.prezzi = p.prezzi.filter(e => !e.fatturaId || idFatt.has(e.fatturaId)); });
    M.usa(S);
  }

  // [nome, prodotti già noti (il primo che c'è), parole per cercarlo, ml della bottiglia se è segnato a pezzo]
  const GRUPPI_LISCI = [
    { ricetta: 'r_mwknirqg7jgs', nomi: ['whiskey', 'whisky'], cat: 'Whisky', gruppo: 'Whisky', base: 'Whisky', cassa: 'WHISKEY', voci: [
      ['Jameson', ['p_jameson'], 'jameson'], ['Tullamore', [], 'tullamore'], ['Red Label', [], 'red label'], ['Black Label', [], 'black label'], ['Double Black', ['p_mwkoh4buw64r'], 'double black', 700],
      ['Talisker Skye', [], 'talisker skye'], ['Talisker 10', [], 'talisker 10'], ['Oban 14', [], 'oban'], ['Laphroaig 10', [], 'laphroaig'], ['Caol Ila 12', [], 'caol ila'],
      ["Maker's Mark", ['p_mwjffqjd0ryu'], 'maker mark'], ['Buffalo Trace', [], 'buffalo'], ['Rare Breed', [], 'rare breed'], ['Wild Turkey 101', [], 'turkey 101'], ['Wild Turkey', ['p_wildturkey'], ''],
      ['Wild Turkey Rye', [], 'turkey rye'], ['Knob Creek Rye', [], 'knob creek'], ['Suntory', [], 'suntory'], ['Nikka Days', [], 'nikka days'], ['Nikka From the Barrel', [], 'nikka barrel'],
      ['Bulleit 10', [], 'bulleit'], ["Jack Daniel's", ['p_jack'], '']] },
    { ricetta: 'r_mwknirqgm7fd', nomi: ['vermouth'], cat: 'Amari e liquori', gruppo: 'Vermouth', base: 'Vermouth', cassa: 'VERMOUTH', voci: [
      ['Carpano', ['p_carpano'], ''], ['Antica Formula', [], 'antica formula'], ['Punt e Mes', [], 'punt mes'], ['Carlo Alberto', [], 'carlo alberto'], ['Cocchi', [], 'cocchi torino'],
      ['Lillet', ['p_mwkopu7hiwpk'], '', 750], ['Lillet Rosso', [], 'lillet rouge'], ['Americano Cocchi', [], 'americano cocchi']] },
    { ricetta: 'r_mwknirqg71r8', nomi: ['tequila mezcal'], cat: 'Tequila e mezcal', gruppo: 'Tequila e mezcal', base: 'Tequila', cassa: 'TEQUILA \\ MEZCAL', voci: [
      ['Herradura Blanco', [], 'herradura blanco'], ['Herradura Reposado', [], 'herradura reposado'], ['Patrón Blanco', [], 'patron'], ['Se Busca', [], 'se busca'], ['Los Danzantes', [], 'danzantes'],
      ['Burrito Fiestero', ['p_mezcal'], ''], ['Vida', [], 'del maguey vida'], ['Quiquiriqui', [], 'quiquiriqui'], ['Altos Blanco', ['p_mwjffqja21tz'], ''], ['Altos Reposado', ['p_mwkow6xa062j'], '', 700]] },
    { ricetta: 'r_mwknirqgz16n', nomi: ['rum'], cat: 'Rum', gruppo: 'Rum', base: 'Rum', cassa: 'RUM', voci: [
      ['J. Bally Bianco', [], 'bally'], ['Saint James', ['p_mwkojze66fll'], '', 1000], ['Karukera', [], 'karukera blanc'], ['Karukera Vieux', [], 'karukera vieux'], ['Clairin Vaval', [], 'clairin vaval'],
      ['Demoiseau', [], 'damoiseau'], ['Santero', ['p_mwkopu7pmebj'], ''], ['Wray & Nephew', ['p_mwkojzef5iph', 'p_wray'], ''], ['Havana 7', ['p_mwjffqiwt5og'], '', 700], ["Myers's", [], 'myers'],
      ["Doorly's 5", [], 'doorly 5'], ["Doorly's XO", [], 'doorly xo'], ['Gosling', ['p_gosling'], ''], ['Gosling 151', ['p_mwjffqjdo1fh'], ''], ['OFTD', [], 'oftd'], ['Veritas', ['p_mwkojzefcypl'], ''],
      ['Havana 3', ['p_mwjffqiwi273'], ''], ['Hampden 8', [], 'hampden 8'], ['Abuelo 7', [], 'abuelo 7'], ['Appleton Signature', [], 'appleton signature'], ['Appleton 8', [], 'appleton 8'], ['Appleton 12', [], 'appleton 12'],
      ['Diplomatico', [], 'diplomatico'], ['El Dorado 8', [], 'dorado 8'], ['El Dorado 12', ['p_mwjffqjd6tlj'], ''], ['Magnifica', [], 'magnifica'], ['Yaguara Branca', [], 'yaguara branca'],
      ['Yaguara Organica', ['p_mwjffqiw4n8h'], '', 700], ['Hampden Pagos', [], 'hampden pagos'], ['Papalin 7 anni', [], 'papalin 7'], ['Papalin Reunion', [], 'papalin reunion'], ['Privateer', [], 'privateer'],
      ['Papa Rouyo', [], 'rouyo'], ['Renegade', [], 'renegade']] },
    { ricetta: 'r_mwknirqg5oi4', nomi: ['grappa'], cat: 'Grappe', bar: true, gruppo: 'Grappe', base: 'Grappa', cassa: 'GRAPPA', voci: [
      ['18 Lune invecchiata', ['p_mwkopuas5c2f'], '', 700], ['Amarone invecchiata', [], 'grappa amarone'], ['903 invecchiata', [], '903'], ['Poli bianca', [], 'poli grappa'], ['Prime Uve bianca', [], 'prime uve']] },
    { ricetta: 'r_mwknirqgdn1o', nomi: ['amari'], cat: 'Amari e liquori', gruppo: 'Amari e liquori', base: 'Amari', cassa: 'AMARI', voci: [
      ['Amaro del Capo', ['p_mwkojzgn65se'], ''], ['Sambuca', [], 'sambuca'], ['Braulio', [], 'braulio'], ['Montenegro', ['p_mwkopu7t07vq', 'p_mwkojzgn02eh'], ''], ['Brancamenta', [], 'brancamenta'],
      ['Fernet Branca', ['p_fernet'], ''], ['Averna', [], 'averna'], ['Limoncello', [], 'limoncello'], ['Anima Nera', [], 'anima nera'], ['Borghetti', [], 'borghetti'], ['Disaronno', [], 'disaronno'],
      ['Jägermeister', [], 'jagermeister'], ['Assenzio', [], 'assenzio'], ['Cynar', [], 'cynar'], ['Amaro Lucano', [], 'lucano'], ['Kahlúa', [], 'kahlua'], ['Vodka menta', [], 'vodka menta'],
      ['Liquore Strega', [], 'strega'], ['Pastis', [], 'pastis'], ['Irish Mist', [], 'irish mist'], ['Frangelico', [], 'frangelico'], ['Stravecchio', [], 'stravecchio'], ['Varnelli', [], 'varnelli'],
      ['Bello', [], 'bello'], ['Jefferson', ['p_mwkoh4bwt032'], ''], ['Amaro Camatti', ['p_mwjffqjdn082'], ''], ['Miscela al 30', ['p_mwjffqjd53db'], ''], ['Petrus', ['p_mwjffqjdexns'], ''], ['Amaro Formidabile', [], 'formidabile']] }
  ];
  function creaGruppiLisci() {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const slug = (t) => nn(t).replace(/ /g, '-');
    const testo = (x) => ' ' + nn([x.nomeBreve, x.nomeCompleto, x.nomeFoglio].concat((x.articoli || []).map(a => a.descrizione)).join(' ')) + ' ';
    const cerca = (parole, gia) => { const w = nn(parole).split(' ').filter(Boolean); if (!w.length) return null;
      const l = S.prodotti.filter(x => !x.speciale && !gia.includes(x.id) && w.every(k => testo(x).includes(' ' + k + ' ')));
      return l.find(x => M.daFattura(x)) || l[0] || null; };
    GRUPPI_LISCI.forEach(g => {
      const r = M.ricetta(g.ricetta) || S.ricette.find(x => x.tipo !== 'semilavorato' && g.nomi.includes(nn(x.nome)));
      const ids = [], voci = [];
      g.voci.forEach(([nome, noti, parole, ml]) => {
        let p = noti.map(id => M.prodotto(id)).find(Boolean) || cerca(parole, ids);
        if (!p) {
          // non c'è nelle fatture: lo creo senza prezzo, da completare (il prezzo lo mette la fattura o tu a mano)
          const id = 'p_gr_' + slug(nome);
          p = M.prodotto(id);
          if (!p) { p = { id, nomeBreve: nome, nomeCompleto: nome, categoria: g.cat, unita: 'ml', contenuto: 700, confezione: 'bottiglia', iva: 22, giacenza: 0, scortaMinima: 0, resa: 100, allergeni: [], venditaDiretta: null, fornitoreId: '', articoli: [], prezzi: [], daCompletare: true, note: `Creato per il gruppo «${r ? r.nome : g.cat}»: manca il prezzo, e controlla il formato della bottiglia.` }; S.prodotti.push(p); }
        }
        // bottiglia segnata «a pezzo»: la porto in ml, e le ricette che la usavano a pezzi diventano in ml
        if (ml && p.unita === 'pz' && (Number(p.contenuto) || 1) === 1) {
          S.ricette.forEach(x => [].concat(x.righe || [], x.asporto || []).forEach(rg => { if (rg.rif === 'p:' + p.id) rg.quantita = Math.round((Number(rg.quantita) || 0) * ml * 100) / 100; }));
          p.unita = 'ml'; p.contenuto = ml; p.confezione = 'bottiglia';
        }
        p.categoria = g.cat; if (g.bar) p.reparto = 'Bar';
        if (!ids.includes(p.id)) ids.push(p.id);
        voci.push({ nome, id: p.id });
      });
      // il gruppo delle ricette (es. «Whisky»): una ricetta per ogni bottiglia venduta liscia
      let tipo = Object.keys(M.TIPI).find(k => k !== 'semilavorato' && nn(M.TIPI[k]) === nn(g.gruppo));
      if (!tipo) { tipo = 'g_' + slug(g.gruppo).replace(/-/g, ''); if (!(S.tipiExtra || []).some(t => t.id === tipo)) S.tipiExtra = (S.tipiExtra || []).concat({ id: tipo, nome: g.gruppo, reparto: 'bar' }); M.aggiornaTipi(); }
      if (S.impostazioni.soglie[tipo] == null) S.impostazioni.soglie[tipo] = 3.5;
      // la ricetta generica della cassa («Whiskey»): niente media; resta per le vendite vecchie, finché la cassa non vende con le varianti
      if (r) {
        if (r.media && (r.righe || []).length && r.righe.every(rg => ids.includes(rg.rif.slice(2)) && Number(rg.quantita) === 60)) { r.righe = []; delete r.media; }
        r.tipo = tipo;
        if (!/Vecchia voce della cassa/.test(r.note || '')) r.note = ((r.note ? r.note + '\n' : '') + 'Vecchia voce della cassa senza bottiglia: quando la cassa venderà «' + g.base + ' (nome della bottiglia)» non servirà più e potrai eliminarla.');
      }
      voci.forEach(v => {
        const id = 'r_gr_' + slug(g.base + ' ' + v.nome);
        if (M.ricetta(id)) return;
        S.ricette.push({ id, nome: g.base + ' (' + v.nome + ')', tipo, prezzo: r ? r.prezzo : null, righe: [{ rif: 'p:' + v.id, quantita: 60 }], asporto: [], vendite: {}, costiExtra: [], note: '',
          nomeCassa: ((r && r.nomeCassa) || g.cassa) + ' - ' + v.nome.toUpperCase() });
      });
    });
    // gruppo «Gin tonic»: ci vanno tutti i gin tonic
    // se c'è già il gruppo «Gin tonic e premium» uso quello (rinominato «Gin tonic»), senza farne un doppione
    let gt = Object.keys(M.TIPI).find(k => k !== 'gintonic' && nn(M.TIPI[k]).startsWith('gin tonic'));
    if (gt) {
      S.ricette.forEach(x => { if (x.tipo === 'gintonic') x.tipo = gt; });
      S.tipiExtra = (S.tipiExtra || []).filter(t => t.id !== 'gintonic');
      const t = (S.tipiExtra || []).find(x => x.id === gt); if (t) t.nome = 'Gin tonic'; else { S.nomiTipi = S.nomiTipi || {}; S.nomiTipi[gt] = 'Gin tonic'; }
      M.aggiornaTipi();
    } else {
      gt = 'gintonic';
      if (!(S.tipiExtra || []).some(t => t.id === gt)) { S.tipiExtra = (S.tipiExtra || []).concat({ id: gt, nome: 'Gin tonic', reparto: 'bar' }); M.aggiornaTipi(); }
    }
    if (S.impostazioni.soglie[gt] == null) S.impostazioni.soglie[gt] = 3.5;
    S.ricette.forEach(x => { if (/^gin ?tonic\b/i.test(nn(x.nome)) || /^g ?t\b/.test(nn(x.nome))) x.tipo = gt; });
  }

  function riordinaGruppi() {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const tipi = () => Object.keys(M.TIPI).filter(k => k !== 'semilavorato');
    const tipoDi = (...nomi) => tipi().find(k => nomi.includes(nn(M.TIPI[k])));
    const togli = (k) => { if ((S.tipiExtra || []).some(t => t.id === k)) S.tipiExtra = S.tipiExtra.filter(t => t.id !== k); else S.tipiNascosti = Array.from(new Set((S.tipiNascosti || []).concat(k))); M.aggiornaTipi(); };
    const rinomina = (k, nome) => { const t = (S.tipiExtra || []).find(x => x.id === k); if (t) t.nome = nome; else { S.nomiTipi = S.nomiTipi || {}; S.nomiTipi[k] = nome; } M.aggiornaTipi(); };
    const crea = (nome) => { const id = 'g_' + nn(nome).replace(/ /g, ''); if (!(S.tipiExtra || []).some(t => t.id === id)) S.tipiExtra = (S.tipiExtra || []).concat({ id, nome, reparto: 'bar' }); M.aggiornaTipi(); if (S.impostazioni.soglie[id] == null) S.impostazioni.soglie[id] = 3.5; return id; };
    const unisci = (dest, altri) => altri.forEach(k => { if (!k || k === dest) return; S.ricette.forEach(r => { if (r.tipo === k) r.tipo = dest; }); togli(k); });
    const catIngr = (r) => (r.righe || []).map(rg => rg.rif.startsWith('p:') ? (M.prodotto(rg.rif.slice(2)) || {}).categoria || '' : '');
    // Cocktail = Drink + Cocktail
    const cocktail = tipoDi('cocktail') || tipoDi('drink') || tipoDi('drink e cocktail');
    if (cocktail) { unisci(cocktail, [tipoDi('drink'), tipoDi('cocktail'), tipoDi('drink e cocktail')]); rinomina(cocktail, 'Cocktail'); }
    // Birre: tutti i gruppi delle birre insieme, e le birre tolte da «Birre, vini e bibite»
    const nomiBirre = ['birre', 'birra', 'birre in lattina', 'birre e fusti', 'birra e fusti', 'birre alla spina', 'birre artigianali'];
    const birre = tipoDi(...nomiBirre) || crea('Birre');
    unisci(birre, tipi().filter(k => nomiBirre.includes(nn(M.TIPI[k]))));
    rinomina(birre, 'Birre');
    const misto = tipi().find(k => /\bbirr/.test(nn(M.TIPI[k])) && k !== birre);
    if (misto) {
      S.ricette.forEach(r => { if (r.tipo === misto && (/^birr/.test(nn(r.catCassa)) || /\bbirr/.test(nn(r.nome)) || catIngr(r).some(c => /^(birr|fust)/i.test(c)))) r.tipo = birre; });
      rinomina(misto, M.TIPI[misto].replace(/birr[ae]\s*(,|e)?\s*/i, '').replace(/^\s*(,|e)\s*/, '').replace(/^./, c => c.toUpperCase()) || 'Vini e bibite');
    }
    // il vermouth va con amari e liquori
    const amari = tipoDi('amari e liquori') || tipoDi('amari') || crea('Amari e liquori');
    rinomina(amari, 'Amari e liquori');
    unisci(amari, [tipoDi('vermouth'), tipoDi('liquori'), tipoDi('amari')].filter(k => k !== amari));
    // «Distillati» non serve più: ogni ricetta va nel suo gruppo
    const dist = tipoDi('distillati');
    if (dist) {
      const dove = (r) => { const n = nn(r.nome);
        if (/\brum\b|\brhum\b/.test(n)) return tipoDi('rum') || crea('Rum');
        if (/whisk/.test(n)) return tipoDi('whisky') || crea('Whisky');
        if (/tequila|mezcal/.test(n)) return tipoDi('tequila e mezcal') || crea('Tequila e mezcal');
        if (/grapp/.test(n)) return tipoDi('grappe') || crea('Grappe');
        return amari; };
      S.ricette.forEach(r => { if (r.tipo === dist) r.tipo = dove(r); });
      togli(dist);
    }
    // in Caffetteria solo i caffè: la grappa va nelle grappe
    const caff = tipoDi('caffetteria');
    if (caff) S.ricette.forEach(r => { if (r.tipo === caff && /grapp/.test(nn(r.nome))) r.tipo = tipoDi('grappe') || crea('Grappe'); });
    // categorie dei prodotti
    S.prodotti.forEach(p => {
      const c = nn(p.categoria), n = nn([p.nomeBreve, p.nomeCompleto].join(' '));
      if (/^(birra e fusti|birre e fusti|fusti|birra|birre)$/.test(c)) p.categoria = 'Birre';
      else if (/^(bitter e vermouth|vodka|liquori|amari)$/.test(c)) p.categoria = 'Amari e liquori';
      else if (c === 'rum e cachaca') p.categoria = 'Rum';
      else if (c === 'distillati') {
        p.categoria = /\bgin\b/.test(n) ? 'Gin' : /\brum\b|\brhum\b|cachaca/.test(n) ? 'Rum' : /whisk|bourbon/.test(n) ? 'Whisky' : /tequila|mezcal/.test(n) ? 'Tequila e mezcal' : /grapp/.test(n) ? 'Grappe' : 'Amari e liquori';
        if (p.categoria === 'Grappe') p.reparto = 'Bar';
      }
    });
  }

  function unisciBevande() {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const tipi = () => Object.keys(M.TIPI).filter(k => k !== 'semilavorato');
    const nomi = ['bevande', 'bibite', 'acqua', 'acque', 'bevanda', 'bibita'];
    let dest = tipi().find(k => nn(M.TIPI[k]) === 'bevande') || tipi().find(k => nomi.includes(nn(M.TIPI[k])));
    if (!dest) { dest = 'g_bevande'; if (!(S.tipiExtra || []).some(t => t.id === dest)) S.tipiExtra = (S.tipiExtra || []).concat({ id: dest, nome: 'Bevande', reparto: 'bar' }); M.aggiornaTipi(); }
    if (S.impostazioni.soglie[dest] == null) S.impostazioni.soglie[dest] = 3;
    tipi().filter(k => k !== dest && nomi.includes(nn(M.TIPI[k]))).forEach(k => {
      S.ricette.forEach(r => { if (r.tipo === k) r.tipo = dest; });
      if ((S.tipiExtra || []).some(t => t.id === k)) S.tipiExtra = S.tipiExtra.filter(t => t.id !== k); else S.tipiNascosti = Array.from(new Set((S.tipiNascosti || []).concat(k)));
      M.aggiornaTipi();
    });
    const t = (S.tipiExtra || []).find(x => x.id === dest); if (t) t.nome = 'Bevande'; else { S.nomiTipi = S.nomiTipi || {}; S.nomiTipi[dest] = 'Bevande'; }
    M.aggiornaTipi();
    // dal gruppo misto «Vini e bibite»: acqua e bibite vanno in Bevande, i vini restano
    const misto = tipi().find(k => k !== dest && /\bbibit/.test(nn(M.TIPI[k])));
    if (misto) {
      const catIngr = (r) => (r.righe || []).map(rg => rg.rif.startsWith('p:') ? nn((M.prodotto(rg.rif.slice(2)) || {}).categoria) : '');
      const bibita = (r) => { const n = nn(r.nome), c = nn(r.catCassa);
        if (/^(bibite|bevande|acqua)/.test(c)) return true;
        if (/\b(vino|vini|calice|bottiglia|prosecco|spumante|franciacorta)\b/.test(n)) return false;
        return /\b(acqua|naturale|frizzante|nat|frizz|gas|coca|cola|fanta|sprite|tonica|ginger|lemonsoda|lemon soda|redbull|red bull|the|te|tea|succo|succhi|soda|tassoni|chinotto|aranciata|schweppes|cedrata|cocco)\b/.test(n) || catIngr(r).some(x => /^(sode|acqua|bibite)/.test(x)); };
      // le birre (alla spina con la misura, o in lattina/bottiglia) vanno nelle Birre; i caffè nella Caffetteria
      const birra = (r) => { const n = nn(r.nome);
        return /^birr/.test(nn(r.catCassa)) || /\b(piccola|media|boccale|giraffa|caraffa|pinta|mezza pinta)$/.test(n) && !/\b(coca|cola|fanta|sprite|acqua)\b/.test(n)
          || /\b(birra|ipa|pils|lager|weiss|stout|guinness|kilkenny|menabrea|franziskaner|bud|ale|blanche|crak|residual)\b/.test(n) || /\blattina\b/.test(n) && !/\b(coca|cola|fanta|sprite|fuze|tea|the|redbull|soda)\b/.test(n) || catIngr(r).some(x => /^(birr|fust)/.test(x)); };
      const caffe = (r) => /\b(caffe|decaffeinato|orzo|ginseng|cappuccino|macchiato)\b/.test(nn(r.nome)) || /^caffett/.test(nn(r.catCassa));
      const birre = tipi().find(k => nn(M.TIPI[k]) === 'birre'), caff = tipi().find(k => nn(M.TIPI[k]) === 'caffetteria');
      const tis = tipi().find(k => /^tisan/.test(nn(M.TIPI[k]))), vb = tipi().find(k => nn(M.TIPI[k]) === 'vini bottiglia'), vc = tipi().find(k => nn(M.TIPI[k]) === 'vini calice');
      S.ricette.forEach(r => { if (r.tipo !== misto) return; const n = nn(r.nome);
        if (caff && caffe(r)) r.tipo = caff;
        else if (tis && /\b(tisana|karkade|zenzero|cannella|liquirizia|earl grey|camomilla|infuso)\b/.test(n)) r.tipo = tis;
        else if (vb && /^(bottiglia|bott)\b/.test(n)) r.tipo = vb;
        else if (vc && /^calice\b/.test(n)) r.tipo = vc;
        else if (birre && birra(r)) r.tipo = birre; else if (bibita(r)) r.tipo = dest; });
      // rimasto vuoto: il gruppo misto non serve più
      if (!S.ricette.some(r => r.tipo === misto)) { if ((S.tipiExtra || []).some(t => t.id === misto)) S.tipiExtra = S.tipiExtra.filter(t => t.id !== misto); else S.tipiNascosti = Array.from(new Set((S.tipiNascosti || []).concat(misto))); M.aggiornaTipi(); return; }
      // se dentro sono rimasti solo vini, il gruppo si chiama «Vini»
      const restano = S.ricette.filter(r => r.tipo === misto);
      if (restano.length && restano.every(r => /\b(vino|vini|calice|bottiglia|bott|prosecco|spumante|franciacorta|sangiovese|rebola|malvasia|gewurz|sangue di giuda|lambrusco|bianco|rosso|rose)\b/.test(nn(r.nome)))) {
        const tm = (S.tipiExtra || []).find(x => x.id === misto), nuovo = 'Vini';
        if (tm) tm.nome = nuovo; else { S.nomiTipi = S.nomiTipi || {}; S.nomiTipi[misto] = nuovo; }
        M.aggiornaTipi();
      }
    }
  }

  function togliGruppoPanini() {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const tipi = Object.keys(M.TIPI).filter(k => k !== 'semilavorato');
    const pan = tipi.find(k => nn(M.TIPI[k]) === 'panini'); if (!pan) return;
    // le ricette rimaste dentro vanno nei Burgers (o nel primo gruppo della cucina)
    const dove = tipi.find(k => k !== pan && /^(burgers|classic burgers|burger)$/.test(nn(M.TIPI[k])));
    if (S.ricette.some(r => r.tipo === pan) && !dove) return;
    S.ricette.forEach(r => { if (r.tipo === pan) r.tipo = dove; });
    if ((S.tipiExtra || []).some(t => t.id === pan)) S.tipiExtra = S.tipiExtra.filter(t => t.id !== pan); else S.tipiNascosti = Array.from(new Set((S.tipiNascosti || []).concat(pan)));
    M.aggiornaTipi();
  }

  // dopo il venduto 2026: amari e grappe generici della cassa di nuovo nelle loro ricette, la «Mezza nat» doppia senza vendite via, i fritti in «Da spizzicare»
  function sistemaDopoVenduto() {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const esito = { generici: [], mezzeTolte: 0, fritti: 0 };
    const totVend = (r) => Object.values(r.vendite || {}).reduce((t, q) => t + (Number(q) || 0), 0);
    // 1) «AMARI» e «GRAPPA» della cassa: ricetta generica, costo = la bottiglia più economica del gruppo (60 ml)
    [{ id: 'r_mwknirqgdn1o', nome: 'Amaro generico', cassa: 'AMARI', base: 'amari', prezzo: 3.5 }, { id: 'r_mwknirqg5oi4', nome: 'Grappa generica', cassa: 'GRAPPA', base: 'grappa', prezzo: 4.5 }].forEach(g => {
      const bott = S.ricette.filter(r => r.id.startsWith('r_gr_' + g.base + '-'));
      if (!bott.length) return;
      const tipo = bott[0].tipo;
      let gen = M.ricetta(g.id);
      if (!gen) { gen = { id: g.id, nome: g.nome, tipo, prezzo: null, righe: [], asporto: [], vendite: {}, costiExtra: [], note: '' }; S.ricette.push(gen); }
      gen.nome = g.nome; gen.tipo = tipo; gen.nomeCassa = g.cassa; delete gen.media;
      // le vendite finite su una bottiglia per nome simile tornano qui, e quella bottiglia non si ricorda più il nome generico
      const k = nn(g.cassa); let spostati = 0;
      S.ricette.forEach(r => {
        if (r === gen) return;
        const alias = (r.aliasCassa || []).some(a => nn(a) === k), nome = r.nomeCassa && nn(r.nomeCassa) === k;
        if (!alias && !nome) return;
        if (alias) r.aliasCassa = r.aliasCassa.filter(a => nn(a) !== k);
        if (nome) delete r.nomeCassa;
        if (!r.id.startsWith('r_gr_')) return;
        Object.entries(r.vendite || {}).forEach(([per, q]) => { gen.vendite = gen.vendite || {}; gen.vendite[per] = (Number(gen.vendite[per]) || 0) + (Number(q) || 0); spostati += Number(q) || 0; });
        r.vendite = {};
        if (!gen.prezzo && r.prezzo) gen.prezzo = r.prezzo;
      });
      if (!gen.prezzo) gen.prezzo = g.prezzo;
      // costo: la bottiglia più economica del gruppo, 60 ml
      let min = null;
      bott.forEach(r => (r.righe || []).forEach(rg => { const c = M.costoRiga(rg.rif, 60, undefined, []); if (c.costo != null && c.costo > 0 && (!min || c.costo < min.costo)) min = { rif: rg.rif, costo: c.costo, nome: r.nome }; }));
      if (min) gen.righe = [{ rif: min.rif, quantita: 60 }];
      gen.note = 'Voce generica della cassa («' + g.cassa + '»), per le vendite di prima delle varianti per bottiglia. Costo: la bottiglia più economica del gruppo' + (min ? ' (' + min.nome + ')' : '') + ', 60 ml.';
      esito.generici.push({ nome: g.nome, spostati, bottiglia: min && min.nome });
    });
    // 2) «Mezza nat» doppia: tolgo quella senza nessuna vendita (se ce n'è un'altra)
    const mezze = S.ricette.filter(r => r.tipo !== 'semilavorato' && nn(r.nome) === 'mezza nat');
    if (mezze.length > 1 && mezze.some(r => totVend(r) > 0)) {
      const via = mezze.filter(r => !totVend(r) && !M.usatoIn('r:' + r.id).dirette.length);
      const tieni = mezze.find(r => totVend(r) > 0);
      via.forEach(r => { (r.aliasCassa || []).forEach(a => { if (!(tieni.aliasCassa || []).includes(a)) tieni.aliasCassa = (tieni.aliasCassa || []).concat(a); }); });
      S.ricette = S.ricette.filter(r => !via.includes(r)); esito.mezzeTolte = via.length;
    }
    // 3) i fritti rimasti nel gruppo «Fritti» vanno in «Da spizzicare», e «Fritti» sparisce
    const spizz = Object.keys(M.TIPI).find(t => t !== 'fritto' && t !== 'semilavorato' && /\bspizzicare\b/.test(nn(M.TIPI[t])));
    if (spizz) {
      S.ricette.forEach(r => { if (r.tipo === 'fritto') { r.tipo = spizz; esito.fritti++; } });
      const cg = (S.costiGruppo || {}).fritto; if (cg && cg.length && !((S.costiGruppo[spizz] || []).length)) S.costiGruppo[spizz] = cg;
      if (S.costiGruppo) delete S.costiGruppo.fritto;
      S.tipiNascosti = Array.from(new Set((S.tipiNascosti || []).concat('fritto'))); M.aggiornaTipi();
    }
    // 4) collegamenti ricordati per «nome simile» che erano sbagliati: «+ pata» o misura diversa, o la voce generica su una bottiglia
    esito.slegati = [];
    S.ricette.forEach(r => {
      const via = (r.aliasCassa || []).filter(a => somiglianzaNomi(a, r.nome) < 0.65 && (r.id.startsWith('r_gr_') || /\b(pata|doppio|triplo)\b/i.test(a) !== /\b(pata|doppio|triplo)\b/i.test(r.nome)));
      if (!via.length) return;
      r.aliasCassa = r.aliasCassa.filter(a => !via.includes(a)); via.forEach(a => esito.slegati.push(a + ' → ' + r.nome));
    });
    // 5) il burrito è un panino (non il mezcal Burrito Fiestero): ricette «Burrito» e «Burrito + pata» nei gruppi dei burger
    const gruppoDi = (re, poi) => { const r = S.ricette.find(x => x.tipo !== 'semilavorato' && re.test(normCassa(x.nomeCassa || ''))); return r ? r.tipo : poi; };
    [{ id: 'r_burrito', nome: 'Burrito', cassa: 'BURRITO', tipo: gruppoDi(/^(resmash|cheesebacon|crispy rebacon)\b/, 'panino') },
      { id: 'r_burrito-pata', nome: 'Burrito + pata', cassa: 'BURRITO + PATA', tipo: gruppoDi(/^(oklahoma|double b) pata\b/, 'combo') }].forEach(x => {
      let r = M.ricetta(x.id) || S.ricette.find(y => y.tipo !== 'semilavorato' && normCassa(y.nomeCassa || '') === normCassa(x.cassa));
      if (!r) { r = { id: x.id, nome: x.nome, tipo: x.tipo, prezzo: null, righe: [], asporto: [], vendite: {}, costiExtra: [], note: 'Ricetta da completare: creata dalla vendita della cassa «' + x.cassa + '». Metti gli ingredienti.' }; S.ricette.push(r); }
      r.nomeCassa = x.cassa;
    });
    // le vendite del burrito finite sul mezcal tornano al panino
    const fiest = M.ricetta('r_gr_tequila-burrito-fiestero'), bur = M.ricetta('r_burrito');
    if (fiest && bur && esito.slegati.some(t => /^burrito → /i.test(t))) {
      Object.entries(fiest.vendite || {}).forEach(([per, q]) => { bur.vendite[per] = (Number(bur.vendite[per]) || 0) + (Number(q) || 0); });
      fiest.vendite = {};
    }
    return esito;
  }

  function creaGinTonic() {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const gt = Object.keys(M.TIPI).find(k => nn(M.TIPI[k]).startsWith('gin tonic')); if (!gt) return;
    const testo = (p) => nn([p.nomeBreve, p.nomeCompleto].join(' '));
    // le toniche in lattina/bottiglietta comprate a cartone (es. «15CL X24») erano contate come un pezzo solo: un pezzo = una lattina
    S.prodotti.forEach(p => { const m = String(p.nomeCompleto || '').match(/x\s*(\d{1,2})\b/i);
      if (/tonic|tonica/.test(testo(p)) && p.unita === 'pz' && (Number(p.contenuto) || 1) === 1 && m && Number(m[1]) >= 6 && (M.prezzo(p) || 0) > 5) { p.contenuto = Number(m[1]); p.confezione = 'cartone'; } });
    const goldberg = M.prodotto('p_mwkopuaxeoxv') || S.prodotti.find(p => /goldberg/.test(testo(p)) && /tonic/.test(testo(p)));
    // ml della bottiglia scritti nel nome della fattura: 070 / 0700 / cl 70 = 700 ml, 100 / cl 100 = 1000 ml, 050 = 500 ml
    const mlDa = (p) => { const t = String(p.nomeCompleto || '');
      const m = t.match(/\b(?:cl\.?\s*)?(0?70|0700|100|1000|050|0500|75|075)\b/i); if (!m) return 700;
      const v = m[1].replace(/^0+/, ''); return v === '70' || v === '700' ? 700 : v === '100' || v === '1000' ? 1000 : v === '50' || v === '500' ? 500 : v === '75' ? 750 : 700; };
    const chiave = (p) => nn(p.nomeBreve).replace(/\bgin\b/g, '').replace(/\s+/g, ' ').trim();
    // i gin che hanno già il loro gin tonic
    const fatti = new Set();
    S.ricette.forEach(r => { if (!/^gin ?tonic/.test(nn(r.nome)) && r.tipo !== gt) return;
      (r.righe || []).forEach(rg => { const p = rg.rif.startsWith('p:') && M.prodotto(rg.rif.slice(2)); if (p && nn(p.categoria) === 'gin') fatti.add(chiave(p)); }); });
    S.prodotti.filter(p => nn(p.categoria) === 'gin' && !p.speciale).forEach(p => {
      const k = chiave(p); if (fatti.has(k)) return; fatti.add(k);
      if (p.unita === 'pz' && (Number(p.contenuto) || 1) === 1) {
        const ml = mlDa(p);
        S.ricette.forEach(x => [].concat(x.righe || [], x.asporto || []).forEach(rg => { if (rg.rif === 'p:' + p.id) rg.quantita = Math.round((Number(rg.quantita) || 0) * ml * 100) / 100; }));
        p.unita = 'ml'; p.contenuto = ml; p.confezione = 'bottiglia';
      }
      let nome = p.nomeBreve.replace(/\bgin\b/ig, '').replace(/\s+/g, ' ').trim();
      if (!nome) nome = String(p.nomeCompleto || '').replace(/\bgin\b|\d+([.,]\d+)?\s*(%|°)|\b0?\d{2,4}\b|\bcl\.?/ig, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^./, c => c.toUpperCase()) || p.nomeBreve;
      nome = nome.replace(/^./, c => c.toUpperCase());
      const id = 'r_gt_' + nn(nome).replace(/ /g, '-');
      if (M.ricetta(id)) return;
      S.ricette.push({ id, nome: 'Gin tonic ' + nome, tipo: gt, prezzo: null, righe: [{ rif: 'p:' + p.id, quantita: 50 }].concat(goldberg ? [{ rif: 'p:' + goldberg.id, quantita: 1 }] : []), asporto: [], vendite: {}, costiExtra: [], note: '' });
    });
  }

  // [nome del prodotto nell'app, riga del listino, prezzo del listino senza IVA]
  const LISTINO_ZONZINI_1 = [["Amaro Formidabile", "FORMIDABILE Amaro cl.70", 19.64], ["Anima Nera", "MARZADRO Anima Nera cl.70", 13.21], ["Averna", "AVERNA cl.70", 10.23], ["Braulio", "BRAULIO Amaro cl.70", 11.4], ["Borghetti", "BORGHETTI Caffe` cl.70", 9.23], ["Frangelico", "FRANGELICO cl.70", 12.4], ["Irish Mist", "IRISH MIST cl.70", 17.01], ["Liquore Strega", "STREGA cl.70", 10.77], ["Stravecchio", "STRAVECCHIO cl.70", 9.77], ["Carlo Alberto", "CARLO ALBERTO RIS.Sup cl.70", 19.55], ["Campari", "BITTER Campari cl.100", 13.67], ["Select", "SELECT Bitter cl.100", 11.49], ["Carpano", "CARPANO Vermouth cl.100", 8.42], ["Fernet", "FERNET cl.100", 16.65], ["Jägermeister", "JAGERMAISTER cl.100", 14.03], ["Kahlúa", "KAHLUA cl.100", 13.58], ["Aurum", "AURUM cl.70", 15.57], ["Angostura", "ANGOSTURA Grande ml.200", 11.77], ["Prime Uve bianca", "MASCHIO Prime Uve BIANCA cl70", 20.36], ["J. Bally Bianco", "BALLY Rum bianco cl.70", 18.19], ["Herradura Reposado", "TEQUILA HERRADURA Repos. cl 70", 32.22], ["Buffalo Trace", "BUFFALO TRACE Kentucky cl.70", 18.01], ["Jack Daniel's", "JACK DANIEL'S cl 100", 20.63], ["Jameson", "JAMESON cl.100", 19.64], ["Nikka Days", "NIKKA DAYS Blended cl 70", 28.51], ["Rare Breed", "WILD TURKEY RARE BREED cl.70", 42.26], ["Talisker Skye", "TALISKER SKYE cl.70", 28.96], ["Tullamore", "TULLAMORE DEW cl.70", 13.21], ["Wild Turkey", "WILD TURKEY 81 Proof cl 100", 22.99], ["Wild Turkey Rye", "WILD TURKEY Rye cl 70", 23.8], ["Gin Mare", "MARE Gin cl.100", 28.42], ["Tanqueray 0%", "TANQUERAY Senza Alcool cl.70", 11.13], ["Ginger ale", "SCHWEPPES Ginger Ale cl.18x24", 17.56], ["Ginger beer Schweppes", "SCHWEPPES Ginger Beer cl.18x24", 17.65], ["Pastis", "PASTIS-51 Citron cl.70", 9.32], ["Suntory", "SUNTORY SHIRO Kaku cl 70", 23.89], ["Antica Formula", "CARPANO Antica Formula cl.100", 23.8], ["Punt e Mes", "PUNT E MES cl.100", 8.87], ["Cynar", "CYNAR cl.100", 12.76], ["Varnelli", "VARNELLI Amaro cl.100", 21.72], ["Appleton 12", "APPLETON Estate 12 Anni cl.70", 34.21], ["Doorly's XO", "DOORLY'S XO Rhum", 19.37], ["Gosling", "GOSLING Black Seal cl.100", 21.45], ["Myers's", "MYER'S Rum cl.100", 13.85], ["Wray & Nephew", "WRAY & NEPHEW WHITE CL 70", 29.05], ["Talisker 10", "TALISKER 10 Anni cl.70", 31.04], ["Wild Turkey 101", "WILD TURKEY 101 50,5ø cl.70", 22.44], ["Laphroaig 10", "LAPHROAIG 10 anni cl.70", 30.5], ["Oban 14", "OBAN 14 anni cl.70", 51.4], ["Nikka From the Barrel", "NIKKA From The Barrel cl 50", 30.5], ["Red Bull", "RED BULL Classica x 24", 23.71], ["Caol Ila 12", "CAOL ILA 11YO SR 24 cl 70", 73.03], ["Sambuca", "MOLINARI  cl.100", 15.57]];
  const LISTINO_ZONZINI_2 = [['Amaro Lucano', 'LUCANO  cl.70', 8.51], ['Brancamenta', 'FERNET Menta cl.70', 11.04], ['Cocchi', 'VERMOUTH COCCHI cl.70', 14.03], ['Disaronno', 'SARONNO  cl.70', 10.23],
    ['Limoncello', 'VILLA MASSA Limoncello cl 100', 15.66], ['Amarone invecchiata', 'MARZADRO Giare Amarone cl.70', 29.77], ['Poli bianca', 'POLI SARPA cl. 70', 15.20],
    ['Black Label', 'JOHNNIE WALKER Black 12y cl.70', 20.27], ['Red Label', 'JOHNNIE  WALKER Red cl 70', 10.50]];
  // la bottiglia creata senza prezzo per i lisci lascia il posto a quella che c'è già nelle fatture (ricette comprese)
  function collegaBottiglieDaFattura() {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const testo = (p) => nn([p.nomeBreve, p.nomeCompleto].concat((p.articoli || []).map(a => a.descrizione)).join(' '));
    const fatti = [];
    [['Bello', /amarobello|amaro bello/], ['Vida', /maguey|\bvida\b/]].forEach(([nome, re]) => {
      const ph = S.prodotti.find(p => /^p_gr_/.test(p.id) && nn(p.nomeBreve) === nn(nome) && !M.daFattura(p));
      const t = S.prodotti.find(p => p !== ph && !p.speciale && M.daFattura(p) && re.test(testo(p)));
      if (!ph || !t) { fatti.push(nome + ': ' + (!t ? 'non c\'è nelle fatture' : 'già sistemato')); return; }
      if (t.unita === 'pz' && (Number(t.contenuto) || 1) === 1) {
        S.ricette.forEach(x => [].concat(x.righe || [], x.asporto || []).forEach(rg => { if (rg.rif === 'p:' + t.id) rg.quantita = Math.round((Number(rg.quantita) || 0) * 700 * 100) / 100; }));
        t.unita = 'ml'; t.contenuto = 700; t.confezione = 'bottiglia';
      }
      S.ricette.forEach(x => [].concat(x.righe || [], x.asporto || []).forEach(rg => { if (rg.rif === 'p:' + ph.id) rg.rif = 'p:' + t.id; }));
      Object.values(S.costiGruppo || {}).forEach(l => l.forEach(g => { if (g.rif === 'p:' + ph.id) g.rif = 'p:' + t.id; }));
      t.categoria = ph.categoria; if (ph.reparto) t.reparto = ph.reparto;
      S.prodotti = S.prodotti.filter(p => p !== ph);
      fatti.push(nome + ' → ' + t.nomeBreve + ' (' + euro(M.prezzo(t)) + ')');
    });
    return fatti;
  }
  function prezziListinoZonzini(lista) {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const forn = S.fornitori.find(f => /zonzini/i.test(f.nome)); if (!forn) return { messi: [], saltati: (lista || LISTINO_ZONZINI_1).map(x => x[0] + ': manca il fornitore Zonzini') };
    const oggi = M.oggi(), messi = [], saltati = [];
    (lista || LISTINO_ZONZINI_1).forEach(([nome, descr, prezzo]) => {
      const l = S.prodotti.filter(p => !p.speciale && nn(p.nomeBreve) === nn(nome));
      const p = l.find(x => !M.daFattura(x)) || l[0];
      if (!p) { saltati.push(nome + ': non trovato'); return; }
      if (M.daFattura(p)) { saltati.push(nome + ': ha già il prezzo da fattura'); return; }
      const f = formatoListino(descr), pezzi = f.pezzi > 1 ? f.pezzi : 1;
      let misura = f.misura && f.unita === 'ml' ? f.misura : 0;
      if (pezzi === 1 && !misura && p.unita !== 'ml') misura = 700;
      // bottiglia: la misura del prodotto diventa quella del listino (a pezzo → in ml, le ricette a pezzi passano in ml)
      if (pezzi === 1 && misura) {
        if (p.unita === 'pz' && (Number(p.contenuto) || 1) === 1) S.ricette.forEach(x => [].concat(x.righe || [], x.asporto || []).forEach(rg => { if (rg.rif === 'p:' + p.id) rg.quantita = Math.round((Number(rg.quantita) || 0) * misura * 100) / 100; }));
        if (p.unita === 'pz' || p.unita === 'ml') { p.unita = 'ml'; p.contenuto = misura; p.confezione = 'bottiglia'; }
      } else if (pezzi > 1 && p.unita === 'pz') { p.contenuto = 1; }
      else if (pezzi > 1 && p.unita === 'ml' && misura) { p.contenuto = misura; }
      const pr = Math.round(prezzo / pezzi * 10000) / 10000;
      p.prezzi = (p.prezzi || []).filter(e => !/^Foglio/.test(e.origine || '') && e.origine !== 'Listino ' + forn.nome);
      p.prezzi.push({ data: oggi, prezzo: pr, fornitoreId: forn.id, origine: 'Listino ' + forn.nome });
      p.fornitoreId = forn.id; delete p.daCompletare;
      if (!(p.articoli || []).some(a => a.fornitoreId === forn.id && normCassa(a.descrizione) === normCassa(descr))) (p.articoli = p.articoli || []).push({ fornitoreId: forn.id, descrizione: descr, codice: '', confezioniPerUnita: pezzi });
      messi.push(p.nomeBreve + ' ' + (pezzi > 1 ? euro(pr) + ' a pezzo' : euro(pr) + ' (' + qta(p.contenuto) + ' ml)'));
    });
    return { data: oggi, messi, saltati };
  }

  // [parole nel nome del gruppo, soglia]: la prima che combacia vince (l'ordine conta: «gin tonic» prima di «tonic», «vini bottiglia» prima di «vini»)
  const SOGLIE_RICERCA = [
    [/\bgin ?tonic/, 5], [/cocktail|analcolic|drink|mocktail|spritz/, 5.5], [/amar|liquor|vermouth|bitter/, 5], [/whisk|\brum\b|tequila|mezcal|distillat/, 4.5], [/grapp/, 5],
    [/birr|fust|spina/, 5], [/vin.*bottigli|bottigli/, 3], [/vin.*calice|calice/, 4], [/\bvin/, 4], [/bevand|bibit|acqu/, 8], [/caff/, 9], [/tisan|\bthe\b|\bte\b/, 7],
    [/burger|panin|piadin|toast|baby/, 3.7], [/fritt|spizzic|patat|stuzzic/, 5], [/insalat/, 3.7], [/dolc|dessert/, 4.4], [/sals/, 5.5], [/combinaz|\bmenu\b|combo/, 3.4]
  ];
  function soglieDaRicerca() {
    const nn = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const fatte = [];
    Object.keys(M.TIPI).filter(k => k !== 'semilavorato').forEach(k => {
      const n = nn(M.TIPI[k]); if (/copert/.test(n)) return;
      const x = SOGLIE_RICERCA.find(([re]) => re.test(n)); if (!x) return;
      S.impostazioni.soglie[k] = x[1]; fatte.push(M.TIPI[k] + ' ×' + String(x[1]).replace('.', ','));
    });
    return fatte;
  }

  // ---------- Salvataggio online (Firebase) ----------
  let db = null, utente = null, ultimoSalvato = new Map(), timerCloud = null, inVolo = 0, ultimoTimbro = null;
  // finché non ho controllato che la copia sul dispositivo sia ancora quella online, non scrivo niente online
  let attesaCloud = Promise.resolve();
  // copia dei dati sul dispositivo (IndexedDB): all'avvio l'app parte subito da qui, poi controlla online se è cambiato qualcosa
  const COPIA = {
    apri() { return new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('copia lenta')), 2000); try { const r = indexedDB.open('gestionaleRepub', 1); r.onupgradeneeded = () => r.result.createObjectStore('c'); r.onsuccess = () => { clearTimeout(t); ok(r.result); }; r.onerror = () => { clearTimeout(t); ko(r.error); }; r.onblocked = () => { clearTimeout(t); ko(new Error('copia bloccata')); }; } catch (e) { clearTimeout(t); ko(e); } }); },
    async leggi() { try { const bd = await COPIA.apri(); return await new Promise(ok => { setTimeout(() => ok(null), 4000); const t = bd.transaction('c').objectStore('c').get('cloud'); t.onsuccess = () => ok(t.result || null); t.onerror = () => ok(null); }); } catch (e) { return null; } },
    async scrivi(v) { try { const bd = await COPIA.apri(); await new Promise(ok => { const t = bd.transaction('c', 'readwrite'); t.objectStore('c').put(v, 'cloud'); t.oncomplete = ok; t.onerror = ok; t.onabort = ok; }); } catch (e) { /* niente copia: pazienza */ } },
    timer: null,
    // quello che c'è online (documenti salvati) + il timbro
    aggiorna() { clearTimeout(COPIA.timer); COPIA.timer = setTimeout(() => { if (utente) COPIA.scrivi({ email: utente.email || '', timbro: ultimoTimbro, docs: [...ultimoSalvato] }); }, 1500); }
  };
  const COLL = ['prodotti', 'ricette', 'fatture', 'fornitori'];
  function documenti(stato) {
    const m = new Map(); const resto = {};
    Object.keys(stato).forEach(k => { if (!COLL.includes(k) && k !== 'cestino') resto[k] = stato[k]; });
    // cestino: ricette, prodotti, fatture e fornitori restano nella loro raccolta con il segno «_cestino»; il resto (periodi, eventi) nel generale
    resto.cestino = (stato.cestino || []).filter(c => !COLL.includes(c.tipo));
    m.set('dati/generale', JSON.stringify(resto));
    COLL.forEach(c => (stato[c] || []).forEach(x => m.set(c + '/' + x.id, JSON.stringify(x))));
    (stato.cestino || []).forEach(c => { if (COLL.includes(c.tipo) && !m.has(c.tipo + '/' + c.x.id)) m.set(c.tipo + '/' + c.x.id, JSON.stringify(Object.assign({}, c.x, { _cestino: { id: c.id, quando: c.quando, gruppo: c.gruppo || null, righe: c.righe || null } }))); });
    return m;
  }
  function salvaCloud() { clearTimeout(timerCloud); timerCloud = setTimeout(scriviCloud, 400); }
  async function scriviCloud() {
    await attesaCloud;
    timerCloud = null;
    const nuovi = documenti(S); const ops = [];
    nuovi.forEach((v, k) => { if (ultimoSalvato.get(k) !== v) ops.push([k, v]); });
    ultimoSalvato.forEach((v, k) => { if (!nuovi.has(k)) ops.push([k, null]); });
    if (!ops.length) return;
    // il documento generale porta sempre un «timbro» nuovo: gli altri dispositivi leggono solo quello per sapere se è cambiato qualcosa
    if (!ops.some(([k]) => k === 'dati/generale')) ops.unshift(['dati/generale', nuovi.get('dati/generale')]);
    const timbro = Date.now() + '-' + Math.random().toString(36).slice(2, 7); ultimoTimbro = timbro;
    ultimoSalvato = nuovi;
    for (let i = 0; i < ops.length; i += 400) {
      const b = db.batch();
      const parte = ops.slice(i, i + 400);
      parte.forEach(([k, v]) => { const ref = db.doc(k); if (v == null) b.delete(ref); else b.set(ref, Object.assign({ json: v, da: utente.email || '', quando: Date.now() }, k === 'dati/generale' ? { timbro } : {})); });
      inVolo++;
      b.commit().then(() => { inVolo--; COPIA.aggiorna(); }, e => {
        inVolo--;
        // al prossimo salvataggio questi documenti vengono rimandati
        parte.forEach(([k, v]) => { if (v == null) ultimoSalvato.set(k, '(da cancellare)'); else ultimoSalvato.delete(k); });
        avviso('Non riesco a salvare online: ' + e.message + '. Riprovo alla prossima modifica.');
      });
    }
  }
  // dai documenti online (o dalla copia sul dispositivo) ricostruisco lo stato
  function statoDaDocumenti(docs) {
    const g = docs.get('dati/generale'); if (!g) return null;
    const stato = JSON.parse(g);
    const ces = (stato.cestino || []).slice();
    COLL.forEach(c => { stato[c] = []; });
    docs.forEach((v, k) => {
      const c = k.slice(0, k.indexOf('/')); if (!COLL.includes(c) || v == null || v === '(da cancellare)') return;
      const x = JSON.parse(v);
      if (x._cestino) { const m = x._cestino; delete x._cestino; ces.push({ id: m.id, tipo: c, quando: m.quando, gruppo: m.gruppo, righe: m.righe, x }); }
      else stato[c].push(x);
    });
    stato.cestino = ces.sort((a, b) => a.quando < b.quando ? 1 : -1);
    return stato;
  }
  async function caricaCloud() {
    const gen = await db.doc('dati/generale').get();
    if (!gen.exists) return null;
    ultimoTimbro = gen.data().timbro || null;
    const docs = new Map([['dati/generale', gen.data().json]]);
    const fatti = [];
    const mostra = () => { const x = document.getElementById('carico-passi'); if (x) x.textContent = fatti.length ? 'Fatto: ' + fatti.join(', ') : ''; };
    for (const c of COLL) {
      const snap = await db.collection(c).get();
      snap.docs.forEach(d => docs.set(c + '/' + d.id, d.data().json));
      fatti.push(c + ' ' + snap.docs.length); mostra();
    }
    return statoDaDocumenti(docs);
  }
  function caricaScriptOrdinati(lista) { return lista.reduce((p, src) => p.then(() => caricaScript(src)), Promise.resolve()); }
  function datiDelDispositivo() { try { const t = localStorage.getItem(CHIAVE); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function schermataAccesso(msg) {
    $('#testa').innerHTML = '<span></span><h1>Gestionale Repub</h1><span></span>';
    $('#tabbar').innerHTML = ''; $('#contenuto').className = '';
    $('#contenuto').innerHTML = `<form class="card form accesso" id="acc-form" autocomplete="on"><h3>Entra nel gestionale</h3>${msg ? `<p class="msg rosso">${esc(msg)}</p>` : ''}
      <label>Email<input id="acc-email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"></label>
      <label>Password<span class="campo-occhio"><input id="acc-pw" name="password" type="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false"><button type="button" class="occhio" data-occhio="acc-pw" aria-label="Mostra la password">${OCCHIO}</button></span></label>
      <div class="bottoni colonna"><button type="submit" class="btn primario" id="acc-ok">Entra</button><button type="button" class="btn piccolo" id="acc-dim">Ho dimenticato la password</button></div></form>`;
    const entra = () => firebase.auth().signInWithEmailAndPassword($('#acc-email').value.trim(), $('#acc-pw').value)
      .catch(e => schermataAccesso(/password|credential|user-not-found|invalid/i.test(e.code || '') ? 'Email o password sbagliate.' : 'Accesso non riuscito: ' + e.message));
    // un vero modulo: così il portachiavi di iPhone riconosce email e password e propone di salvarle
    $('#acc-form').onsubmit = (e) => { e.preventDefault(); const b = $('#acc-ok'); b.disabled = true; b.textContent = 'Un attimo…'; entra(); };
    $('#acc-dim').onclick = () => { const em = $('#acc-email').value.trim(); if (!em) { alert('Scrivi prima la tua email.'); return; } firebase.auth().sendPasswordResetEmail(em).then(() => alert('Ti ho mandato una mail per cambiare la password.'), e => alert(e.message)); };
  }
  function sceltaPrimoAvvio() {
    return new Promise(ok => {
      const locale = datiDelDispositivo();
      const nf = locale ? (locale.fatture || []).length : 0;
      $('#contenuto').innerHTML = `<div class="card form accesso"><h3>Primo avvio online</h3><p>Il database online è vuoto. Da dove parto?</p>
        <div class="bottoni colonna">${locale ? `<button class="btn primario" id="pa-loc">Porta online i dati di questo dispositivo (${nf} fatture, ${(locale.prodotti || []).length} prodotti)</button>` : ''}
        <button class="btn" id="pa-prova">Parti dai dati della prova</button></div></div>`;
      if (locale) $('#pa-loc').onclick = () => ok(locale);
      $('#pa-prova').onclick = () => ok(JSON.parse(JSON.stringify(window.DATI_INIZIALI)));
    });
  }
  // porta le fatture salvate su questo dispositivo dentro i dati online (le doppie vengono scartate)
  function portaFattureLocali() {
    const locale = datiDelDispositivo();
    if (!locale || !(locale.fatture || []).length) { alert('Su questo dispositivo non ci sono fatture salvate.'); return; }
    const lista = locale.fatture.map(f => {
      const x = JSON.parse(JSON.stringify(f));
      x.stato = 'da_abbinare'; x.resoconto = null; x.avvisi = null; x.fornitoreId = null; x.servizi = false;
      x.righe.forEach(r => { r.prodottoId = null; r.ignora = false; r.automatico = false; r.creato = false; r.confezioniPerUnita = 1; });
      return x;
    });
    if (!S.casella.url && locale.casella && locale.casella.url) S.casella = locale.casella;
    const prima = S.fatture.length;
    aggiungiFatture(lista, true);
    avviso(`Portate online ${S.fatture.length - prima} fatture.`);
    disegna();
  }
  async function avvia() {
    if (!CLOUD) { prepara(carica()); salva(); partenza(); return; }
    $('#contenuto').innerHTML = '<p class="tenue centro">Avvio…</p><div class="rotella"></div>';
    try {
      const v = '10.12.2';
      await caricaScriptOrdinati([`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`, `https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`, `https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`]);
    } catch (e) { $('#contenuto').innerHTML = '<p class="msg rosso">Non riesco a collegarmi: controlla la connessione e ricarica.</p>'; return; }
    firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.firestore();
    try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* già attivo o non disponibile */ }
    let partito = false;
    firebase.auth().onAuthStateChanged(async u => {
      utente = u;
      if (!u) { schermataAccesso(); return; }
      // 1) parto subito dalla copia sul dispositivo, se è dello stesso account
      const copia = await COPIA.leggi();
      if (copia && copia.docs && copia.email === (u.email || '') && !partito) {
        try {
          const docs = new Map(copia.docs), stato = statoDaDocumenti(docs);
          if (stato) {
            ultimoSalvato = documenti(stato); ultimoTimbro = copia.timbro || null;
            let fine; attesaCloud = new Promise(r => { fine = r; });
            prepara(stato); partito = true; partenza(); salva();
            // 2) controllo online: se il timbro è lo stesso ho già tutto; se no ricarico e ridisegno
            (async () => {
              try {
                const g = await db.doc('dati/generale').get();
                if (g.exists && (!g.data().timbro || g.data().timbro !== ultimoTimbro)) {
                  const nuovo = await caricaCloud();
                  if (nuovo) { ultimoSalvato = documenti(nuovo); const bozza = ui.bozza; prepara(nuovo); ui.bozza = bozza; COPIA.aggiorna(); ridisegnaMantenendo(); }
                }
              } catch (e) { avviso('Non riesco a controllare i dati online: uso quelli sul dispositivo.'); }
              fine();
            })();
            return;
          }
        } catch (e) { /* copia rovinata: carico online */ }
      }
      $('#contenuto').innerHTML = '<p class="tenue centro">Carico i dati…</p><div class="rotella"></div><p class="tenue centro piccolo" id="carico-passi"></p><div class="bottoni" id="carico-riprova" hidden style="justify-content:center"><button class="btn" onclick="location.reload()">Ci mette troppo: riprova</button></div>';
      setTimeout(() => { const r = document.getElementById('carico-riprova'); if (r) r.hidden = false; }, 45000);
      try {
        let stato = await caricaCloud();
        if (stato) ultimoSalvato = documenti(stato);
        else { stato = await sceltaPrimoAvvio(); ultimoSalvato = new Map(); }
        prepara(stato); salva(); COPIA.aggiorna();
        if (!partito) { partito = true; partenza(); } else disegna();
      } catch (e) {
        $('#contenuto').innerHTML = `<p class="msg rosso">${/permission/i.test(e.message) ? 'Questo account non ha il permesso di vedere i dati del gestionale.' : 'Errore nel caricare i dati: ' + esc(e.message)}</p><button class="btn" onclick="firebase.auth().signOut()">Esci</button>`;
      }
    });
    // quando torni sull'app, ricarico i dati cambiati dagli altri dispositivi
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible' || !utente || !S || timerCloud || inVolo || ui.bozza || ui.conta) return;
      try {
        // prima leggo solo il timbro (una lettura): se nessuno ha cambiato niente non ricarico tutto
        const g = await db.doc('dati/generale').get();
        if (g.exists && g.data().timbro && g.data().timbro === ultimoTimbro) return;
        const stato = await caricaCloud(); if (!stato) return;
        const nuovi = documenti(stato);
        if (JSON.stringify([...nuovi]) === JSON.stringify([...ultimoSalvato])) return;
        ultimoSalvato = nuovi; prepara(stato); COPIA.aggiorna(); ridisegnaMantenendo();
      } catch (e) { /* riprovo la prossima volta */ }
    });
  }

  // ---------- Pezzi grafici ----------
  // costo e prezzo di vendita in due etichette, ben in vista nelle righe delle ricette
  const etichetteCP = (i) => `<span class="cp"><span class="ch-cp">costo <b>${i.costo > 0 ? euro(i.costo) : '—'}</b></span><span class="ch-cp">vendo <b>${i.prezzo ? euro(i.prezzo) : '—'}</b></span></span>`;
  function badgeMolt(ind) {
    if (ind.molt == null) return `<span class="badge grigio">${ind.costo > 0 && !ind.prezzo ? 'senza prezzo' : 'senza costo'}</span>`;
    return `<span class="badge ${ind.sotto ? 'rosso' : 'verde'}">× ${n2(ind.molt)}</span>`;
  }
  function kpi(etichetta, valore, sotto, cls) {
    return `<div class="kpi ${cls || ''}"><div class="kpi-v">${valore}</div><div class="kpi-e">${esc(etichetta)}</div>${sotto ? `<div class="kpi-s">${sotto}</div>` : ''}</div>`;
  }
  // andamento nel tempo: linea a gradini (il prezzo resta uguale finché non cambia), date in proporzione,
  // numeri scritti solo dove il valore cambia, così anche con tante fatture resta leggibile
  function grafico(punti, etichettaY) {
    const tutti = (punti || []).filter(p => p.data && p.y != null).sort((a, b) => a.data < b.data ? -1 : 1);
    // un punto per giorno, e solo quando il valore cambia (più l'ultimo)
    const l = [];
    tutti.forEach(p => { const u = l[l.length - 1]; if (u && u.data === p.data) u.y = p.y; else if (!u || Math.abs(u.y - p.y) > 0.0005) l.push({ data: p.data, y: p.y }); });
    const ultimo = tutti[tutti.length - 1];
    if (l.length < 2) return tutti.length ? `<p class="tenue">Sempre ${euro(tutti[0].y)} dal ${dataIt(tutti[0].data)}: non è mai cambiato.</p>` : '<p class="tenue">Il grafico compare quando ci sono almeno due prezzi in date diverse.</p>';
    const fine = ultimo.data > l[l.length - 1].data ? ultimo.data : l[l.length - 1].data;
    const W = 340, H = 150, PL = 10, PR = 10, PT = 22, PB = 24;
    const t = d => Date.parse(d), t0 = t(l[0].data), t1 = Math.max(t(fine), t0 + 864e5);
    const ys = l.map(p => p.y); let min = Math.min(...ys), max = Math.max(...ys);
    const pad = (max - min) * 0.15 || max * 0.05 || 1; min -= pad; max += pad;
    const x = d => PL + (t(d) - t0) / (t1 - t0) * (W - PL - PR);
    const y = v => PT + (max - v) / (max - min) * (H - PT - PB);
    let path = `M${x(l[0].data).toFixed(1)},${y(l[0].y).toFixed(1)}`;
    l.slice(1).forEach(p => { path += ` H${x(p.data).toFixed(1)} V${y(p.y).toFixed(1)}`; });
    path += ` H${x(fine).toFixed(1)}`;
    // quali numeri scrivere: tutti se sono pochi, altrimenti primo, ultimo, il più alto e il più basso
    const idx = new Set(l.length <= 6 ? l.map((_, i) => i) : [0, l.length - 1, ys.indexOf(Math.max(...ys)), ys.indexOf(Math.min(...ys))]);
    const ancora = (xx) => xx < 40 ? 'start' : xx > W - 40 ? 'end' : 'middle';
    // date sull'asse: inizio, fine e qualche mese in mezzo
    const mesi = []; { const a = new Date(t0), b = new Date(t1); let d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1)); while (d < b) { mesi.push(d.toISOString().slice(0, 10)); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); } }
    const passo = Math.ceil(mesi.length / 5) || 1;
    const MM = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    const tacche = mesi.filter((_, i) => i % passo === 0).filter(d => x(d) > PL + 30 && x(d) < W - PR - 30);
    const primo = l[0].y, dopo = l[l.length - 1].y, varia = primo ? (dopo / primo - 1) * 100 : 0;
    return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etichettaY)}">
      <line x1="${PL}" y1="${H - PB}" x2="${W - PR}" y2="${H - PB}" class="asse"/>
      ${tacche.map(d => `<line x1="${x(d).toFixed(1)}" y1="${PT - 6}" x2="${x(d).toFixed(1)}" y2="${H - PB}" stroke="var(--linea)" stroke-width="1"/><text x="${x(d).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="g-x">${MM[+d.slice(5, 7) - 1]}${d.slice(5, 7) === '01' ? ' ' + d.slice(2, 4) : ''}</text>`).join('')}
      <text x="${PL}" y="${H - 8}" text-anchor="start" class="g-x">${dataIt(l[0].data).slice(0, 5)}</text><text x="${W - PR}" y="${H - 8}" text-anchor="end" class="g-x">${dataIt(fine).slice(0, 5)}</text>
      <path d="${path}" fill="none" stroke="var(--accento)" stroke-width="2.2" stroke-linejoin="round"/>
      ${l.map((p, i) => `<circle cx="${x(p.data).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="3.2" fill="var(--accento)"/>${idx.has(i) ? `<text x="${x(p.data).toFixed(1)}" y="${(y(p.y) - 7).toFixed(1)}" text-anchor="${ancora(x(p.data))}" class="g-val">${n2(p.y)}</text>` : ''}`).join('')}
    </svg>
    <p class="tenue piccolo">Dal ${dataIt(l[0].data)} ${euro(primo)}, oggi ${euro(dopo)} (<b class="${varia > 0.5 ? 'rosso-t' : varia < -0.5 ? 'verde-t' : ''}">${varia > 0 ? '+' : ''}${n2(varia, 1)}%</b>). È cambiato ${l.length - 1} ${l.length === 2 ? 'volta' : 'volte'}${tutti.length > l.length ? `, su ${tutti.length} prezzi registrati` : ''}.</p>`;
  }
  function opzioniProdotti(sel, filtroCat) {
    const lista = S.prodotti.filter(p => !filtroCat || filtroCat(p)).slice().sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve));
    return lista.map(p => `<option value="p:${p.id}" ${sel === 'p:' + p.id ? 'selected' : ''}>${esc(p.nomeBreve)} (${esc(p.unita)})</option>`).join('');
  }
  function opzioniRif(sel, escludiId) {
    const ric = S.ricette.filter(r => r.id !== escludiId).slice().sort((a, b) => a.nome.localeCompare(b.nome));
    return `<option value="">Scegli…</option><optgroup label="Prodotti">${opzioniProdotti(sel)}</optgroup>
      <optgroup label="Preparazioni e altre ricette">${ric.map(r => `<option value="r:${r.id}" ${sel === 'r:' + r.id ? 'selected' : ''}>${esc(r.nome)} (${esc(M.unitaRif('r:' + r.id))})</option>`).join('')}</optgroup>`;
  }
  function modale(html) {
    chiudiModale();
    const el = document.createElement('div'); el.className = 'modale-sfondo'; el.id = 'modale';
    el.innerHTML = `<div class="modale">${html}</div>`;
    el.addEventListener('click', e => { if (e.target === el) chiudiModale(); });
    document.body.appendChild(el);
  }
  function chiudiModale() { const m = $('#modale'); if (m) m.remove(); }

  // ---------- Cestino: niente sparisce subito, si può rimettere ----------
  const NOMI_CESTINO = { ricette: ['ricetta', 'ricette'], prodotti: ['prodotto', 'prodotti'], fatture: ['fattura', 'fatture'], fornitori: ['fornitore', 'fornitori'], eventi: ['evento', 'eventi'], periodi: ['periodo di vendite', 'periodi di vendite'] };
  function nelCestino(tipo, x, extra, gruppo) {
    S.cestino = S.cestino || [];
    S.cestino.unshift(Object.assign({ id: M.uid('c'), tipo, quando: new Date().toISOString(), gruppo: gruppo || null, x: JSON.parse(JSON.stringify(x)) }, extra || {}));
  }
  const nomeCestino = (c) => c.tipo === 'ricette' ? c.x.nome : c.tipo === 'prodotti' ? c.x.nomeBreve : c.tipo === 'fatture' ? `${c.x.fornitoreNome || 'Fattura'} n. ${c.x.numero || '?'} del ${dataIt(c.x.data)}` : c.x.nome || '—';
  function rimettiDalCestino(c) {
    const x = c.x;
    if (c.tipo === 'ricette') { if (x.tipo !== 'semilavorato' && !M.TIPI[x.tipo]) { S.tipiNascosti = (S.tipiNascosti || []).filter(k => k !== x.tipo); M.aggiornaTipi(); if (!M.TIPI[x.tipo]) x.tipo = Object.keys(M.TIPI)[0]; } if (!S.ricette.some(r => r.id === x.id)) S.ricette.push(x); }
    else if (c.tipo === 'prodotti') {
      if (!S.prodotti.some(p => p.id === x.id)) S.prodotti.push(x);
      (c.righe || []).forEach(([fid, i]) => { const f = S.fatture.find(y => y.id === fid), rg = f && f.righe[i]; if (rg && !rg.prodottoId) { rg.prodottoId = x.id; rg.ignora = false; rg.automatico = false; } });
    } else if (c.tipo === 'fatture') {
      if (!S.fatture.some(f => f.id === x.id)) { const era = x.stato === 'registrata'; x.stato = 'da_abbinare'; x.resoconto = null; S.fatture.push(x); if (era && !M.daAbbinare(x)) M.registraFattura(x); }
    } else if (c.tipo === 'fornitori') { if (!S.fornitori.some(f => f.id === x.id)) S.fornitori.push(x); }
    else if (c.tipo === 'eventi') { if (!S.eventi.some(e => e.id === x.id)) S.eventi.push(x); }
    else if (c.tipo === 'periodi') {
      if (!S.periodiVendita.includes(x.nome)) S.periodiVendita.push(x.nome);
      if (x.date) (S.periodiDate = S.periodiDate || {})[x.nome] = x.date;
      if (x.cassa) S.periodiCassa[x.nome] = x.cassa;
      if (x.scaricato && !S.periodiScaricati.includes(x.nome)) S.periodiScaricati.push(x.nome);
      Object.entries(x.vendite || {}).forEach(([rid, q]) => { const r = M.ricetta(rid); if (r) { r.vendite = r.vendite || {}; r.vendite[x.nome] = q; } });
    }
    S.cestino = S.cestino.filter(y => y !== c);
  }
  // tolgo un prodotto: le righe di fattura collegate restano senza prodotto (me le segno per poterle ricollegare)
  function togliProdotto(id, gruppo) {
    const p = M.prodotto(id); if (!p) return;
    const righe = [];
    S.fatture.forEach(f => f.righe.forEach((rg, i) => { if (rg.prodottoId === id) { righe.push([f.id, i]); rg.prodottoId = null; rg.ignora = true; rg.automatico = true; } }));
    nelCestino('prodotti', p, { righe }, gruppo);
    S.prodotti = S.prodotti.filter(x => x.id !== id);
  }
  function togliRicetta(id, gruppo) { const r = M.ricetta(id); if (!r) return; nelCestino('ricette', r, null, gruppo); S.ricette = S.ricette.filter(x => x.id !== id); }

  // ---------- Pagine ----------
  const PAGINE = {};
  PAGINE.cestino = function () {
    const C = S.cestino || [], filtro = ui.cestinoTipo || '';
    const tipi = Object.keys(NOMI_CESTINO).filter(t => C.some(c => c.tipo === t));
    const l = C.filter(c => !filtro || c.tipo === filtro);
    // le cose eliminate insieme (es. 30 ricette in un colpo) stanno in un blocco solo
    const blocchi = []; const visti = new Map();
    l.forEach(c => { if (c.gruppo) { if (!visti.has(c.gruppo)) { const b = { gruppo: c.gruppo, voci: [] }; visti.set(c.gruppo, b); blocchi.push(b); } visti.get(c.gruppo).voci.push(c); } else blocchi.push({ voci: [c] }); });
    const quando = (c) => { const d = new Date(c.quando); return dataIt(c.quando.slice(0, 10)) + ' alle ' + d.toTimeString().slice(0, 5); };
    const riga = (c) => `<div class="riga"><span>${esc(nomeCestino(c))}<small>${NOMI_CESTINO[c.tipo][0]} · ${['ricette', 'fatture'].includes(c.tipo) ? 'eliminata' : 'eliminato'} il ${quando(c)}</small></span><span class="bottoni" style="margin:0;flex-wrap:nowrap"><button class="btn piccolo" data-az="ces-rimetti" data-id="${c.id}">Rimetti</button><button class="x" data-az="ces-via" data-id="${c.id}" aria-label="Elimina per sempre">✕</button></span></div>`;
    return { titolo: 'Cestino', indietro: '#/altro', html: `
      <p class="tenue">Qui finisce quello che elimini: ricette, prodotti, fatture, fornitori, eventi e periodi di vendite. Puoi rimetterlo com'era. Non si svuota mai da solo: resta qui finché non lo elimini tu.</p>
      ${C.length ? `<div class="chips"><button class="chip ${!filtro ? 'on' : ''}" data-az="ces-tipo" data-v="">Tutto (${C.length})</button>${tipi.map(t => `<button class="chip ${filtro === t ? 'on' : ''}" data-az="ces-tipo" data-v="${t}">${NOMI_CESTINO[t][1].charAt(0).toUpperCase() + NOMI_CESTINO[t][1].slice(1)} (${C.filter(c => c.tipo === t).length})</button>`).join('')}</div>` : ''}
      ${blocchi.length ? blocchi.map(b => b.voci.length > 1 ? (() => { const f = ['ricette', 'fatture'].includes(b.voci[0].tipo); return `<div class="card"><div class="riga"><span><b>${b.voci.length} ${NOMI_CESTINO[b.voci[0].tipo][1]} ${f ? 'eliminate' : 'eliminati'} insieme</b><small>il ${quando(b.voci[0])}: ${esc(b.voci.slice(0, 4).map(nomeCestino).join(', '))}${b.voci.length > 4 ? '…' : ''}</small></span><button class="btn primario piccolo" data-az="ces-rimetti-gruppo" data-g="${b.gruppo}">Rimetti ${f ? 'tutte' : 'tutti'}</button></div>
          <details><summary>Vedi ${f ? 'quali sono e rimettine solo alcune' : 'quali sono e rimettine solo alcuni'}</summary>${b.voci.map(riga).join('')}</details></div>`; })() : `<div class="card lista-ces">${riga(b.voci[0])}</div>`).join('')
        : '<p class="tenue centro">Il cestino è vuoto.</p>'}
      ${C.length ? '<div class="bottoni"><button class="btn pericolo" data-az="ces-svuota">Svuota il cestino</button></div>' : ''}` };
  };

  // Analisi del menu per un periodo: quanto vende e quanto rende ogni ricetta con gli ingredienti completi
  const GRUPPI_MENU = { tutto: null, get bar() { return M.tipiDi('bar'); }, get cucina() { return M.tipiDi('cucina'); } };
  // le categorie scelte nel pannello: Tutto, Bar, Cucina oppure più gruppi insieme (es. Burgers + Baby burgers + Burgers con patate)
  const tipiPannello = () => { const g = ui.panGruppo || 'tutto'; if (g !== 'scelte') return g; const l = (ui.panCat || []).filter(k => M.TIPI[k]); return l.length ? l : 'tutto'; };
  const completa = (r) => { const c = M.costoRicetta(r); return c.totale > 0 && !c.mancanti.length && !/^Ricetta da completare/.test(r.note || ''); };
  function analisiMenu(pers, gruppo) {
    if (!Array.isArray(pers)) pers = [pers];
    const tipi = Array.isArray(gruppo) ? gruppo : GRUPPI_MENU[gruppo];
    const q = (r) => pers.reduce((s, p) => s + (Number((r.vendite || {})[p]) || 0), 0);
    const vendute = S.ricette.filter(r => r.tipo !== 'semilavorato' && (!tipi || tipi.includes(r.tipo)) && q(r) > 0);
    const voci = vendute.filter(completa).map(r => { const i = M.indicatori(r); return { r, q: q(r), i, tot: q(r) * i.margine }; }).filter(x => x.i.margine != null);
    const pezziTutti = vendute.reduce((s, r) => s + q(r), 0), pezziOk = voci.reduce((s, x) => s + x.q, 0);
    let gruppoDi = () => null, sogliaQ = 0, sogliaM = 0;
    if (voci.length >= 2) {
      sogliaQ = 0.7 * pezziOk / voci.length;
      sogliaM = voci.reduce((s, x) => s + x.q * x.i.margine, 0) / pezziOk;
      gruppoDi = (x) => x.q >= sogliaQ ? (x.i.margine >= sogliaM ? 'vincenti' : 'rendere') : (x.i.margine >= sogliaM ? 'spingere' : 'ripensare');
    }
    voci.forEach(x => { x.g = gruppoDi(x); });
    return { vendute, voci, pezziTutti, pezziOk, sogliaQ, sogliaM, q };
  }
  // ---------- Periodi: date di ogni periodo (anche quelli scritti a mano, es. «Mar-ago 2026») e scelta per date ----------
  const MESI_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const meseDa = (t) => MESI_IT.indexOf(String(t).toLowerCase().slice(0, 3));
  const fineMese = (a, m) => new Date(Date.UTC(a, m + 1, 0)).toISOString().slice(0, 10);
  const dd = (a, m) => `${a}-${String(m + 1).padStart(2, '0')}-01`;
  function dateDiPeriodo(per) {
    if (S.periodiDate && S.periodiDate[per]) return S.periodiDate[per];
    const t = String(per).trim().toLowerCase(); let m;
    if ((m = t.match(/^(\d{4})$/))) return { dal: m[1] + '-01-01', al: m[1] + '-12-31' };
    if ((m = t.match(/^([a-z]+)\s*-\s*([a-z]+)\s+(\d{4})$/)) && meseDa(m[1]) >= 0 && meseDa(m[2]) >= 0) { const a = +m[3], m1 = meseDa(m[1]), m2 = meseDa(m[2]); return { dal: dd(m1 > m2 ? a - 1 : a, m1), al: fineMese(a, m2) }; }
    if ((m = t.match(/^([a-z]+)\s+(\d{4})$/)) && meseDa(m[1]) >= 0) { const a = +m[2], mm = meseDa(m[1]); return { dal: dd(a, mm), al: fineMese(a, mm) }; }
    return null;
  }
  // tiene solo i periodi che non sono già dentro un altro scelto (es. «Mar-ago 2025» dentro «2025»), così non conta due volte
  // periodi che si accavallano solo in parte (nessuno dei due contiene l'altro): i giorni in comune verrebbero contati due volte
  function accavallati(pers) {
    const d = pers.map(p => ({ p, x: dateDiPeriodo(p) })).filter(a => a.x), out = [];
    d.forEach((a, i) => d.slice(i + 1).forEach(b => {
      const comune = a.x.dal <= b.x.al && b.x.dal <= a.x.al, dentro = (a.x.dal <= b.x.dal && a.x.al >= b.x.al) || (b.x.dal <= a.x.dal && b.x.al >= a.x.al);
      if (comune && !dentro) out.push([a.p, b.p]);
    }));
    return out;
  }
  function senzaDoppi(pers) {
    const d = pers.map(p => ({ p, x: dateDiPeriodo(p) }));
    return d.filter(a => !a.x || !d.some(b => b !== a && b.x && b.x.dal <= a.x.dal && b.x.al >= a.x.al && (b.x.dal < a.x.dal || b.x.al > a.x.al || d.indexOf(b) < d.indexOf(a)))).map(a => a.p);
  }
  function selezionePannello() {
    const conVendite = S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp]));
    const sel = ui.panSel || { tipo: 'periodo', per: conVendite[conVendite.length - 1] };
    if (sel.tipo === 'tutto') return { pers: senzaDoppi(conVendite), etichetta: 'Tutto', esclusi: [] };
    if (sel.tipo === 'anno' || sel.tipo === 'date') {
      const dal = sel.tipo === 'anno' ? sel.anno + '-01-01' : sel.dal, al = sel.tipo === 'anno' ? sel.anno + '-12-31' : sel.al;
      if (!dal || !al) return { pers: [], etichetta: 'Scegli le date', esclusi: [] };
      const dentro = [], esclusi = [];
      conVendite.forEach(p => { const x = dateDiPeriodo(p); if (!x) return; if (x.dal >= dal && x.al <= al) dentro.push(p); else if (x.dal <= al && x.al >= dal) esclusi.push(p); });
      return { pers: senzaDoppi(dentro), etichetta: sel.tipo === 'anno' ? 'Anno ' + sel.anno : `dal ${dataIt(dal)} al ${dataIt(al)}`, esclusi };
    }
    const per = conVendite.includes(sel.per) ? sel.per : conVendite[conVendite.length - 1];
    return { pers: per ? [per] : [], etichetta: per || '', esclusi: [] };
  }
  // scelta del periodo (tutto, anni, periodi, date) e delle categorie: la stessa per il pannello e per la mappa del menu
  function scelteVendite(SEL, qv) {
    const pers = SEL.pers;
    const conVendite = S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp]));
      const sel = ui.panSel || { tipo: 'periodo', per: conVendite[conVendite.length - 1] };
      const anni = Array.from(new Set(conVendite.map(p => dateDiPeriodo(p)).filter(Boolean).flatMap(x => { const l = []; for (let a = +x.dal.slice(0, 4); a <= +x.al.slice(0, 4); a++) l.push(a); return l; }))).sort();
      return `<div class="chips"><button class="chip ${sel.tipo === 'tutto' ? 'on' : ''}" data-az="pan-sel" data-tipo="tutto">Tutto</button>${anni.map(a => `<button class="chip ${sel.tipo === 'anno' && sel.anno == a ? 'on' : ''}" data-az="pan-sel" data-tipo="anno" data-v="${a}">${a}</button>`).join('')}${(() => {
        // l'ultimo periodo caricato resta a portata di dito, gli altri stanno in una tendina: così non vanno su due righe
        const altri = conVendite.filter(pp => { const x = dateDiPeriodo(pp); return !(x && x.dal.slice(5) === '01-01' && x.al.slice(5) === '12-31' && x.dal.slice(0, 4) === x.al.slice(0, 4)); });
        if (!altri.length) return '';
        const ultimo = altri[altri.length - 1], prima = altri.slice(0, -1).reverse(), scelto = sel.tipo === 'periodo' ? pers[0] : '';
        return `<button class="chip ${scelto === ultimo ? 'on' : ''}" data-az="pan-sel" data-tipo="periodo" data-v="${esc(ultimo)}">${esc(ultimo)}</button>` +
          (prima.length ? `<select class="chip chip-tendina ${prima.includes(scelto) ? 'on' : ''}" data-pan-periodo aria-label="Altri periodi"><option value="">Altri periodi</option>${prima.map(pp => `<option value="${esc(pp)}" ${scelto === pp ? 'selected' : ''}>${esc(pp)}</option>`).join('')}</select>` : '');
      })()}<button class="chip ${sel.tipo === 'date' ? 'on' : ''}" data-az="pan-sel" data-tipo="date">📅 Scegli le date</button></div>
        ${sel.tipo === 'date' ? `<div class="card form date-pan"><div class="due"><label>Dal<input type="date" data-pan-data="dal" value="${esc(sel.dal || '')}"></label><label>Al<input type="date" data-pan-data="al" value="${esc(sel.al || '')}"></label></div></div>` : ''}
        ${(() => { const acc = accavallati(pers); return acc.length ? `<p class="msg rosso">Attenzione: ${acc.slice(0, 3).map(([a, b]) => `«${esc(a)}» e «${esc(b)}»`).join(', ')} hanno dei giorni in comune, quindi le vendite di quei giorni sono contate due volte. In Vendite elimina uno dei due, oppure ricarica i file con date che non si accavallano.</p>` : ''; })()}
        ${sel.tipo !== 'periodo' ? `<p class="tenue piccolo">${pers.length ? `Conto i periodi: ${pers.map(esc).join(', ')}.` : 'Nessun periodo caricato cade tutto in queste date.'}${SEL.esclusi.length ? ` Non conto ${SEL.esclusi.map(esc).join(', ')}: ${SEL.esclusi.length === 1 ? 'è' : 'sono'} solo in parte dentro le date. Le vendite si caricano per periodi: per guardare pochi giorni, carica dalla cassa periodi più corti (es. un mese alla volta).` : ''}</p>` : ''}
        <div class="chips sotto">${[['tutto', 'Tutto il locale'], ['bar', 'Bar'], ['cucina', 'Cucina'], ['scelte', 'Scegli le categorie']].map(([k, v]) => `<button class="chip ${(ui.panGruppo || 'tutto') === k ? 'on' : ''}" data-az="pan-gruppo" data-v="${k}">${v}</button>`).join('')}</div>
        ${(ui.panGruppo || 'tutto') === 'scelte' ? (() => {
          const sc = new Set(ui.panCat || []);
          const tutti = Object.keys(M.TIPI).filter(k => k !== 'semilavorato').map(k => ({ k, q: S.ricette.filter(r => r.tipo === k).reduce((t, r) => t + qv(r), 0) })).filter(x => x.q > 0 || sc.has(x.k));
          return `<div class="card"><p class="tenue piccolo">Tocca le categorie da guardare insieme: i numeri qui sotto sono la somma. ${sc.size ? '' : 'Finché non ne scegli nessuna vedi tutto il locale.'}</p>
            <div class="chips">${tutti.map(x => `<button class="chip ${sc.has(x.k) ? 'on' : ''}" data-az="pan-cat" data-v="${x.k}">${sc.has(x.k) ? '✓ ' : ''}${esc(M.TIPI[x.k])} <span class="${sc.has(x.k) ? '' : 'tenue'}">${qta(x.q)}</span></button>`).join('')}</div>
            ${sc.size ? '<div class="bottoni"><button class="btn piccolo" data-az="pan-cat-via">Togli tutte</button></div>' : ''}</div>`;
        })() : ''}`;
  }
  const QUADRANTI = {
    vincenti: ['Vincenti', 'Vendono tanto e fanno guadagnare tanto. Non toccarli.', 'var(--verde)'],
    rendere: ['Da far rendere di più', 'Vendono tanto ma guadagnano poco a pezzo. Rivedi il costo o il prezzo.', 'var(--giallo)'],
    spingere: ['Da spingere', 'Guadagnano bene ma vendono poco. Mettili in vista, consigliali.', 'var(--accento)'],
    ripensare: ['Da ripensare', 'Vendono poco e guadagnano poco. Da cambiare o togliere.', 'var(--rosso)']
  };

  // la mappa del menu: grafico e quattro caselle, dentro il pannello (stessa scelta di periodo e categorie)
  function schedaMappa(A, per) {
    const testa = `<div class="card larga" id="mappa"><h3>La mappa del menu · ${esc(per)}</h3>`;
    if (A.voci.length < 2) return testa + '<p class="tenue">Servono almeno due ricette complete con delle vendite in quello che hai scelto.</p></div>';
    const voci = A.voci.slice().sort((a, b) => b.tot - a.tot), num = new Map(voci.map((x, k) => [x, k + 1]));
    const col = { vincenti: 'var(--verde)', rendere: 'var(--giallo)', spingere: 'var(--accento)', ripensare: 'var(--rosso)' };
    const W = 340, H = 260, P = 34;
    const maxQ = Math.max(...voci.map(x => x.q)), maxM = Math.max(...voci.map(x => x.i.margine)), minM = Math.min(0, ...voci.map(x => x.i.margine));
    const X = q => P + 10 + Math.sqrt(q / maxQ) * (W - P - 24), Y = m => H - P - 10 - (m - minM) / (maxM - minM || 1) * (H - P - 30);
    const svg = `<svg class="mappa" viewBox="0 0 ${W} ${H}">
      <line x1="${X(A.sogliaQ)}" y1="8" x2="${X(A.sogliaQ)}" y2="${H - P}" class="asse-s"/><line x1="${P}" y1="${Y(A.sogliaM)}" x2="${W - 6}" y2="${Y(A.sogliaM)}" class="asse-s"/>
      <line x1="${P}" y1="${H - P}" x2="${W - 6}" y2="${H - P}" class="asse"/><line x1="${P}" y1="8" x2="${P}" y2="${H - P}" class="asse"/>
      <text x="${W / 2}" y="${H - 8}" text-anchor="middle" class="g-x">quanto vende →</text><text x="12" y="${H / 2}" transform="rotate(-90 12 ${H / 2})" text-anchor="middle" class="g-x">quanto rende a pezzo →</text>
      ${voci.slice().reverse().map(x => `<circle cx="${X(x.q)}" cy="${Y(x.i.margine)}" r="9" fill="${col[x.g]}" stroke="#fff" stroke-width="1.5"/><text x="${X(x.q)}" y="${Y(x.i.margine) + 3.5}" text-anchor="middle" class="g-num">${num.get(x)}</text>`).join('')}
    </svg>`;
    const riga = (x) => `<a class="riga piccola" href="#/ricetta/${x.r.id}"><span><span><span class="num" style="background:${col[x.g]}">${num.get(x)}</span>${esc(x.r.nome)}</span></span><small>${qta(x.q)} · ${euro(x.i.margine)}</small></a>`;
    return testa + `<p class="tenue piccolo">Ogni ricetta finisce in una delle quattro caselle, secondo quanto vende e quanto fa guadagnare a pezzo rispetto alla media (${euro(A.sogliaM)} a pezzo). Il numero è lo stesso nel grafico e negli elenchi: 1 è quella che fa guadagnare di più in tutto.</p>
      <div class="mappa-due">${svg}
      <div class="quadranti">${Object.entries(QUADRANTI).map(([k, [nome, spiega, c]]) => { const l = voci.filter(x => x.g === k); return `<div class="quad" style="border-color:${c}"><h4 style="color:${c}">${nome} <small>(${l.length})</small></h4><p class="tenue piccolo">${spiega}</p>${l.slice(0, 6).map(riga).join('')}${l.length > 6 ? `<details><summary class="piccolo">e altre ${l.length - 6}</summary>${l.slice(6).map(riga).join('')}</details>` : ''}</div>`; }).join('')}</div></div>
      <p class="tenue piccolo">Accanto al nome: pezzi venduti · guadagno a pezzo senza IVA. La soglia di «vende tanto» è il 70% della media (${n2(A.sogliaQ, 0)} pezzi).</p></div>`;
  }
  PAGINE.pannello = function () {
    const conVendite = S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp]));
    const SEL = selezionePannello(), pers = SEL.pers, per = SEL.etichetta;
    const gruppo = tipiPannello();
    const aumenti = [];
    S.prodotti.forEach(p => {
      const l = (p.prezzi || []).slice().sort((a, b) => a.data < b.data ? -1 : 1);
      if (l.length < 2) return;
      const a = l[l.length - 2], b = l[l.length - 1];
      const v = (b.prezzo / a.prezzo - 1) * 100;
      if (Math.abs(v) >= (S.impostazioni.sogliaAumento || 3)) aumenti.push({ p, v, data: b.data });
    });
    aumenti.sort((a, b) => a.data < b.data ? 1 : -1);
    const sotto = S.ricette.filter(r => r.tipo !== 'semilavorato' && completa(r) && M.indicatori(r).sotto);
    const scorta = M.sottoScorta();
    const daFare = S.fatture.filter(f => f.stato !== 'registrata');

    // ---- com'è andato il periodo
    let andamento = '';
    if (conVendite.length) {
      const A = analisiMenu(pers, gruppo), qv = A.q;
      const iva = 1 + (S.impostazioni.ivaVendita || 0) / 100;
      const incassoRic = A.vendute.reduce((s, r) => s + qv(r) * (r.prezzo || 0), 0);
      const cassa = gruppo === 'tutto' && pers.length && pers.every(p => S.periodiCassa[p]) ? pers.reduce((s, p) => s + S.periodiCassa[p].incasso, 0) : null;
      const nettoOk = A.voci.reduce((s, x) => s + x.q * x.i.netto, 0), costoOk = A.voci.reduce((s, x) => s + x.q * x.i.costo, 0);
      const su100 = nettoOk ? costoOk / nettoOk * 100 : null;
      const copertura = A.pezziTutti ? A.pezziOk / A.pezziTutti : 0;
      const daCompletare = A.vendute.filter(r => !completa(r)).sort((a, b) => qv(b) - qv(a));
      const scelte = scelteVendite(SEL, qv);
      const top = (lista, titolo, spiega, valore) => `<div class="card"><h3>${titolo}</h3><p class="tenue piccolo">${spiega}</p>${lista.length ? lista.map((x, k) => `<a class="riga" href="#/ricetta/${x.r.id}"><span>${k + 1}. ${esc(x.r.nome)}</span><span class="destra">${valore(x)}</span></a>`).join('') : '<p class="tenue">Ancora nessuna ricetta completa venduta.</p>'}</div>`;
      const piuVendute = A.vendute.slice().sort((a, b) => qv(b) - qv(a)).slice(0, 5).map(r => ({ r, q: qv(r) }));
      const piuGuadagno = A.voci.slice().sort((a, b) => b.tot - a.tot).slice(0, 5);
      const menoAPezzo = A.voci.filter(x => x.i.molt != null).sort((a, b) => a.i.molt - b.i.molt).slice(0, 5);
      andamento = `${scelte}
      <div class="kpi-griglia">
        ${kpi('Incasso', euro(cassa != null ? cassa : incassoRic, 0), cassa != null ? 'dalla cassa, IVA compresa' : 'pezzi venduti × prezzo, IVA compresa')}
        ${kpi('Su 100 € incassati', su100 == null ? '—' : euro(su100, 0) + ' di merce', 'ingredienti, senza contare l\'IVA', su100 == null ? '' : su100 > 30 ? 'rosso' : su100 > 25 ? 'giallo' : 'verde')}
        ${kpi('Guadagno sulla merce', euro(A.voci.reduce((s, x) => s + x.tot, 0), 0), 'incasso senza IVA meno ingredienti, prima di personale e spese')}
        ${kpi('Vendite con la ricetta completa', Math.round(copertura * 100) + '%', copertura < 1 ? 'i numeri qui accanto valgono per queste; il resto è da completare' : 'tutti i numeri sono completi', copertura < 0.6 ? 'giallo' : '')}
      </div>
      ${(() => {
        // vendite divise per categoria (gruppo di ricette), con il totale delle categorie scelte
        const perTipo = {};
        A.vendute.forEach(r => { const x = perTipo[r.tipo] = perTipo[r.tipo] || { q: 0, inc: 0, guad: 0 }; x.q += qv(r); x.inc += qv(r) * (r.prezzo || 0); });
        A.voci.forEach(v => { perTipo[v.r.tipo].guad += v.tot; });
        const l = Object.entries(perTipo).sort((a, b) => b[1].inc - a[1].inc);
        if (!l.length) return '';
        const T = l.reduce((t, [, x]) => ({ q: t.q + x.q, inc: t.inc + x.inc, guad: t.guad + x.guad }), { q: 0, inc: 0, guad: 0 });
        return `<div class="card larga"><h3>Per categoria</h3><div class="scorri"><table class="tab"><tr><th>Categoria</th><th class="n">Pezzi</th><th class="n">Incasso</th><th class="n">Guadagno sulla merce</th></tr>
          ${l.map(([k, x]) => `<tr><td>${esc(M.TIPI[k] || k)}</td><td class="n">${qta(x.q)}</td><td class="n">${euro(x.inc, 0)}</td><td class="n">${x.guad ? euro(x.guad, 0) : '—'}</td></tr>`).join('')}
          ${l.length > 1 ? `<tr class="totale"><td>Totale</td><td class="n">${qta(T.q)}</td><td class="n">${euro(T.inc, 0)}</td><td class="n">${euro(T.guad, 0)}</td></tr>` : ''}</table></div>
          <p class="tenue piccolo">Incasso = pezzi venduti × prezzo, IVA compresa. Il guadagno conta solo le ricette con gli ingredienti completi.</p></div>`;
      })()}
      ${(() => {
        // i costi del locale nelle stesse date delle vendite scelte
        if (gruppo !== 'tutto' || !pers.length) return '';
        const dd = pers.map(dateDiPeriodo).filter(Boolean); if (dd.length !== pers.length) return '';
        const dal = dd.map(x => x.dal).sort()[0], al = dd.map(x => x.al).sort().slice(-1)[0];
        // solo i giorni coperti dalle vendite scelte (se ci sono buchi tra un periodo e l'altro, lì non conto le spese)
        const X = { per: {}, totale: 0 }; dd.forEach(x => { const y = speseTra(x.dal, x.al); Object.entries(y.per).forEach(([c, v]) => { X.per[c] = (X.per[c] || 0) + v; }); X.totale += y.totale; });
        const cop = coperturaFatture(); if (!X.totale) return '';
        const iva = 1 + (S.impostazioni.ivaVendita || 10) / 100, inc = (cassa != null ? cassa : incassoRic) / iva;
        const completo = cop && cop.dal <= dal && cop.al >= al.slice(0, 8) + '01';
        // il confronto ha senso solo con l'incasso vero della cassa: quello stimato dalle ricette è parziale
        if (cassa == null) return `<div class="card larga"><h3>Spese dalle fatture in queste date</h3><div class="kpi-griglia">${kpi('Merce comprata', euro(X.per.merce || 0, 0))}${kpi('Altre spese', euro(X.totale - (X.per.merce || 0), 0), 'bollette, servizi, materiali…')}</div>
          <p class="tenue piccolo">Per vedere quanto resta serve l'incasso vero: carica il venduto della cassa di queste date (Importa dati). <a href="#/costi">Vedi tutti i costi ›</a></p></div>`;
        return `<div class="card larga"><h3>Quanto resta, con le fatture di questo periodo</h3>
          <div class="kpi-griglia">${kpi('Incasso senza IVA', euro(inc, 0))}${kpi('Merce comprata', euro(X.per.merce || 0, 0), inc ? Math.round((X.per.merce || 0) / inc * 100) + '% dell\'incasso' : '')}${kpi('Altre spese', euro(X.totale - (X.per.merce || 0), 0), 'bollette, servizi, materiali…')}${kpi('Resta', euro(inc - X.totale, 0), 'prima di stipendi, contributi e tasse', inc - X.totale < 0 ? 'rosso' : '')}</div>
          ${completo ? '' : `<p class="msg giallo">Per queste date le fatture sono incomplete (caricate ${cop ? 'dal ' + dataIt(cop.dal) + ' al ' + dataIt(cop.al) : 'nessuna'}): il «Resta» non è affidabile.</p>`}
          <p class="tenue piccolo">La merce comprata non è quella consumata (ci sono le scorte), ma su qualche mese si avvicina. <a href="#/costi">Vedi tutti i costi ›</a></p></div>`;
      })()}
      ${daCompletare.length ? `<div class="card larga"><h3>Ricette vendute ma senza ingredienti completi (${daCompletare.length})</h3><p class="tenue piccolo">Finché non le completi i conti sono parziali. Parti da quelle che vendono di più:</p>
        ${daCompletare.slice(0, 5).map(r => `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}</span><span class="destra">${qta(qv(r))} venduti</span></a>`).join('')}
        <div class="bottoni"><button class="btn primario" data-az="pan-completa">Completale una per una, dalle più vendute</button></div></div>` : ''}
      <div class="griglia-tre">
        ${top(piuVendute, 'I più venduti', 'Pezzi venduti nel periodo.', x => qta(x.q) + ' pz')}
        ${top(piuGuadagno, 'Fanno guadagnare di più', 'Guadagno sulla merce in tutto il periodo.', x => euro(x.tot, 0))}
        ${top(menoAPezzo, 'Rendono meno a pezzo', 'Il moltiplicatore più basso tra quelli venduti.', x => badgeMolt(x.i))}
      </div>
      ${schedaMappa(A, per)}`;
    } else {
      andamento = `<div class="card evidenza"><h3>Carica le vendite</h3><p>Qui vedrai com'è andato il periodo: incasso, quanto se ne va in merce, cosa vende e cosa fa guadagnare. Servono le vendite della cassa.</p><a class="btn primario" href="#/importa">Importa dalla cassa</a></div>`;
    }

    return {
      titolo: 'Gestionale Repub', html: `${andamento}
      <h2 class="sezione">Da fare</h2>
      ${(() => { const p = passiOrdine(), n = p.filter(x => x[1]).length; return n ? `<a class="card riga evidenza" href="#/ordine"><span><b>Metti in ordine i dati</b><small>${p.filter(x => x[1]).slice(0, 4).map(x => esc(x[4]) + ' ' + x[1]).join(' · ')}${n > 4 ? ' · …' : ''}</small></span><span class="badge giallo">${n} passi</span></a>` : ''; })()}
      ${(() => {
        // ricette che costano più di quanto si vendono: quasi sempre un prodotto col prezzo del cartone intero contato come un pezzo
        const colpevoli = {};
        S.ricette.filter(r => r.tipo !== 'semilavorato' && r.prezzo).forEach(r => { const i = M.indicatori(r); if (i.costo == null || i.costo <= i.netto) return;
          const c = M.costoRicetta(r).righe.filter(x => x.rif && x.rif.startsWith('p:')).sort((a, b) => (b.costo || 0) - (a.costo || 0))[0];
          if (c) { const k = c.rif.slice(2); (colpevoli[k] = colpevoli[k] || []).push(r.nome); } });
        const ks = Object.keys(colpevoli).filter(k => M.prodotto(k));
        return ks.length ? `<div class="card evidenza"><h3>Costi impossibili</h3><p class="tenue">Queste ricette costano più di quanto le vendete: il colpevole è quasi sempre un prodotto con il prezzo di un cartone intero contato come un pezzo solo. Apri il prodotto e scrivi quanti pezzi ci sono nel cartone.</p>
          ${ks.map(k => { const p = M.prodotto(k); return `<a class="riga" href="#/prodotto/${k}"><span>${esc(p.nomeBreve)}<small>${descrPrezzo(p)} · in ${colpevoli[k].slice(0, 4).map(esc).join(', ')}${colpevoli[k].length > 4 ? '…' : ''}</small></span><span class="badge rosso">${colpevoli[k].length} ricette</span></a>`; }).join('')}</div>` : '';
      })()}
      ${daFare.length ? `<div class="card"><h3>Fatture da completare</h3>${daFare.map(f => `<a class="riga" href="#/fattura/${f.id}"><span>${esc(f.fornitoreNome)} · n. ${esc(f.numero)}</span><span class="badge giallo">${M.daAbbinare(f)} righe da collegare</span></a>`).join('')}</div>` : ''}
      <div class="card"><h3>Prezzi cambiati${aumenti.length ? ' <a class="piccolo" href="#/aumenti">quanto pesano ›</a>' : ''}</h3>${aumenti.length ? aumenti.slice(0, 8).map(x => `<a class="riga" href="#/prodotto/${x.p.id}"><span>${esc(x.p.nomeBreve)}<small>${dataIt(x.data)}</small></span><span class="badge ${x.v > 0 ? 'rosso' : 'verde'}">${x.v > 0 ? '+' : ''}${n2(x.v, 1)}%</span></a>`).join('') : '<p class="tenue">Nessun cambio di prezzo. Compariranno qui quando registri le fatture.</p>'}</div>
      <div class="card"><h3>Sotto la soglia del moltiplicatore${sotto.length ? ' <a class="piccolo" href="#/prezzi-consigliati">prezzi consigliati ›</a>' : ''}</h3>${sotto.length ? sotto.map(r => { const i = M.indicatori(r); return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>${M.TIPI_SINGOLARE[r.tipo]} · soglia × ${n2(i.soglia)}</small>${etichetteCP(i)}</span><span class="destra">${badgeMolt(i)}<small>${i.margine != null && i.molt != null ? 'guadagni ' + euro(i.margine) : ''}</small></span></a>`; }).join('') : '<p class="tenue">Tutte le ricette complete sono sopra la soglia.</p>'}</div>
      ${scorta.length ? `<div class="card"><h3>Sotto la scorta minima</h3>${scorta.map(p => `<a class="riga" href="#/prodotto/${p.id}"><span>${esc(p.nomeBreve)}</span><span>${qta(p.giacenza)} / ${qta(p.scortaMinima)} ${esc(p.confezione)}</span></a>`).join('')}</div>` : ''}
`
    };
  };
  // ----- Prodotti -----
  // un fornitore confermato «vende merce»: i suoi prodotti creati dalle fatture entrano già buoni
  function confermaProdottiDi(f) {
    if (!f || f.servizi) return 0;
    const sue = new Set(S.fatture.filter(x => x.fornitoreId === f.id).map(x => x.id));
    let n = 0;
    S.prodotti.forEach(p => { if (p.daCompletare && !p.dubbio && !p.forseDoppioneDi && (sue.has(p.creatoDa) || p.fornitoreId === f.id)) { p.daCompletare = false; n++; } });
    return n;
  }
  const nuoviDaCompletare = () => S.prodotti.filter(p => p.daCompletare).length;
  function repartiUsati() { const s = new Set(S.prodotti.map(p => M.reparto(p))); return M.REPARTI.concat(['Da classificare']).filter(r => s.has(r)); }
  const norm2 = (s) => String(s || '').toLowerCase().replace(/\b(s ?r ?l|s ?p ?a|s ?n ?c|s ?a ?s|srls)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  function categorie() { return Array.from(new Set(S.prodotti.map(p => p.categoria))).sort(); }
  // filtro dei prodotti: un reparto (o tutto) e una o più categorie insieme. st = { rep: '', cats: [] }
  const PF = () => (ui.prodFiltro = ui.prodFiltro || { rep: '', cats: [] });
  const passaReparti = (p, st) => (!st.rep || M.reparto(p) === st.rep) && (!(st.cats || []).length || st.cats.includes(p.categoria));
  function cambiaReparti(st, el) {
    if (el.dataset.rep != null) { st.rep = el.dataset.rep; st.cats = []; }
    else if (el.dataset.cat === '') st.cats = [];
    else { const c = el.dataset.cat, l = st.cats || []; st.cats = l.includes(c) ? l.filter(x => x !== c) : l.concat(c); }
  }
  function chipsReparti(st, az, prima, spento) {
    const prod = S.prodotti.filter(p => !p.speciale), sel = new Set(st.cats || []);
    const nel = p => !st.rep || M.reparto(p) === st.rep;
    // «Da classificare» c'è già come reparto: non lo ripeto tra le categorie
    const cats = categorie().filter(c => sel.has(c) || (prod.some(p => p.categoria === c && nel(p)) && !(c === 'Da classificare' && repartiUsati().includes('Da classificare'))));
    const n = c => prod.filter(p => p.categoria === c && nel(p)).length;
    // come in Ricette: Tutti / Bar / Cucina ben in vista, gli altri reparti come bottoni accanto
    const segm = [['', 'Tutti']].concat(['Bar', 'Cucina'].filter(r => repartiUsati().includes(r)).map(r => [r, r])), altri = repartiUsati().filter(r => r !== 'Bar' && r !== 'Cucina');
    return `<div class="filtri-ric">${prima || ''}<div class="segmentato">${segm.map(([v, t]) => `<button class="${!spento && (st.rep || '') === v ? 'on' : ''}" data-az="${az}" data-rep="${esc(v)}">${esc(t)}</button>`).join('')}</div>${altri.map(r => `<button class="chip ${!spento && st.rep === r ? 'on' : ''}" data-az="${az}" data-rep="${esc(r)}">${esc(r)}</button>`).join('')}</div><div class="chips"></div>
      ${spento ? '' : `<div class="chips sotto">${cats.map(c => `<button class="chip ${sel.has(c) ? 'on' : ''}" data-az="${az}" data-cat="${esc(c)}">${sel.has(c) ? '✓ ' : ''}${esc(c)} <span class="${sel.has(c) ? '' : 'tenue'}">${n(c)}</span></button>`).join('')}${sel.size ? `<button class="chip giallo" data-az="${az}" data-cat="">Togli le categorie</button>` : ''}</div>`}`;
  }
  const diFornitore = (p, id) => p.fornitoreId === id || (p.prezzi || []).some(e => e.fornitoreId === id) || (p.articoli || []).some(e => e.fornitoreId === id);
  function fornitoriConProdotti() {
    return S.fornitori.filter(f => !f.servizi).map(f => ({ f, n: S.prodotti.filter(p => diFornitore(p, f.id)).length })).filter(x => x.n).sort((x, y) => x.f.nome.localeCompare(y.f.nome));
  }
  // ---------- Eliminare tante ricette o tanti prodotti in un colpo (con «Rimetti» subito dopo) ----------
  const inElimina = (t) => ui.elim && ui.elim.tipo === t;
  function rigaElimina(id, nome, info) {
    const on = ui.elim.sel.includes(id);
    return `<label class="riga spunta-riga ${on ? (ui.elim.tipo === 'u' || ui.elim.tipo === 's' ? 'da-unire' : 'da-togliere') : ''}"><input type="checkbox" data-elim="${id}" ${on ? 'checked' : ''}><span>${esc(nome)}<small>${info}</small></span></label>`;
  }
  function barraSposta() {
    const n = ui.elim.sel.length;
    return `<div class="card evidenza sposta-barra elim-barra"><b>Spunta i prodotti da spostare: <span data-elim-n>${n}</span> ${n === 1 ? 'prodotto' : 'prodotti'}</b>
      <div class="due"><label>Nel reparto<select id="sposta-rep" data-spr="Rep">${M.REPARTI.map(r => `<option ${ui.spostaRep === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label>Nella categoria <small class="tenue">(vuoto: non la cambio)</small><input id="sposta-cat" data-spr="Cat" list="sposta-cat-l" autocomplete="off" value="${esc(ui.spostaCat || '')}"><datalist id="sposta-cat-l">${categorie().filter(c => c && c !== 'Da classificare').map(c => `<option value="${esc(c)}">`).join('')}</datalist></label></div>
      <div class="bottoni"><button class="btn primario" data-az="sposta-prod-ok">Sposta quelli spuntati</button>
      <button class="btn" data-az="elim-tutte">Spunta tutti quelli visibili</button>
      ${n ? '<button class="btn" data-az="elim-nessuno">Togli le spunte</button>' : ''}
      <button class="btn" data-az="elim-fine">Annulla</button></div>
      <p class="tenue piccolo">Puoi cercare (per esempio «olio») o scegliere una categoria, spuntare e spostare tutti insieme. Si può rifare quante volte vuoi.</p></div>`;
  }
  function barraUnisci() {
    const n = ui.elim.sel.length;
    return `<div class="card evidenza sposta-barra elim-barra"><b>Spunta i prodotti da unire in uno solo: <span data-elim-n>${n}</span> ${n === 1 ? 'prodotto' : 'prodotti'}</b>
      <div class="bottoni"><button class="btn primario" data-az="unisci-ok">Unisci quelli spuntati</button>
      <button class="btn" data-az="elim-tutte">Spunta tutti quelli visibili</button>
      ${n ? '<button class="btn" data-az="elim-nessuno">Togli le spunte</button>' : ''}
      <button class="btn" data-az="elim-fine">Annulla</button></div>
      <p class="tenue piccolo">Cerca per esempio «arance», spunta quelle da unire e tocca «Unisci». Resta un prodotto solo con i prezzi, le fatture e le ricette di tutti: vale l'ultimo prezzo pagato, e le prossime fatture con quei nomi finiscono lì.</p></div>`;
  }
  function barraElimina(t) {
    const cos = t === 'r' ? 'ricette' : 'prodotti', n = ui.elim.sel.length;
    return `<div class="card evidenza sposta-barra elim-barra"><b>Spunta ${t === 'r' ? 'le ricette' : 'i prodotti'} da eliminare: <span data-elim-n>${n}</span> ${n === 1 ? (t === 'r' ? 'ricetta' : 'prodotto') : cos}</b>
      <div class="bottoni"><button class="btn pericolo" data-az="elim-ok">Elimina quelli spuntati</button>
      <button class="btn" data-az="elim-tutte">Spunta tutti quelli visibili</button>
      ${t === 'r' ? '<button class="btn" data-az="elim-mai">Spunta le mai vendute</button>' : '<button class="btn" data-az="elim-mai">Spunta quelli non usati in nessuna ricetta</button>'}
      ${n ? '<button class="btn" data-az="elim-nessuno">Togli le spunte</button>' : ''}
      <button class="btn" data-az="elim-fine">Annulla</button></div>
      <p class="tenue piccolo">Usa la ricerca e i filtri qui sopra per trovarli; le spunte restano anche se cambi filtro. Quelli eliminati finiscono nel Cestino.</p></div>`;
  }
  const avvisoCestino = (t) => ui.cestino && ui.cestino.tipo === t ? `<div class="msg grigio casella"><div>${ui.cestino.n} ${t === 'r' ? (ui.cestino.n === 1 ? 'ricetta spostata' : 'ricette spostate') : (ui.cestino.n === 1 ? 'prodotto spostato' : 'prodotti spostati')} nel <a href="#/cestino">Cestino</a>.</div><button class="btn piccolo" data-az="elim-rimetti">Rimetti</button></div>` : '';
  // il fornitore in breve: senza S.R.L., SNC DI…, S.P.A. e simili
  const nomeFornBreve = (nome) => { const n = String(nome || '').replace(/[,\s]+(S\.?\s?N\.?\s?C\.?|S\.?\s?R\.?\s?L\.?(\s?S\.?)?|S\.?\s?P\.?\s?A\.?|S\.?\s?A\.?\s?S\.?|S\.?\s?A\.?\s?R\.?\s?L\.?|S\.a\.? r\.l\.?|SOC\.?\s|SOCIET[AÀ]\s).*$/i, '').trim(); return n || nome; };
  function fornitoreBreve(p) {
    const fo = M.fornitore(p.fornitoreId);
    if (!fo) return p.interno ? 'fatto in casa' : M.daFoglio(p) ? 'dal tuo foglio' : 'senza fornitore';
    const n = String(fo.nome || '').replace(/[,\s]+(S\.?\s?N\.?\s?C\.?|S\.?\s?R\.?\s?L\.?(\s?S\.?)?|S\.?\s?P\.?\s?A\.?|S\.?\s?A\.?\s?S\.?|S\.?\s?A\.?\s?R\.?\s?L\.?|S\.a\.? r\.l\.?|SOC\.?\s|SOCIET[AÀ]\s).*$/i, '').trim();
    return n || fo.nome;
  }
  // ordine della lista prodotti
  const ORDINI_PROD = [['nome', 'Nome, dalla A alla Z'], ['recenti', 'Ultima fattura, dalla più recente'], ['prezzoSu', 'Prezzo al kg o al litro, dal più basso'], ['prezzoGiu', 'Prezzo al kg o al litro, dal più alto'], ['fornitore', 'Fornitore']];
  // data dell'ultima fattura del prodotto (se non ne ha, l'ultimo prezzo scritto)
  const ultimaFattura = (p) => { let d = '', d2 = ''; (p.prezzi || []).forEach(e => { if (!e.data) return; if (e.fatturaId && e.data > d) d = e.data; if (e.data > d2) d2 = e.data; }); return d || d2; };
  function ordinaProdotti() {
    const perNome = (a, b) => a.nomeBreve.localeCompare(b.nomeBreve);
    const pr = (p) => { const r = M.prezzoRiferimento(p); return r && r.valore != null ? r.valore : null; };
    switch (ui.ordineProd) {
      case 'recenti': return (a, b) => ultimaFattura(b).localeCompare(ultimaFattura(a)) || perNome(a, b);
      case 'prezzoSu': case 'prezzoGiu': { const v = ui.ordineProd === 'prezzoSu' ? 1 : -1; return (a, b) => { const x = pr(a), y = pr(b); if (x == null && y == null) return perNome(a, b); if (x == null) return 1; if (y == null) return -1; return (x - y) * v || perNome(a, b); }; }
      case 'fornitore': return (a, b) => fornitoreBreve(a).localeCompare(fornitoreBreve(b)) || perNome(a, b);
      default: return perNome;
    }
  }
  function listaProdotti() {
    const f = ui.filtroProdotti.toLowerCase();
    const perForn = ui.prodVista === 'fornitori';
    const l = S.prodotti.filter(p => (perForn ? (!ui.fornProd || diFornitore(p, ui.fornProd)) : (ui.categoria === '__nuovi' ? p.daCompletare : passaReparti(p, PF()))) && (!f || (p.nomeBreve + ' ' + p.nomeCompleto + ' ' + (p.nomeFoglio || '')).toLowerCase().includes(f)))
      .sort(ordinaProdotti());
    ui.scorriP = l.map(p => p.id);
    if (!l.length) return '<p class="tenue centro">Nessun prodotto.</p>';
    if (inElimina('p')) return l.map(p => { const u = M.usatoIn('p:' + p.id).tutte.length; return rigaElimina(p.id, p.nomeBreve, `${esc((M.fornitore(p.fornitoreId) || {}).nome || 'senza fornitore')} · ${u ? `<b>usato in ${u} ${u === 1 ? 'ricetta' : 'ricette'}</b>` : 'non usato'}`); }).join('');
    if (inElimina('s')) return l.map(p => rigaElimina(p.id, p.nomeBreve, `${esc(M.reparto(p))} · ${esc(p.categoria || '')} · ${esc((M.fornitore(p.fornitoreId) || {}).nome || 'senza fornitore')}`)).join('');
    if (inElimina('u')) return l.map(p => { const v = M.prezzoVoce(p), rif = M.prezzoRiferimento(p); return rigaElimina(p.id, p.nomeBreve, `${esc((M.fornitore(p.fornitoreId) || {}).nome || 'senza fornitore')} · ${rif ? n2(rif.valore) + ' ' + rif.etichetta : 'senza prezzo'}${v && v.data ? ' · ' + dataIt(v.data) : ''}`); }).join('');
    return l.map(p => {
      const pr = M.prezzo(p), rif = M.prezzoRiferimento(p);
      const sc = p.scortaMinima > 0 && (p.giacenza || 0) < p.scortaMinima;
      return `<a class="riga" href="#/prodotto/${p.id}"><span>${esc(p.nomeBreve)}<small>${esc(p.nomeCompleto)}</small><small class="forn-riga">${esc(fornitoreBreve(p))}${ui.ordineProd === 'recenti' && ultimaFattura(p) ? ' · ' + dataIt(ultimaFattura(p)) : ''}</small></span>
        <span class="destra">${p.speciale ? euro(rif && rif.valore, 2) + '<small>' + esc(rif ? rif.etichetta : '') + '</small>' : euro(pr) + `<small>${rif ? n2(rif.valore) + ' ' + rif.etichetta : 'senza prezzo'}</small>`}${sc ? '<span class="badge rosso">scorta</span>' : ''}${p.daCompletare ? '<span class="badge giallo">da completare</span>' : ''}</span></a>`;
    }).join('');
  }
  // un solo avviso compatto al posto dei tasti grandi: porta a «Metti in ordine i dati»
  function avvisoSistemare() {
    const p = passiOrdine().filter(x => x[1] && ['prodotti nuovi', 'doppioni', 'del foglio', 'cartoni'].includes(x[4])), tot = p.reduce((t, x) => t + x[1], 0);
    if (!tot) return '';
    return `<a class="card riga evidenza avviso-ordine" href="#/ordine"><span><b>Prodotti da sistemare</b><small>${p.map(x => esc(x[4]) + ' ' + x[1]).join(' · ')}</small></span><span class="badge giallo">${tot}</span></a>`;
  }
  PAGINE.prodotti = function () {
    return {
      titolo: 'Prodotti', azione: '<a class="btn-top" href="#/modifica-prodotto/nuovo">＋ Nuovo</a>', html: `
      ${avvisoSistemare()}
      <input class="cerca" type="search" placeholder="Cerca un prodotto" value="${esc(ui.filtroProdotti)}" data-filtro="prodotti">
      <div class="chips"><button class="chip ${ui.prodVista !== 'fornitori' ? 'on' : ''}" data-az="prod-vista" data-v="categorie">Per categoria</button><button class="chip ${ui.prodVista === 'fornitori' ? 'on' : ''}" data-az="prod-vista" data-v="fornitori">Per fornitore</button></div>
      ${ui.prodVista === 'fornitori' ? `<div class="chips">${fornitoriConProdotti().map(x => `<button class="chip ${ui.fornProd === x.f.id ? 'on' : ''}" data-az="forn-prod" data-v="${x.f.id}">${esc(x.f.nome)} (${x.n})</button>`).join('')}</div>` : chipsReparti(PF(), 'prod-filtro', nuoviDaCompletare() ? `<button class="chip ${ui.categoria === '__nuovi' ? 'on' : ''} giallo" data-az="categoria" data-v="__nuovi">Da completare (${nuoviDaCompletare()})</button>` : '', ui.categoria === '__nuovi')}
      <div class="filtri-tendine"><label><span>Ordina</span><select data-prod-ordine aria-label="Ordina">${ORDINI_PROD.map(([k, v]) => `<option value="${k}" ${(ui.ordineProd || 'nome') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      ${inElimina('p') ? barraElimina('p') : inElimina('u') ? barraUnisci() : inElimina('s') ? barraSposta() : `<div class="azioni-riga">${ui.prodVista === 'fornitori'
        ? (ui.fornProd && M.fornitore(ui.fornProd) ? `<a class="btn primario piccolo" href="#/formati" data-az="fmt-fornitore" data-id="${ui.fornProd}">Metti a posto i prodotti di ${esc(nomeFornBreve(M.fornitore(ui.fornProd).nome))}, uno dopo l'altro</a>` : '')
        : `<a class="btn primario piccolo" href="#/formati" data-az="fmt-categoria">${ui.categoria !== '__nuovi' && PF().cats.length === 1 ? `Ricontrolla i formati: ${esc(PF().cats[0])}` : ui.categoria !== '__nuovi' && PF().rep ? `Ricontrolla i formati: ${esc(PF().rep)}` : 'Ricontrolla i formati, uno dopo l\'altro'}</a>`}
        <details class="menu-azioni"><summary class="btn piccolo">Altro ▾</summary><div class="menu-azioni-voci"><button class="btn piccolo" data-az="elim-inizia" data-v="s">Sposta più prodotti in un reparto</button><button class="btn piccolo" data-az="elim-inizia" data-v="u">Unisci più prodotti in uno</button><button class="btn piccolo" data-az="elim-inizia" data-v="p">Elimina più prodotti</button><a class="btn piccolo" href="#/doppioni">Unisci i doppioni</a><a class="btn piccolo" href="#/foglio" data-az="fg-apri">Prodotti del foglio</a></div></details></div>`}
      ${avvisoCestino('p')}
      <div class="card lista" id="lista">${listaProdotti()}</div>`
    };
  };

  // ---------- Frecce per passare al prodotto o alla ricetta dopo, nell'elenco come l'avevi filtrato e ordinato ----------
  // t = 'P' prodotti, 'R' ricette; l'elenco è quello visto per ultimo nella pagina Prodotti o Ricette
  const posScorri = (t, id) => { const ids = ui['scorri' + t] || []; return { ids, i: ids.indexOf(id) }; };
  function barraScorri(t, id, modifica) {
    const { ids, i } = posScorri(t, id);
    if (i < 0 || ids.length < 2) return '';
    return `<div class="scorri"><button class="btn piccolo" data-az="scorri" data-t="${t}" data-dir="-1" ${modifica ? 'data-m="1"' : ''} ${i === 0 ? 'disabled' : ''} aria-label="Precedente">‹ Precedente</button>
      <span>${i + 1} di ${ids.length}</span>
      <button class="btn piccolo" data-az="scorri" data-t="${t}" data-dir="1" ${modifica ? 'data-m="1"' : ''} ${i === ids.length - 1 ? 'disabled' : ''} aria-label="Successivo">Successivo ›</button></div>`;
  }
  const tastoAvanti = (t, id) => { const { ids, i } = posScorri(t, id); return i >= 0 && i < ids.length - 1 ? `<button class="btn primario" data-az="scorri" data-t="${t}" data-dir="1" data-m="1" data-forza="1">Salva e vai avanti ›</button>` : ''; };
  const bozzaCambiata = () => { const b = ui.bozza; if (!b || !b._iniz) return false; const c = Object.assign({}, b); delete c._iniz; return JSON.stringify(c) !== b._iniz; };
  // il campo delle note con la ✕ per svuotarlo in un colpo
  const campoNote = (b, righe) => `<div class="note-testa"><span>Note</span>${b.note ? '<button type="button" class="x" data-az="note-svuota" aria-label="Cancella la nota" title="Cancella la nota">✕</button>' : ''}</div><textarea data-b="note" rows="${righe}" aria-label="Note">${esc(b.note)}</textarea>`;
  PAGINE.prodotto = function (id) {
    const p = M.prodotto(id);
    if (!p) return { titolo: 'Prodotto', html: '<p>Prodotto non trovato.</p>' };
    const pr = M.prezzo(p), rif = M.prezzoRiferimento(p), forn = M.fornitore(p.fornitoreId);
    const storico = (p.prezzi || []).slice().sort((a, b) => a.data < b.data ? -1 : 1);
    const uso = M.usatoIn('p:' + p.id);
    const ultimi = Object.entries(M.ultimiPerFornitore(p));
    const vd = p.venditaDiretta;
    let vdHtml = '';
    if (vd && pr != null) {
      const porz = p.contenuto / vd.porzione;
      const costoPorz = M.costoUnita(p) * vd.porzione;
      const iva = 1 + (S.impostazioni.ivaVendita || 0) / 100;
      vdHtml = `<div class="card"><h3>Vendita diretta</h3>
        <div class="dati">
          <div><span>Da una ${esc(p.confezione)}</span><b>${n2(porz, 1)} ${esc(vd.nomePorzione)} da ${qta(vd.porzione)} ${esc(p.unita)}</b></div>
          <div><span>Costo di un ${esc(vd.nomePorzione)}</span><b>${euro(costoPorz)}</b></div>
          <div><span>Prezzo del ${esc(vd.nomePorzione)}</span><b>${euro(vd.prezzoPorzione)}</b></div>
          <div><span>Moltiplicatore</span><b>× ${n2(vd.prezzoPorzione / costoPorz)}</b></div>
          <div><span>Incidenza</span><b>${perc(costoPorz / (vd.prezzoPorzione / iva))}</b></div>
          ${vd.prezzoIntero ? `<div><span>Prezzo della ${esc(p.confezione)} intera</span><b>${euro(vd.prezzoIntero)} · × ${n2(vd.prezzoIntero / pr)}</b></div>
          <div><span>Incasso vendendola tutta al ${esc(vd.nomePorzione)}</span><b>${euro(porz * vd.prezzoPorzione)}</b></div>` : ''}
        </div></div>`;
    }
    const conIva = pr != null ? pr * (1 + (p.iva || 0) / 100) : null;
    return {
      titolo: p.nomeBreve, indietro: '#/prodotti', azione: `<a class="btn-top" href="#/modifica-prodotto/${p.id}">Modifica</a>`, html: `${barraScorri('P', p.id)}
      ${p.daCompletare ? `<div class="card evidenza giallo"><h3>Creato in automatico da una fattura</h3><p>Controlla il <b>nome breve</b> (quello delle ricette), il <b>formato</b> (${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)}), la categoria e gli allergeni.</p>
        <div class="bottoni"><a class="btn primario" href="#/controllo">Controllo rapido</a><a class="btn" href="#/modifica-prodotto/${p.id}">Modifica</a><button class="btn" data-az="completato" data-id="${p.id}">È già giusto</button>${p.creatoDa ? `<a class="btn" href="#/fattura/${p.creatoDa}">Vedi la fattura</a>` : ''}</div></div>` : ''}
      <div class="card"><div class="sottotitolo">${esc(p.nomeCompleto)}</div>
        <div class="dati">
          <div><span>Categoria</span><b>${esc(p.categoria)}</b></div>
          <div><span>Formato</span><b>${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)}</b></div>
          ${p.speciale === 'olio' ? `<div><span>Costo</span><b>${euro(rif && rif.valore)} per kg di cibo fritto</b></div><div><span></span><a class="link" href="#/olio">Calcolo del costo dell'olio ›</a></div>` : `
          <div><span>Prezzo senza IVA</span><b>${euro(pr)}${M.prezzoVoce(p) && M.prezzoVoce(p).media ? ' (media)' : ''}</b></div>
          <div><span>IVA ${n2(p.iva, 0)}%</span><b>${euro(conIva)} con IVA</b></div>
          <div><span>Prezzo di riferimento</span><b>${rif ? n2(rif.valore) + ' ' + rif.etichetta : '—'}</b></div>`}
          ${p.resa && p.resa !== 100 ? `<div><span>Resa</span><b>${qta(p.resa)}%</b></div>` : ''}
          <div><span>Fornitore principale</span><b>${forn ? `<a href="#/fornitore/${forn.id}">${esc(forn.nome)}</a>` : (p.interno ? 'Fatto in casa' : '—')}</b></div>
        </div></div>
      ${p.speciale ? '' : `<div class="card"><h3>Magazzino</h3><div class="dati">
          <div><span>In casa</span><b>${qta(p.giacenza)} ${esc(p.confezione)}</b></div>
          <div><span>Valore</span><b>${euro(M.valoreGiacenza(p))}</b></div>
          <div><span>Scorta minima</span><b>${p.scortaMinima ? qta(p.scortaMinima) + ' ' + esc(p.confezione) : 'non impostata'}</b></div>
        </div>${p.scortaMinima && (p.giacenza || 0) < p.scortaMinima ? '<p class="msg rosso">Sotto la scorta minima.</p>' : ''}</div>`}
      ${vdHtml}
      ${(p.allergeni || []).length ? `<div class="card"><h3>Allergeni</h3><div class="chips">${p.allergeni.map(a => `<span class="chip on">${esc(a)}</span>`).join('')}</div></div>` : ''}
      ${p.speciale ? '' : `<div class="card"><h3>Storico dei prezzi</h3>
        ${grafico(storico.map(e => ({ data: e.data, y: e.prezzo })), 'Prezzo')}
        ${(() => { const rigaP = e => `<tr><td>${dataIt(e.data)}</td><td>${esc(nomeFornBreve((M.fornitore(e.fornitoreId) || {}).nome) || '—')}</td><td class="n">${euro(e.prezzo)}${e.sconto ? `<small>sconto ${n2(e.sconto, 0)}%</small>` : ''}${e.raddoppiato ? '<small>cassa ×2</small>' : ''}</td><td>${e.fatturaId ? `<a href="#/fattura/${e.fatturaId}">${esc(String(e.origine || '').replace(/^Fattura /, 'n. '))}</a>` : esc(e.origine || 'a mano')}</td></tr>`;
          const testa = '<tr><th>Data</th><th>Fornitore</th><th class="n">Prezzo</th><th>Da</th></tr>', l = storico.slice().reverse();
          return `<table class="tab">${testa}${l.slice(0, 8).map(rigaP).join('')}</table>${l.length > 8 ? `<details><summary>Vedi tutti i ${l.length} prezzi</summary><table class="tab">${l.slice(8).map(rigaP).join('')}</table></details>` : ''}`; })()}
        <button class="btn piccolo" data-az="prezzo-mano" data-id="${p.id}">＋ Aggiungi un prezzo a mano</button></div>`}
      ${ultimi.length > 1 ? `<div class="card"><h3>Confronto fornitori</h3><table class="tab"><tr><th>Fornitore</th><th>Ultimo acquisto</th><th class="n">Prezzo</th></tr>
        ${ultimi.sort((a, b) => a[1].prezzo - b[1].prezzo).map(([fid, e], i) => `<tr><td>${esc((M.fornitore(fid) || {}).nome || '—')}${i === 0 ? ' <span class="badge verde">il più basso</span>' : ''}</td><td>${dataIt(e.data)}</td><td class="n">${euro(e.prezzo)}</td></tr>`).join('')}</table></div>` : ''}
      <div class="card"><h3>Dove viene usato</h3>${uso.tutte.length ? uso.tutte.map(r => {
        const diretta = (r.righe || []).find(rg => rg.rif === 'p:' + p.id);
        return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>${diretta ? qta(diretta.quantita) + ' ' + esc(p.unita) + ' · ' + euro(M.costoUnita(p) * diretta.quantita, 3) : 'dentro una preparazione'}</small></span><span class="destra">${euro(M.costo(r))}<small>${M.TIPI_SINGOLARE[r.tipo]}</small></span></a>`;
      }).join('') : '<p class="tenue">Non è usato in nessuna ricetta.</p>'}</div>
      ${!p.speciale ? collegaARicette(p) : ''}
      ${!p.speciale && !M.daFattura(p) ? `<div class="card"><h3>È fatto da voi?</h3><p class="tenue piccolo">Se è una cosa che preparate voi (salse, sciroppi, cipolla tagliata…), trasformalo in preparazione: gli metti gli ingredienti e la resa, e le ricette che lo usano passano alla preparazione.</p><button class="btn piccolo" data-az="prod-prep" data-id="${p.id}">Diventa una preparazione</button></div>` : ''}
      ${!p.speciale ? `<div class="card form"><h3>È lo stesso di un altro prodotto?</h3><p class="tenue piccolo">Uniscilo: resta l'altro, con i prezzi, le fatture e le ricette di tutti e due.</p>
        <label>Unisci dentro<select data-az-change="ctrl-unisci" data-id="${p.id}"><option value="">scegli il prodotto…</option>${S.prodotti.filter(x => x.id !== p.id && !x.speciale).sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve)).map(x => `<option value="${x.id}">${esc(x.nomeBreve)} · ${esc(x.nomeCompleto)} · ${esc((M.fornitore(x.fornitoreId) || {}).nome || '')}</option>`).join('')}</select></label></div>` : ''}
      ${(p.uniti || []).length ? `<div class="card"><h3>Prodotti uniti qui</h3><p class="tenue piccolo">Se ne hai unito uno per sbaglio, «Separa» lo rimette com'era, con i suoi prezzi, le sue fatture e le sue ricette.</p>
        ${p.uniti.slice().reverse().map(u => `<div class="riga"><span>${esc(u.prodotto.nomeBreve)}<small>${esc((M.fornitore(u.prodotto.fornitoreId) || {}).nome || '')} · unito il ${dataIt(u.quando)}</small></span><button class="btn piccolo" data-az="prod-separa" data-id="${p.id}" data-u="${u.id}">Separa</button></div>`).join('')}</div>` : ''}
      ${(p.articoli || []).length ? `<div class="card"><h3>Come compare nelle fatture</h3>${p.articoli.map(a => `<div class="riga"><span>${esc(a.descrizione)}<small>${esc((M.fornitore(a.fornitoreId) || {}).nome || '')}${a.codice ? ' · codice ' + esc(a.codice) : ''}</small></span><span>${a.confezioniPerUnita > 1 ? a.confezioniPerUnita + ' ' + esc(p.confezione) + ' per unità' : ''}</span></div>`).join('')}</div>` : ''}
      ${p.note ? `<div class="card"><h3>Note</h3><p>${esc(p.note)}</p></div>` : ''}
      <button class="btn piccolo" data-az="simula-prodotto" data-id="${p.id}">Simula un cambio di prezzo</button>`
    };
  };

  PAGINE['modifica-prodotto'] = function (id) {
    if (!ui.bozza || ui.bozza._per !== 'p:' + id) {
      const base = id === 'nuovo' ? { id: M.uid('p'), nomeBreve: '', nomeCompleto: '', categoria: PF().cats.length === 1 ? PF().cats[0] : '', unita: 'ml', contenuto: 1000, confezione: 'bottiglia', iva: 22, giacenza: 0, scortaMinima: 0, resa: 100, allergeni: [], venditaDiretta: null, fornitoreId: '', articoli: [], prezzi: [], note: '' } : JSON.parse(JSON.stringify(M.prodotto(id)));
      if (id === 'nuovo' && M.REPARTI.includes(PF().rep)) base.reparto = PF().rep;
      base._per = 'p:' + id; const pr0 = id === 'nuovo' ? null : M.prezzo(M.prodotto(id)); base._prezzo = pr0 == null ? '' : n2(pr0); base._prezzoPrima = pr0;
      base._iniz = JSON.stringify(base); ui.bozza = base;
    }
    const b = ui.bozza;
    const campo = (et, k, tipo, extra) => `<label>${et}<input type="${tipo || 'text'}" data-b="${k}" value="${esc(b[k])}" ${extra || ''}></label>`;
    const vd = b.venditaDiretta || {};
    return {
      titolo: id === 'nuovo' ? 'Nuovo prodotto' : 'Modifica ' + b.nomeBreve, indietro: id === 'nuovo' ? '#/prodotti' : '#/prodotto/' + id, html: `${barraScorri('P', id, true)}
      <div class="due-colonne"><div class="colonna">
      <div class="card form">
        ${campo('Nome breve (quello delle ricette)', 'nomeBreve')}
        ${campo('Nome completo', 'nomeCompleto')}
        <label>Reparto${id === 'nuovo' ? ' <small class="tenue">(bar, cucina o non food)</small>' : ''}<select data-b="reparto" data-ridisegna="1">${id === 'nuovo' ? `<option value="" ${!b.reparto ? 'selected' : ''}>Scegli…</option>` : `<option value="" ${!b.reparto ? 'selected' : ''}>Dalla categoria (${esc(M.reparto(Object.assign({}, b, { reparto: '' })))})</option>`}${M.REPARTI.map(r => `<option ${b.reparto === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label>Categoria${id === 'nuovo' ? ' <small class="tenue">(scegline una o scrivine una nuova)</small>' : ''}<input list="cat-list" data-b="categoria" value="${esc(b.categoria)}" autocomplete="off"><datalist id="cat-list">${categorie().filter(c => c && (!b.reparto || S.prodotti.some(p => p.categoria === c && M.reparto(p) === b.reparto))).map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <div class="due">
          <label>Unità<select data-b="unita">${['ml', 'g', 'pz'].map(u => `<option ${b.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
          ${campo('Contenuto della confezione', 'contenuto', 'text', 'inputmode="decimal" autocomplete="off"')}
        </div>
        <div class="due">
          <label>Tipo di confezione<input list="conf-list" data-b="confezione" value="${esc(b.confezione)}" autocomplete="off"><datalist id="conf-list">${['bottiglia', 'fusto', 'lattina', 'cartone', 'cassa', 'confezione', 'sacco', 'barattolo', 'busta', 'vaschetta', 'pezzo', 'kg', 'litro'].map(c => `<option value="${c}">`).join('')}</datalist></label>
          ${campo('IVA %', 'iva', 'text', 'inputmode="decimal" autocomplete="off"')}
        </div>
        <label>Fornitore principale<select data-b="fornitoreId"><option value="">Fatto in casa / nessuno</option><option value="__nuovo">＋ Nuovo fornitore…</option>${S.fornitori.slice().sort((a, c) => a.nome.localeCompare(c.nome)).map(f => `<option value="${f.id}" ${b.fornitoreId === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
        ${campo('Prezzo della confezione senza IVA (€)', '_prezzo', 'text', 'inputmode="decimal" autocomplete="off"')}
        ${id !== 'nuovo' ? '<p class="tenue piccolo" style="margin-top:-4px">Se lo cambi, lo segno come prezzo scritto a mano con la data di oggi. Quando arriva una fattura più nuova vale quella.</p>' : ''}
        <div class="due">
          ${campo('In casa (confezioni)', 'giacenza', 'text', 'inputmode="decimal" autocomplete="off"')}
          ${campo('Scorta minima', 'scortaMinima', 'text', 'inputmode="decimal" autocomplete="off"')}
        </div>
        ${campo('Resa % (scarto, calo in cottura)', 'resa', 'text', 'inputmode="decimal" autocomplete="off"')}
      </div>
      ${pezziInFattura(b)}
      </div><div class="colonna">
      <div class="card form"><h3>Allergeni</h3><div class="chips">${M.ALLERGENI.map(a => `<button class="chip ${(b.allergeni || []).includes(a) ? 'on' : ''}" data-az="allergene" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>
      <div class="card form"><h3>Vendita diretta</h3>
        <label class="interruttore"><input type="checkbox" data-az="vd-attiva" ${b.venditaDiretta ? 'checked' : ''}> Lo vendo anche così com'è (al calice, liscio…)</label>
        ${b.venditaDiretta ? `<div class="due">
          <label>Nome della porzione<input data-vd="nomePorzione" value="${esc(vd.nomePorzione || '')}"></label>
          <label>Porzione (${esc(b.unita)})<input type="text" inputmode="decimal" autocomplete="off" data-vd="porzione" value="${esc(vd.porzione || '')}"></label></div>
          <div class="due"><label>Prezzo della porzione<input type="text" inputmode="decimal" autocomplete="off" data-vd="prezzoPorzione" value="${esc(vd.prezzoPorzione || '')}"></label>
          <label>Prezzo della confezione intera<input type="text" inputmode="decimal" autocomplete="off" data-vd="prezzoIntero" value="${esc(vd.prezzoIntero || '')}"></label></div>` : ''}
      </div>
      <div class="card form">${campoNote(b, 3)}</div>
      </div></div>
      <div class="bottoni">${tastoAvanti('P', id)}<button class="btn ${tastoAvanti('P', id) ? '' : 'primario'}" data-az="salva-prodotto">Salva</button>${id !== 'nuovo' ? '<button class="btn pericolo" data-az="elimina-prodotto">Elimina</button>' : ''}</div>`
    };
  };

  // ----- Controllo rapido dei fornitori: vende merce oppure è un servizio? -----
  function fornitoriDaControllare() {
    return S.fornitori.filter(f => !f.controllato && S.fatture.some(x => x.fornitoreId === f.id));
  }
  PAGINE['controllo-fatture'] = function () {
    const lista = fornitoriDaControllare().sort((x, y) => (x.servizi ? 1 : 0) - (y.servizi ? 1 : 0) || x.nome.localeCompare(y.nome));
    if (!lista.length) return { titolo: 'Controllo fatture', indietro: '#/fatture', html: '<div class="card evidenza"><h3>Tutti i fornitori sono controllati</h3><p>Quando arriva la prima fattura di un fornitore nuovo, lo ritrovi qui.</p><a class="btn primario" href="#/fatture">Torna alle fatture</a></div>' };
    if (ui.ctrlFIdx == null || ui.ctrlFIdx >= lista.length) ui.ctrlFIdx = 0;
    const f = lista[ui.ctrlFIdx];
    const sue = S.fatture.filter(x => x.fornitoreId === f.id).sort((x, y) => (x.data || '') < (y.data || '') ? 1 : -1);
    const righe = [];
    sue.forEach(x => x.righe.forEach(r => { if (righe.length < 8 && !righe.includes(r.descrizione)) righe.push(r.descrizione); }));
    const prodotti = S.prodotti.filter(p => p.daCompletare && sue.some(x => x.id === p.creatoDa)).length;
    const totale = sue.reduce((t, x) => t + (x.totale || 0), 0);
    return {
      titolo: `Controllo fatture · ${ui.ctrlFIdx + 1} di ${lista.length}`, indietro: '#/fatture', html: `
      <div class="ctrl">
      <div class="card">
        <h3 class="grande-t">${esc(f.nome)}</h3>
        <p class="tenue">${sue.length} ${sue.length === 1 ? 'fattura' : 'fatture'} · ${euro(totale)} in tutto${prodotti ? ` · ${prodotti} prodotti creati` : ''}</p>
        ${f.servizi ? '<p class="msg grigio">Riconosciuto da solo come <b>servizio</b> (bollette, banca, SIAE…): le sue fatture non creano prodotti.</p>' : ''}
        <h3>Cosa c'è nelle sue fatture</h3>
        <ul class="righe-esempio">${righe.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
      </div>
      <div class="bottoni colonna ctrl-scelte">
        ${f.servizi ? `<button class="btn primario grande" data-az="ctrlf-ok" data-id="${f.id}">✓ Giusto, è un servizio</button>
          <button class="btn" data-az="ctrlf-merce" data-id="${f.id}">No, vende merce: crea i prodotti</button>`
        : `<button class="btn primario grande" data-az="ctrlf-ok" data-id="${f.id}">✓ Vende merce, va bene</button>
          <button class="btn" data-az="ctrlf-servizi" data-id="${f.id}">Non vende merce (bollette, servizi, ricambi, lavori)</button>`}
        <div class="bottoni"><button class="btn piccolo" data-az="ctrlf-indietro">‹ Precedente</button><button class="btn piccolo" data-az="ctrlf-salta">Salta ›</button><a class="btn piccolo" href="#/fornitore/${f.id}">Scheda del fornitore</a></div>
        <p class="tenue piccolo">La scelta vale per tutte le sue fatture, anche quelle che arriveranno. Se vende merce, i suoi prodotti entrano già confermati: non serve ricontrollarli.</p>
      </div></div>`
    };
  };

  // ----- Controllo rapido dei prodotti creati dalle fatture -----
  PAGINE.controllo = function () {
    const lista = S.prodotti.filter(p => p.daCompletare).sort((x, y) => x.nomeBreve.localeCompare(y.nomeBreve));
    if (!lista.length) return { titolo: 'Controllo rapido', indietro: '#/prodotti', html: '<div class="card evidenza"><h3>Tutto controllato</h3><p>Non ci sono prodotti nuovi da controllare. Quando arrivano fatture con prodotti nuovi, li ritrovi qui.</p><a class="btn primario" href="#/prodotti">Vai ai prodotti</a></div>' };
    if (ui.ctrlIdx == null || ui.ctrlIdx >= lista.length) ui.ctrlIdx = 0;
    const p = lista[ui.ctrlIdx];
    const f = p.creatoDa ? S.fatture.find(x => x.id === p.creatoDa) : null;
    const forn = M.fornitore(p.fornitoreId);
    const rif = M.prezzoRiferimento(p);
    const altri = S.prodotti.filter(x => x.id !== p.id && x.unita === p.unita && !x.speciale).sort((x, y) => x.nomeBreve.localeCompare(y.nomeBreve));
    return {
      titolo: `Controllo rapido · ${ui.ctrlIdx + 1} di ${lista.length}`, indietro: '#/prodotti', html: `
      <div class="ctrl">
      <div class="card form">
        <div class="sottotitolo">Dalla fattura: <b>${esc(p.nomeCompleto)}</b><br>${esc(forn ? forn.nome : '')}${f ? ' · ' + dataIt(f.data) : ''} · ${euro(M.prezzo(p))} a ${esc(p.confezione)}${rif ? ' · ' + n2(rif.valore) + ' ' + rif.etichetta : ''}</div>
        <label>Nome breve (quello delle ricette)<input data-ctrl="${p.id}" data-k="nomeBreve" value="${esc(p.nomeBreve)}"></label>
        <div class="due">
          <label>Categoria<input list="cat-ctrl" data-ctrl="${p.id}" data-k="categoria" value="${esc(p.categoria)}"><datalist id="cat-ctrl">${categorie().map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
          <label>Confezione<input data-ctrl="${p.id}" data-k="confezione" value="${esc(p.confezione)}"></label>
        </div>
        <div class="due">
          <label>Contiene<input type="text" inputmode="decimal" autocomplete="off" data-ctrl="${p.id}" data-k="contenuto" value="${esc(p.contenuto)}"></label>
          <label>Unità<select data-ctrl="${p.id}" data-k="unita">${['ml', 'g', 'pz'].map(u => `<option ${p.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        </div>
        <p class="tenue piccolo">Esempi: bottiglia da 700 ml · kg da 1000 g · pezzo da 1 pz · fusto da 30000 ml.</p>
      </div>
      <div class="bottoni colonna ctrl-scelte">
        ${p.forseDoppioneDi && M.prodotto(p.forseDoppioneDi) ? `<button class="btn primario grande scelta-lunga" data-az="pul-si" data-da="${p.forseDoppioneDi}" data-a="${p.id}"><b>✓ È «${esc(M.prodotto(p.forseDoppioneDi).nomeBreve)}» che c'è già nelle ricette</b><small>uniscili: le ricette prendono il prezzo di questa fattura</small></button>` : ''}
        <button class="btn ${p.forseDoppioneDi ? '' : 'primario grande'}" data-az="ctrl-giusto" data-id="${p.id}">✓ È giusto${p.forseDoppioneDi ? ', è un prodotto nuovo' : ''}</button>
        <button class="btn" data-az="ctrl-materiale" data-id="${p.id}">È materiale (sacchi, bicchieri, detersivi…)</button>
        <button class="btn" data-az="ctrl-togli" data-id="${p.id}">Non è merce: toglilo (ricambi, lavori, spese)</button>
        ${forn ? `<button class="btn" data-az="ctrl-servizi" data-id="${forn.id}">${esc(forn.nome)} non vende merce: togli tutti i suoi</button>` : ''}
        <label class="unisci">È un doppione di…<select data-az-change="ctrl-unisci" data-id="${p.id}"><option value="">scegli il prodotto giusto</option>${altri.map(x => `<option value="${x.id}">${esc(x.nomeBreve)} (${esc(x.confezione)} da ${qta(x.contenuto)} ${esc(x.unita)})</option>`).join('')}</select></label>
        <div class="bottoni"><button class="btn piccolo" data-az="ctrl-indietro">‹ Precedente</button><button class="btn piccolo" data-az="ctrl-salta">Salta ›</button><a class="btn piccolo" href="#/prodotto/${p.id}">Scheda completa</a></div>
      </div></div>
      <p class="tenue piccolo">Sul Mac: Invio = «È giusto», freccia destra = salta.</p>`
    };
  };


  // ----- Ricontrollo dei formati, uno dopo l'altro (anche dei prodotti già accettati) -----
  // il ricontrollo può essere di tutto, solo del formato, solo della categoria o solo del fornitore
  const FMT_MODI = [['tutto', 'Tutto'], ['formato', 'Formato'], ['categoria', 'Categoria'], ['fornitore', 'Fornitore']];
  const fmtModo = () => ui.fmtModo || 'tutto';
  const FMT_FILTRO_INIZIALE = { tutto: 'ricette', formato: 'ricette', categoria: 'daclass', fornitore: 'senzaforn' };
  const fmtFiltro = () => ui.fmtFiltro || FMT_FILTRO_INIZIALE[fmtModo()];
  const fornitoriDi = (p) => Array.from(new Set([p.fornitoreId].concat((p.prezzi || []).map(e => e.fornitoreId), (p.articoli || []).map(a => a.fornitoreId)).filter(id => id && M.fornitore(id))));
  const senzaFornitore = (p) => !M.fornitore(p.fornitoreId) && !/fatt[io] in casa/i.test(p.categoria || '');
  const daClassificare = (p) => !p.categoria || p.categoria === 'Da classificare' || M.reparto(p) === 'Da classificare';
  function listaFormati() {
    const usati = new Set();
    S.ricette.forEach(r => (r.righe || []).concat(r.asporto || []).forEach(rg => { const m = /^p:(.+)$/.exec(rg.rif); if (m) usati.add(m[1]); }));
    const filtro = fmtFiltro();
    const daForn = (p) => p.fornitoreId === ui.fmtForn || (p.prezzi || []).some(e => e.fornitoreId === ui.fmtForn) || (p.articoli || []).some(e => e.fornitoreId === ui.fmtForn);
    const passa = (p) => filtro === 'tutti' || (filtro === 'ricette' ? usati.has(p.id) : filtro === 'cartoni' ? cartoneSospetto(p) : filtro === 'daclass' ? daClassificare(p) : filtro === 'senzaforn' ? senzaFornitore(p) : filtro === 'piuforn' ? fornitoriDi(p).length > 1 : !p.formatoOk);
    return S.prodotti.filter(p => !p.speciale && passa(p)
      && (!ui.fmtRep || M.reparto(p) === ui.fmtRep) && (!ui.fmtCat || p.categoria === ui.fmtCat) && (!ui.fmtForn || daForn(p)))
      .sort((x, y) => ui.fmtForn ? x.nomeBreve.localeCompare(y.nomeBreve) : (x.categoria || '').localeCompare(y.categoria || '') || x.nomeBreve.localeCompare(y.nomeBreve));
  }
  // prodotto comprato a cartoni (in fattura CT, CF…) ma contato come se il cartone fosse un pezzo solo
  function cartoneSospetto(p) {
    if (p.dubbio) return true;
    if (p.formatoOk || (p.unita === 'pz' && p.contenuto > 1)) return false;
    const ur = ultimaRiga(p);
    return !!(ur && M.umScatola(ur.rg.um) && (Number(ur.rg.confezioniPerUnita) || 1) === 1);
  }
  function ultimaRiga(p) {
    let best = null;
    S.fatture.forEach(f => f.righe.forEach(rg => { if (rg.prodottoId === p.id && !rg.ignora && (!best || (f.data || '') > (best.f.data || ''))) best = { f, rg }; }));
    return best;
  }
  PAGINE.formati = function () {
    const lista = listaFormati();
    const filtro = fmtFiltro(), modo = fmtModo();
    const forniConProdotti = S.fornitori.filter(f => !f.servizi && S.prodotti.some(p => p.fornitoreId === f.id || (p.prezzi || []).some(e => e.fornitoreId === f.id))).sort((x, y) => x.nome.localeCompare(y.nome));
    const nCartoni = S.prodotti.filter(p => !p.speciale && cartoneSospetto(p)).length;
    const filtriModo = modo === 'categoria' ? [['daclass', 'Da classificare (' + S.prodotti.filter(p => !p.speciale && daClassificare(p)).length + ')'], ['tutti', 'Tutti']]
      : modo === 'fornitore' ? [['senzaforn', 'Senza fornitore (' + S.prodotti.filter(p => !p.speciale && senzaFornitore(p)).length + ')'], ['piuforn', 'Comprati da più fornitori (' + S.prodotti.filter(p => !p.speciale && fornitoriDi(p).length > 1).length + ')'], ['tutti', 'Tutti']]
      : [['ricette', 'Usati nelle ricette'], ['cartoni', 'Cartoni senza pezzi (' + nCartoni + ')'], ['dacontrollare', 'Non ancora ricontrollati'], ['tutti', 'Tutti']];
    const chips = `<div class="filtri-ric"><span class="tenue piccolo">Cosa controllo</span><div class="segmentato">${FMT_MODI.map(([k, v]) => `<button class="${modo === k ? 'on' : ''}" data-az="fmt-modo" data-v="${k}">${v}</button>`).join('')}</div></div>
      <div class="chips">${filtriModo.map(([k, v]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-az="fmt-filtro" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="card form filtri-fmt"><div class="filtri3">
        <label>Solo il reparto<select data-fmt-sel="fmtRep"><option value="">Tutti i reparti</option>${M.REPARTI.map(r => `<option ${ui.fmtRep === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label>Solo la categoria<select data-fmt-sel="fmtCat"><option value="">Tutte le categorie</option>${categorie().map(c => `<option ${ui.fmtCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label>Solo il fornitore<select data-fmt-sel="fmtForn"><option value="">Tutti i fornitori</option>${forniConProdotti.map(f => `<option value="${f.id}" ${ui.fmtForn === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
      </div></div>`;
    if (!lista.length) return { titolo: 'Ricontrollo formati', indietro: '#/prodotti', html: chips + '<div class="card evidenza"><h3>Finito</h3><p>Non ci sono prodotti in questo elenco.</p><a class="btn primario" href="#/prodotti">Vai ai prodotti</a></div>' };
    if (ui.fmtIdx == null || ui.fmtIdx >= lista.length) ui.fmtIdx = 0;
    const p = lista[ui.fmtIdx];
    const forn = M.fornitore(p.fornitoreId);
    const navig = `<div class="bottoni"><button class="btn piccolo" data-az="fmt-indietro">‹ Precedente</button><button class="btn piccolo" data-az="fmt-salta">Salta ›</button><a class="btn piccolo" href="#/prodotto/${p.id}">Apri la scheda</a></div>`;
    const testaP = `<h3 class="grande-t">${esc(p.nomeBreve)}</h3><div class="sottotitolo">${esc(p.nomeCompleto)}<br>${esc(forn ? forn.nome : 'senza fornitore')} · ${esc(p.categoria || '')}</div>`;
    // solo la categoria: un tocco sulla categoria e si passa al prossimo
    if (modo === 'categoria') {
      const rep = M.reparto(p) === 'Da classificare' ? (ui.fmtcRep || '') : M.reparto(p);
      const cats = categorie().filter(c => c && c !== 'Da classificare' && (!rep || S.prodotti.some(x => x.categoria === c && M.reparto(x) === rep)));
      return { titolo: `Categorie · ${ui.fmtIdx + 1} di ${lista.length}`, indietro: '#/prodotti', html: chips + `
        <div class="ctrl"><div class="card form">${testaP}
          <p class="tenue piccolo">1. Il reparto</p>
          <div class="segmentato">${M.REPARTI.map(r => `<button class="${rep === r ? 'on' : ''}" data-az="fmtc-rep" data-id="${p.id}" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div>
          <p class="tenue piccolo">2. La categoria${rep ? '' : ' (prima scegli il reparto)'} — tocca e passa al prossimo</p>
          <div class="chips a-capo">${rep ? cats.map(c => `<button class="chip ${p.categoria === c ? 'on' : ''}" data-az="fmtc-cat" data-id="${p.id}" data-v="${esc(c)}">${esc(c)}</button>`).join('') : ''}</div>
          ${rep ? `<div class="olio-aggiungi"><input id="fmtc-nuova" placeholder="Oppure scrivi una categoria nuova" autocomplete="off"><button class="btn piccolo" data-az="fmtc-nuova" data-id="${p.id}">Usa questa</button></div>` : ''}
        </div>${navig}</div>
        <p class="tenue piccolo">I prodotti che arriveranno nelle prossime fatture con un nome simile prenderanno da soli la categoria che scegli qui.</p>` };
    }
    // solo il fornitore principale
    if (modo === 'fornitore') {
      const fl = fornitoriDi(p), ult = M.ultimiPerFornitore(p);
      return { titolo: `Fornitori · ${ui.fmtIdx + 1} di ${lista.length}`, indietro: '#/prodotti', html: chips + `
        <div class="ctrl"><div class="card form">${testaP}
          ${fl.length ? `<p class="tenue piccolo">L'hai comprato da: tocca quello principale e passa al prossimo</p>${fl.map(id => { const f = M.fornitore(id), e = ult[id]; return `<button class="btn largo scelta-forn ${p.fornitoreId === id ? 'on' : ''}" data-az="fmtf-scegli" data-id="${p.id}" data-v="${id}"><span>${esc(f.nome)}</span><small>${e ? euro(e.prezzo) + ' · ' + dataIt(e.data) : ''}</small></button>`; }).join('')}` : '<p class="tenue">Nessuna fattura con questo prodotto.</p>'}
          <label>Oppure un altro fornitore<select data-fmtf="${p.id}"><option value="">Scegli…</option><option value="__nuovo">＋ Nuovo fornitore…</option>${S.fornitori.filter(f => !f.servizi).sort((a, b) => a.nome.localeCompare(b.nome)).map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select></label>
        </div>${navig}</div>` };
    }
    const ur = ultimaRiga(p);
    const art = ur ? (p.articoli || []).find(a => a.fornitoreId === ur.f.fornitoreId && ((ur.rg.codice && a.codice === ur.rg.codice) || a.descrizione === ur.rg.descrizione)) : null;
    const perRiga = ur ? (Number(ur.rg.confezioniPerUnita) || 1) : null;
    const pr = M.prezzo(p), rif = M.prezzoRiferimento(p);
    const usoRic = M.usatoIn('p:' + p.id).tutte.length;
    const conto = ur ? `<div class="card form"><h3>Livello in più: quanti «${esc(p.confezione)}» ci sono in ogni ${esc(ur.rg.um || 'confezione')} di fattura</h3>
        <p>In fattura${ur.f.fornitoreNome ? ' di <b>' + esc(forn ? forn.nome : ur.f.fornitoreNome) + '</b>' : ''} del ${dataIt(ur.f.data)}:<br><b>${esc(ur.rg.descrizione)}</b><br>${qta(ur.rg.quantita)} ${esc(ur.rg.um || '')} a ${euro(ur.rg.prezzoUnitario, 3)}</p>
        ${cartoneSospetto(p) ? `<p class="msg giallo">In fattura c'è scritto <b>${esc(ur.rg.um)}</b>, ma adesso è contato come un pezzo solo. Scrivi quanti pezzi ci sono dentro e premi Invio.</p>` : ''}
        <label>1 ${esc(ur.rg.um || 'pezzo')} di fattura = quanti «${esc(p.confezione)}»? (es. cartone da 12 bottiglie: scrivi 12)<input type="text" inputmode="decimal" autocomplete="off" data-fmt-righe="${p.id}" data-fattura="${ur.f.id}" value="${esc(perRiga)}"></label>
        <p class="msg grigio"><b>Riassunto:</b> 1 ${esc(ur.rg.um || 'confezione')} di fattura = ${qta(perRiga)} ${esc(p.confezione)} · 1 ${esc(p.confezione)} = ${qta(p.contenuto)} ${esc(p.unita)}</p>
        <p class="msg grigio">${pr != null ? `Quindi: <b>${euro(pr, 3)}</b> a ${esc(p.confezione)} · ${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)} · <b>${rif ? n2(rif.valore) + ' ' + rif.etichetta : ''}</b>` : 'Senza prezzo.'}</p>
      </div>` : `<div class="card"><h3>Prezzo</h3><p>${pr != null ? `${euro(pr, 3)} a ${esc(p.confezione)} · <b>${rif ? n2(rif.valore) + ' ' + rif.etichetta : ''}</b>` : 'Senza prezzo.'}</p><p class="tenue piccolo">Non arriva da nessuna fattura: il prezzo è quello del foglio o messo a mano.</p></div>`;
    return {
      titolo: `Formati · ${ui.fmtIdx + 1} di ${lista.length}`, indietro: '#/prodotti', html: chips + `
      <div class="ctrl">
      <div class="card form">
        <h3 class="grande-t">${esc(p.nomeBreve)}${p.formatoOk ? ' <span class="badge verde">ricontrollato</span>' : ''}</h3>
        <div class="sottotitolo">${esc(p.nomeCompleto)}<br>${esc(forn ? forn.nome : 'senza fornitore')} · ${esc(p.categoria || '')}${usoRic ? ` · usato in ${usoRic} ${usoRic === 1 ? 'ricetta' : 'ricette'}` : ''}</div>
        ${modo === 'formato' ? '' : `<label>Nome breve<input data-ctrl="${p.id}" data-k="nomeBreve" value="${esc(p.nomeBreve)}"></label>
        <div class="due">
          <label>Reparto<select data-ctrl="${p.id}" data-k="reparto">${M.REPARTI.map(r => `<option ${M.reparto(p) === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label>Categoria<input list="cat-fmt" data-ctrl="${p.id}" data-k="categoria" value="${esc(p.categoria)}"><datalist id="cat-fmt">${categorie().map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        </div>`}
        <label>Si compra a<input data-ctrl="${p.id}" data-k="confezione" value="${esc(p.confezione)}" placeholder="bottiglia, kg, cartone…"></label>
        <div class="due">
          <label>Che contiene<input type="text" inputmode="decimal" autocomplete="off" data-ctrl="${p.id}" data-k="contenuto" value="${esc(p.contenuto)}"></label>
          <label>Unità<select data-ctrl="${p.id}" data-k="unita">${['ml', 'g', 'pz'].map(u => `<option ${p.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        </div>
        <p class="tenue piccolo">Esempi: bottiglia da 700 ml · kg da 1000 g · cartone da 24 pz · fusto da 30000 ml.</p>
        ${p.unita === 'pz' ? '<p class="tenue piccolo">Venduto a pezzo ma nelle ricette lo usi a grammi o millilitri? Metti «pezzo», quanti grammi (o ml) pesa un pezzo e l\'unità g (o ml): il costo al grammo si calcola da solo.</p>' : ''}
      </div>
      ${conto}
      <div class="bottoni colonna ctrl-scelte">
        <button class="btn primario grande" data-az="fmt-giusto" data-id="${p.id}">✓ Giusto, avanti</button>
        <div class="bottoni"><button class="btn piccolo" data-az="fmt-indietro">‹ Precedente</button><button class="btn piccolo" data-az="fmt-salta">Salta ›</button><a class="btn piccolo" href="#/prodotto/${p.id}">Scheda completa</a></div>
      </div></div>
      <p class="tenue piccolo">Sul Mac: Invio = «Giusto, avanti», frecce = precedente e successivo. Le modifiche si salvano da sole e il costo delle ricette si aggiorna subito.</p>`
    };
  };


  // da dove viene il prezzo che uso: fattura, listino, tuo foglio o scritto a mano
  function fontePrezzo(p) {
    const v = M.prezzoVoce(p); if (!v) return '';
    if (v.fatturaId) return `<small class="fonte">prezzo dalla fattura del ${dataIt(v.data)}</small>`;
    if (/^Listino/.test(v.origine || '')) return `<small class="fonte">prezzo dal ${esc(v.origine.toLowerCase())}</small>`;
    if (/^Foglio/.test(v.origine || '')) return `<small class="fonte giallo-t">prezzo dal tuo foglio${/mano/.test(v.origine) ? ', corretto a mano' : ''}</small>`;
    return `<small class="fonte">prezzo scritto a mano il ${dataIt(v.data)}</small>`;
  }
  const provvisoriaDaFoglio = (r) => r && r.tipo === 'semilavorato' && (r.costiExtra || []).some(e => /foglio/i.test(e.nome || ''));
  // ----- Pulizia: i prodotti del foglio diventano quelli veri delle fatture -----
  function coppieFoglio() {
    const fatt = S.prodotti.filter(p => M.daFattura(p));
    const saltati = new Set(S.puliziaSaltati || []);
    return S.prodotti.filter(p => M.daFoglio(p) && !saltati.has(p.id)).map(p => ({ p, sim: M.somiglianti(p, fatt).slice(0, 3) })).filter(x => x.sim.length)
      .sort((a, b) => b.sim[0].punti - a.sim[0].punti || a.p.nomeBreve.localeCompare(b.p.nomeBreve));
  }
  const descrPrezzo = (p) => { const pr = M.prezzo(p), rif = M.prezzoRiferimento(p); return pr == null ? 'senza prezzo' : `${euro(pr)} a ${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)}${rif ? ' · ' + n2(rif.valore) + ' ' + rif.etichetta : ''}`; };
  PAGINE.pulizia = function () {
    const l = coppieFoglio();
    const nFoglio = S.prodotti.filter(p => M.daFoglio(p)).length;
    const fine = `<div class="card"><h3>Ultimo passo</h3><p>Tolgo le due fatture di esempio, e tolgo i fornitori scritti a mano che non hanno fatture (se esiste quello vero delle fatture, i prodotti passano a lui). I prodotti del foglio che non compaiono in nessuna fattura restano col prezzo del foglio, finché non arriva la prima fattura.</p>
      <div class="bottoni"><button class="btn primario" data-az="pulizia-fine">Finisci la pulizia</button></div><p class="tenue piccolo">Prima scarico da solo una copia di tutti i dati, per sicurezza.</p></div>`;
    if (!l.length) return { titolo: 'Pulizia dati del foglio', indietro: '#/impostazioni', html: `<div class="card evidenza"><h3>Collegamenti finiti</h3><p>Non restano prodotti del foglio da collegare alle fatture (ne restano ${nFoglio} che nelle fatture non ci sono).</p></div>${S.puliziaFatta ? '<p class="msg verde">Pulizia già fatta.</p>' : fine}` };
    if (ui.pulIdx == null || ui.pulIdx >= l.length) ui.pulIdx = 0;
    const x = l[ui.pulIdx], p = x.p;
    const usi = M.usatoIn('p:' + p.id).tutte.length;
    return {
      titolo: `Pulizia · ${ui.pulIdx + 1} di ${l.length}`, indietro: '#/impostazioni', html: `
      <p class="tenue">Prodotto del tuo foglio a sinistra, prodotti arrivati dalle fatture a destra. Se è lo stesso, le ricette passano al prodotto vero e da lì in poi il prezzo lo fanno le fatture.</p>
      <div class="ctrl">
      <div class="card"><h3 class="grande-t">${esc(p.nomeBreve)}</h3>
        <div class="sottotitolo">Dal foglio: ${esc(p.nomeCompleto)}<br>${esc((M.fornitore(p.fornitoreId) || {}).nome || '')}${usi ? ` · usato in ${usi} ${usi === 1 ? 'ricetta' : 'ricette'}` : ' · in nessuna ricetta'}</div>
        <p>${descrPrezzo(p)}</p></div>
      <div class="bottoni colonna ctrl-scelte">
        ${x.sim.map((s, k) => `<button class="btn ${k === 0 ? 'primario grande' : ''} scelta-lunga" data-az="pul-si" data-da="${p.id}" data-a="${s.p.id}"><b>${k === 0 ? '✓ ' : ''}È ${esc(s.p.nomeCompleto)}</b><small>${esc((M.fornitore(s.p.fornitoreId) || {}).nome || '')} · ${descrPrezzo(s.p)}</small></button>`).join('')}
        <button class="btn" data-az="pul-no" data-id="${p.id}">Nessuno di questi: tienilo com'è</button>
        <div class="bottoni"><button class="btn piccolo" data-az="pul-indietro">‹ Precedente</button><button class="btn piccolo" data-az="pul-salta">Salta ›</button></div>
      </div></div>
      <p class="tenue piccolo">Controlla che i due prezzi al litro, al chilo o al pezzo siano simili: se sono molto diversi, il formato di uno dei due è sbagliato e lo sistemi dopo nel ricontrollo formati. Sul Mac: Invio = la prima scelta.</p>
      ${fine}`
    };
  };

  // ----- Ricette -----
  // scelta del gruppo: un gruppo solo, oppure tutte le ricette (o tutte quelle del bar o della cucina)
  const SCELTE_REP = { '*tutto': 'Tutte', '*bar': 'Bar', '*cucina': 'Cucina' };
  const tipiScelti = (t) => t === '*tutto' ? Object.keys(M.TIPI).filter(k => k !== 'semilavorato') : t === '*bar' ? M.tipiDi('bar') : t === '*cucina' ? M.tipiDi('cucina') : [t];
  // reparto di una preparazione: quello scelto a mano, se no da chi la usa (drink → bar, panini → cucina), se no dagli ingredienti; '' = tutti e due
  function repPrep(r) {
    if (r.reparto === 'bar' || r.reparto === 'cucina') return r.reparto;
    const usi = new Set(M.usatoIn('r:' + r.id).tutte.filter(x => x.tipo !== 'semilavorato').map(x => M.REPARTO_TIPO[x.tipo]).filter(Boolean));
    if (usi.size === 1) return [...usi][0]; if (usi.size > 1) return '';
    const conta = { bar: 0, cucina: 0 };
    (r.righe || []).forEach(rg => { if (!rg.rif.startsWith('p:')) return; const p = M.prodotto(rg.rif.slice(2)); const x = p ? String(M.reparto(p)).toLowerCase() : ''; if (conta[x] != null) conta[x]++; });
    return conta.bar > conta.cucina ? 'bar' : conta.cucina > conta.bar ? 'cucina' : '';
  }
  const prepNelReparto = (r, rep) => { if (!rep || rep === '*tutto') return true; const x = repPrep(r); return !x || x === rep.slice(1); };
  const nomeScelta = (t) => t === '*tutto' ? 'ricette' : t === '*bar' ? 'ricette del bar' : t === '*cucina' ? 'ricette della cucina' : (M.TIPI[t] || 'ricette').toLowerCase();
  const daCompletareR = (r) => { if (!(r.righe || []).length || /^Ricetta da completare/.test(r.note || '')) return true; const c = M.costoRicetta(r); return !!c.mancanti.length || !(c.totale > 0); };
  function chipsGruppi(az, conDaCompletare) {
    const t = ui.tipoRicette, rep = ui.repRicette || (SCELTE_REP[t] ? t : '*tutto');
    const gruppi = Object.keys(M.TIPI).filter(k => k !== 'semilavorato' && (rep === '*tutto' || M.REPARTO_TIPO[k] === rep.slice(1)));
    const nDc = conDaCompletare ? S.ricette.filter(r => tipiScelti(t).includes(r.tipo) && daCompletareR(r)).length : 0;
    const staccato = az === 'tipo-ricette';
    const segm = [['*tutto', 'Tutte'], ['*bar', 'Bar'], ['*cucina', 'Cucina']].concat(staccato ? [] : [['semilavorato', 'Preparazioni']]);
    return `<div class="filtri-ric">
      <div class="segmentato">${segm.map(([k, v]) => `<button class="${t === k || (rep === k && !SCELTE_REP[t] && (t !== 'semilavorato' || staccato)) ? 'on' : ''}" data-az="${az}" data-v="${k}">${v}</button>`).join('')}</div>
      ${staccato ? `<button class="btn-prep ${t === 'semilavorato' ? 'on' : ''}" data-az="ric-prep" aria-pressed="${t === 'semilavorato'}">Preparazioni</button>` : ''}
    </div>
    ${t !== 'semilavorato' ? `<div class="striscia-gruppi">${conDaCompletare ? `<button class="chip piccola giallo ${ui.ricDaComp ? 'on' : ''}" data-az="ric-dacomp">${ui.ricDaComp ? '✓ ' : ''}Da completare ${nDc}</button><span class="separa"></span>` : ''}${SCELTE_REP[t] ? `<button class="chip piccola on" data-az="${az}" data-v="${rep}">Tutti</button>` : `<button class="chip piccola" data-az="${az}" data-v="${rep}">Tutti</button>`}${gruppi.map(k => { const n = S.ricette.filter(r => r.tipo === k).length; return `<button class="chip piccola ${t === k ? 'on' : ''} ${n ? '' : 'vuoto'}" data-az="${az}" data-v="${k}">${esc(M.TIPI[k])} <span class="${t === k ? '' : 'tenue'}">${n}</span></button>`; }).join('')}</div>` : ''}`;
  }
  const ORDINI_RIC = [['vendute', 'Più vendute'], ['menovendute', 'Meno vendute'], ['guadtot', 'Guadagno totale'], ['guadpiu', 'Guadagno più alto'], ['guadagno', 'Guadagno più basso'], ['molt', 'Costo % più alto'], ['nome', 'Per nome']];
  const haVendite = () => S.periodiVendita.some(pp => S.ricette.some(r => (r.vendite || {})[pp]));
  const ordineRic = () => ui.ordineRicette || (haVendite() ? 'vendute' : 'nome');
  function vendutiRic(r) {
    const per = ui.ricPer || '';
    if (per) return Number((r.vendite || {})[per]) || 0;
    return senzaDoppi(S.periodiVendita.slice()).reduce((t, pp) => t + (Number((r.vendite || {})[pp]) || 0), 0);
  }
  function listaRicette() {
    const f = ui.filtroRicette.toLowerCase();
    const scelti = tipiScelti(ui.tipoRicette), conGruppo = scelti.length > 1;
    const l = S.ricette.filter(r => scelti.includes(r.tipo) && (r.tipo !== 'semilavorato' || prepNelReparto(r, ui.repRicette)) && (!f || r.nome.toLowerCase().includes(f)) && (!ui.ricDaComp || daCompletareR(r))).sort((a, b) => a.nome.localeCompare(b.nome));
    if (!l.length) { ui.scorriR = []; return `<p class="tenue centro">${ui.ricDaComp ? 'Nessuna ricetta da completare qui. Ottimo!' : 'Nessuna ricetta.'}</p>`; }
    // ordinamento come nei programmi per la ristorazione: popolarità (pezzi venduti), guadagno a pezzo, guadagno totale, costo in percentuale
    const ord = ordineRic();
    const vend = (r) => vendutiRic(r), mar = (r) => { const x = M.indicatori(r).margine; return x == null ? null : x; };
    const perNum = (f, verso) => (a, b) => { const x = f(a), y = f(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return verso * (y - x); };
    if (ord !== 'nome' && l[0].tipo !== 'semilavorato') {
      if (ord === 'vendute') l.sort(perNum(vend, 1));
      else if (ord === 'menovendute') l.sort(perNum(vend, -1));
      else if (ord === 'guadtot') l.sort(perNum(r => mar(r) == null ? null : mar(r) * vend(r), 1));
      else if (ord === 'guadpiu') l.sort(perNum(mar, 1));
      else if (ord === 'guadagno') l.sort(perNum(mar, -1));
      else if (ord === 'molt') l.sort(perNum(r => M.indicatori(r).molt, -1));
    }
    const conVend = ['vendute', 'menovendute', 'guadtot'].includes(ord);
    ui.scorriR = l.map(r => r.id);
    if (inElimina('r')) { const pp = periodoVendite(); return l.map(r => { const v = (S.periodiVendita || []).reduce((t, x) => t + (Number((r.vendite || {})[x]) || 0), 0), u = M.usatoIn('r:' + r.id).tutte.length; return rigaElimina(r.id, r.nome, `${esc(M.TIPI[r.tipo] || '')} · ${v ? qta(v) + ' venduti in tutto' : 'mai venduta'}${u ? ` · <b>usata in ${u} ${u === 1 ? 'ricetta' : 'ricette'}</b>` : ''}`); }).join(''); }
    if (ui.spostaModo) { const sel = new Set(ui.spostaSel || []); return l.map(r => `<label class="riga spunta-riga"><input type="checkbox" data-sposta="${r.id}" ${sel.has(r.id) ? 'checked' : ''}><span>${esc(r.nome)}</span></label>`).join(''); }
    return l.map(r => {
      if (r.tipo === 'semilavorato') {
        const c = M.costo(r);
        return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>resa ${qta(r.resa)} ${esc(r.unita)}</small></span><span class="destra">${euro(c)}<small>${c != null && r.resa ? euro(c / r.resa * 1000) + ' al ' + (r.unita === 'g' ? 'kg' : 'litro') : ''}</small></span></a>`;
      }
      const i = M.indicatori(r);
      // ricette con solo una parte degli ingredienti: i numeri sono troppo belli, lo dico chiaro
      const parziale = /^Ricetta da completare/.test(r.note || '');
      const vv = conVend ? vendutiRic(r) : 0;
      return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}${conGruppo ? `<small>${esc(M.TIPI[r.tipo] || '')}</small>` : ''}${etichetteCP(i)}${conVend ? `<small class="forn-riga">${vv ? qta(vv) + ' venduti' + (i.margine != null && ord === 'guadtot' ? ' · ' + euro(vv * i.margine, 0) + ' guadagnati' : '') : 'mai venduta'}</small>` : ''}</span><span class="destra">${parziale ? '<span class="badge giallo">ingredienti incompleti</span>' : badgeMolt(i)}<small>${i.margine != null && i.molt != null ? 'guadagni ' + euro(i.margine) : ''}</small></span></a>`;
    }).join('');
  }
  PAGINE.ricette = function () {
    return {
      titolo: 'Ricette', azione: '<a class="btn-top" href="#/modifica-ricetta/nuovo">＋ Nuova</a>', html: `
      <div class="cerca-riga"><input class="cerca" type="search" placeholder="Cerca una ricetta" value="${esc(ui.filtroRicette)}" data-filtro="ricette">
</div>
      ${chipsGruppi('tipo-ricette', true)}
      ${ui.tipoRicette !== 'semilavorato' ? `<div class="filtri-tendine">
        <label><span>Ordina</span><select data-ric-ordine aria-label="Ordina">${ORDINI_RIC.map(([k, v]) => `<option value="${k}" ${ordineRic() === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        ${haVendite() ? `<label><span>Vendite di</span><select data-ric-periodo aria-label="Vendite di">${[['', 'Tutti i periodi']].concat(S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp])).map(pp => [pp, pp])).map(([k, v]) => `<option value="${esc(k)}" ${(ui.ricPer || '') === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>` : ''}
      </div>` : ''}
      ${ui.spostaModo ? `<div class="card evidenza sposta-barra"><b>Sposta le ricette spuntate (${(ui.spostaSel || []).length})</b>
        <label>nel gruppo<select id="sposta-in">${Object.entries(M.TIPI).filter(([k]) => k !== ui.tipoRicette).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
        <div class="bottoni"><button class="btn primario" data-az="sposta-ok">Sposta</button><button class="btn" data-az="sposta-tutte">Spunta tutte quelle visibili</button><button class="btn" data-az="sposta-fine">Annulla</button></div></div>` : ''}
      ${inElimina('r') ? barraElimina('r') : `<div class="azioni-riga"><button class="btn primario piccolo" data-az="riv-inizia" title="Rivedi ${ui.ricDaComp ? 'quelle da completare' : ui.filtroRicette ? 'quelle con «' + esc(ui.filtroRicette) + '»' : 'le ' + esc(nomeScelta(ui.tipoRicette))} una per una">Rivedi una per una</button>
        <details class="menu-azioni"><summary class="btn piccolo">Altro ▾</summary><div class="menu-azioni-voci"><button class="btn piccolo" data-az="sposta-inizia">Sposta ricette in un altro gruppo</button><button class="btn piccolo" data-az="elim-inizia" data-v="r">Elimina più ricette</button>${tipiScelti(ui.tipoRicette).length === 1 && ui.tipoRicette !== 'semilavorato' ? `<a class="btn piccolo" href="#/costi-gruppo/${tipiScelti(ui.tipoRicette)[0]}">Costi su tutto il gruppo «${esc(M.TIPI[tipiScelti(ui.tipoRicette)[0]] || '')}»</a>` : ''}<a class="btn piccolo" href="#/gruppi-ricette">＋ Nuovo gruppo / gestisci i gruppi (e i loro costi)</a></div></details></div>`}
      ${avvisoCestino('r')}
      <div class="card lista" id="lista">${listaRicette()}</div>`
    };
  };

  PAGINE.ricetta = function (id) {
    const r = M.ricetta(id);
    if (!r) return { titolo: 'Ricetta', html: '<p>Ricetta non trovata.</p>' };
    const cr = M.costoRicetta(r);
    const semi = r.tipo === 'semilavorato';
    const i = M.indicatori(r);
    const asp = M.costoAsporto(r);
    const all = M.allergeniRicetta(r);
    const and = M.andamento(r);
    const uso = M.usatoIn('r:' + r.id);
    const periodi = S.periodiVendita.filter(pp => r.vendite && r.vendite[pp]);
    const righe = cr.righe.map(rg => {
      const o = M.rif(rg.rif);
      const link = rg.rif.startsWith('p:') ? '#/prodotto/' + rg.rif.slice(2) : '#/ricetta/' + rg.rif.slice(2);
      const quota = rg.costo != null && cr.totale ? rg.costo / cr.totale : null;
      const fonte = rg.rif.startsWith('p:') ? (o ? fontePrezzo(o) : '') : provvisoriaDaFoglio(o) ? '<small class="fonte giallo-t">preparazione con il costo provvisorio del tuo foglio</small>' : '';
      return `<tr><td><a href="${link}">${esc(M.nomeRif(rg.rif))}</a>${rg.nota ? `<small>${esc(rg.nota)}</small>` : ''}${fonte}</td><td class="n">${qta(rg.quantita)}${rg.misura && M.MISURE[rg.misura] ? misuraTesto(rg) : ' ' + esc(M.unitaRif(rg.rif))}</td><td class="n">${rg.costo == null ? '<span class="badge rosso">manca</span>' : euro(rg.costo, 3)}</td><td class="n tenue">${perc(quota, 0)}</td></tr>`;
    }).join('') + (r.costiExtra || []).map(e => `<tr><td>${esc(e.nome)}</td><td></td><td class="n">${euro(e.costo, 3)}</td><td class="n tenue">${perc(cr.totale ? e.costo / cr.totale : null, 0)}</td></tr>`).join('')
      + (cr.gruppo || []).map(g => `<tr><td>${g.rif ? `<a href="#/prodotto/${g.rif.slice(2)}">${esc(M.nomeRif(g.rif))}</a>` : esc(g.nome || 'costo')}<small class="fonte"><a href="#/costi-gruppo/${r.tipo}">dal gruppo ${esc(M.TIPI[r.tipo] || '')}</a></small></td><td class="n">${g.rif ? qta(g.quantita) + ' ' + esc(M.unitaRif(g.rif)) : ''}</td><td class="n">${g.costo == null ? '<span class="badge giallo">senza prezzo</span>' : euro(g.costo, 3)}</td><td class="n tenue">${perc(g.costo != null && cr.totale ? g.costo / cr.totale : null, 0)}</td></tr>`).join('');
    return {
      titolo: r.nome, indietro: '#/ricette', azione: `<a class="btn-top" href="#/modifica-ricetta/${r.id}">Modifica</a>`, html: `${barraScorri('R', r.id)}
      ${semi ? `<div class="kpi-griglia">${kpi('Costo della preparazione', euro(cr.totale))}${kpi('Resa', qta(r.resa) + ' ' + esc(r.unita))}${kpi(r.unita === 'g' ? 'Costo al kg' : 'Costo al litro', euro(cr.totale != null && r.resa ? cr.totale / r.resa * 1000 : null))}${kpi('Costo per 10 ' + esc(r.unita), euro(cr.totale != null && r.resa ? cr.totale / r.resa * 10 : null, 3))}</div>` : `
      <div class="kpi-griglia">
        ${kpi('Costo', euro(i.costo), 'senza IVA')}
        ${kpi('Prezzo di vendita', euro(i.prezzo), 'senza IVA ' + euro(i.netto))}
        ${kpi('Moltiplicatore', i.molt == null ? '—' : '× ' + n2(i.molt), 'prezzo con IVA ÷ costo' + (i.soglia ? ' · soglia × ' + n2(i.soglia) : ''), i.sotto ? 'rosso' : 'verde')}
        ${kpi('Incidenza', perc(i.incidenza), 'margine ' + euro(i.margine) + ' a pezzo')}
      </div>`}
      ${!semi && i.sotto && prezzoConsigliato(r) && i.prezzo && prezzoConsigliato(r) > i.prezzo * 2.5 ? '<p class="msg giallo">Il moltiplicatore è molto basso: prima di cambiare il prezzo controlla che dosi e formati degli ingredienti siano giusti.</p>' : ''}
      ${!semi && i.sotto && prezzoConsigliato(r) && !(i.prezzo && prezzoConsigliato(r) > i.prezzo * 2.5) ? `<p class="msg giallo">Prezzo consigliato: <b>${euro(prezzoConsigliato(r))}</b> per tornare alla soglia × ${n2(i.soglia)} (adesso ${euro(i.prezzo)}). <a href="#/prezzi-consigliati">Tutte le ricette da ritoccare</a></p>` : ''}
      ${cr.mancanti.length ? `<p class="msg rosso">Mancano i prezzi di: ${esc(cr.mancanti.join(', '))}.</p>` : ''}
      <div class="card"><h3>Ingredienti</h3>${r.media ? '<p class="msg grigio">Il cliente ne sceglie uno: il costo è la media di questi.</p>' : ''}<table class="tab"><tr><th>Ingrediente</th><th class="n">Dose</th><th class="n">Costo</th><th class="n">Peso</th></tr>${righe}
        <tr class="totale"><td>Totale</td><td></td><td class="n">${euro(cr.totale, 3)}</td><td></td></tr></table></div>
      ${asp && (r.asporto || []).length ? `<div class="card"><h3>Da asporto</h3><div class="dati">
        ${(r.asporto || []).map(a => `<div><span>${esc(M.nomeRif(a.rif))} × ${qta(a.quantita)}</span><b>${euro(M.costoRiga(a.rif, a.quantita).costo, 3)}</b></div>`).join('')}
        <div><span>Costo da asporto</span><b>${euro(asp.totale)}</b></div>
        <div><span>Moltiplicatore da asporto</span><b>× ${n2(r.prezzo / asp.totale)}</b></div></div></div>` : ''}
      <div class="card"><h3>Allergeni</h3>${all.length ? `<div class="chips">${all.map(a => `<span class="chip on">${esc(a)}</span>`).join('')}</div>` : '<p class="tenue">Nessun allergene segnato.</p>'}<p class="tenue piccolo">Presi in automatico dalle schede dei prodotti, più quelli che segni tu in «Modifica».</p></div>
      ${!semi && periodi.length ? `<div class="card"><h3>Vendite</h3><table class="tab"><tr><th>Periodo</th><th class="n">Pezzi</th><th class="n">Incasso</th><th class="n">Margine</th></tr>
        ${periodi.map(pp => `<tr><td>${esc(pp)}</td><td class="n">${qta(r.vendite[pp])}</td><td class="n">${euro(r.vendite[pp] * r.prezzo, 0)}</td><td class="n">${euro(i.margine != null ? r.vendite[pp] * i.margine : null, 0)}</td></tr>`).join('')}</table>
        <p class="tenue piccolo">Margine senza IVA, con il costo di oggi.</p></div>` : ''}
      <div class="card"><h3>Andamento del costo</h3>${grafico(and.map(x => ({ data: x.data, y: x.costo })), 'Costo')}</div>
      ${uso.tutte.length ? `<div class="card"><h3>Usata in</h3>${uso.tutte.map(x => `<a class="riga" href="#/ricetta/${x.id}"><span>${esc(x.nome)}</span><span>${euro(M.costo(x))}</span></a>`).join('')}</div>` : ''}
      ${r.note ? `<div class="card"><div class="riga" style="border:0;padding:0"><h3 style="margin:0">Note</h3><button class="x" data-az="nota-via" data-id="${r.id}" aria-label="Togli la nota" title="Togli la nota">✕</button></div><p>${esc(r.note)}</p></div>` : ''}
      <div class="bottoni">${!semi ? `<button class="btn" data-az="simula-ricetta" data-id="${r.id}">Simula un altro prezzo</button>` : ''}<button class="btn" data-az="duplica-ricetta" data-id="${r.id}">Duplica</button></div>`
    };
  };

  // Rivedere le ricette una per una: ingredienti, dosi e prezzo, poi «Salva e avanti»
  function periodoVendite() {
    const con = S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp]));
    if (ui.rivPer === '*' && con.length) return '*';
    if (ui.rivPer && con.includes(ui.rivPer)) return ui.rivPer;
    return con[con.length - 1] || '';
  }
  const vendutiDi = (r, pp) => pp === '*' ? senzaDoppi(S.periodiVendita.slice()).reduce((t, x) => t + (Number((r.vendite || {})[x]) || 0), 0) : ((pp && (r.vendite || {})[pp]) || 0);
  function listaRivedi() {
    const filtro = ui.rivFiltro || 'darivedere';
    const cerca = (ui.filtroRicette || '').toLowerCase();
    const ord = ui.rivOrdine || 'nome', pp = periodoVendite();
    const sceltiR = tipiScelti(ui.tipoRicette);
    const l = S.ricette.filter(r => sceltiR.includes(r.tipo) && (!cerca || r.nome.toLowerCase().includes(cerca)) && (filtro === 'tutte' || r.id === ui.rivFisso || (filtro === 'incomplete' ? /^Ricetta da completare/.test(r.note || '') || (!r.rivista && daCompletareR(r)) : !r.rivista)))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    if (ord === 'piu') l.sort((a, b) => vendutiDi(b, pp) - vendutiDi(a, pp));
    if (ord === 'meno') l.sort((a, b) => vendutiDi(a, pp) - vendutiDi(b, pp));
    if (ord === 'nonvendute') return l.filter(r => !vendutiDi(r, pp));
    return l;
  }
  PAGINE['rivedi-ricette'] = function () {
    const lista = listaRivedi();
    const filtro = ui.rivFiltro || 'darivedere';
    const sceltiR = tipiScelti(ui.tipoRicette), tutte = S.ricette.filter(r => sceltiR.includes(r.tipo));
    const fatte = tutte.filter(r => r.rivista).length;
    const titolo = 'Rivedi ' + nomeScelta(ui.tipoRicette) + (ui.filtroRicette ? ' «' + ui.filtroRicette + '»' : '');
    const chips = `${chipsGruppi('riv-tipo')}
      <div class="chips sotto">${[['darivedere', 'Da rivedere (' + (tutte.length - fatte) + ')'], ['incomplete', 'Con ingredienti incompleti'], ['tutte', 'Tutte (' + tutte.length + ')']].map(([k, v]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-az="riv-filtro" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="chips sotto"><span class="tenue piccolo">Ordine:</span>${[['nome', 'Per nome'], ['piu', 'Più vendute prima'], ['meno', 'Meno vendute prima'], ['nonvendute', 'Solo mai vendute']].map(([k, v]) => `<button class="chip ${(ui.rivOrdine || 'nome') === k ? 'on' : ''}" data-az="riv-ordine" data-v="${k}">${v}</button>`).join('')}</div>
      ${(ui.rivOrdine || 'nome') !== 'nome' ? `<div class="chips sotto"><span class="tenue piccolo">Vendite del periodo:</span>${haVendite() ? `<button class="chip ${periodoVendite() === '*' ? 'on' : ''}" data-az="riv-per" data-v="*">Tutto</button>` : ''}${S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp])).map(pp => `<button class="chip ${periodoVendite() === pp ? 'on' : ''}" data-az="riv-per" data-v="${esc(pp)}">${esc(pp)}</button>`).join('') || '<span class="tenue piccolo">nessuna vendita caricata</span>'}</div>` : ''}`;
    if (!lista.length) { ui.bozza = null; return { titolo, indietro: '#/ricette', html: chips + `<div class="card evidenza"><h3>Finito</h3><p>Non ci sono ricette in questo elenco. Rivedute ${fatte} su ${tutte.length}.</p><a class="btn primario" href="#/ricette">Torna alle ricette</a></div>` }; }
    if (ui.rivIdx == null || ui.rivIdx >= lista.length) ui.rivIdx = 0;
    const r = lista[ui.rivIdx];
    if (!ui.bozza || ui.bozza._per !== 'r:' + r.id) { const base = JSON.parse(JSON.stringify(r)); base._per = 'r:' + r.id; base._rivedi = true; ui.bozza = base; }
    const b = ui.bozza; M.svuota();
    const semi = b.tipo === 'semilavorato';
    const c = M.costoRicetta(Object.assign({}, b, { id: '_bozza', righe: b.righe.map(rg => Object.assign({}, rg, { quantita: numDa(rg.quantita) || 0 })) })).totale;
    const pr = numDa(b.prezzo);
    return {
      titolo: `${titolo} · ${ui.rivIdx + 1} di ${lista.length}`, indietro: '#/ricette', html: chips + `
      <p class="tenue piccolo">Rivedute finora: ${fatte} su ${tutte.length}</p>
      <div class="card form">
        <h2>${esc(b.nome)}${r.rivista ? ' <span class="badge verde">già riveduta</span>' : ''}</h2>
        ${periodoVendite() ? `<p class="tenue piccolo">Venduti ${periodoVendite() === '*' ? 'in tutto' : `nel periodo «${esc(periodoVendite())}»`}: <b>${qta(vendutiDi(r, periodoVendite()))}</b></p>` : ''}
        ${b.note ? `<div class="msg ${/^Ricetta da completare/.test(b.note) ? 'giallo' : 'grigio'} casella"><div>${esc(b.note)}</div><button class="x" data-az="nota-via" data-id="${r.id}" aria-label="Togli la nota" title="Togli la nota">✕</button></div>` : ''}
        ${semi ? `<div class="due"><label>Quanto ne viene<input type="text" inputmode="decimal" autocomplete="off" data-b="resa" value="${esc(b.resa)}"></label><label>Unità<select data-b="unita">${['ml', 'g', 'pz'].map(u => `<option ${b.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>`
          : `<label>Prezzo di vendita (con IVA)<input type="text" inputmode="decimal" autocomplete="off" data-b="prezzo" value="${esc(b.prezzo)}"></label>`}
        <h3>Ingredienti</h3>
        ${!semi && b.media ? `<label class="spunta"><input type="checkbox" data-media="1" ${b.media ? 'checked' : ''}> <span>Il cliente ne sceglie uno (amari, rum, grappe…): il costo è la <b>media</b> degli ingredienti, non la somma</span></label>` : ''}
        ${b.righe.map((rg, k) => `<div class="riga-ed">${campoIngrediente(rg, k)}
          <input type="text" inputmode="decimal" autocomplete="off" data-r="${k}" data-k="quantita" value="${esc(rg.quantita)}" placeholder="dose">${unitaRiga(rg, k)}
          <button class="x" data-az="togli-riga" data-k="${k}" aria-label="Togli">✕</button></div>`).join('')}
        <button class="btn piccolo" data-az="aggiungi-riga">＋ Aggiungi ingrediente</button>
        <p class="anteprima">Costo: <b>${euro(c, 3)}</b>${!semi && pr && c ? ` · moltiplicatore × ${n2(pr / c)}` : ''}</p>
        ${campoNote(b, 2)}
      </div>
      <div class="bottoni">
        <button class="btn" data-az="riv-indietro" ${ui.rivIdx === 0 && !(ui.rivStorico || []).length ? 'disabled' : ''}>◀ Precedente</button>
        <button class="btn primario" data-az="riv-salva">Salva e avanti ▶</button>
        <button class="btn" data-az="riv-salta">Salta</button>
        <a class="btn" href="#/modifica-ricetta/${r.id}">Scheda completa</a>
      </div>`
    };
  };
  PAGINE['modifica-ricetta'] = function (id) {
    if (!ui.bozza || ui.bozza._per !== 'r:' + id) {
      const base = id === 'nuovo' ? { id: M.uid('r'), nome: '', tipo: tipiScelti(ui.tipoRicette)[0] || 'drink', prezzo: null, righe: [], resa: null, unita: 'ml', asporto: [], costiExtra: [], vendite: {}, note: '' } : JSON.parse(JSON.stringify(M.ricetta(id)));
      base._per = 'r:' + id; base._iniz = JSON.stringify(base); ui.bozza = base;
    }
    const b = ui.bozza;
    M.svuota();
    const anteprima = M.costoRicetta(Object.assign({}, b, { id: '_bozza' }));
    const semi = b.tipo === 'semilavorato';
    return {
      titolo: id === 'nuovo' ? 'Nuova ricetta' : 'Modifica ' + b.nome, indietro: id === 'nuovo' ? '#/ricette' : '#/ricetta/' + id, html: `${barraScorri('R', id, true)}
      <div class="card form">
        <label>Nome<input data-b="nome" value="${esc(b.nome)}"></label>
        <div class="due"><label>Tipo<select data-b="tipo" data-ridisegna="1">${Object.entries(M.TIPI_SINGOLARE).map(([k, v]) => `<option value="${k}" ${b.tipo === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        ${semi ? `<label>Quanto ne viene<input type="text" inputmode="decimal" autocomplete="off" data-b="resa" value="${esc(b.resa)}"></label>` : `<label>Prezzo di vendita<input type="text" inputmode="decimal" autocomplete="off" data-b="prezzo" value="${esc(b.prezzo)}"></label>`}</div>
        ${semi ? `<div class="due"><label>Unità della preparazione<select data-b="unita">${['ml', 'g', 'pz'].map(u => `<option ${b.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
          <label>Reparto<select data-b="reparto"><option value="" ${!b.reparto ? 'selected' : ''}>Da solo${(() => { const x = repPrep(Object.assign({}, b, { reparto: '' })); return x ? ' (' + (x === 'bar' ? 'bar' : 'cucina') + ')' : ' (tutti e due)'; })()}</option><option value="bar" ${b.reparto === 'bar' ? 'selected' : ''}>Bar</option><option value="cucina" ${b.reparto === 'cucina' ? 'selected' : ''}>Cucina</option></select></label></div>` : ''}
      </div>
      <div class="card form"><h3>Ingredienti</h3>
        ${b.tipo !== 'semilavorato' && b.media ? `<label class="spunta"><input type="checkbox" data-media="1" ${b.media ? 'checked' : ''}> <span>Il cliente ne sceglie uno (amari, rum, grappe…): il costo è la <b>media</b> degli ingredienti, non la somma</span></label>` : ''}
        ${b.righe.map((rg, k) => `<div class="riga-ed">${campoIngrediente(rg, k)}
          <input type="text" inputmode="decimal" autocomplete="off" data-r="${k}" data-k="quantita" value="${esc(rg.quantita)}" placeholder="dose">${unitaRiga(rg, k)}
          <button class="x" data-az="togli-riga" data-k="${k}" aria-label="Togli">✕</button></div>`).join('')}
        <button class="btn piccolo" data-az="aggiungi-riga">＋ Aggiungi ingrediente</button>
        <p class="anteprima">Costo: <b>${euro(anteprima.totale, 3)}</b>${!semi && b.prezzo && anteprima.totale ? ` · moltiplicatore × ${n2(b.prezzo / anteprima.totale)}` : ''}</p>
      </div>
      <div class="card form"><h3>Costi fissi (guarnizioni, sale…)</h3>
        ${(b.costiExtra || []).map((e, k) => `<div class="riga-ed"><input data-e="${k}" data-k="nome" value="${esc(e.nome)}" placeholder="nome"><input type="text" inputmode="decimal" autocomplete="off" data-e="${k}" data-k="costo" value="${esc(e.costo)}" placeholder="€"><button class="x" data-az="togli-extra" data-k="${k}">✕</button></div>`).join('')}
        <button class="btn piccolo" data-az="aggiungi-extra">＋ Aggiungi costo fisso</button></div>
      ${!semi ? `<div class="card form"><h3>Costi del gruppo «${esc(M.TIPI[b.tipo] || '')}»</h3>
        ${((S.costiGruppo || {})[b.tipo] || []).length ? `<p class="tenue piccolo">${S.costiGruppo[b.tipo].map(g => g.rif ? descrCostoGruppo(g) : esc(g.nome || 'costo') + ' ' + euro(Number(g.costo) || 0, 3)).join(' · ')}</p>
          <label class="spunta"><input type="checkbox" data-senza-cg ${b.senzaCostiGruppo ? '' : 'checked'}> <span>Aggiungili anche a questa ricetta</span></label>` : `<p class="tenue piccolo">Nessun costo messo su tutto il gruppo.</p>`}
        <a class="btn piccolo" href="#/costi-gruppo/${b.tipo}">Cambia i costi del gruppo</a></div>` : ''}
      ${!semi ? `<div class="card form"><h3>Da asporto</h3>
        ${(b.asporto || []).map((a, k) => `<div class="riga-ed"><select data-a="${k}" data-k="rif">${opzioniProdotti(a.rif, p => p.categoria === 'Non alimentare')}</select><input type="text" inputmode="decimal" autocomplete="off" data-a="${k}" data-k="quantita" value="${esc(a.quantita)}"><button class="x" data-az="togli-asporto" data-k="${k}">✕</button></div>`).join('')}
        <button class="btn piccolo" data-az="aggiungi-asporto">＋ Aggiungi materiale da asporto</button></div>
      ` : ''}
      ${(() => { const daIngr = M.allergeniRicetta(Object.assign({}, b, { allergeni: [] })); return `<div class="card form"><h3>Allergeni</h3>
        <div class="chips a-capo">${M.ALLERGENI.map(a => daIngr.includes(a) ? `<span class="chip on bloccato" title="dagli ingredienti">${esc(a)}</span>` : `<button class="chip ${(b.allergeni || []).includes(a) ? 'on' : ''}" data-az="allergene" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div>
        <p class="tenue piccolo">Tocca per segnarne uno a mano. Quelli bloccati arrivano dagli ingredienti: per toglierli cambia la scheda del prodotto.</p></div>`; })()}
      <div class="card form">${campoNote(b, 3)}</div>
      <div class="bottoni">${tastoAvanti('R', id)}<button class="btn ${tastoAvanti('R', id) ? '' : 'primario'}" data-az="salva-ricetta">Salva</button>${id !== 'nuovo' ? '<button class="btn pericolo" data-az="elimina-ricetta">Elimina</button>' : ''}</div>`
    };
  };

  // ----- Fatture -----
  // elenco delle fatture con la ricerca: fornitore, numero, data, importo o un articolo dentro le righe (es. «tovagliette»)
  function listaFatture() {
    const t = normCassa(ui.filtroFatt || '').split(' ').filter(Boolean), st = ui.statoFatt || '';
    const imp = /^\d+([.,]\d+)?$/.test((ui.filtroFatt || '').trim()) ? Number(ui.filtroFatt.trim().replace(',', '.')) : null;
    // una data (18/11/2026) o un mese (11/2026, novembre 2026): cerco solo per data
    const q = (ui.filtroFatt || '').trim().toLowerCase(); let md = null, mm;
    if ((mm = q.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) md = `${mm[3]}-${mm[2].padStart(2, '0')}-${mm[1].padStart(2, '0')}`;
    else if ((mm = q.match(/^(\d{1,2})[\/.-](\d{4})$/))) md = `${mm[2]}-${mm[1].padStart(2, '0')}`;
    else if ((mm = q.match(/^([a-z]+)\s+(\d{4})$/)) && meseDa(mm[1]) >= 0) md = `${mm[2]}-${String(meseDa(mm[1]) + 1).padStart(2, '0')}`;
    else if ((mm = q.match(/^(20\d{2})$/))) md = mm[1];
    const l = S.fatture.filter(f => (!st || (st === 'reg' ? f.stato === 'registrata' : st === 'nc' ? f.tipoDoc === 'TD04' : f.stato !== 'registrata'))).map(f => {
      if (md) return (f.data || '').startsWith(md) ? { f } : null;
      if (!t.length) return { f };
      const nome = (M.fornitore(f.fornitoreId) || {}).nome || f.fornitoreNome || '';
      const testa = normCassa(nome + ' ' + f.fornitoreNome + ' ' + f.numero + ' ' + dataIt(f.data));
      if (t.every(w => testa.includes(w)) || (imp != null && (Math.abs((f.totale || 0) - imp) < 0.5 || Math.abs((f.imponibile || 0) - imp) < 0.5))) return { f };
      const rg = f.righe.find(r => { const x = normCassa(r.descrizione + ' ' + ((M.prodotto(r.prodottoId) || {}).nomeBreve || '')); return t.every(w => (x + ' ' + testa).includes(w)); });
      return rg ? { f, rg } : null;
    }).filter(Boolean).sort((a, b) => (a.f.data || '') < (b.f.data || '') ? 1 : -1);
    if (!l.length) return '<p class="tenue centro">Nessuna fattura.</p>';
    const tot = l.reduce((x, { f }) => x + (f.tipoDoc === 'TD04' ? -1 : 1) * (Number(f.imponibile) || 0), 0);
    return (t.length || st ? `<p class="tenue piccolo" style="grid-column:1/-1">${l.length} ${l.length === 1 ? 'fattura' : 'fatture'} · ${euro(tot, 0)} senza IVA</p>` : '') + l.map(({ f, rg }) => `<a class="riga" href="#/fattura/${f.id}"><span>${esc((M.fornitore(f.fornitoreId) || {}).nome || f.fornitoreNome)}<small>n. ${esc(f.numero)} del ${dataIt(f.data)}${f.tipoDoc === 'TD04' ? ' · nota di credito' : ''}${f.origine === 'foto' ? ' · da foto' : ''}${rg ? `<br>riga: ${esc(String(rg.descrizione).slice(0, 70))} · ${euro(rg.totale)}` : ''}</small></span><span class="destra">${euro(f.totale)}${f.stato === 'registrata' ? '<span class="badge verde">registrata</span>' : `<span class="badge giallo">${M.daAbbinare(f) ? M.daAbbinare(f) + ' da collegare' : 'da registrare'}</span>`}</span></a>`).join('');
  }
  PAGINE.fatture = function () {
    const l = S.fatture;
    const daCtrl = fornitoriDaControllare().length;
    return {
      titolo: 'Fatture', html: `
      ${daCtrl ? `<a class="btn primario largo" href="#/controllo-fatture">Controllo rapido: ${daCtrl} ${daCtrl === 1 ? 'fornitore' : 'fornitori'} da controllare</a>` : ''}
      <div class="card"><h3>Carica</h3>
        <div class="bottoni colonna">
          <label class="btn primario">Fatture elettroniche (.xml, .p7m o .zip)<input type="file" accept=".xml,.p7m,.zip,application/xml,text/xml,application/zip" multiple hidden data-carica="xml"></label>
          ${S.impostazioni.chiaveClaude ? '<label class="btn">Foto o PDF di una fattura<input type="file" accept="image/*,application/pdf" hidden data-carica="foto"></label>' : ''}
        </div>
        <p class="tenue piccolo">Puoi scegliere più fatture insieme, anche il file .zip scaricato dal portale.</p>
        <div class="casella">${S.casella.url ? `<div><b>Casella delle fatture</b><small>${S.casella.ultimoControllo ? 'ultimo controllo ' + new Date(S.casella.ultimoControllo).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'mai controllata'}${S.casella.fotoInAttesa ? ' · ' + S.casella.fotoInAttesa + ' foto in attesa' : ''}</small></div><button class="btn piccolo" data-az="controlla-casella">Controlla adesso</button>` : `<div><b>Casella delle fatture</b><small>non ancora collegata</small></div><a class="btn piccolo" href="#/impostazioni">Collega</a>`}</div>
        <details><summary>Fatture di esempio per la prova</summary><div class="bottoni">${window.FATTURE_ESEMPIO.map((x, i) => `<button class="btn piccolo" data-az="esempio" data-i="${i}">${esc(x.nome)}</button>`).join('')}</div></details>
      </div>
      ${l.length ? `<input class="cerca" type="search" placeholder="Cerca: fornitore, numero, articolo, importo, data o mese (es. 11/2026)" value="${esc(ui.filtroFatt || '')}" data-filtro="fatture">
      <div class="chips">${[['', 'Tutte'], ['dafare', 'Da sistemare (' + l.filter(f => f.stato !== 'registrata').length + ')'], ['reg', 'Registrate'], ['nc', 'Note di credito']].map(([k, v]) => `<button class="chip ${(ui.statoFatt || '') === k ? 'on' : ''}" data-az="stato-fatt" data-v="${k}">${v}</button>`).join('')}</div>` : ''}
      <div class="card lista" id="lista-fatt">${l.length ? listaFatture() : '<p class="tenue centro">Nessuna fattura caricata.</p>'}</div>`
    };
  };

  function resocontoHtml(f) {
    const rs = f.resoconto; if (!rs) return '';
    const ric = rs.ricette.slice().sort((a, b) => Math.abs(b.dopo - b.prima) - Math.abs(a.dopo - a.prima));
    const sotto = ric.filter(x => x.sotto).length;
    return `<div class="card evidenza"><h3>Cosa è cambiato</h3>
      <table class="tab"><tr><th>Prodotto</th><th class="n">Prima</th><th class="n">Ora</th><th class="n">Diff.</th></tr>
      ${rs.prodotti.map(x => { const p = M.prodotto(x.prodottoId); const v = x.prima && x.dopo ? (x.dopo / x.prima - 1) * 100 : null; return `<tr><td><a href="#/prodotto/${x.prodottoId}">${esc(p ? p.nomeBreve : '?')}</a><small>${qta(x.confezioni)} × ${esc(p ? p.confezione : '')} comprati</small></td><td class="n">${euro(x.prima)}</td><td class="n">${euro(x.dopo)}</td><td class="n ${v > 0 ? 'rosso-t' : 'verde-t'}">${v == null ? '' : (v > 0 ? '+' : '') + n2(v, 1) + '%'}</td></tr>`; }).join('')}</table>
      <h3>${ric.length ? (ric.length === 1 ? '1 ricetta ricalcolata' : ric.length + ' ricette ricalcolate') : 'Nessuna ricetta cambia costo'}</h3>
      ${ric.length ? `<table class="tab"><tr><th>Ricetta</th><th class="n">Costo prima</th><th class="n">Ora</th><th class="n">Molt.</th></tr>
      ${ric.map(x => { const r = M.ricetta(x.ricettaId); return `<tr><td><a href="#/ricetta/${x.ricettaId}">${esc(r ? r.nome : '?')}</a></td><td class="n">${euro(x.prima, 3)}</td><td class="n">${euro(x.dopo, 3)}</td><td class="n">${r && r.tipo !== 'semilavorato' ? `<span class="badge ${x.sotto ? 'rosso' : 'verde'}">× ${n2(x.molt)}</span>` : ''}</td></tr>`; }).join('')}</table>
      <p class="msg ${sotto ? 'rosso' : 'verde'}">${sotto ? (sotto === 1 ? '1 ricetta è sotto' : sotto + ' ricette sono sotto') + ' la soglia del moltiplicatore.' : 'Tutte le ricette toccate restano sopra la soglia.'}</p>` : ''}</div>`;
  }

  PAGINE.fattura = function (id) {
    const f = S.fatture.find(x => x.id === id);
    if (!f) return { titolo: 'Fattura', html: '<p>Fattura non trovata.</p>' };
    const reg = f.stato === 'registrata';
    const an = M.analizzaFattura(f);
    const forn = M.fornitore(f.fornitoreId);
    const avvisi = reg ? (f.avvisi || []) : an.avvisi;
    const daColl = M.daAbbinare(f);
    const righe = f.righe.map((rg, k) => {
      const p = rg.prodottoId ? M.prodotto(rg.prodottoId) : null;
      const conf = rg.quantita * (Number(rg.confezioniPerUnita) || 1);
      const prConf = conf ? rg.totale / conf : null;
      const att = p ? M.prezzo(p) : null;
      const v = p && att && prConf && rg.totale > 0 && !reg ? (prConf / att - 1) * 100 : null;
      let coll;
      if (reg) coll = rg.ignora ? `<span class="tenue">non è merce: ignorata</span> <button class="btn piccolo" data-az="riga-merce" data-id="${f.id}" data-k="${k}">È merce: collegala a un prodotto</button>` : p ? `→ <a href="#/prodotto/${p.id}">${esc(p.nomeBreve)}</a> · ${qta(conf)} × ${esc(p.confezione)}${p.daCompletare ? ' <span class="badge giallo">nuovo, da completare</span>' : ''}` : '';
      else coll = `<select data-fr="${k}" data-k="scelta">
          <option value="">Collega a un prodotto…</option>
          <option value="__nuovo">＋ Crea un prodotto nuovo</option>
          <option value="__ignora" ${rg.ignora ? 'selected' : ''}>Non è merce (trasporto, cauzione…): ignora</option>
          <optgroup label="Prodotti">${S.prodotti.slice().sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve)).map(x => `<option value="${x.id}" ${rg.prodottoId === x.id ? 'selected' : ''}>${esc(x.nomeBreve)}</option>`).join('')}</optgroup></select>
        ${p ? `<div class="conv"><label>1 ${esc(rg.um || 'unità')} in fattura =<input type="text" inputmode="decimal" autocomplete="off" data-fr="${k}" data-k="confezioniPerUnita" value="${esc(rg.confezioniPerUnita)}"> ${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)}</label>
        <div class="tenue piccolo">${rg.totale > 0 ? `${euro(prConf)} a ${esc(p.confezione)}` : 'omaggio'}${att != null && rg.totale > 0 ? ` · prima ${euro(att)}` : ''}${v != null ? ` <span class="badge ${Math.abs(v) < (S.impostazioni.sogliaAumento || 3) ? 'grigio' : v > 0 ? 'rosso' : 'verde'}">${v > 0 ? '+' : ''}${n2(v, 1)}%</span>` : ''}${rg.automatico ? ' · riconosciuto in automatico' : ''}</div></div>` : ''}`;
      return `<div class="fr ${!rg.prodottoId && !rg.ignora && !reg ? 'da-fare' : ''}"><div class="fr-testa"><b>${esc(rg.descrizione)}</b><span>${euro(rg.totale)}</span></div>
        <div class="tenue piccolo">${rg.codice ? 'cod. ' + esc(rg.codice) + ' · ' : ''}${qta(rg.quantita)} ${esc(rg.um)} × ${euro(rg.prezzoUnitario)}${rg.sconto ? ' · sconto ' + n2(rg.sconto, 0) + '%' : ''}${rg.totale === 0 ? ' · <b>omaggio</b>' : ''}</div>
        <div class="fr-coll">${coll}</div></div>`;
    }).join('');
    return {
      titolo: 'Fattura ' + (f.numero || ''), indietro: '#/fatture', html: `
      ${reg ? resocontoHtml(f) : ''}
      <div class="card"><div class="dati">
        <div><span>Fornitore</span><b>${forn ? `<a href="#/fornitore/${forn.id}">${esc(forn.nome)}</a>` : esc(f.fornitoreNome) + ' <span class="badge giallo">nuovo</span>'}</b></div>
        <div><span>Numero e data</span><b>${esc(f.numero)} del ${dataIt(f.data)}</b></div>
        <div><span>Tipo</span><b>${f.tipoDoc === 'TD04' ? 'Nota di credito' : 'Fattura'}${f.origine === 'foto' ? ' (letta da foto)' : ''}${f.servizi ? ' · servizio, senza prodotti' : ''}</b></div>
        <div><span>Imponibile</span><b>${euro(f.imponibile)}</b></div>
        <div><span>Totale</span><b>${euro(f.totale)}</b></div>
      </div>${f.daVerificare && !reg ? '<p class="msg giallo">Letta da una foto: controlla numeri e prezzi prima di registrarla.</p>' : ''}</div>
      ${avvisi.length ? `<div class="card"><h3>Controlli</h3>${avvisi.map(a => `<p class="msg ${a.tipo === 'aumento' || a.tipo === 'attenzione' ? 'rosso' : a.tipo === 'calo' ? 'verde' : 'grigio'}">${esc(a.testo)}</p>`).join('')}</div>` : ''}
      <div class="card larga"><h3>Righe</h3>${righe}</div>
      <div class="bottoni">
        ${!reg && daColl ? `<button class="btn" data-az="crea-mancanti" data-id="${f.id}">Crea i prodotti che mancano</button>` : ''}
        ${forn && !forn.servizi ? `<button class="btn" data-az="segna-servizi" data-id="${forn.id}">È una bolletta o un servizio</button>` : ''}
        ${reg ? `<button class="btn" data-az="annulla-fattura" data-id="${f.id}">Annulla la registrazione</button>` : `<button class="btn primario" data-az="registra-fattura" data-id="${f.id}" ${daColl ? 'disabled' : ''}>${daColl ? 'Collega ancora ' + daColl + (daColl === 1 ? ' riga' : ' righe') : 'Registra e aggiorna i costi'}</button>`}
        <button class="btn pericolo" data-az="elimina-fattura" data-id="${f.id}">Elimina</button>
      </div>`
    };
  };

  // ----- Altro -----
  // le voci di «Altro»: le stesse, nello stesso ordine, nella pagina Altro e nella colonna a sinistra su iPad e Mac
  const VOCI_ALTRO = [
    ['fornitori', 'Fornitori', 'contatti, spesa, prodotti', 'M2 6h12v10H2zM14 9h4l4 4v3h-8M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
    ['magazzino', 'Magazzino', 'inventario ogni sei mesi', 'M3 21V8l9-5 9 5v13M7 21v-8h10v8M7 17h10'],
    ['vendite', 'Vendite', 'pezzi venduti per periodo', 'M4 20V11M10 20V5M16 20v-6M2 20h20'],
    ['costi', 'Costi del locale', 'merce, bollette, servizi, materiali', 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3zM3 7l12-4v4M16 13.5h2'],
    ['eventi', 'Eventi', 'listini per le serate', 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4'],
    ['aumenti', 'Cosa è aumentato', 'aumenti dei fornitori e quanto pesano', 'M3 17l6-6 4 4 8-8M15 7h6v6'],
    ['prezzi-consigliati', 'Prezzi da ritoccare', 'prezzo consigliato per le ricette sotto la soglia', 'M20 12l-8 8-9-9V3h8zM7 7h.01'],
    ['chi-costa-meno', 'Chi costa meno', 'stesso prodotto, fornitori diversi', 'M4 6h16M7 12h10M10 18h4'],
    ['mappa', 'Mappa del menu', 'da tenere, far rendere, spingere, ripensare', 'M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3'],
    ['allergeni', 'Allergeni', 'tabella da stampare per i clienti', 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z'],
    ['olio', 'Costo olio', 'quanto costa friggere', 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z'],
    ['ordine', 'Metti in ordine i dati', 'tutto quello da sistemare, in un posto', 'M10 6h10M10 12h10M10 18h10M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17'],
    ['importa', 'Importa dati', 'cassa, ricette, listini dei fornitori', 'M12 3v12M7 10l5 5 5-5M4 20h16'],
    ['cestino', 'Cestino', 'quello che hai eliminato', 'M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6'],
    ['impostazioni', 'Impostazioni', 'soglie, IVA, esportazione', 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2']
  ];
  PAGINE.altro = function () {
    return { titolo: 'Altro', html: `<div class="griglia-voci">${VOCI_ALTRO.map(v => `<a class="voce con-icona" href="#/${v[0]}"><svg viewBox="0 0 24 24"><path d="${v[3]}"/></svg><b>${v[1]}</b><span>${v[2]}</span></a>`).join('')}</div>
      <p class="versione-app">Versione ${VERSIONE_APP.replace(/^repub-v/, '')}</p>` };
  };

  // ----- Fornitori -----
  PAGINE.fornitori = function () {
    const spesa = {}; S.fatture.filter(f => f.stato === 'registrata').forEach(f => { spesa[f.fornitoreId] = (spesa[f.fornitoreId] || 0) + (f.tipoDoc === 'TD04' ? -1 : 1) * (f.imponibile || f.totale); });
    return {
      titolo: 'Fornitori', indietro: '#/altro', azione: '<button class="btn-top" data-az="nuovo-fornitore">＋ Nuovo</button>', html: `${coppieFornitori()}
      <input class="cerca" type="search" placeholder="Cerca un fornitore" value="${esc(ui.filtroForn || '')}" data-filtro="fornitori">
      <div class="card lista" id="lista-forn">${S.fornitori.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(f => {
        const np = S.prodotti.filter(p => p.fornitoreId === f.id).length;
        return `<a class="riga" data-nome="${esc(normCassa(f.nome))}" ${ui.filtroForn && !normCassa(f.nome).includes(normCassa(ui.filtroForn)) ? 'hidden' : ''} href="#/fornitore/${f.id}"><span>${esc(f.nome)}<small>${f.servizi ? 'servizi · ' : ''}${np} prodotti${f.giorniConsegna ? ' · consegna ' + esc(f.giorniConsegna) : ''}</small></span><span>${spesa[f.id] ? euro(spesa[f.id], 0) : ''}</span></a>`;
      }).join('')}</div>`
    };
  };
  PAGINE.fornitore = function (id) {
    const f = M.fornitore(id);
    if (!f) return { titolo: 'Fornitore', html: '<p>Non trovato.</p>' };
    const fatt = S.fatture.filter(x => x.fornitoreId === id).sort((a, b) => a.data < b.data ? 1 : -1);
    const mesi = {}; fatt.filter(x => x.stato === 'registrata').forEach(x => { const m = (x.data || '').slice(0, 7); mesi[m] = (mesi[m] || 0) + (x.tipoDoc === 'TD04' ? -1 : 1) * (x.imponibile || x.totale); });
    const prod = S.prodotti.filter(p => p.fornitoreId === id || (p.prezzi || []).some(e => e.fornitoreId === id));
    const campo = (et, k, tipo) => `<label>${et}<input type="${tipo || 'text'}" data-forn="${id}" data-k="${k}" value="${esc(f[k])}"></label>`;
    const mk = Object.keys(mesi).sort();
    const max = Math.max(1, ...Object.values(mesi));
    return {
      titolo: f.nome, indietro: '#/fornitori', html: `
      <div class="kpi-griglia">${kpi('Prodotti', prod.length)}${kpi('Fatture registrate', fatt.filter(x => x.stato === 'registrata').length)}</div>
      ${prod.length && !f.servizi ? `<a class="btn primario largo" href="#/formati" data-az="fmt-fornitore" data-id="${id}">Ricontrolla i formati di tutto quello che compriamo da ${esc(f.nome)}</a>` : ''}
      <div class="card form"><label class="interruttore"><input type="checkbox" data-az="toggle-servizi" data-id="${id}" ${f.servizi ? 'checked' : ''}> Non vende merce (bollette, banca, pagamenti, servizi): le sue fatture restano in archivio e non creano prodotti</label></div>
      ${!f.servizi ? `<div class="card form"><label class="interruttore"><input type="checkbox" data-az="toggle-casse" data-id="${id}" ${f.casseAMeta ? 'checked' : ''}> In fattura le casse hanno il prezzo a metà: le conto il doppio (solo le righe dove c'è scritto CASSA)</label>
        ${f.casseAMeta ? (() => { const l = Array.from(M.prodottiACassa(id)).map(M.prodotto).filter(Boolean); return `<p class="tenue piccolo">Prodotti a cassa raddoppiati: ${l.length ? l.map(p => `<a href="#/prodotto/${p.id}">${esc(p.nomeBreve)}</a> (ora ${euro(M.prezzo(p))} a ${esc(p.confezione)})`).join(', ') : 'nessuno'}. Conto il doppio solo le righe dove c'è scritto CASSA; le altre righe dello stesso prodotto restano come in fattura.</p>`; })() : ''}</div>` : ''}
      <div class="card form"><h3>Tipo di spesa</h3><p class="tenue piccolo">Serve per «Costi del locale». ${f.catSpesa ? '' : 'Ora è indovinato dal nome: cambialo se è sbagliato.'}</p>
        <select data-cat-spesa="${id}">${Object.entries(CAT_SPESA).map(([k, v]) => `<option value="${k}" ${categoriaSpesa(f) === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
      <div class="card form"><h3>Contatti</h3>${campo('Nome', 'nome')}${campo('Partita IVA', 'piva')}${campo('Referente', 'referente')}${campo('Telefono', 'telefono', 'tel')}${campo('Email', 'email', 'email')}${campo('Giorni di consegna', 'giorniConsegna')}
        <label>Note<textarea data-forn="${id}" data-k="note" rows="2">${esc(f.note)}</textarea></label>
        ${f.telefono ? `<div class="bottoni"><a class="btn piccolo" href="tel:${esc(f.telefono)}">Chiama</a><a class="btn piccolo" href="https://wa.me/${esc(f.telefono.replace(/\D/g, '').replace(/^(?!39)/, '39'))}">WhatsApp</a></div>` : ''}</div>
      <div class="card"><h3>Spesa per mese</h3>${mk.length ? `<div class="barre">${mk.map(m => `<div class="barra"><div class="b" style="height:${mesi[m] / max * 100}%"></div><span>${m.slice(5)}/${m.slice(2, 4)}</span><small>${n2(mesi[m], 0)}</small></div>`).join('')}</div>` : '<p class="tenue">Compare quando registri le sue fatture.</p>'}</div>
      <div class="card"><h3>Prodotti</h3>${prod.map(p => `<a class="riga" href="#/prodotto/${p.id}"><span>${esc(p.nomeBreve)}</span><span>${euro(M.prezzo(p))}</span></a>`).join('') || '<p class="tenue">Nessuno.</p>'}</div>
      <div class="card"><h3>Fatture</h3>${fatt.map(x => `<a class="riga" href="#/fattura/${x.id}"><span>n. ${esc(x.numero)}<small>${dataIt(x.data)}</small></span><span>${euro(x.totale)}</span></a>`).join('') || '<p class="tenue">Nessuna.</p>'}</div>
      <div class="card form"><h3>È lo stesso di un altro fornitore?</h3><p class="tenue piccolo">Per esempio «Doreca» ed «Emilia Romagna Doreca S.r.l.»: uniscili e fatture e prodotti finiscono in uno solo.</p>
        ${(() => { const simili = fornitoriSimili(f); return simili.length ? `<p class="piccolo"><b>Forse è lo stesso di:</b></p>${simili.map(x => `<button class="btn piccolo" data-az="unisci-fornitore" data-id="${id}" data-a="${x.id}">Unisci dentro «${esc(x.nome)}»</button>`).join(' ')}` : ''; })()}
        <label>Oppure cerca il fornitore<div class="scegli-rif"><input class="cerca-rif" data-cerca-forn="${id}" autocomplete="off" placeholder="Scrivi una parte del nome, es. doreca"><div class="sugg" id="sugg-forn"></div></div></label></div>
      <button class="btn pericolo piccolo" data-az="elimina-fornitore" data-id="${id}">Elimina fornitore</button>`
    };
  };

  // ----- Magazzino -----
  PAGINE.magazzino = function () {
    const cats = categorie().filter(c => S.prodotti.some(p => p.categoria === c && !p.speciale));
    const c = ui.conta;
    if (c) {
      const lista = S.prodotti.filter(p => !p.speciale && passaReparti(p, c)).sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve));
      return {
        titolo: 'Inventario', indietro: '#/magazzino', html: `
        <p class="tenue">Scrivi quante confezioni ci sono davvero (anche a metà: 0,5). Quelle che non tocchi restano come sono.</p>
        ${chipsReparti(c, 'conta-filtro')}
        <div class="card">${lista.map(p => { const v = c.valori[p.id]; return `<div class="conta ${v != null ? 'toccato' : ''}"><span>${esc(p.nomeBreve)}<small>${esc(fornitoreBreve(p))} · ${esc(p.confezione)} · in app ${qta(p.giacenza)}</small></span>
          <button class="tondo" data-az="conta-meno" data-id="${p.id}">−</button><input type="text" inputmode="decimal" autocomplete="off" data-conta="${p.id}" value="${v != null ? v : ''}" placeholder="${qta(p.giacenza)}"><button class="tondo" data-az="conta-piu" data-id="${p.id}">＋</button></div>`; }).join('')}</div>
        <div class="bottoni"><button class="btn primario" data-az="salva-conta">Salva la conta (${Object.keys(c.valori).length})</button><button class="btn" data-az="esci-conta">Annulla</button></div>`
      };
    }
    const perCat = cats.map(x => ({ c: x, v: S.prodotti.filter(p => p.categoria === x).reduce((s, p) => s + M.valoreGiacenza(p), 0) }));
    const ultima = S.conte[S.conte.length - 1];
    return {
      titolo: 'Magazzino', indietro: '#/altro', html: `
      <div class="kpi-griglia">${kpi('Valore totale', euro(M.valoreMagazzino(), 0))}</div>
      <p class="tenue">Il magazzino lo fa solo l'inventario: le fatture aggiornano i prezzi, non le quantità. Quando fai l'inventario scrivi quanto c'è e da lì vedi il valore.</p>
      <button class="btn primario largo" data-az="inizia-conta">Fai l'inventario</button>
      <div class="card"><h3>Per categoria</h3>${perCat.map(x => `<div class="riga"><span>${esc(x.c)}</span><span>${euro(x.v, 0)}</span></div>`).join('')}</div>
      ${ultima ? `<div class="card"><h3>Ultimo inventario: ${dataIt(ultima.data)}</h3>

        <p>Valore contato: <b>${euro(ultima.righe.reduce((s, r) => { const p = M.prodotto(r.prodottoId); return s + (p ? (M.prezzo(p) || 0) * r.reale : 0); }, 0), 0)}</b> (ai prezzi di oggi, senza IVA)</p>
        <table class="tab"><tr><th>Prodotto</th><th class="n">Contato</th><th class="n">Valore</th></tr>
        ${ultima.righe.filter(r => r.reale > 0).map(r => { const p = M.prodotto(r.prodottoId); return `<tr><td>${esc(p ? p.nomeBreve : '?')}</td><td class="n">${qta(r.reale)}</td><td class="n">${euro(p ? (M.prezzo(p) || 0) * r.reale : 0)}</td></tr>`; }).join('')}</table>
        </div>` : ''}`
    };
  };

  // ----- Ordini -----
  PAGINE.ordini = function () {
    const per = {};
    M.sottoScorta().forEach(p => { (per[p.fornitoreId || '_'] = per[p.fornitoreId || '_'] || []).push(p); });
    const blocchi = Object.entries(per).map(([fid, lista]) => {
      const f = M.fornitore(fid);
      const righe = lista.map(p => ({ p, q: Math.max(1, Math.ceil(p.scortaMinima * 2 - (p.giacenza || 0))) }));
      const testoOrd = `Ciao${f && f.referente ? ' ' + f.referente : ''}, per il Repub vorremmo ordinare:\n` + righe.map(x => `- ${x.q} ${x.p.confezione} ${x.p.nomeCompleto}`).join('\n') + '\nGrazie!';
      const tel = f && f.telefono ? f.telefono.replace(/\D/g, '').replace(/^(?!39)/, '39') : '';
      return `<div class="card"><h3>${esc(f ? f.nome : 'Fatti in casa / senza fornitore')}${f && f.giorniConsegna ? `<small> · consegna ${esc(f.giorniConsegna)}</small>` : ''}</h3>
        ${righe.map(x => `<div class="riga"><span>${esc(x.p.nomeBreve)}<small>in casa ${qta(x.p.giacenza)}, minimo ${qta(x.p.scortaMinima)}</small></span><b>${x.q} ${esc(x.p.confezione)}</b></div>`).join('')}
        ${f ? `<div class="bottoni"><button class="btn piccolo" data-az="copia" data-testo="${esc(testoOrd)}">Copia l'ordine</button><a class="btn piccolo" target="_blank" href="https://wa.me/${tel}?text=${encodeURIComponent(testoOrd)}">Manda su WhatsApp</a></div>` : ''}</div>`;
    });
    return { titolo: 'Ordini', indietro: '#/altro', html: (blocchi.join('') || '<p class="tenue centro">Niente da ordinare: nessun prodotto è sotto la scorta minima.</p>') + '<p class="tenue piccolo">La quantità proposta riporta la giacenza al doppio della scorta minima. La scorta minima si imposta nella scheda di ogni prodotto.</p>' };
  };

  PAGINE.vendite = function () {
    const periodi = S.periodiVendita;
    if (!periodi.includes(ui.vendPer)) ui.vendPer = periodi[periodi.length - 1] || '';
    const per = ui.vendPer;
    const date = (S.periodiDate || {})[per];
    const scelta = `<div class="chips">${periodi.map(pp => `<button class="chip ${per === pp ? 'on' : ''}" data-az="vend-per" data-v="${esc(pp)}">${esc(pp)}</button>`).join('')}<button class="chip" data-az="vend-nuovo">＋ Nuovo periodo</button></div>`;
    const nuovo = ui.vendNuovo ? `<div class="card form"><h3>Nuovo periodo</h3>
        <div class="due"><label>Dal<input type="date" id="vn-dal" value="${esc(ui.vendNuovo.dal || '')}"></label><label>Al<input type="date" id="vn-al" value="${esc(ui.vendNuovo.al || '')}"></label></div>
        <label>Nome<input id="vn-nome" placeholder="si scrive da solo dalle date" value="${esc(ui.vendNuovo.nome || '')}"></label>
        <div class="bottoni"><button class="btn primario" data-az="vend-crea">Crea e inizia a scrivere</button><button class="btn" data-az="vend-annulla">Annulla</button></div></div>` : '';
    if (!per) return { titolo: 'Vendite', indietro: '#/altro', html: scelta + nuovo + '<p class="tenue centro">Crea il primo periodo.</p>' };
    const f = (ui.vendFiltro || '').toLowerCase();
    const tipiV = Object.keys(M.TIPI).filter(k => k !== 'semilavorato');
    const gruppi = tipiV.map(k => [k]), nomiG = tipiV.map(k => M.TIPI[k]);
    let tot = 0, incasso = 0;
    S.ricette.forEach(r => { const q = (r.vendite || {})[per]; if (q && r.tipo !== 'semilavorato') { tot += q; incasso += q * (r.prezzo || 0); } });
    const blocchi = gruppi.map((g, k) => {
      const l = S.ricette.filter(r => g.includes(r.tipo) && (!f || r.nome.toLowerCase().includes(f))).sort((x, y) => x.nome.localeCompare(y.nome));
      if (!l.length) return '';
      return `<div class="card"><h3>${nomiG[k]}</h3>${l.map(r => `<label class="riga vend-riga"><span>${esc(r.nome)}</span><input class="mini senza-frecce" type="text" inputmode="numeric" pattern="[0-9]*" data-vend="${r.id}" data-p="${esc(per)}" value="${esc((r.vendite || {})[per] || '')}" placeholder="0"></label>`).join('')}</div>`;
    }).join('');
    const scaricato = S.periodiScaricati.includes(per);
    return {
      titolo: 'Vendite', indietro: '#/altro', html: `${scelta}${nuovo}
      <div class="card"><h3>${esc(per)}</h3><p class="tenue">${date ? `dal ${dataIt(date.dal)} al ${dataIt(date.al)} · ` : ''}${qta(tot)} pezzi · incasso ${euro(incasso, 0)}${S.periodiCassa[per] ? ` · <b>dalla cassa: ${euro(S.periodiCassa[per].incasso, 0)}</b> (${qta(S.periodiCassa[per].pezzi)} pezzi, anche coperti e voci senza ricetta)` : ''}</p>
        <div class="bottoni"><button class="btn piccolo" data-az="vend-rinomina">Rinomina</button><button class="btn piccolo" data-az="vend-elimina">Elimina il periodo</button></div></div>
      <input class="cerca" placeholder="Cerca una ricetta" value="${esc(ui.vendFiltro || '')}" data-filtro="vendFiltro">
      <div class="griglia-vend">${blocchi}</div>
      <p class="tenue piccolo">Scegli il periodo in alto e scrivi quanti pezzi hai venduto: si salva da solo. I periodi possono essere lunghi quanto vuoi (un mese, una stagione, un anno).</p>`
    };
  };

  // ----- Mappa del menu -----
  // la mappa del menu ora è in fondo al pannello: il vecchio indirizzo porta lì
  PAGINE.mappa = function () { history.replaceState(null, '', '#/pannello'); setTimeout(() => { const m = document.getElementById('mappa'); if (m) m.scrollIntoView({ block: 'start' }); }, 60); return PAGINE.pannello(); };

  // ----- Simulatore -----
  PAGINE.simulatore = function () {
    const sm = ui.sim;
    let ris = '';
    if (sm.modo === 'prodotto' && sm.prodottoId) {
      const p = M.prodotto(sm.prodottoId);
      const att = M.prezzo(p);
      let nuovo = numDa(sm.valore);
      if (nuovo != null && sm.inPercentuale) nuovo = att * (1 + nuovo / 100);
      const uso = M.usatoIn('p:' + p.id).tutte.filter(r => r.tipo !== 'semilavorato');
      const prima = uso.map(r => ({ r, i: M.indicatori(r) }));
      if (nuovo != null && att != null) {
        M.simula({ [p.id]: nuovo });
        const dopo = uso.map(r => M.indicatori(r));
        M.simula(null);
        let deltaAnno = 0;
        ris = `<div class="card"><h3>${esc(p.nomeBreve)}: da ${euro(att)} a ${euro(nuovo)} (${nuovo > att ? '+' : ''}${n2((nuovo / att - 1) * 100, 1)}%)</h3>
          <table class="tab"><tr><th>Ricetta</th><th class="n">Costo ora</th><th class="n">Dopo</th><th class="n">Molt.</th></tr>
          ${prima.map((x, k) => { const v = (x.r.vendite || {})['2025'] || 0; deltaAnno += v * (dopo[k].costo - x.i.costo); return `<tr><td>${esc(x.r.nome)}</td><td class="n">${euro(x.i.costo, 3)}</td><td class="n">${euro(dopo[k].costo, 3)}</td><td class="n"><span class="badge ${dopo[k].sotto ? 'rosso' : 'verde'}">× ${n2(dopo[k].molt)}</span></td></tr>`; }).join('')}</table>
          <p class="msg ${deltaAnno > 0 ? 'rosso' : 'verde'}">Con le vendite del 2025 sarebbero ${euro(Math.abs(deltaAnno), 0)} all'anno ${deltaAnno > 0 ? 'in più di costo' : 'risparmiati'}.</p>
          <p class="tenue piccolo">Niente è stato salvato: è solo una prova.</p></div>`;
      }
    }
    if (sm.modo === 'ricetta' && sm.ricettaId) {
      const r = M.ricetta(sm.ricettaId);
      const nuovo = numDa(sm.prezzo);
      if (nuovo != null) {
        const a = M.indicatori(r), b = M.indicatori(r, nuovo);
        const v = (r.vendite || {})['2025'] || 0;
        ris = `<div class="card"><h3>${esc(r.nome)}: da ${euro(a.prezzo)} a ${euro(nuovo)}</h3><div class="dati">
          <div><span>Moltiplicatore</span><b>× ${n2(a.molt)} → × ${n2(b.molt)}</b></div>
          <div><span>Incidenza</span><b>${perc(a.incidenza)} → ${perc(b.incidenza)}</b></div>
          <div><span>Margine a pezzo</span><b>${euro(a.margine)} → ${euro(b.margine)}</b></div>
          ${v ? `<div><span>Sulle vendite del 2025 (${qta(v)})</span><b>${euro((b.margine - a.margine) * v, 0)} di margine in più</b></div>` : ''}
        </div><p class="tenue piccolo">Niente è stato salvato: è solo una prova.</p></div>`;
      }
    }
    return {
      titolo: 'Simulatore', indietro: '#/altro', html: `
      <div class="chips"><button class="chip ${sm.modo === 'prodotto' ? 'on' : ''}" data-az="sim-modo" data-v="prodotto">Cambia il prezzo di un prodotto</button><button class="chip ${sm.modo === 'ricetta' ? 'on' : ''}" data-az="sim-modo" data-v="ricetta">Cambia il prezzo di vendita</button></div>
      <div class="card form">${sm.modo === 'prodotto' ? `
        <label>Prodotto<select data-sim="prodottoId"><option value="">Scegli…</option>${S.prodotti.filter(p => !p.speciale && M.usatoIn('p:' + p.id).tutte.length).sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve)).map(p => `<option value="${p.id}" ${sm.prodottoId === p.id ? 'selected' : ''}>${esc(p.nomeBreve)} (ora ${euro(M.prezzo(p))})</option>`).join('')}</select></label>
        <div class="due"><label>${sm.inPercentuale ? 'Aumento in %' : 'Nuovo prezzo (senza IVA)'}<input type="text" inputmode="decimal" autocomplete="off" data-sim="valore" value="${esc(sm.valore)}"></label>
        <label class="interruttore"><input type="checkbox" data-az="sim-perc" ${sm.inPercentuale ? 'checked' : ''}> in percentuale</label></div>` : `
        <label>Ricetta<select data-sim="ricettaId"><option value="">Scegli…</option>${S.ricette.filter(r => r.tipo !== 'semilavorato').sort((a, b) => a.nome.localeCompare(b.nome)).map(r => `<option value="${r.id}" ${sm.ricettaId === r.id ? 'selected' : ''}>${esc(r.nome)} (ora ${euro(r.prezzo)})</option>`).join('')}</select></label>
        <label>Nuovo prezzo di vendita<input type="text" inputmode="decimal" autocomplete="off" data-sim="prezzo" value="${esc(sm.prezzo)}"></label>`}
        <button class="btn primario" data-az="sim-calcola">Calcola</button></div>
      ${ris}`
    };
  };

  // ----- Eventi -----
  PAGINE.eventi = function () {
    return {
      titolo: 'Eventi', indietro: '#/altro', azione: '<button class="btn-top" data-az="nuovo-evento">＋ Nuovo</button>', html: `<div class="card lista">${S.eventi.map(e => `<a class="riga" href="#/evento/${e.id}"><span>${esc(e.nome)}<small>${dataIt(e.data)}</small></span><span>${e.righe.length} drink</span></a>`).join('') || '<p class="tenue centro">Nessun evento.</p>'}</div>`
    };
  };
  PAGINE.evento = function (id) {
    const e = S.eventi.find(x => x.id === id);
    if (!e) return { titolo: 'Evento', html: '<p>Non trovato.</p>' };
    const extra = (e.extraPerPezzo || []).reduce((s, a) => s + (M.costoRiga(a.rif, a.quantita).costo || 0), 0);
    const iva = 1 + (S.impostazioni.ivaVendita || 0) / 100;
    let incasso = 0, costi = 0;
    const righe = e.righe.map((rg, k) => {
      const r = M.ricetta(rg.ricettaId); const c = (M.costo(r) || 0) + extra;
      incasso += rg.prezzo * rg.previsti; costi += c * rg.previsti;
      return `<div class="fr evento"><div class="fr-testa"><b>${esc(r ? r.nome : '?')}</b><button class="x" data-az="ev-togli" data-id="${id}" data-k="${k}">✕</button></div>
        <div class="due"><label>Prezzo<input type="text" inputmode="decimal" autocomplete="off" data-ev="${id}" data-k="${k}" data-c="prezzo" value="${esc(rg.prezzo)}"></label><label>Pezzi previsti<input type="text" inputmode="numeric" autocomplete="off" data-ev="${id}" data-k="${k}" data-c="previsti" value="${esc(rg.previsti)}"></label></div>
        <div class="tenue piccolo">Costo ${euro(c)} con il bicchiere · moltiplicatore <span class="badge ${rg.prezzo / c < ((S.impostazioni.soglie || {})[r && r.tipo] || 0) ? 'rosso' : 'verde'}">× ${n2(rg.prezzo / c)}</span></div></div>`;
    }).join('');
    return {
      titolo: e.nome, indietro: '#/eventi', html: `
      <div class="kpi-griglia">${kpi('Incasso previsto', euro(incasso, 0))}${kpi('Costo previsto', euro(costi, 0))}${kpi('Margine senza IVA', euro(incasso / iva - costi, 0), '', 'verde')}${kpi('Incidenza', perc(costi / (incasso / iva || 1)))}</div>
      <div class="card form"><label>Nome<input data-evc="${id}" data-c="nome" value="${esc(e.nome)}"></label><label>Data<input type="date" data-evc="${id}" data-c="data" value="${esc(e.data)}"></label>
        <p class="tenue piccolo">Su ogni drink si aggiunge: ${(e.extraPerPezzo || []).map(a => esc(M.nomeRif(a.rif))).join(', ') || 'niente'} (${euro(extra, 3)}).</p>
        <label>Materiale in più per ogni drink<select data-az-change="ev-extra" data-id="${id}"><option value="">Nessuno</option>${opzioniProdotti((e.extraPerPezzo || [])[0] && e.extraPerPezzo[0].rif, p => p.categoria === 'Non alimentare')}</select></label></div>
      <div class="card"><h3>Listino della serata</h3>${righe}
        <label>Aggiungi<select data-az-change="ev-aggiungi" data-id="${id}"><option value="">Scegli una ricetta…</option>${S.ricette.filter(r => r.tipo !== 'semilavorato').map(r => `<option value="${r.id}">${esc(r.nome)}</option>`).join('')}</select></label></div>
      ${e.note ? `<p class="tenue">${esc(e.note)}</p>` : ''}
      <button class="btn pericolo piccolo" data-az="elimina-evento" data-id="${id}">Elimina evento</button>`
    };
  };

  // ----- Olio -----
  // ----- Costo dell'olio: spesa delle fatture ÷ grammi fritti venduti, nello stesso periodo -----
  const OLIO_FRITTURA = /\b(semi|girasol|giras|arachid|palma|frittur|alto oleico|a\.? ?oleico)\b/i;
  const prodottiOlio = () => S.prodotti.filter(p => !p.speciale && /\bolio\b/i.test(p.nomeBreve + ' ' + (p.nomeCompleto || '')));
  const olioScelti = () => { const o = S.impostazioni.olio; return o.prodotti || prodottiOlio().filter(p => OLIO_FRITTURA.test(p.nomeBreve + ' ' + (p.nomeCompleto || ''))).map(p => p.id); };
  // grammi di cibo fritto in un pezzo di ogni ricetta (anche dentro le preparazioni e i panini con patatine):
  // il costo è lineare nel costo dell'olio al grammo, quindi basta la differenza tra due costi
  function grammiFrittiPerRicetta() {
    const o = S.impostazioni.olio, prima = { spesaAnnua: o.spesaAnnua, grammiFritti: o.grammiFritti };
    const out = {};
    try {
      o.spesaAnnua = 0; o.grammiFritti = 1; M.svuota(); const a = {}; S.ricette.forEach(r => { a[r.id] = M.costo(r) || 0; });
      o.spesaAnnua = 1; M.svuota(); S.ricette.forEach(r => { const g = (M.costo(r) || 0) - a[r.id]; if (g > 0.5) out[r.id] = g; });
    } finally { o.spesaAnnua = prima.spesaAnnua; o.grammiFritti = prima.grammiFritti; M.svuota(); }
    return out;
  }
  function spesaOlio(d) {
    const scelti = new Set(olioScelti());
    let spesa = 0; const perProd = {};
    S.fatture.forEach(f => { if (!f.data || f.data < d.dal || f.data > d.al) return; const segno = f.tipoDoc === 'TD04' ? -1 : 1;
      f.righe.forEach(rg => { if (!scelti.has(rg.prodottoId) || rg.ignora) return; const t = segno * (Number(rg.totale) || 0); spesa += t; perProd[rg.prodottoId] = (perProd[rg.prodottoId] || 0) + t; }); });
    return { spesa, perProd };
  }
  // pezzi venduti di ogni ricetta tra due date: i periodi della cassa che cadono dentro, in proporzione ai giorni
  function vendutiTra(dal, al) {
    const g = (x) => new Date(x + 'T00:00:00').getTime() / 864e5;
    const out = {}; let giorni = 0;
    senzaDoppi(S.periodiVendita.slice()).forEach(pp => {
      const d = dateDiPeriodo(pp); if (!d) return;
      const a = Math.max(g(d.dal), g(dal)), b = Math.min(g(d.al), g(al));
      if (b < a) return;
      const quota = (b - a + 1) / (g(d.al) - g(d.dal) + 1); let c = false;
      S.ricette.forEach(r => { const q = Number((r.vendite || {})[pp]) || 0; if (q) { out[r.id] = (out[r.id] || 0) + q * quota; c = true; } });
      if (c) giorni += b - a + 1;
    });
    return { venduti: out, giorni };
  }
  const rigaOlio = (r) => (r.righe || []).find(rg => rg.rif === 'p:p_olio' || (M.rif(rg.rif) || {}).speciale === 'olio');
  const rifOlio = () => { const p = S.prodotti.find(x => x.speciale === 'olio'); return p ? 'p:' + p.id : null; };
  function datePredefiniteOlio() {
    // dalla prima fattura dell'olio a oggi (prima non ci sono fatture, il conto verrebbe sbagliato)
    const scelti = new Set(olioScelti()); let primo = '';
    S.fatture.forEach(f => { if (f.data && f.righe.some(rg => scelti.has(rg.prodottoId)) && (!primo || f.data < primo)) primo = f.data; });
    return { dal: primo || (new Date().getFullYear() + '-01-01'), al: M.oggi() };
  }
  function calcoloOlio(dal, al) {
    const { spesa, perProd } = spesaOlio({ dal, al });
    const g = grammiFrittiPerRicetta(), { venduti, giorni } = vendutiTra(dal, al);
    const esclusi = new Set(S.impostazioni.olio.esclusi || []);
    let grammi = 0; const perRic = [];
    Object.keys(g).forEach(id => { const r = M.ricetta(id); if (!r || r.tipo === 'semilavorato') return; const q = venduti[id] || 0; const via = esclusi.has(id); if (!via) grammi += q * g[id]; perRic.push({ r, q, g: g[id], tot: q * g[id], diretta: !!rigaOlio(r), via }); });
    perRic.sort((x, y) => y.tot - x.tot || x.r.nome.localeCompare(y.r.nome));
    const fatt = S.fatture.filter(f => f.data >= dal && f.data <= al && f.righe.some(rg => olioScelti().includes(rg.prodottoId))).map(f => f.data).sort();
    return { spesa, grammi, perProd, perRic, giorni, fattDal: fatt[0], fattAl: fatt[fatt.length - 1], c: grammi ? spesa / grammi : null };
  }
  PAGINE.olio = function () {
    const o = S.impostazioni.olio;
    const c = M.costoOlioGrammo();
    const def = datePredefiniteOlio();
    const dal = ui.olioDal || def.dal, al = ui.olioAl || def.al;
    const k = calcoloOlio(dal, al), scelti = olioScelti();
    const giorniTot = Math.round((new Date(al) - new Date(dal)) / 864e5) + 1;
    const avvisi = [];
    if (k.fattDal && k.fattDal > dal) avvisi.push(`La prima fattura dell'olio in queste date è del ${dataIt(k.fattDal)}: prima di allora l'olio comprato non c'è, ma le vendite sì. Meglio partire da lì.`);
    if (k.giorni < giorniTot - 3) avvisi.push(`Le vendite della cassa coprono ${k.giorni} giorni su ${giorniTot}: nei giorni scoperti l'olio c'è ma i fritti no, e il costo viene più alto del vero.`);
    const candidati = S.ricette.filter(r => r.tipo !== 'semilavorato' && !rigaOlio(r)).sort((x, y) => x.nome.localeCompare(y.nome));
    const tot = (o.dettaglio || []).reduce((t, d) => t + d[1] * d[2], 0);
    return {
      titolo: 'Costo dell\'olio', indietro: '#/altro', html: `
      <p class="tenue">Olio da frittura comprato (dalle fatture) diviso i grammi di cibo fritto venduto (dalla cassa), nelle stesse date. Tu dici solo cosa va fritto e quanti grammi a porzione: il resto lo calcola l'app.</p>
      <div class="kpi-griglia">${kpi('Adesso: olio per kg fritto', c == null ? '—' : euro(c * 1000))}${kpi('Su 255 g di patatine', c == null ? '—' : euro(c * 255))}${o.origine ? kpi('Calcolato su', esc(o.origine)) : ''}</div>
      <div class="card form larga"><h3>Il conto</h3>
        <div class="due"><label>Dal<input type="date" data-olio-data="dal" value="${dal}"></label><label>Al<input type="date" data-olio-data="al" value="${al}"></label></div>
        ${ui.olioDal || ui.olioAl ? '<button class="btn piccolo" data-az="olio-date-def">Rimetti dalla prima fattura dell\'olio a oggi</button>' : ''}
        <div class="kpi-griglia">${kpi('Olio comprato', euro(k.spesa, 0), k.fattDal ? 'fatture dal ' + dataIt(k.fattDal) + ' al ' + dataIt(k.fattAl) : 'nessuna fattura in queste date')}${kpi('Cibo fritto venduto', qta(Math.round(k.grammi / 1000)) + ' kg', k.giorni + ' giorni di vendite')}${kpi('Olio per kg fritto', k.c ? euro(k.c * 1000) : '—', k.c ? euro(k.c * 255) + ' su 255 g di patatine' : '')}</div>
        ${avvisi.map(t => `<p class="msg giallo">${t}</p>`).join('')}
        ${k.c && k.spesa > 0 ? `<div class="bottoni"><button class="btn primario" data-az="olio-usa">Usa questo costo</button></div>` : '<p class="tenue piccolo">Servono sia le fatture dell\'olio sia le vendite dei fritti in queste date.</p>'}</div>
      <div class="card larga"><h3>Cosa va fritto</h3>
        <p class="tenue piccolo">Grammi di cibo che finiscono nell'olio per una porzione. I panini con patatine li conta da soli dalla ricetta delle patatine. Il ✕ toglie la frittura dalla ricetta; «Non contare» lascia stare la ricetta ma la toglie da questo conto (per esempio un panino che non fate più).</p>
        <div class="scorre-x"><table class="tab olio-tab"><tr><th>Ricetta</th><th class="n">g a porzione</th><th class="n">Venduti</th><th class="n">kg fritti</th><th></th></tr>
        ${k.perRic.map(x => `<tr class="${x.via ? 'spento' : ''}"><td><a href="#/ricetta/${x.r.id}">${esc(x.r.nome)}</a>${x.diretta ? '' : ' <small class="tenue">dalle preparazioni</small>'}</td>
          <td class="n">${x.diretta ? `<input class="mini" type="text" inputmode="decimal" data-olio-g="${x.r.id}" value="${esc(String(rigaOlio(x.r).quantita))}">` : qta(Math.round(x.g))}</td>
          <td class="n">${qta(Math.round(x.q))}</td><td class="n">${x.via ? '—' : qta(Math.round(x.tot / 100) / 10)}</td>
          <td class="n nowrap"><button class="btn piccolo" data-az="olio-escludi" data-id="${x.r.id}">${x.via ? 'Conta' : 'Non contare'}</button>${x.diretta ? ` <button class="btn piccolo pericolo" data-az="olio-togli" data-id="${x.r.id}" aria-label="Togli la frittura">✕</button>` : ''}</td></tr>`).join('')}
        </table></div>
        <div class="olio-aggiungi"><select id="olio-nuova"><option value="">＋ Aggiungi una ricetta fritta…</option>${candidati.map(r => `<option value="${r.id}">${esc(r.nome)}</option>`).join('')}</select>
          <input id="olio-nuova-g" type="text" inputmode="decimal" placeholder="grammi" class="mini"><button class="btn piccolo" data-az="olio-aggiungi">Aggiungi</button></div></div>
      <details class="card"><summary><b>Quali oli conto</b> <span class="tenue">· ${scelti.length} ${scelti.length === 1 ? 'prodotto' : 'prodotti'}</span></summary>
        <p class="tenue piccolo">Di solito solo quelli per friggere: semi, girasole, arachide, palma. L'extravergine per condire no.</p>
        ${prodottiOlio().map(p => `<label class="interruttore"><input type="checkbox" data-olio-prod="${p.id}" ${scelti.includes(p.id) ? 'checked' : ''}> ${esc(p.nomeBreve)} <small class="tenue">${esc((M.fornitore(p.fornitoreId) || {}).nome || '')}${k.perProd[p.id] ? ' · ' + euro(k.perProd[p.id], 0) + ' in queste date' : ''}</small></label>`).join('') || '<p class="tenue">Nessun prodotto con «olio» nel nome.</p>'}</details>
      <details class="card form"><summary><b>A mano</b> <span class="tenue">· spesa e grammi scritti da te</span></summary>
        <label>Spesa per l'olio (€)<input type="text" inputmode="decimal" autocomplete="off" data-olio="spesaAnnua" value="${esc(o.spesaAnnua)}"></label>
        <label>Grammi fritti nello stesso periodo<input type="text" inputmode="numeric" autocomplete="off" data-olio="grammiFritti" value="${esc(o.grammiFritti)}"></label>
        ${tot ? `<button class="btn piccolo" data-az="olio-da-tabella">Usa il totale della vecchia tabella (${qta(tot)} g)</button>` : ''}</details>`
    };
  };

  // ===== Strumenti: prezzi consigliati, aumenti, chi costa meno, allergeni, classifica =====
  // periodo di vendite di riferimento: tra quelli che finiscono nell'ultimo mese e mezzo, il più lungo (es. «Gen-nov 2026» invece di «Novembre 2026»)
  function periodoRiferimento() {
    const pers = S.periodiVendita.filter(pp => dateDiPeriodo(pp) && S.ricette.some(r => (r.vendite || {})[pp]));
    const fine = pers.reduce((m, pp) => dateDiPeriodo(pp).al > m ? dateDiPeriodo(pp).al : m, ''), lim = fine ? new Date(new Date(fine) - 45 * 864e5).toISOString().slice(0, 10) : '';
    const durata = (pp) => new Date(dateDiPeriodo(pp).al) - new Date(dateDiPeriodo(pp).dal);
    return pers.filter(pp => dateDiPeriodo(pp).al >= lim).sort((x, y) => durata(y) - durata(x))[0] || null;
  }
  const giorniDi = (pp) => { const d = dateDiPeriodo(pp); return d ? (new Date(d.al) - new Date(d.dal)) / 864e5 + 1 : 365; };
  const vendutiAnno = (r, pp) => pp ? (Number((r.vendite || {})[pp]) || 0) * 365 / giorniDi(pp) : 0;
  const passoArrotonda = () => Number(S.impostazioni.arrotonda) || 0.5;
  const arrotondaSu = (x) => { const a = passoArrotonda(); return Math.round(Math.ceil(x / a - 1e-9) * a * 100) / 100; };
  // prezzo con IVA per tornare alla soglia del moltiplicatore, arrotondato per eccesso
  function prezzoConsigliato(r) { const i = M.indicatori(r); return i.costo && i.soglia ? arrotondaSu(i.costo * i.soglia) : null; }
  // quante confezioni di un prodotto entrano in un pezzo di ogni ricetta (anche dentro le preparazioni): il costo cresce in linea col prezzo
  function quotaProdotto(p) {
    const ric = M.usatoIn('p:' + p.id).tutte, out = {};
    if (!ric.length) return out;
    try {
      M.simula({ [p.id]: 0 }); const a = {}; ric.forEach(r => { a[r.id] = M.costo(r) || 0; });
      M.simula({ [p.id]: 1 }); ric.forEach(r => { const d = (M.costo(r) || 0) - a[r.id]; if (d > 1e-9) out[r.id] = d; });
    } finally { M.simula(null); }
    return out;
  }

  // ----- Prezzi da ritoccare -----
  PAGINE['prezzi-consigliati'] = function () {
    const per = periodoRiferimento();
    const l = S.ricette.filter(r => r.tipo !== 'semilavorato' && completa(r) && M.indicatori(r).sotto).map(r => {
      const i = M.indicatori(r), c = prezzoConsigliato(r), va = vendutiAnno(r, per);
      const strano = !!(c && i.prezzo && c > i.prezzo * 2.5);
      const piu = c && i.prezzo && !strano ? (c - i.prezzo) / (1 + (S.impostazioni.ivaVendita || 0) / 100) * va : 0;
      return { r, i, c, va, piu, strano };
    }).sort((a, b) => (a.strano - b.strano) || b.piu - a.piu || a.r.nome.localeCompare(b.r.nome));
    const bozza = ui.prezziNuovi = ui.prezziNuovi || {};
    const tot = l.reduce((t, x) => t + x.piu, 0);
    return {
      titolo: 'Prezzi da ritoccare', indietro: '#/altro', html: `
      <p class="tenue">Le ricette sotto la soglia del moltiplicatore, con il prezzo per tornarci (arrotondato a ${euro(passoArrotonda())}). In cima quelle dove alzare il prezzo rende di più, in base a quanto le vendi.</p>
      <div class="kpi-griglia">${kpi('Ricette sotto la soglia', String(l.length))}${per ? kpi('Guadagno in più in un anno', euro(tot, 0), 'se le porti tutte al prezzo consigliato, senza IVA, vendendone quante adesso (' + esc(per) + ')') : ''}</div>
      ${l.length ? `<div class="card larga">
        ${l.map(x => `<div class="pc-riga${x.strano ? ' strano' : ''}"><div class="pc-nome"><a href="#/ricetta/${x.r.id}"><b>${esc(x.r.nome)}</b></a><small class="tenue">${esc(M.TIPI[x.r.tipo] || '')} · soglia × ${n2(x.i.soglia)}${per ? ' · ' + qta(Math.round(x.va)) + ' venduti l\'anno' : ''}</small></div>
          <div class="pc-num"><span><small class="tenue">costo</small>${euro(x.i.costo)}</span><span><small class="tenue">adesso</small>${euro(x.i.prezzo)} <span class="badge rosso">× ${n2(x.i.molt)}</span></span>
          ${x.strano ? '<span class="pc-strano">Il costo sembra sbagliato (il prezzo dovrebbe più che raddoppiare): controlla gli ingredienti.</span>' : `<span><small class="tenue">consigliato</small><button class="btn piccolo" data-az="pc-usa" data-id="${x.r.id}" data-v="${x.c}">${euro(x.c)}</button></span>${per && x.piu > 0 ? `<span><small class="tenue">in più l'anno</small>${euro(x.piu, 0)}</span>` : ''}`}
          <label class="pc-nuovo"><small class="tenue">nuovo prezzo</small><input class="mini" type="text" inputmode="decimal" data-pc="${x.r.id}" value="${bozza[x.r.id] != null ? esc(String(bozza[x.r.id]).replace('.', ',')) : ''}" placeholder="${esc(n2(x.i.prezzo))}"></label></div></div>`).join('')}
        <div class="bottoni"><button class="btn primario" data-az="pc-salva">Salva i prezzi nuovi${Object.keys(bozza).length ? ' (' + Object.keys(bozza).length + ')' : ''}</button><button class="btn" data-az="pc-tutti">Metti il consigliato a tutte (tranne quelle da controllare)</button>${Object.keys(bozza).length ? '<button class="btn" data-az="pc-annulla">Annulla</button>' : ''}</div>
        <p class="tenue piccolo">Tocca il prezzo consigliato per copiarlo nella colonna «Nuovo prezzo», o scrivine uno tuo. Niente cambia finché non tocchi «Salva». Ricordati di cambiarli anche nella cassa.</p></div>` : '<div class="card"><p>Tutte le ricette complete sono sopra la soglia. 👌</p></div>'}`
    };
  };

  // ----- Cosa è aumentato -----
  const PERIODI_AUMENTI = [['30', 'Ultimo mese'], ['90', 'Ultimi 3 mesi'], ['180', 'Ultimi 6 mesi'], ['365', 'Ultimo anno']];
  function aumentiTra(giorni) {
    const da = new Date(Date.now() - giorni * 864e5).toISOString().slice(0, 10), soglia = Number(S.impostazioni.sogliaAumento) || 3;
    const per = periodoRiferimento(), out = [];
    S.prodotti.forEach(p => {
      if (p.speciale) return;
      const ora = M.prezzoVoce(p);
      let prima = M.prezzoVoce(p, da);
      if (!prima) { const dentro = (p.prezzi || []).filter(e => e.data > da && e.prezzo > 0).sort((x, y) => x.data.localeCompare(y.data)); if (dentro.length > 1) prima = dentro[0]; }
      if (!ora || !prima || !prima.prezzo || !ora.prezzo) return;
      if (!(p.prezzi || []).some(e => e.data > da)) return;
      const v = (ora.prezzo / prima.prezzo - 1) * 100;
      if (Math.abs(v) < soglia) return;
      out.push({ p, prima: prima.prezzo, ora: ora.prezzo, v, data: ora.data || '', forn: (M.fornitore(ora.fornitoreId) || M.fornitore(p.fornitoreId) || {}).nome || '' });
    });
    // quanto pesa in un anno: confezioni usate nelle ricette × pezzi venduti × differenza di prezzo
    out.forEach(x => {
      const q = quotaProdotto(x.p); x.ricette = []; x.annuo = 0;
      Object.keys(q).forEach(id => { const r = M.ricetta(id); if (!r || r.tipo === 'semilavorato') return; const va = vendutiAnno(r, per), d = q[id] * (x.ora - x.prima); x.annuo += d * va; x.ricette.push({ r, d, va, i: M.indicatori(r) }); });
      x.ricette.sort((a, b) => b.d * b.va - a.d * a.va);
    });
    return { lista: out, per, da };
  }
  PAGINE.aumenti = function () {
    const g = ui.aumGiorni || '90', A = aumentiTra(+g);
    const su = A.lista.filter(x => x.v > 0).sort((a, b) => b.annuo - a.annuo || b.v - a.v), giu = A.lista.filter(x => x.v < 0).sort((a, b) => a.annuo - b.annuo || a.v - b.v);
    const tot = su.reduce((t, x) => t + x.annuo, 0), risp = giu.reduce((t, x) => t + x.annuo, 0);
    const riga = (x) => `<details class="aum-riga"><summary><span class="aum-nome"><b>${esc(x.p.nomeBreve)}</b><small class="tenue">${esc(x.forn)} · ${x.data ? dataIt(x.data) : ''}</small></span>
        <span class="aum-num"><span>${euro(x.prima)} → <b>${euro(x.ora)}</b></span><span class="badge ${x.v > 0 ? 'rosso' : 'verde'}">${x.v > 0 ? '+' : ''}${n2(x.v, 1)}%</span>${A.per && x.ricette.length ? `<small class="${x.v > 0 ? 'rosso-t' : 'verde-t'}">${x.annuo > 0 ? '+' : ''}${euro(x.annuo, 0)} l'anno</small>` : ''}</span></summary>
        <div class="aum-dett">${x.ricette.length ? `<table class="tab"><tr><th>Ricetta</th><th class="n">Costo in più a pezzo</th>${A.per ? '<th class="n">Venduti l\'anno</th><th class="n">In un anno</th>' : ''}<th class="n">Molt. adesso</th></tr>${x.ricette.map(y => `<tr><td><a href="#/ricetta/${y.r.id}">${esc(y.r.nome)}</a></td><td class="n">${euro(y.d, 3)}</td>${A.per ? `<td class="n">${qta(Math.round(y.va))}</td><td class="n">${euro(y.d * y.va, 0)}</td>` : ''}<td class="n">${y.i.molt != null ? `<span class="badge ${y.i.sotto ? 'rosso' : 'verde'}">× ${n2(y.i.molt)}</span>` : '—'}</td></tr>`).join('')}</table>` : '<p class="tenue piccolo">Non è usato in nessuna ricetta.</p>'}
        <a class="btn piccolo" href="#/prodotto/${x.p.id}">Apri il prodotto</a></div></details>`;
    return {
      titolo: 'Cosa è aumentato', indietro: '#/altro', html: `
      <div class="segmentato">${PERIODI_AUMENTI.map(([k, v]) => `<button class="${g === k ? 'on' : ''}" data-az="aum-per" data-v="${k}">${v}</button>`).join('')}</div>
      <p class="tenue piccolo">Prezzo di oggi confrontato con quello del ${dataIt(A.da)}, per i prodotti cambiati di almeno il ${n2(Number(S.impostazioni.sogliaAumento) || 3, 0)}% (lo cambi in Impostazioni).${A.per ? ' Quanto pesa in un anno lo calcolo da quanto vendi (' + esc(A.per) + ').' : ' Carica le vendite della cassa per vedere quanto pesa in un anno.'} Tocca un prodotto per vedere le ricette toccate.</p>
      <div class="kpi-griglia">${kpi('Aumentati', String(su.length), A.per ? '+' + euro(tot, 0) + ' l\'anno' : '', su.length ? 'rosso' : '')}${kpi('Calati', String(giu.length), A.per && giu.length ? euro(risp, 0) + ' l\'anno' : '', giu.length ? 'verde' : '')}</div>
      <div class="card larga"><h3>Aumentati</h3>${su.length ? su.map(riga).join('') : '<p class="tenue">Nessun aumento in questo periodo.</p>'}</div>
      ${giu.length ? `<div class="card larga"><h3>Calati</h3>${giu.map(riga).join('')}</div>` : ''}`
    };
  };

  // ----- Chi costa meno -----
  PAGINE['chi-costa-meno'] = function () {
    const per = periodoRiferimento();
    const l = [];
    S.prodotti.forEach(p => {
      if (p.speciale) return;
      const ult = Object.entries(M.ultimiPerFornitore(p)).filter(([k, e]) => k !== '_' && e.prezzo > 0);
      if (ult.length < 2) return;
      const voci = ult.map(([k, e]) => ({ f: M.fornitore(k), e })).filter(x => x.f).sort((a, b) => a.e.prezzo - b.e.prezzo);
      if (voci.length < 2) return;
      const min = voci[0], ora = M.prezzoVoce(p);
      const q = quotaProdotto(p); let conf = 0; Object.keys(q).forEach(id => { const r = M.ricetta(id); if (r && r.tipo !== 'semilavorato') conf += q[id] * vendutiAnno(r, per); });
      const diff = ora ? ora.prezzo - min.e.prezzo : 0;
      l.push({ p, voci, min, ora, conf, risp: diff > 0 ? diff * conf : 0 });
    });
    l.sort((a, b) => b.risp - a.risp || a.p.nomeBreve.localeCompare(b.p.nomeBreve));
    const tot = l.reduce((t, x) => t + x.risp, 0);
    const unita = (p, prezzo) => { const c = p.contenuto || 1; return p.unita === 'pz' ? (c > 1 ? euro(prezzo / c) + ' al pezzo' : '') : euro(prezzo / c * 1000) + (p.unita === 'g' ? ' al kg' : ' al litro'); };
    return {
      titolo: 'Chi costa meno', indietro: '#/altro', html: `
      <p class="tenue">I prodotti che compri da più fornitori, con l'ultimo prezzo di ciascuno. Il più conveniente è in verde. Se due prodotti uguali sono ancora separati (per esempio due Coca-Cola), uniscili in Prodotti › Altro › «Unisci più prodotti in uno» e compariranno qui.</p>
      <div class="kpi-griglia">${kpi('Prodotti con più fornitori', String(l.length))}${per ? kpi('Risparmio in un anno', euro(tot, 0), 'comprando sempre dal più conveniente, con le vendite di ' + esc(per)) : ''}</div>
      ${l.length ? l.map(x => `<div class="card"><div class="riga-testa"><a href="#/prodotto/${x.p.id}"><b>${esc(x.p.nomeBreve)}</b></a>${x.risp > 0.5 ? `<span class="badge verde">risparmi ${euro(x.risp, 0)} l'anno</span>` : ''}</div>
        ${x.voci.map((v, k) => `<div class="riga piccola ${k === 0 ? 'migliore' : ''}"><span>${esc(v.f.nome)}<small>${dataIt(v.e.data)}${x.ora && Math.abs(x.ora.prezzo - v.e.prezzo) < 0.005 ? ' · è il prezzo che uso adesso' : ''}</small></span><span class="destra"><b>${euro(v.e.prezzo)}</b><small>${unita(x.p, v.e.prezzo)}${k > 0 ? ' · +' + n2((v.e.prezzo / x.min.e.prezzo - 1) * 100, 0) + '%' : ''}</small></span></div>`).join('')}</div>`).join('') : '<div class="card"><p class="tenue">Nessun prodotto comprato da più di un fornitore.</p></div>'}`
    };
  };

  // ----- Tabella degli allergeni -----
  // ricette della tabella allergeni, divise per gruppo; quelle tolte dalla stampa si vedono solo mentre scegli
  const allEsclusi = () => { const im = S.impostazioni; im.allEsclusi = im.allEsclusi || { gruppi: [], ricette: [] }; return im.allEsclusi; };
  function gruppiAllergeni(tutte) {
    const rep = ui.allRep || '*tutto', ex = allEsclusi();
    const l = S.ricette.filter(r => r.tipo !== 'semilavorato' && (rep === '*tutto' || M.REPARTO_TIPO[r.tipo] === rep.slice(1)) && (r.prezzo || (r.righe || []).length))
      .sort((a, b) => (M.TIPI[a.tipo] || '').localeCompare(M.TIPI[b.tipo] || '') || a.nome.localeCompare(b.nome));
    const gruppi = [];
    l.forEach(r => {
      const g = M.TIPI[r.tipo] || '', via = ex.gruppi.includes(g) || ex.ricette.includes(r.id);
      if (via && !tutte) return;
      if (!gruppi.length || gruppi[gruppi.length - 1].g !== g) gruppi.push({ g, l: [], via: ex.gruppi.includes(g) });
      gruppi[gruppi.length - 1].l.push(r);
    });
    return gruppi;
  }
  PAGINE.allergeni = function () {
    const rep = ui.allRep || '*tutto', scegli = !!ui.allScegli, ex = allEsclusi();
    const gruppi = gruppiAllergeni(scegli);
    const l = [].concat(...gruppi.map(G => G.l));
    const vuote = l.filter(r => !(r.righe || []).length).length;
    const nascoste = gruppiAllergeni(true).reduce((n, G) => n + G.l.length, 0) - gruppiAllergeni(false).reduce((n, G) => n + G.l.length, 0);
    const colonne = M.ALLERGENI.length + 1;
    return {
      titolo: 'Allergeni', indietro: '#/altro', html: `
      <div class="no-stampa"><div class="filtri-ric"><div class="segmentato">${[['*tutto', 'Tutto'], ['*bar', 'Bar'], ['*cucina', 'Cucina']].map(([k, v]) => `<button class="${rep === k ? 'on' : ''}" data-az="all-rep" data-v="${k}">${v}</button>`).join('')}</div>
        <button class="btn ${scegli ? 'primario' : ''}" data-az="all-scegli">${scegli ? '✓ Ho scelto' : 'Scegli cosa stampare'}</button>
        <button class="btn ${ui.allMod ? 'primario' : ''}" data-az="all-mod">${ui.allMod ? '✓ Ho finito' : 'Segna a mano'}</button>
        <button class="btn primario" data-az="all-pdf">Stampa o salva in PDF</button></div>
        ${scegli ? `<p class="msg piccolo">Togli la spunta ai gruppi o alle singole righe che non vuoi nella tabella da stampare (per esempio gli amari). La scelta resta salvata per le prossime volte.</p>` : nascoste ? `<p class="tenue piccolo">${nascoste} righe sono tolte dalla stampa. <a href="#" data-az="all-scegli">Cambia</a></p>` : ''}
        ${ui.allMod ? `<p class="msg piccolo">Tocca una casella vuota per aggiungere l'allergene, tocca un pallino arancione per toglierlo. I pallini verdi arrivano dagli ingredienti: toccali per vedere da quale prodotto.</p>` : ''}
        <p class="tenue piccolo">Gli allergeni arrivano dalle schede dei prodotti usati in ogni ricetta, più quelli segnati a mano nella ricetta. Prima di esporla, controlla che i prodotti abbiano gli allergeni giusti.${vuote ? ` <b>${vuote} ricette non hanno ancora gli ingredienti</b>: sono segnate con «da completare».` : ''}</p></div>
      <div class="stampa-testa"><h2>Repub · Allergeni</h2><p>Elenco delle sostanze che provocano allergie o intolleranze (Reg. UE 1169/2011), aggiornato al ${dataIt(M.oggi())}. Per informazioni chiedi al personale.</p></div>
      <div class="card larga tab-allergeni-box tiene-scroll"><table class="tab tab-allergeni ${ui.allMod ? 'modifica' : ''}"><thead><tr><th class="all-nome">Piatto o drink</th>${M.ALLERGENI.map(a => `<th class="all-col"><span>${esc(a)}</span></th>`).join('')}</tr></thead>
        <tbody>${gruppi.map(G => `<tr class="all-gruppo ${G.via ? 'via' : ''}"><td colspan="${colonne}">${scegli ? `<label class="all-spunta"><input type="checkbox" data-all-gruppo="${esc(G.g)}" ${G.via ? '' : 'checked'}> ${esc(G.g)}</label>` : esc(G.g)}</td></tr>` + G.l.map(r => {
          const al = M.allergeniRicetta(r), vuota = !(r.righe || []).length, via = G.via || ex.ricette.includes(r.id);
          const daIngr = ui.allMod ? M.allergeniRicetta(Object.assign({}, r, { allergeni: [] })) : [];
          return `<tr class="${via ? 'via' : ''}"><td class="all-nome">${scegli ? `<label class="all-spunta"><input type="checkbox" data-all-ricetta="${r.id}" ${via ? '' : 'checked'} ${G.via ? 'disabled' : ''}> ${esc(r.nome)}</label>` : esc(r.nome)}${vuota ? ' <small class="giallo-t">da completare</small>' : ''}</td>${M.ALLERGENI.map(a => ui.allMod
            ? `<td class="all-c tocca ${!daIngr.includes(a) && al.includes(a) ? 'a-mano' : ''}" data-az="all-cella" data-id="${r.id}" data-v="${esc(a)}" title="${esc(a)}">${al.includes(a) ? '●' : ''}</td>`
            : `<td class="all-c">${al.includes(a) ? '●' : ''}</td>`).join('')}</tr>`; }).join('')).join('')}</tbody></table></div>`
    };
  };

  // ----- Impostazioni -----
  const CODICE_SHEET = "// Gestionale Repub · copia automatica\n// Cambia la parola qui sotto e scrivi la stessa nell'app (Impostazioni › Copia automatica su Google)\nconst PAROLA_SEGRETA = 'scrivi-qui-la-tua-parola';\nconst COPIE_DA_TENERE = 30;\n\nfunction doPost(e) {\n  try {\n    const d = JSON.parse(e.postData.contents);\n    if (d.chiave !== PAROLA_SEGRETA) return risposta({ errore: 'parola segreta sbagliata' });\n    const ss = SpreadsheetApp.getActiveSpreadsheet();\n    Object.keys(d.fogli).forEach(function (nome) {\n      const righe = d.fogli[nome];\n      const largh = Math.max.apply(null, righe.map(function (r) { return r.length; }));\n      const tab = righe.map(function (r) { while (r.length < largh) r.push(''); return r; });\n      const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);\n      sh.clearContents();\n      sh.getRange(1, 1, tab.length, largh).setValues(tab);\n      sh.setFrozenRows(1);\n    });\n    const c = ss.getSheetByName('Copie complete') || ss.insertSheet('Copie complete');\n    const pezzi = [];\n    for (let i = 0; i < d.copia.length; i += 45000) pezzi.push(d.copia.slice(i, i + 45000));\n    c.appendRow([new Date(), d.versione, pezzi.length].concat(pezzi));\n    const n = c.getLastRow();\n    if (n > COPIE_DA_TENERE) c.deleteRows(1, n - COPIE_DA_TENERE);\n    return risposta({ ok: true });\n  } catch (err) {\n    return risposta({ errore: String(err) });\n  }\n}\n\nfunction doGet(e) {\n  if (!e.parameter || e.parameter.chiave !== PAROLA_SEGRETA) return risposta({ errore: 'parola segreta sbagliata' });\n  const c = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Copie complete');\n  if (!c || c.getLastRow() < 1) return risposta({ errore: 'nessuna copia ancora' });\n  const riga = c.getRange(c.getLastRow(), 1, 1, c.getLastColumn()).getValues()[0];\n  const pezzi = Number(riga[2]) || 0;\n  return risposta({ quando: riga[0], copia: riga.slice(3, 3 + pezzi).join('') });\n}\n\nfunction risposta(o) {\n  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);\n}\n";
  PAGINE['copia-sheet'] = function () {
    return {
      titolo: 'Copia su Google', indietro: '#/impostazioni', html: `
      <div class="card"><h3>Come si prepara (una volta sola, 5 minuti, dal computer)</h3>
        <ol class="passi">
          <li>Apri <b>Google Fogli</b> e crea un foglio nuovo. Chiamalo per esempio «Copie Gestionale Repub».</li>
          <li>Dal menu in alto: <b>Estensioni › Apps Script</b>. Si apre una pagina con un po' di codice: cancellalo tutto.</li>
          <li>Tocca <b>«Copia il codice»</b> qui sotto e incollalo al suo posto.</li>
          <li>Nella terza riga cambia <b>scrivi-qui-la-tua-parola</b> con una parola segreta tua (senza spazi), e salva con il dischetto.</li>
          <li>In alto a destra: <b>Esegui il deployment › Nuovo deployment</b>. Dall'ingranaggio scegli <b>App web</b>. «Esegui come»: <b>Me</b>. «Chi ha accesso»: <b>Chiunque</b>. Tocca <b>Esegui il deployment</b>.</li>
          <li>Google ti chiede di autorizzare: scegli il tuo account, poi «Avanzate» › «Vai a … (non sicuro)» › «Consenti». È normale: lo script l'hai scritto tu e lavora solo su quel foglio.</li>
          <li>Copia l'<b>URL dell'app web</b> (finisce con /exec) e incollalo in <b>Impostazioni › Copia automatica su Google</b>, insieme alla parola segreta.</li>
          <li>Tocca <b>«Fai una copia adesso»</b>: nel foglio compaiono le schede Prodotti, Ricette, Fatture, Fornitori e Copie complete.</li>
        </ol>
        <p class="tenue piccolo">Da lì in poi l'app fa la copia da sola quando la apri, ogni settimana o ogni mese. Le schede leggibili vengono riscritte ogni volta; in «Copie complete» restano le ultime 30 copie, una per riga. Per rimettere tutto com'era: «Scarica l'ultima copia» e poi «Carica una copia dei dati».</p></div>
      <div class="card"><h3>Il codice da incollare</h3>
        <div class="bottoni"><button class="btn primario" data-az="copia-codice">Copia il codice</button></div>
        <pre class="codice" id="codice-sheet">${esc(CODICE_SHEET)}</pre></div>`
    };
  };
  PAGINE.impostazioni = function () {
    const im = S.impostazioni;
    return {
      titolo: 'Impostazioni', indietro: '#/altro', html: `
      <div class="due-colonne imp-colonne"><div class="colonna">
      <div class="card form"><h3>Prezzi</h3>
        <label>IVA sul prezzo di vendita (%)<input type="text" inputmode="decimal" autocomplete="off" data-imp="ivaVendita" value="${esc(im.ivaVendita)}"></label>
        <label>Quando un prodotto arriva da più fornitori, usa<select data-imp="metodoPrezzo">${[['ultimo', 'l\'ultimo prezzo pagato'], ['minimo', 'il prezzo più basso'], ['media', 'la media tra i fornitori']].map(([k, v]) => `<option value="${k}" ${im.metodoPrezzo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Segnala gli aumenti a partire da (%)<input type="text" inputmode="decimal" autocomplete="off" data-imp="sogliaAumento" value="${esc(im.sogliaAumento)}"></label>
        <label>Arrotonda i prezzi consigliati a<select data-imp="arrotonda">${[['0.1', '10 centesimi'], ['0.5', '50 centesimi'], ['1', '1 euro']].map(([k, v]) => `<option value="${k}" ${String(passoArrotonda()) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="card form"><h3>Misure da bar</h3><p class="tenue piccolo">Quanti ml valgono, per il costo delle ricette scritte in dash o drop.</p>
        <div class="due"><label>1 dash = ml<input type="text" inputmode="decimal" autocomplete="off" data-imp="mlDash" value="${esc(String(M.mlMisura('dash')).replace('.', ','))}"></label>
        <label>1 drop = ml<input type="text" inputmode="decimal" autocomplete="off" data-imp="mlDrop" value="${esc(String(M.mlMisura('drop')).replace('.', ','))}"></label></div></div>
      <div class="card form"><h3>Fatture</h3>
        <label class="interruttore"><input type="checkbox" data-az="imp-bool" data-k="autoCrea" ${im.autoCrea !== false ? 'checked' : ''}> Crea in automatico i prodotti nuovi che arrivano dalle fatture</label>
        <label class="interruttore"><input type="checkbox" data-az="imp-bool" data-k="autoRegistra" ${im.autoRegistra !== false ? 'checked' : ''}> Registra subito le fatture complete (i prezzi si aggiornano da soli)</label>
        <p class="tenue piccolo">Le spese di trasporto, le cauzioni e simili vengono saltate da sole. Le fatture lette da foto restano sempre da controllare prima di registrarle.</p></div>
      <div class="card"><h3>Dati dalla cassa</h3><p class="tenue piccolo">Listino dei prodotti in vendita e venduto di un periodo, dai file esportati da Cassa in Cloud.</p><a class="btn" href="#/importa">Importa dalla cassa</a></div>
      <div class="card form"><h3>Copia automatica su Google</h3>
        <p class="tenue piccolo">Ogni tanto l'app salva da sola prodotti, ricette, fornitori e fatture in un tuo Foglio Google, più una copia completa per rimettere tutto com'era. <a href="#/copia-sheet">Come si prepara</a></p>
        <label>Indirizzo dell'app web<input data-cs="url" value="${esc(CS().url)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
        <label>Parola segreta<span class="campo-occhio"><input type="password" id="cs-chiave" data-cs="chiave" value="${esc(CS().chiave)}" autocomplete="off"><button type="button" class="occhio" data-occhio="cs-chiave" aria-label="Mostra">👁</button></span></label>
        <label>Ogni quanto<select data-cs="ogni">${[['settimana', 'Ogni settimana'], ['mese', 'Ogni mese'], ['mai', 'Mai (solo a mano)']].map(([k, v]) => `<option value="${k}" ${CS().ogni === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <p class="tenue piccolo">${CS().ultima ? 'Ultima copia: ' + new Date(CS().ultima).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nessuna copia ancora.'}${CS().errore ? ` <span class="rosso-t">L'ultima prova non è riuscita: ${esc(CS().errore)}</span>` : ''}</p>
        <div class="bottoni"><button class="btn piccolo" data-az="copia-sheet">Fai una copia adesso</button><button class="btn piccolo" data-az="copia-sheet-scarica">Scarica l'ultima copia</button></div></div>
      </div><div class="colonna">
      <div class="card form"><h3>Soglie del moltiplicatore</h3><p class="tenue piccolo">Sotto questo numero la ricetta diventa rossa.</p>
        <div class="due">${Object.keys(M.TIPI).filter(t => t !== 'semilavorato').map(t => `<label>${esc(M.TIPI[t])}<input type="text" inputmode="decimal" autocomplete="off" data-soglia="${t}" value="${esc((im.soglie || {})[t])}"></label>`).join('')}</div></div>
      ${CLOUD && utente ? `<div class="card"><h3>Account</h3><p>Sei entrato come <b>${esc(utente.email)}</b>. I dati sono online e uguali su tutti i dispositivi.</p>
        <div class="bottoni colonna">${(datiDelDispositivo() || {}).fatture && datiDelDispositivo().fatture.length ? `<button class="btn" data-az="porta-locali">Porta online le fatture salvate su questo dispositivo (${datiDelDispositivo().fatture.length})</button>` : ''}<button class="btn" data-az="esci">Esci</button></div></div>` : ''}
      <div class="card"><h3>Dati</h3>
        <p class="tenue piccolo">${CLOUD ? 'Salvati online su Firebase.' : 'In questa prova i dati sono salvati su questo dispositivo.'}</p>
        <div class="bottoni colonna">
          <button class="btn" data-az="esporta-excel">Esporta in Excel</button>
          <a class="btn" href="#/foglio">Prodotti del foglio: collegali a quelli delle fatture</a>
          <button class="btn" data-az="scarica-copia">Scarica una copia dei dati</button>
          <label class="btn">Carica una copia dei dati<input type="file" accept=".json" hidden data-carica="copia"></label>
        </div></div>
      </div></div>
      <p class="versione-app">Versione ${VERSIONE_APP.replace(/^repub-v/, '')}</p>`
    };
  };

  // ---------- Disegno ----------
  const TAB = [['pannello', 'Pannello', 'M3 12l9-8 9 8v8a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'], ['prodotti', 'Prodotti', 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10'], ['ricette', 'Ricette', 'M6 3h12M8 3v6l-4 12h16L16 9V3'], ['fatture', 'Fatture', 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8'], ['altro', 'Altro', 'M5 12h.01M12 12h.01M19 12h.01']];
  const SEZIONE = { aumenti: 'altro', 'prezzi-consigliati': 'altro', 'chi-costa-meno': 'altro', allergeni: 'altro', 'copia-sheet': 'altro', cestino: 'altro', mappa: 'pannello', costi: 'altro', ordine: 'altro', 'gruppi-ricette': 'ricette', 'costi-gruppo': 'ricette', foglio: 'prodotti', doppioni: 'prodotti', importa: 'altro', 'controllo-fatture': 'fatture', controllo: 'prodotti', pulizia: 'altro', formati: 'prodotti', prodotto: 'prodotti', 'modifica-prodotto': 'prodotti', ricetta: 'ricette', 'modifica-ricetta': 'ricette', 'rivedi-ricette': 'ricette', fattura: 'fatture' };
  function disegna() {
    if (!S) return;
    const [, nome, arg] = (location.hash || '#/pannello').split('/');
    const fn = PAGINE[nome] || PAGINE.pannello;
    if (!(nome === 'modifica-prodotto' || nome === 'modifica-ricetta' || nome === 'rivedi-ricette')) ui.bozza = null;
    if (nome !== 'magazzino') ui.conta = null;
    // le frecce valgono per l'elenco da cui sei partito: se vai in un'altra sezione si azzera
    if (nome === 'pannello' || nome === 'fatture' || nome === 'altro' || VOCI_ALTRO.some(v => v[0] === nome)) { ui.scorriP = null; ui.scorriR = null; }
    if (nome === 'ricette') ui.scorriP = null;
    if (nome === 'prodotti') ui.scorriR = null;
    let pag;
    try { pag = fn(arg); } catch (e) { console.error(e); pag = { titolo: 'Errore', html: `<p class="msg rosso">Qualcosa non ha funzionato: ${esc(e.message)}</p>` }; }
    const sez = SEZIONE[nome] || (PAGINE[nome] && TAB.some(t => t[0] === nome) ? nome : (PAGINE[nome] ? 'altro' : 'pannello'));
    $('#testa').innerHTML = `${pag.indietro ? `<a class="indietro" href="${pag.indietro}" data-az="indietro" aria-label="Indietro">‹</a>` : '<span></span>'}<h1>${esc(pag.titolo)}</h1>${pag.azione || '<span></span>'}`;
    $('#contenuto').innerHTML = pag.html;
    // sul telefono: barra in basso; su Mac e iPad: colonna a sinistra con tutte le sezioni
    const PAGINA_DI = { fornitore: 'fornitori', evento: 'eventi' };
    const attiva = PAGINA_DI[nome] || nome;
    $('#tabbar').innerHTML = '<div class="marchio">Gestionale <span>Repub</span></div>' +
      TAB.map(t => `<a href="#/${t[0]}" class="${sez === t[0] ? 'on' : ''} ${t[0] === 'altro' ? 'solo-stretto tab-altro' : ''}"><svg viewBox="0 0 24 24"><path d="${t[2]}"/></svg><span>${t[1]}</span></a>`).join('') +
      '<div class="gruppo solo-largo">Altro</div>' +
      VOCI_ALTRO.map(v => `<a href="#/${v[0]}" class="solo-largo secondaria ${attiva === v[0] ? 'on' : ''}"><svg viewBox="0 0 24 24"><path d="${v[3]}"/></svg><span>${v[1]}</span></a>`).join('') +
      `<div class="solo-largo versione-lato">Versione ${VERSIONE_APP.replace(/^repub-v/, '')}</div>`;
    $('#contenuto').className = ['pannello', 'prodotto', 'ricetta', 'fattura', 'fornitore', 'evento', 'impostazioni', 'mappa', 'scadenze', 'magazzino', 'modifica-prodotto', 'modifica-ricetta', undefined].includes(nome) && !(nome === 'magazzino' && ui.conta) ? 'colonne' : '';
    document.title = pag.titolo + ' · Gestionale Repub';
  }
  function ridisegnaMantenendo() {
    // anche le strisce di etichette che scorrono di lato restano dove le avevi lasciate (prima tornavano all'inizio e i tasti «saltavano»)
    const lati = Array.from(document.querySelectorAll('#contenuto .striscia-gruppi, #contenuto .chips')).map(e => e.scrollLeft);
    const riquadri = Array.from(document.querySelectorAll('#contenuto .tiene-scroll')).map(e => [e.scrollTop, e.scrollLeft]);
    const y = window.scrollY; disegna(); window.scrollTo(0, y);
    document.querySelectorAll('#contenuto .tiene-scroll').forEach((e, i) => { if (riquadri[i]) { e.scrollTop = riquadri[i][0]; e.scrollLeft = riquadri[i][1]; } });
    document.querySelectorAll('#contenuto .striscia-gruppi, #contenuto .chips').forEach((e, i) => { if (lati[i]) e.scrollLeft = lati[i]; });
  }

  // ---------- Tendine lunghe: si cerca scrivendo (vale per tutte le tendine con tante voci, in ogni pagina) ----------
  function rendiCercabile(sel) {
    if (sel.dataset.cercabile || sel.dataset.noCerca || sel.options.length <= 12) return;
    sel.dataset.cercabile = '1';
    const box = document.createElement('div'); box.className = 'scegli-rif tendina-cerca';
    const inp = document.createElement('input'); inp.className = 'cerca-rif'; inp.type = 'search'; inp.autocomplete = 'off';
    const vuota = (o) => !o || o.value === '' || /^(scegli|—|-)/i.test(o.text.trim());
    const cur = sel.options[sel.selectedIndex];
    inp.value = vuota(cur) ? '' : cur.text.trim();
    inp.placeholder = (vuota(cur) && cur ? cur.text.trim() + ' · ' : '') + 'scrivi per cercare';
    const sugg = document.createElement('div'); sugg.className = 'sugg';
    box.appendChild(inp); box.appendChild(sugg);
    sel.parentNode.insertBefore(box, sel); sel.style.display = 'none';
    const voci = () => Array.from(sel.options).map(o => ({ o, gruppo: o.parentNode && o.parentNode.tagName === 'OPTGROUP' ? o.parentNode.label : '' }));
    const mostra = (tutte) => {
      const t = normCassa(inp.value).split(' ').filter(Boolean);
      const l = voci().filter(({ o, gruppo }) => tutte || !t.length || o.value === '__nuovo' || t.every(w => normCassa(o.text + ' ' + gruppo).includes(w))).slice(0, 40);
      sugg.innerHTML = '';
      l.forEach(({ o, gruppo }, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sugg-voce' + (i === 0 && t.length ? ' primo' : ''); b.innerHTML = `<b>${esc(o.text)}</b>${gruppo ? `<small>${esc(gruppo)}</small>` : ''}`;
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', () => { sel.value = o.value; inp.value = vuota(o) ? '' : o.text.trim(); sugg.innerHTML = ''; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); });
        sugg.appendChild(b); });
      if (!l.length) sugg.innerHTML = '<p class="tenue piccolo">Niente con queste parole.</p>';
    };
    inp.addEventListener('input', (e) => { e.stopPropagation(); mostra(false); });
    inp.addEventListener('focus', () => { inp.select(); mostra(!inp.value || inp.value === (sel.options[sel.selectedIndex] || {}).text); });
    inp.addEventListener('blur', () => setTimeout(() => { sugg.innerHTML = ''; const o = sel.options[sel.selectedIndex]; inp.value = vuota(o) ? '' : o.text.trim(); }, 150));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = sugg.querySelector('.sugg-voce'); if (b) b.click(); } if (e.key === 'Escape') inp.blur(); });
    inp.addEventListener('change', (e) => e.stopPropagation());
  }
  // telefono e iPad: quando scrivi in un campo di ricerca, la tastiera non deve coprire l'elenco dei suggerimenti
  function spazioSuggerimenti(inp) {
    const box = inp.parentNode && inp.parentNode.querySelector('.sugg'); if (!box) return;
    const vv = window.visualViewport, alto = vv ? vv.height + vv.offsetTop : window.innerHeight;
    const r = inp.getBoundingClientRect();
    box.style.maxHeight = Math.max(140, Math.min(420, alto - r.bottom - 12)) + 'px';
  }
  document.addEventListener('focusin', (e) => {
    const el = e.target; if (!el.classList || !el.classList.contains('cerca-rif')) return;
    const piccolo = window.matchMedia('(max-width: 900px)').matches || 'ontouchstart' in window;
    if (piccolo) setTimeout(() => {
      // porto il campo in alto, sotto la barra del titolo, così sotto c'è posto per l'elenco
      const testa = (document.querySelector('header') || {}).offsetHeight || 60;
      const r = el.getBoundingClientRect(); window.scrollBy({ top: r.top - testa - 12, behavior: 'smooth' });
      setTimeout(() => spazioSuggerimenti(el), 350);
    }, 250);
    else spazioSuggerimenti(el);
  });
  document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('cerca-rif')) spazioSuggerimenti(e.target); }, true);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { const el = document.activeElement; if (el && el.classList && el.classList.contains('cerca-rif')) spazioSuggerimenti(el); });
  // i numeri nei campi si scrivono all'italiana: 3,5 e non 3.5 (la lettura accetta tutti e due)
  const virgola = (root) => { if (!root.querySelectorAll) return; const l = root.matches && root.matches('input[inputmode=decimal]') ? [root] : root.querySelectorAll('input[inputmode=decimal]');
    l.forEach(i => { if (i.dataset.virgola) return; i.dataset.virgola = '1'; if (/^-?\d+\.\d+$/.test(i.value) && document.activeElement !== i) i.value = i.value.replace('.', ','); }); };
  // spiegazioni lunghe: si vede la prima frase, il resto con «Di più» (così le pagine sono più pulite)
  const accorcia = (root) => { if (!root.querySelectorAll) return;
    const l = root.matches && root.matches('p.tenue') ? [root] : root.querySelectorAll('p.tenue');
    l.forEach(pp => { if (pp.dataset.corto || pp.textContent.length < 130) return; pp.dataset.corto = '1';
      const h = pp.innerHTML, m = h.match(/^([^<]{20,120}?[.:;!?])\s+(\S[\s\S]*)$/); if (!m) return;
      pp.innerHTML = `${m[1]} <button type="button" class="piu" data-piu>Di più</button><span class="resto" hidden> ${m[2]}</span>`; }); };
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-piu]'); if (!b) return; e.preventDefault(); const r = b.nextElementSibling; if (r) r.hidden = false; b.remove(); });
  new MutationObserver((ms) => ms.forEach(m => m.addedNodes.forEach(n => { virgola(n); accorcia(n); }))).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(() => { document.querySelectorAll('#contenuto select').forEach(rendiCercabile); crocette(); }).observe(document.getElementById('contenuto') || document.body, { childList: true, subtree: true });
  // ---------- Crocetta in fondo ai campi di ricerca: cancella quello che hai scritto ----------
  const CAMPI_CERCA = 'input.cerca, input.cerca-rif, input[type=search], input[data-filtro]';
  function mettiCrocetta(inp) {
    const x = inp._crocetta; if (!x) return;
    const vede = !!inp.value && inp.offsetParent !== null && !inp.disabled;
    x.style.display = vede ? 'flex' : 'none';
    inp.classList.toggle('ha-testo', vede);
    if (!vede) return;
    const tendina = inp.closest('.tendina-cerca');
    // misuro rispetto al contenitore vero della crocetta, così sta sempre dentro il campo
    const cb = x.offsetParent || document.body, ir = inp.getBoundingClientRect(), cr = cb.getBoundingClientRect();
    x.style.top = (ir.top - cr.top - cb.clientTop + cb.scrollTop + (ir.height - 28) / 2) + 'px';
    x.style.left = (ir.right - cr.left - cb.clientLeft + cb.scrollLeft - 28 - (tendina ? 34 : 8)) + 'px';
  }
  function crocette() {
    document.querySelectorAll('#contenuto ' + CAMPI_CERCA.split(', ').join(', #contenuto ')).forEach(inp => {
      if (!inp._crocetta) {
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'crocetta'; x.setAttribute('aria-label', 'Cancella'); x.textContent = '✕';
        x.addEventListener('mousedown', (e) => e.preventDefault());
        x.addEventListener('click', (e) => {
          e.preventDefault(); e.stopPropagation();
          // in un filtro a tendina («Tutti i fornitori», «Tutte le categorie»…) la crocetta toglie anche il filtro
          const box = inp.closest('.tendina-cerca'), sel = box && box.nextElementSibling;
          if (sel && sel.tagName === 'SELECT' && sel.options[0] && /^tutt/i.test(sel.options[0].text.trim())) {
            inp.value = '';
            if (sel.value !== sel.options[0].value) { sel.value = sel.options[0].value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
            mettiCrocetta(inp); return;
          }
          inp.value = '';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.focus();
          mettiCrocetta(inp);
        });
        inp.insertAdjacentElement('afterend', x);
        inp._crocetta = x;
        inp.addEventListener('input', () => mettiCrocetta(inp));
        inp.addEventListener('focus', () => mettiCrocetta(inp));
        inp.addEventListener('blur', () => setTimeout(() => mettiCrocetta(inp), 200));
      }
      mettiCrocetta(inp);
    });
  }
  window.addEventListener('resize', () => document.querySelectorAll('#contenuto ' + CAMPI_CERCA.split(', ').join(', #contenuto ')).forEach(mettiCrocetta));
  // ---------- Storia della navigazione: la freccia ‹ torna alla pagina da cui vieni (e allo stesso punto) ----------
  const storia = []; let tornando = null;
  const qui = () => location.hash || '#/pannello';
  function segnaStoria() {
    const h = qui();
    if (tornando) return;
    if (storia.length && storia[storia.length - 1].h === h) return;
    storia.push({ h, y: 0 }); if (storia.length > 60) storia.shift();
  }
  window.addEventListener('scroll', () => { if (storia.length && storia[storia.length - 1].h === qui()) storia[storia.length - 1].y = window.scrollY; }, { passive: true });
  function tornaAllaPrecedente(riserva) {
    const ora = qui();
    while (storia.length && storia[storia.length - 1].h === ora) storia.pop();
    // le pagine di modifica già chiuse non si riaprono tornando indietro
    while (storia.length && (/^#\/modifica-/.test(storia[storia.length - 1].h) || storia[storia.length - 1].h === ora)) storia.pop();
    const prec = storia[storia.length - 1];
    if (prec) { tornando = prec; location.hash = prec.h; return; }
    vai(riserva || '#/pannello');
  }
  window.addEventListener('hashchange', () => {
    const t = tornando;
    if (!t) segnaStoria();
    disegna();
    if (t) { tornando = null; requestAnimationFrame(() => {
      window.scrollTo(0, t.y || 0);
      const a = ui.scorriArrivo, nome = (qui().split('/')[1] || '');
      if (a && ((a.t === 'P' && nome === 'prodotti') || (a.t === 'R' && nome === 'ricette'))) {
        const r = document.querySelector(`#lista a[href="#/${a.t === 'P' ? 'prodotto' : 'ricetta'}/${a.id}"]`);
        if (r) { r.scrollIntoView({ block: 'center' }); r.classList.add('appena-visto'); }
        ui.scorriArrivo = null;
      }
    }); } else window.scrollTo(0, 0);
  });

  // ---------- Fatture: caricamento ----------
  function aggiungiFatture(lista, silenzioso) {
    let ultimo = null, doppie = 0, nuove = 0, creati = 0;
    const im = S.impostazioni;
    // dalla più vecchia alla più nuova, così lo storico dei prezzi resta in ordine
    lista.slice().sort((a, b) => (a.data || '') < (b.data || '') ? -1 : 1).forEach(f => {
      const dop = S.fatture.find(x => x.numero === f.numero && x.data === f.data && (x.piva === f.piva || x.fornitoreNome === f.fornitoreNome));
      if (dop) { doppie++; ultimo = dop; return; }
      M.abbinaAutomatico(f);
      if (im.autoCrea !== false) creati += M.creaProdottiDaFattura(f).length;
      S.fatture.push(f); ultimo = f; nuove++;
      if (im.autoRegistra !== false && !f.daVerificare && !M.daAbbinare(f)) { M.registraFattura(f); M.svuota(); }
    });
    salva();
    if (creati) avviso(creati === 1 ? '1 prodotto nuovo creato dalle fatture: da completare.' : creati + ' prodotti nuovi creati dalle fatture: da completare.');
    if (silenzioso) return nuove;
    if (doppie) avviso(doppie === 1 ? 'Questa fattura era già caricata.' : doppie + ' fatture erano già caricate.');
    if (lista.length === 1 && ultimo) vai('#/fattura/' + ultimo.id); else { vai('#/fatture'); disegna(); }
  }
  async function caricaXML(files) {
    const tutte = []; const errori = [];
    // gli .zip scaricati dal portale: si aprono e si leggono le fatture dentro
    const espansi = [];
    for (const file of files) {
      if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
        try {
          if (!window.JSZip) await caricaScript('jszip.min.js');
          const zip = await window.JSZip.loadAsync(file);
          for (const nome of Object.keys(zip.files)) {
            const voce = zip.files[nome];
            if (!voce.dir && /\.(xml|p7m)$/i.test(nome) && !/(^|\/)\._/.test(nome)) espansi.push({ name: nome.split('/').pop(), arrayBuffer: () => voce.async('arraybuffer') });
          }
        } catch (e) { alert('Non riesco ad aprire ' + file.name + ': ' + e.message); }
      } else espansi.push(file);
    }
    files = espansi;
    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        const xml = M.estraiXML(buf);
        if (!xml) throw new Error('non trovo la fattura nel file');
        tutte.push(...M.leggiFatturaXML(xml, file.name));
      } catch (e) { errori.push(file.name + ': ' + e.message); }
    }
    if (errori.length) alert('Non sono riuscito a leggere:\n' + errori.join('\n'));
    if (tutte.length) aggiungiFatture(tutte);
  }
  async function caricaFoto(file) {
    if (!S.impostazioni.chiaveClaude) { alert('Per leggere le foto serve la chiave di Claude: la inserisci in Altro › Impostazioni.'); return; }
    modale('<h3>Sto leggendo la fattura…</h3><p class="tenue">Ci vogliono una decina di secondi.</p><div class="rotella"></div>');
    try {
      let base64, tipo = file.type;
      if (tipo === 'application/pdf') base64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(file); });
      else { base64 = await rimpicciolisci(file); tipo = 'image/jpeg'; }
      const f = await M.leggiFotoConClaude(base64, tipo);
      chiudiModale(); aggiungiFatture([f]);
    } catch (e) { chiudiModale(); alert(e.message); }
  }
  function rimpicciolisci(file) {
    return new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => {
        const max = 2000, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => ko(new Error('Non riesco ad aprire la foto.'));
      img.src = URL.createObjectURL(file);
    });
  }
  // ---------- Casella delle fatture (Gmail) ----------
  function daBase64(b64) { const b = atob(b64); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; }
  let controlloInCorso = false;
  async function controllaCasella(manuale) {
    const c = S.casella;
    if (!c.url || !c.chiave) { if (manuale) alert('Prima inserisci indirizzo e parola segreta della casella in Altro › Impostazioni.'); return; }
    if (controlloInCorso) return; controlloInCorso = true;
    if (manuale) modale('<h3>Controllo la casella…</h3><div class="rotella"></div>');
    try {
      const da60 = Date.now() - 60 * 864e5;
      const dal = new Date(c.ultimoControllo ? Math.max(da60, new Date(c.ultimoControllo).getTime() - 5 * 864e5) : da60).toISOString();
      const r = await fetch(c.url + (c.url.includes('?') ? '&' : '?') + 'chiave=' + encodeURIComponent(c.chiave) + '&dal=' + encodeURIComponent(dal));
      const j = await r.json();
      if (j.errore) throw new Error(j.errore);
      const visti = new Set(c.visti || []);
      const nuoveFatture = []; let fotoInAttesa = 0, fotoLette = 0; const errori = [];
      for (const a of (j.allegati || [])) {
        if (visti.has(a.id)) continue;
        try {
          if (a.tipo === 'xml') {
            const xml = M.estraiXML(daBase64(a.base64));
            if (!xml) throw new Error('non trovo la fattura nel file');
            nuoveFatture.push(...M.leggiFatturaXML(xml, a.nome)); visti.add(a.id);
          } else if (S.impostazioni.chiaveClaude) {
            const b64 = a.tipo === 'application/pdf' ? a.base64 : await rimpicciolisci(new Blob([daBase64(a.base64)], { type: a.tipo }));
            const f = await M.leggiFotoConClaude(b64, a.tipo === 'application/pdf' ? 'application/pdf' : 'image/jpeg');
            f.nomeFile = a.nome; nuoveFatture.push(f); visti.add(a.id); fotoLette++;
          } else fotoInAttesa++;
        } catch (e) { errori.push(a.nome + ': ' + e.message); visti.add(a.id); }
      }
      const nuove = nuoveFatture.length ? aggiungiFatture(nuoveFatture, true) : 0;
      c.visti = Array.from(visti).slice(-3000); c.ultimoControllo = new Date().toISOString(); c.fotoInAttesa = fotoInAttesa;
      salva();
      if (manuale) chiudiModale();
      if (nuove || manuale) avviso(nuove ? (nuove === 1 ? 'È arrivata 1 fattura nuova.' : 'Sono arrivate ' + nuove + ' fatture nuove.') : 'Nessuna fattura nuova.');
      if (fotoInAttesa && manuale) alert(fotoInAttesa + ' foto o PDF in attesa: per leggerli serve la chiave di Claude in Impostazioni.');
      if (errori.length && manuale) alert('Non sono riuscito a leggere:\n' + errori.join('\n'));
      ridisegnaMantenendo();
    } catch (e) {
      if (manuale) { chiudiModale(); alert('Non riesco a leggere la casella: ' + e.message); }
    } finally { controlloInCorso = false; }
  }

  function nuovoProdottoDaRiga(f, k) {
    const rg = f.righe[k];
    const parole = rg.descrizione.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !/^\d/.test(w)).slice(0, 2).join(' ');
    const nb = parole.charAt(0).toUpperCase() + parole.slice(1);
    const um = (rg.um || '').toUpperCase();
    const unita = um === 'KG' ? 'g' : um === 'LT' || um === 'L' ? 'ml' : 'pz';
    const cont = um === 'KG' || um === 'LT' || um === 'L' ? 1000 : 1;
    modale(`<h3>Nuovo prodotto</h3><p class="tenue piccolo">Da: «${esc(rg.descrizione)}»</p>
      <div class="form">
        <label>Nome breve<input id="np-nb" value="${esc(nb)}"></label>
        <label>Nome completo<input id="np-nc" value="${esc(rg.descrizione)}"></label>
        <label>Categoria<input id="np-cat" list="np-cats" value=""><datalist id="np-cats">${categorie().map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <div class="due"><label>Unità<select id="np-u">${['ml', 'g', 'pz'].map(u => `<option ${u === unita ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        <label>Contenuto di una confezione<input id="np-cont" type="text" inputmode="decimal" autocomplete="off" value="${cont}"></label></div>
        <label>Tipo di confezione<input id="np-conf" value="${um === 'KG' ? 'kg' : um === 'LT' ? 'litro' : 'pezzo'}"></label>
      </div>
      <div class="bottoni"><button class="btn primario" id="np-ok">Crea e collega</button><button class="btn" id="np-no">Annulla</button></div>`);
    $('#np-no').onclick = () => { chiudiModale(); ridisegnaMantenendo(); };
    $('#np-ok').onclick = () => {
      const nbv = $('#np-nb').value.trim(); if (!nbv) { alert('Scrivi il nome breve.'); return; }
      const p = { id: M.uid('p'), nomeBreve: nbv, nomeCompleto: $('#np-nc').value.trim(), categoria: $('#np-cat').value.trim() || 'Altro', unita: $('#np-u').value, contenuto: numDa($('#np-cont').value) || 1, confezione: $('#np-conf').value.trim() || 'confezione', iva: rg.aliquota || 22, giacenza: 0, scortaMinima: 0, resa: 100, allergeni: [], venditaDiretta: null, fornitoreId: f.fornitoreId || '', articoli: [], prezzi: [], note: '' };
      S.prodotti.push(p); rg.prodottoId = p.id; rg.ignora = false; rg.confezioniPerUnita = 1;
      salva(); chiudiModale(); ridisegnaMantenendo();
    };
  }

  // ---------- Esportazione ----------
  function caricaScript(src) { return new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Serve la connessione per esportare.')); document.head.appendChild(s); }); }
  // le tabelle leggibili (Excel e copia su Google): una lista di righe per foglio
  function fogliLeggibili() {
    const r2 = (n) => n == null || isNaN(n) ? '' : Math.round(n * 100) / 100, r3 = (n) => n == null || isNaN(n) ? '' : Math.round(n * 1000) / 1000;
    const per = periodoRiferimento();
    const ultimaData = (p) => (p.prezzi || []).reduce((d, e) => e.data && e.data > d ? e.data : d, '');
    const spesoForn = {};
    S.fatture.forEach(f => { const x = spesoForn[f.fornitoreId] = spesoForn[f.fornitoreId] || { tot: 0, n: 0, ultima: '' }; x.tot += (f.tipoDoc === 'TD04' ? -1 : 1) * (Number(f.imponibile) || 0); x.n++; if (f.data > x.ultima) x.ultima = f.data; });
    return {
      Prodotti: S.prodotti.filter(p => !p.speciale).map(p => { const rif = M.prezzoRiferimento(p); return { 'Nome breve': p.nomeBreve, 'Nome completo': p.nomeCompleto, Reparto: M.reparto(p), Categoria: p.categoria, Fornitore: (M.fornitore(p.fornitoreId) || {}).nome || '', Confezione: p.confezione, Contenuto: p.contenuto, Unità: p.unita, 'Prezzo senza IVA': r3(M.prezzo(p)), 'Prezzo al kg, litro o pezzo': rif ? r2(rif.valore) : '', 'Per': rif ? rif.etichetta : '', 'Ultimo prezzo del': ultimaData(p), 'IVA %': p.iva, 'In casa': p.giacenza, 'Valore': r2(M.valoreGiacenza(p)), 'Scorta minima': p.scortaMinima, 'Usato in ricette': M.usatoIn('p:' + p.id).tutte.length, Allergeni: (p.allergeni || []).join(', ') }; }),
      Ricette: S.ricette.map(r => { const i = M.indicatori(r), q = per ? Number((r.vendite || {})[per]) || 0 : 0; const o = { Ricetta: r.nome, Gruppo: M.TIPI[r.tipo] || r.tipo, Reparto: r.tipo === 'semilavorato' ? 'Preparazione' : (M.REPARTO_TIPO[r.tipo] === 'cucina' ? 'Cucina' : 'Bar'), Costo: r2(i.costo), Prezzo: r.prezzo || '', 'Prezzo senza IVA': r2(i.netto), Moltiplicatore: r2(i.molt), Soglia: i.soglia || '', 'Sotto la soglia': i.sotto ? 'sì' : '', 'Costo %': i.incidenza == null ? '' : r2(i.incidenza * 100), 'Guadagno a pezzo': r2(i.margine) };
        if (per) { o['Venduti (' + per + ')'] = q; o['Guadagno totale (' + per + ')'] = q && i.margine != null ? r2(q * i.margine) : ''; }
        o.Ingredienti = (r.righe || []).map(rg => `${M.nomeRif(rg.rif)} ${rg.quantita} ${rg.misura || M.unitaRif(rg.rif)}`).join('; '); o.Allergeni = M.allergeniRicetta(r).join(', '); return o; }),
      Fatture: S.fatture.slice().sort((x, y) => (y.data || '').localeCompare(x.data || '')).map(f => ({ Fornitore: (M.fornitore(f.fornitoreId) || {}).nome || f.fornitoreNome, Numero: String(f.numero || ''), Data: f.data, Tipo: f.tipoDoc === 'TD04' ? 'Nota di credito' : 'Fattura', 'Tipo di spesa': (CAT_SPESA[categoriaSpesa(f)] || [''])[0], Imponibile: r2(f.imponibile), Totale: r2(f.totale), Stato: f.stato === 'registrata' ? 'Registrata' : 'Da registrare' })),
      Fornitori: S.fornitori.slice().sort((x, y) => ((spesoForn[y.id] || {}).tot || 0) - ((spesoForn[x.id] || {}).tot || 0)).map(f => { const x = spesoForn[f.id] || { tot: 0, n: 0, ultima: '' }; return { Nome: f.nome, 'Partita IVA': f.piva || '', 'Tipo di spesa': (CAT_SPESA[categoriaSpesa(f)] || [''])[0], 'Speso in tutto (senza IVA)': r2(x.tot), Fatture: x.n, 'Ultima fattura': x.ultima, Telefono: f.telefono || '', Email: f.email || '', Referente: f.referente || '' }; })
    };
  }
  async function esportaExcel() {
    try {
      if (!window.XLSX) { try { await caricaScript('xlsx.full.min.js'); } catch (e) { await caricaScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'); } }
      const X = window.XLSX; const wb = X.utils.book_new(); const fl = fogliLeggibili();
      ['Prodotti', 'Ricette', 'Fatture'].forEach(n => X.utils.book_append_sheet(wb, X.utils.json_to_sheet(fl[n]), n));
      X.writeFile(wb, 'Gestionale Repub ' + M.oggi() + '.xlsx');
    } catch (e) { alert(e.message); }
  }

  // ---------- Copia automatica su Google Sheet ----------
  // un'app web di Google Apps Script dentro un Foglio Google: riceve le tabelle e la copia completa dei dati
  const CS = () => (S.copiaSheet = S.copiaSheet || { url: '', chiave: '', ogni: 'settimana', ultima: '' });
  const giorniCopia = () => CS().ogni === 'mese' ? 30 : 7;
  const copiaDovuta = () => { const c = CS(); if (!c.url || !c.chiave || c.ogni === 'mai') return false; return !c.ultima || (Date.now() - new Date(c.ultima).getTime()) / 864e5 >= giorniCopia(); };
  let copiaInCorso = false;
  async function copiaSuSheet(manuale) {
    const c = CS();
    if (!c.url || !c.chiave) { if (manuale) alert('Prima scrivi l\'indirizzo dell\'app web e la parola segreta.'); return; }
    if (copiaInCorso) return; copiaInCorso = true;
    if (manuale) modale('<h3>Faccio la copia sul Foglio Google…</h3><div class="rotella"></div>');
    try {
      const fl = fogliLeggibili(), fogli = {};
      // in tabella: prima riga i titoli; i testi che iniziano con «=» non devono diventare formule
      const cella = (v) => v == null ? '' : typeof v !== 'string' ? v : /^[=+@-]/.test(v) ? ' ' + v : /^[\d.,\s/]+$/.test(v) && !/^\d{4}-\d\d-\d\d$/.test(v) ? "'" + v : v;
      Object.keys(fl).forEach(n => { const l = fl[n]; const tit = l.length ? Object.keys(l[0]) : ['Vuoto']; fogli[n] = [tit].concat(l.map(o => tit.map(t => cella(o[t])))); });
      const r = await fetch(c.url, { method: 'POST', body: JSON.stringify({ chiave: c.chiave, versione: VERSIONE_APP, fogli, copia: await comprimi(JSON.stringify(S)) }) });
      const j = await r.json();
      if (j.errore) throw new Error(j.errore);
      c.ultima = new Date().toISOString(); c.errore = ''; salva();
      if (manuale) { chiudiModale(); avviso('Copia fatta sul Foglio Google.'); ridisegnaMantenendo(); }
    } catch (e) {
      c.errore = e.message; salva();
      if (manuale) { chiudiModale(); alert('La copia non è riuscita: ' + e.message); ridisegnaMantenendo(); }
    } finally { copiaInCorso = false; }
  }
  // la copia completa viaggia compressa («GZ:» + base64): nel Foglio occupa circa un decimo
  async function comprimi(testo) {
    if (!window.CompressionStream) return testo;
    const st = new Blob([testo]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(st).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return 'GZ:' + btoa(bin);
  }
  async function decomprimi(testo) {
    if (!String(testo).startsWith('GZ:')) return testo;
    const bin = atob(testo.slice(3)), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  // l'ultima copia completa salvata sul Foglio Google, da scaricare (poi «Carica una copia dei dati»)
  async function scaricaUltimaCopia() {
    const c = CS(); if (!c.url || !c.chiave) { alert('Prima scrivi l\'indirizzo dell\'app web e la parola segreta.'); return; }
    modale('<h3>Prendo l\'ultima copia dal Foglio Google…</h3><div class="rotella"></div>');
    try {
      const r = await fetch(c.url + (c.url.includes('?') ? '&' : '?') + 'chiave=' + encodeURIComponent(c.chiave));
      const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { throw new Error('risposta non valida'); }
      if (j.errore) throw new Error(j.errore);
      const testo = await decomprimi(j.copia);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([testo], { type: 'application/json' })); a.download = 'Gestionale Repub copia del ' + String(j.quando || '').slice(0, 10) + '.json'; a.click();
      chiudiModale();
    } catch (e) { chiudiModale(); alert('Non sono riuscito a prenderla: ' + e.message); }
  }

  // ---------- Azioni ----------
  const AZ = {};
  AZ.indietro = (el) => {
    const dest = el.getAttribute('href');
    // dalla conta del magazzino l'indirizzo non cambia: chiude la conta
    if (dest === location.hash || (location.hash === '' && dest === '#/pannello')) { ui.conta = null; ridisegnaMantenendo(); window.scrollTo(0, 0); return; }
    // se si stava modificando qualcosa, la bozza non salvata si butta
    if (/^#\/modifica-/.test(qui())) ui.bozza = null;
    tornaAllaPrecedente(dest);
  };
  AZ.esempio = (el) => { const x = window.FATTURE_ESEMPIO[+el.dataset.i]; aggiungiFatture(M.leggiFatturaXML(x.xml, x.nome + '.xml')); };
  AZ['vai-nuovi'] = () => { ui.categoria = '__nuovi'; vai('#/prodotti'); };
  AZ.categoria = (el) => { ui.categoria = el.dataset.v; ridisegnaMantenendo(); };
  AZ['prod-filtro'] = (el) => { cambiaReparti(PF(), el); ui.categoria = 'Tutte'; ridisegnaMantenendo(); };
  AZ['prod-vista'] = (el) => { ui.prodVista = el.dataset.v; ridisegnaMantenendo(); };
  AZ['forn-prod'] = (el) => { ui.fornProd = ui.fornProd === el.dataset.v ? '' : el.dataset.v; ridisegnaMantenendo(); };
  AZ['tipo-ricette'] = (el) => {
    // con «Preparazioni» acceso, Tutte/Bar/Cucina scelgono il reparto delle preparazioni
    if (ui.tipoRicette === 'semilavorato' && SCELTE_REP[el.dataset.v]) { ui.repRicette = el.dataset.v; ridisegnaMantenendo(); return; }
    ui.tipoRicette = el.dataset.v; if (SCELTE_REP[el.dataset.v]) ui.repRicette = el.dataset.v; ridisegnaMantenendo();
  };
  AZ['ric-prep'] = () => { ui.tipoRicette = ui.tipoRicette === 'semilavorato' ? (ui.repRicette || '*tutto') : 'semilavorato'; ridisegnaMantenendo(); };
  AZ.allergene = (el) => { const a = el.dataset.v, b = ui.bozza; b.allergeni = b.allergeni || []; b.allergeni = b.allergeni.includes(a) ? b.allergeni.filter(x => x !== a) : b.allergeni.concat(a); ridisegnaMantenendo(); };
  AZ['vd-attiva'] = (el) => { ui.bozza.venditaDiretta = el.checked ? { nomePorzione: ui.bozza.unita === 'ml' ? 'calice' : 'porzione', porzione: ui.bozza.unita === 'ml' ? 150 : 1, prezzoPorzione: null, prezzoIntero: null } : null; ridisegnaMantenendo(); };
  AZ.scorri = (el) => {
    const t = el.dataset.t, mod = !!el.dataset.m, id = (qui().split('/')[2] || '');
    const { ids, i } = posScorri(t, id), dest = ids[i + Number(el.dataset.dir)];
    if (i < 0) return;
    // nella pagina di modifica: se hai cambiato qualcosa lo salvo, poi passo al prossimo
    if (mod && (el.dataset.forza || bozzaCambiata())) {
      const b = t === 'P' ? salvaBozzaProdotto() : salvaBozzaRicetta(); if (!b) return;
      avviso('Salvato: ' + (b.nomeBreve || b.nome));
    }
    if (!dest) { vai(t === 'P' ? '#/prodotto/' + id : '#/ricetta/' + id); return; }
    ui.bozza = null;
    const pag = (mod ? '#/modifica-' : '#/') + (t === 'P' ? 'prodotto/' : 'ricetta/');
    const scheda = '#/' + (t === 'P' ? 'prodotto/' : 'ricetta/');
    // le frecce non riempiono la storia: con ‹ in alto torni alla scheda dove sei arrivato e poi all'elenco
    if (storia.length && storia[storia.length - 1].h === qui()) storia[storia.length - 1].h = pag + dest;
    if (mod && storia.length > 1 && storia[storia.length - 2].h.startsWith(scheda)) storia[storia.length - 2].h = scheda + dest;
    ui.scorriArrivo = { t, id: dest };
    vai(pag + dest);
  };
  AZ['note-svuota'] = () => { if (ui.bozza) { ui.bozza.note = ''; ridisegnaMantenendo(); } };
  AZ['salva-prodotto'] = () => { const b = salvaBozzaProdotto(); if (b) vai('#/prodotto/' + b.id); };
  function salvaBozzaProdotto() {
    const b = ui.bozza; if (!b.nomeBreve.trim()) { alert('Scrivi il nome breve.'); return null; }
    if (b._per === 'p:nuovo' && !b.reparto) { alert('Scegli il reparto: bar, cucina o non food.'); return null; }
    if (b._per === 'p:nuovo' && !String(b.categoria || '').trim()) { alert('Scegli la categoria (o scrivine una nuova).'); return null; }
    ['contenuto', 'iva', 'giacenza', 'scortaMinima', 'resa'].forEach(k => { b[k] = numDa(b[k]) || 0; });
    if (!b.contenuto) b.contenuto = 1; if (!b.resa) b.resa = 100;
    if (b.venditaDiretta) ['porzione', 'prezzoPorzione', 'prezzoIntero'].forEach(k => { b.venditaDiretta[k] = numDa(b.venditaDiretta[k]); });
    const pr = numDa(b._prezzo), prima = b._prezzoPrima;
    const nuovo = b._per === 'p:nuovo';
    delete b._per; delete b._prezzo; delete b._prezzoPrima; delete b._iniz;
    b.prezzi = b.prezzi || [];
    if (!nuovo && pr != null && pr > 0 && (prima == null || Math.abs(pr - prima) > 0.004)) b.prezzi.push({ data: M.oggi(), fornitoreId: b.fornitoreId || null, prezzo: pr, origine: 'a mano' });
    b.daCompletare = false;
    if (nuovo) { if (pr != null) b.prezzi.push({ data: M.oggi(), fornitoreId: b.fornitoreId, prezzo: pr, origine: 'a mano' }); b.interno = !b.fornitoreId; S.prodotti.push(b); }
    else { const i = S.prodotti.findIndex(p => p.id === b.id); if (i >= 0) S.prodotti[i] = b; else S.prodotti.push(b); }
    ui.bozza = null; M.svuota(); salva(); return b;
  }
  AZ['elimina-prodotto'] = () => {
    const b = ui.bozza; const uso = M.usatoIn('p:' + b.id).dirette;
    if (uso.length && !confirm(`${b.nomeBreve} è usato in ${uso.map(r => r.nome).join(', ')}. Eliminarlo lo stesso?`)) return;
    if (!uso.length && !confirm('Eliminare ' + b.nomeBreve + '?')) return;
    togliProdotto(b.id); ui.bozza = null; salva(); vai('#/prodotti'); avviso('Prodotto spostato nel Cestino: da lì lo puoi rimettere.');
  };
  AZ['segna-servizi'] = (el) => {
    const forn = M.fornitore(el.dataset.id);
    if (!confirm(`${forn.nome} non vende merce? Le sue fatture restano in archivio, ma tolgo i prodotti creati da lì e le prossime non ne creeranno.`)) return;
    const n = M.segnaServizi(forn.id, true); forn.controllato = true; salva(); ridisegnaMantenendo(); avviso(n ? `Tolti ${n} prodotti creati per sbaglio. Vale per tutte le fatture di ${forn.nome}.` : `Fatto: vale per tutte le fatture di ${forn.nome}.`);
  };
  AZ['toggle-servizi'] = (el) => {
    if (el.checked) { const n = M.segnaServizi(el.dataset.id, true); salva(); avviso(n ? `Tolti ${n} prodotti creati per sbaglio.` : 'Salvato.'); }
    else { M.fornitore(el.dataset.id).servizi = false; salva(); avviso('Salvato. Le prossime fatture creeranno i prodotti.'); }
    setTimeout(ridisegnaMantenendo, 150);
  };
  // «Precedente» in tutti gli strumenti passo per passo: annulla l'ultima scelta e torna su quella voce
  function ricorda(chiave, idxKey, conFatture) {
    const st = ui['st_' + chiave] = ui['st_' + chiave] || [];
    st.push({ idx: ui[idxKey] || 0, dati: JSON.stringify({ p: S.prodotti, r: S.ricette, fo: S.fornitori, ig: S.ignorati || [], f: conFatture ? S.fatture : null }) });
    if (st.length > 10) st.shift();
  }
  function ricordaPosto(chiave, idxKey) { (ui['st_' + chiave] = ui['st_' + chiave] || []).push({ idx: ui[idxKey] || 0, dati: null }); }
  function tornaIndietro(chiave, idxKey) {
    const u = (ui['st_' + chiave] || []).pop();
    if (!u) ui[idxKey] = Math.max(0, (ui[idxKey] || 0) - 1);
    else {
      if (u.dati) { const d = JSON.parse(u.dati); S.prodotti = d.p; S.ricette = d.r; S.fornitori = d.fo; S.ignorati = d.ig; if (d.f) S.fatture = d.f; S.cestino = (S.cestino || []).filter(c => !((S[c.tipo] || []).some && S[c.tipo].some(y => y.id === c.x.id))); M.svuota(); salva(); avviso('Ho annullato l\'ultima scelta: puoi rifarla.'); }
      ui[idxKey] = u.idx;
    }
    ridisegnaMantenendo(); window.scrollTo(0, 0);
  }
  const ctrlFAvanti = () => { salva(); ridisegnaMantenendo(); };
  AZ['ctrlf-ok'] = (el) => { ricorda('ctrlf', 'ctrlFIdx', true); const f = M.fornitore(el.dataset.id); f.controllato = true; const n = confermaProdottiDi(f); if (n) avviso(`${n} prodotti di ${f.nome} confermati.`); ctrlFAvanti(); };
  AZ['ctrlf-servizi'] = (el) => { ricorda('ctrlf', 'ctrlFIdx', true); const f = M.fornitore(el.dataset.id); const n = M.segnaServizi(f.id, true); f.controllato = true; ctrlFAvanti(); avviso(`${f.nome}: solo fatture, ${n} prodotti tolti.`); };
  AZ['ctrlf-merce'] = (el) => { ricorda('ctrlf', 'ctrlFIdx', true); const f = M.fornitore(el.dataset.id); const n = M.togliServizi(f.id); f.controllato = true; ctrlFAvanti(); avviso(`${f.nome}: creati ${n} prodotti.`); };
  AZ['ctrlf-salta'] = () => { ricordaPosto('ctrlf', 'ctrlFIdx'); ui.ctrlFIdx = (ui.ctrlFIdx || 0) + 1; ridisegnaMantenendo(); };
  AZ['ctrlf-indietro'] = () => tornaIndietro('ctrlf', 'ctrlFIdx');
  AZ['fmt-categoria'] = () => { ui.fmtCat = ui.categoria !== '__nuovi' && PF().cats.length === 1 ? PF().cats[0] : ''; ui.fmtRep = ui.categoria !== '__nuovi' ? (PF().rep || '') : ''; ui.fmtForn = ''; ui.fmtFiltro = ui.fmtCat || ui.fmtRep ? 'tutti' : 'ricette'; ui.fmtIdx = 0; vai('#/formati'); };
  AZ['fmt-fornitore'] = (el) => { ui.fmtForn = el.dataset.id; ui.fmtCat = ''; ui.fmtRep = ''; ui.fmtFiltro = 'tutti'; ui.fmtIdx = 0; vai('#/formati'); };
  AZ['fmt-filtro'] = (el) => { ui.fmtFiltro = el.dataset.v; ui.fmtIdx = 0; ui.st_fmt = []; ridisegnaMantenendo(); };
  AZ['fmt-giusto'] = (el) => { ricorda('fmt', 'fmtIdx'); const p = M.prodotto(el.dataset.id); p.formatoOk = true; p.daCompletare = false; delete p.dubbio; if (!['dacontrollare', 'cartoni'].includes(fmtFiltro())) ui.fmtIdx = (ui.fmtIdx || 0) + 1; salva(); ridisegnaMantenendo(); window.scrollTo(0, 0); };
  // ogni modo del ricontrollo ricorda il suo filtro e il punto a cui ero arrivato
  AZ['fmt-modo'] = (el) => {
    const m = ui.fmtModi = ui.fmtModi || {};
    m[fmtModo()] = { idx: ui.fmtIdx || 0, filtro: ui.fmtFiltro, st: ui.st_fmt };
    ui.fmtModo = el.dataset.v;
    const t = m[ui.fmtModo] || {};
    ui.fmtIdx = t.idx || 0; ui.fmtFiltro = t.filtro; ui.st_fmt = t.st || [];
    if (!t.filtro && (ui.fmtRep || ui.fmtCat || ui.fmtForn)) ui.fmtFiltro = 'tutti';
    ridisegnaMantenendo(); window.scrollTo(0, 0);
  };
  // dopo una scelta: se il prodotto esce dalla lista resto sullo stesso numero, altrimenti vado avanti
  function fmtAvanti(p) {
    if (listaFormati().includes(p)) ui.fmtIdx = (ui.fmtIdx || 0) + 1;
    salva(); ridisegnaMantenendo(); window.scrollTo(0, 0);
  }
  AZ['fmtc-rep'] = (el) => { const p = M.prodotto(el.dataset.id); p.reparto = el.dataset.v; salva(); ridisegnaMantenendo(); };
  AZ['fmtc-cat'] = (el) => { ricorda('fmt', 'fmtIdx'); const p = M.prodotto(el.dataset.id); if (!p.reparto) p.reparto = M.reparto(p); p.categoria = el.dataset.v; fmtAvanti(p); };
  AZ['fmtc-nuova'] = (el) => {
    const v = (document.getElementById('fmtc-nuova') || {}).value; if (!v || !v.trim()) { avviso('Scrivi il nome della categoria.'); return; }
    ricorda('fmt', 'fmtIdx'); const p = M.prodotto(el.dataset.id); if (!p.reparto) p.reparto = M.reparto(p);
    const t = v.trim(), gia = categorie().find(c => c && c.toLowerCase() === t.toLowerCase());
    p.categoria = gia || t.charAt(0).toUpperCase() + t.slice(1); fmtAvanti(p);
  };
  AZ['fmtf-scegli'] = (el) => { ricorda('fmt', 'fmtIdx'); const p = M.prodotto(el.dataset.id); p.fornitoreId = el.dataset.v; fmtAvanti(p); };
  AZ['fmt-salta'] = () => { ricordaPosto('fmt', 'fmtIdx'); ui.fmtIdx = (ui.fmtIdx || 0) + 1; ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['fmt-indietro'] = () => tornaIndietro('fmt', 'fmtIdx');
  function pulMemoria(conDati) {
    (ui.pulStorico = ui.pulStorico || []).push({ idx: ui.pulIdx || 0, dati: conDati ? JSON.stringify({ p: S.prodotti, r: S.ricette, f: S.fatture, e: S.eventi || [], s: S.puliziaSaltati || [] }) : null });
    if (ui.pulStorico.length > 15) ui.pulStorico.shift();
  }
  AZ['pul-si'] = (el) => {
    pulMemoria(true);
    const fo = M.prodotto(el.dataset.da), ve = M.prodotto(el.dataset.a);
    const err = M.collegaAlFoglio(el.dataset.da, el.dataset.a); if (err) { ui.pulStorico.pop(); alert(err); return; }
    salva(); ridisegnaMantenendo(); avviso(`Collegato: «${ve.nomeBreve}» ora prende il prezzo dalle fatture.`);
  };
  AZ['pul-no'] = (el) => { pulMemoria(true); S.puliziaSaltati = (S.puliziaSaltati || []).concat(el.dataset.id); salva(); ridisegnaMantenendo(); };
  AZ['pul-salta'] = () => { pulMemoria(false); ui.pulIdx = (ui.pulIdx || 0) + 1; ridisegnaMantenendo(); };
  AZ['pul-indietro'] = () => {
    const u = (ui.pulStorico || []).pop();
    if (!u) { ui.pulIdx = Math.max(0, (ui.pulIdx || 0) - 1); ridisegnaMantenendo(); return; }
    if (u.dati) { const d = JSON.parse(u.dati); S.prodotti = d.p; S.ricette = d.r; S.fatture = d.f; S.eventi = d.e; S.puliziaSaltati = d.s; M.svuota(); salva(); }
    ui.pulIdx = u.idx; ridisegnaMantenendo();
  };
  AZ['pulizia-fine'] = () => {
    if (!confirm('Finisco la pulizia? Prima scarico una copia dei dati.')) return;
    AZ['scarica-copia']();
    // fatture di esempio
    S.fatture.filter(f => /ESEMPIO/i.test(f.numero || '') || /ESEMPIO/i.test(f.fornitoreNome || '')).forEach(f => { M.annullaFattura(f); });
    const esempi = new Set(S.fatture.filter(f => /ESEMPIO/i.test(f.numero || '') || /ESEMPIO/i.test(f.fornitoreNome || '')).map(f => f.id));
    S.fatture = S.fatture.filter(f => !esempi.has(f.id));
    S.prodotti = S.prodotti.filter(p => !(esempi.has(p.creatoDa) && !(p.prezzi || []).length && !M.usatoIn('p:' + p.id).dirette.length));
    // fornitori scritti a mano: se c'è quello vero delle fatture, unisco; se non serve a nessuno, lo tolgo
    const conFatture = new Set(S.fatture.map(f => f.fornitoreId));
    S.fornitori.filter(f => !conFatture.has(f.id)).forEach(f => {
      const vero = S.fornitori.find(z => z !== f && conFatture.has(z.id) && (norm2(z.nome).includes(norm2(f.nome)) || norm2(f.nome).includes(norm2(z.nome))));
      if (vero) M.unisciFornitori(f.id, vero.id);
    });
    const usati = new Set(); S.prodotti.forEach(p => { usati.add(p.fornitoreId); (p.prezzi || []).forEach(e => usati.add(e.fornitoreId)); (p.articoli || []).forEach(e => usati.add(e.fornitoreId)); });
    const fattureIds = new Set(S.fatture.map(f => f.fornitoreId));
    S.fornitori = S.fornitori.filter(f => fattureIds.has(f.id) || usati.has(f.id));
    S.puliziaFatta = true; M.svuota(); salva(); ridisegnaMantenendo(); avviso('Pulizia fatta.');
  };
  const ctrlAvanti = (rimosso) => { if (!rimosso) ui.ctrlIdx = (ui.ctrlIdx || 0) + 1; salva(); ridisegnaMantenendo(); };
  AZ['ctrl-giusto'] = (el) => { ricorda('ctrl', 'ctrlIdx'); const p = M.prodotto(el.dataset.id); p.daCompletare = false; delete p.dubbio; delete p.forseDoppioneDi; ctrlAvanti(true); };
  AZ['ctrl-materiale'] = (el) => { ricorda('ctrl', 'ctrlIdx'); const p = M.prodotto(el.dataset.id); p.categoria = 'Non alimentare'; p.daCompletare = false; ctrlAvanti(true); avviso('Segnato come materiale.'); };
  AZ['ctrl-togli'] = (el) => { ricorda('ctrl', 'ctrlIdx', true); const p = M.prodotto(el.dataset.id); M.togliProdotto(p.id); ctrlAvanti(true); avviso(`Tolto «${p.nomeBreve}»: le prossime fatture lo salteranno.`); };
  AZ['ctrl-servizi'] = (el) => { const forn = M.fornitore(el.dataset.id); if (!confirm(`${forn.nome} non vende merce? Tolgo tutti i prodotti creati dalle sue fatture.`)) return; ricorda('ctrl', 'ctrlIdx', true); const n = M.segnaServizi(forn.id, true); ctrlAvanti(true); avviso(`Tolti ${n} prodotti di ${forn.nome}.`); };
  AZ['ctrl-salta'] = () => { ricordaPosto('ctrl', 'ctrlIdx'); ctrlAvanti(false); };
  AZ['ctrl-indietro'] = () => tornaIndietro('ctrl', 'ctrlIdx');
  // fornitori che sembrano lo stesso: una parola importante del nome in comune (es. «Doreca»)
  // fornitori che sono lo stesso: il nome «compatto», senza forme societarie e punti, è uguale o contenuto nell'altro
  // (Sebar e SE.BA.R S.P.A.; Decafood e DE.CA FOOD S.R.L.; Doreca e Emilia Romagna Doreca S.r.l.)
  const FORME_FORN = /\b(s ?r ?l ?s?|s ?p ?a|s ?n ?c|s ?a ?s|s ?b|societa|a socio unico|socio unico|unipersonale|italia|italiana|emilia romagna|di [a-z]+( [a-z]+)?$)\b/g;
  const compattoForn = (n) => normCassa(normCassa(n).replace(FORME_FORN, ' ')).replace(/ /g, '');
  function fornitoriSimili(f) {
    const a = compattoForn(f.nome); if (a.length < 3) return [];
    return S.fornitori.filter(x => { if (x.id === f.id) return false; const b = compattoForn(x.nome); const [c, l] = a.length <= b.length ? [a, b] : [b, a];
      return c.length >= 3 && (a === b || (c.length >= 5 && l.includes(c)) || (l.startsWith(c) && l.length - c.length <= 3)); });
  }
  function coppieFornitori() {
    const viste = new Set(), coppie = [];
    S.fornitori.forEach(f => fornitoriSimili(f).forEach(x => { const k = [f.id, x.id].sort().join('|'); if (!viste.has(k)) { viste.add(k); coppie.push([f, x]); } }));
    if (!coppie.length) return '';
    const n = (f) => S.fatture.filter(z => z.fornitoreId === f.id).length;
    return `<div class="card"><h3>Forse sono lo stesso fornitore (${coppie.length})</h3><p class="tenue piccolo">Hanno una parola importante del nome in comune. Se sono lo stesso, uniscili: prodotti uguali compresi.</p>
      ${coppie.map(([x, y]) => { const [da, a] = n(x) > n(y) ? [y, x] : [x, y]; return `<div class="riga"><span>${esc(da.nome)}<small>e ${esc(a.nome)}</small></span><button class="btn piccolo" data-az="unisci-fornitore" data-id="${da.id}" data-a="${a.id}">Unisci</button></div>`; }).join('')}</div>`;
  }
  AZ['unisci-fornitore'] = (el) => {
    const da = M.fornitore(el.dataset.id), a = M.fornitore(el.dataset.a);
    if (!da || !a) { alert('Scegli il fornitore in cui unirlo.'); return; }
    if (!confirm(`Unisco «${da.nome}» dentro «${a.nome}»? Fatture e prodotti passano a ${a.nome}.`)) return;
    M.unisciFornitori(da.id, a.id);
    // i prodotti uguali dei due fornitori (es. la stessa Guinness) diventano uno solo
    let n = 0; M.gruppiDoppioni().filter(g => g.every(p => p.fornitoreId === a.id)).forEach(g => { n += unisciGruppo(g); });
    salva(); vai('#/fornitore/' + a.id); avviso('Fornitori uniti' + (n ? `, e ${n} prodotti doppi uniti` : '') + '.');
  };
  AZ['imp-bool'] = (el) => { S.impostazioni[el.dataset.k] = el.checked; salva(); avviso('Salvato.'); };
  AZ.completato = (el) => { const p = M.prodotto(el.dataset.id); p.daCompletare = false; salva(); ridisegnaMantenendo(); avviso('Fatto.'); };
  AZ['crea-mancanti'] = (el) => { const f = S.fatture.find(x => x.id === el.dataset.id); const n = M.creaProdottiDaFattura(f).length; salva(); ridisegnaMantenendo(); avviso(n ? (n === 1 ? '1 prodotto creato.' : n + ' prodotti creati.') : 'Righe sistemate.'); };
  AZ['prezzo-mano'] = (el) => {
    const p = M.prodotto(el.dataset.id);
    modale(`<h3>Prezzo a mano · ${esc(p.nomeBreve)}</h3><div class="form">
      <label>Prezzo della ${esc(p.confezione)} senza IVA<input id="pm-p" type="text" inputmode="decimal" autocomplete="off"></label>
      <label>Data<input id="pm-d" type="date" value="${M.oggi()}"></label>
      <label>Fornitore<select id="pm-f"><option value="">—</option>${S.fornitori.map(f => `<option value="${f.id}" ${f.id === p.fornitoreId ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label></div>
      <div class="bottoni"><button class="btn primario" id="pm-ok">Aggiungi</button><button class="btn" id="pm-no">Annulla</button></div>`);
    $('#pm-no').onclick = chiudiModale;
    $('#pm-ok').onclick = () => { const v = numDa($('#pm-p').value); if (v == null) return; p.prezzi.push({ data: $('#pm-d').value || M.oggi(), fornitoreId: $('#pm-f').value, prezzo: v, origine: 'a mano' }); salva(); chiudiModale(); ridisegnaMantenendo(); };
  };
  AZ['simula-prodotto'] = (el) => { ui.sim = { modo: 'prodotto', prodottoId: el.dataset.id, valore: '', inPercentuale: true }; vai('#/simulatore'); };
  AZ['simula-ricetta'] = (el) => { ui.sim = { modo: 'ricetta', ricettaId: el.dataset.id, prezzo: '' }; vai('#/simulatore'); };
  AZ['aggiungi-riga'] = () => { ui.bozza.righe.push({ rif: '', quantita: '', nota: '' }); ridisegnaMantenendo(); const k = ui.bozza.righe.length - 1; setTimeout(() => { const c = document.querySelector(`[data-cr="${k}"]`); if (c) c.focus(); }, 30); };
  AZ['togli-riga'] = (el) => { ui.bozza.righe.splice(+el.dataset.k, 1); ridisegnaMantenendo(); };
  AZ['aggiungi-extra'] = () => { (ui.bozza.costiExtra = ui.bozza.costiExtra || []).push({ nome: '', costo: '' }); ridisegnaMantenendo(); };
  AZ['togli-extra'] = (el) => { ui.bozza.costiExtra.splice(+el.dataset.k, 1); ridisegnaMantenendo(); };
  AZ['aggiungi-asporto'] = () => { (ui.bozza.asporto = ui.bozza.asporto || []).push({ rif: '', quantita: 1 }); ridisegnaMantenendo(); };
  AZ['togli-asporto'] = (el) => { ui.bozza.asporto.splice(+el.dataset.k, 1); ridisegnaMantenendo(); };
  AZ['salva-ricetta'] = () => { const b = salvaBozzaRicetta(); if (b) vai('#/ricetta/' + b.id); };
  // unità di una riga di ricetta: per i liquidi si può scegliere ml, dash o drop
  function unitaRiga(rg, k) {
    const u = M.unitaRif(rg.rif);
    if (u !== 'ml') return `<span class="u">${esc(u)}</span>`;
    return `<select class="u u-scelta" data-r="${k}" data-k="misura" aria-label="Misura">${[['', 'ml'], ['dash', 'dash'], ['drop', 'drop']].map(([v, t]) => `<option value="${v}" ${(rg.misura || '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  }
  const misuraTesto = (rg) => rg.misura && M.MISURE[rg.misura] ? ` ${rg.misura} <small class="tenue">(${String(Math.round(M.qtaRiga(rg) * 100) / 100).replace('.', ',')} ml)</small>` : '';
  function salvaBozzaRicetta() {
    const b = ui.bozza; if (!b.nome.trim()) { alert('Scrivi il nome.'); return null; }
    b.righe = b.righe.filter(rg => rg.rif).map(rg => { Object.assign(rg, { quantita: numDa(rg.quantita) || 0 }); if (!rg.misura || M.unitaRif(rg.rif) !== 'ml') delete rg.misura; return rg; });
    b.costiExtra = (b.costiExtra || []).filter(e => e.nome || e.costo).map(e => Object.assign(e, { costo: numDa(e.costo) || 0 }));
    b.asporto = (b.asporto || []).filter(a => a.rif).map(a => Object.assign(a, { quantita: numDa(a.quantita) || 1 }));
    b.prezzo = numDa(b.prezzo); b.resa = numDa(b.resa);
    const nuovo = b._per === 'r:nuovo'; delete b._per;
    const daRivedi = b._rivedi; delete b._rivedi; delete b._iniz;
    // salvare vuol dire «l'ho sistemata»: l'avviso automatico «Ricetta da completare…» se ne va
    if (/^Ricetta da completare/.test(b.note || '')) b.note = '';
    if (nuovo) S.ricette.push(b); else { const i = S.ricette.findIndex(r => r.id === b.id); if (i >= 0) S.ricette[i] = b; else S.ricette.push(b); }
    // la scelta dell'elenco (Tutte, Bar, un gruppo…) resta quella di prima: tornando indietro ritrovi l'elenco com'era
    if (nuovo && !daRivedi && !tipiScelti(ui.tipoRicette).includes(b.tipo)) ui.tipoRicette = b.tipo;
    ui.bozza = null; salva(); return b;
  }
  // ---------- Importa dalla cassa (Cassa in Cloud) ----------
  // Legge un file Excel (.xlsx) senza librerie esterne oltre a quella per gli zip: restituisce { nomeFoglio: righe[][] }
  async function leggiXlsx(file) {
    if (!window.JSZip) await caricaScript('jszip.min.js');
    const zip = await window.JSZip.loadAsync(file);
    const dp = new DOMParser();
    const xml = async (p) => { const f = zip.file(p); return f ? dp.parseFromString(await f.async('string'), 'application/xml') : null; };
    const tag = (n, t) => Array.from(n.getElementsByTagName(t));
    const ss = await xml('xl/sharedStrings.xml');
    const stringhe = ss ? tag(ss, 'si').map(si => tag(si, 't').map(t => t.textContent).join('')) : [];
    const wb = await xml('xl/workbook.xml'), rel = await xml('xl/_rels/workbook.xml.rels');
    if (!wb || !rel) throw new Error('Non sembra un file Excel (.xlsx).');
    const dest = {}; tag(rel, 'Relationship').forEach(r => { dest[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const colonna = (ref) => { let n = 0; for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    const fogli = {};
    for (const s of tag(wb, 'sheet')) {
      const t = dest[s.getAttribute('r:id')] || ''; const doc = await xml(t.startsWith('/') ? t.slice(1) : 'xl/' + t);
      if (!doc) continue;
      fogli[s.getAttribute('name').trim()] = tag(doc, 'row').map(r => {
        const riga = [];
        tag(r, 'c').forEach(c => {
          const tipo = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
          let val = v ? v.textContent : null;
          if (tipo === 's') val = stringhe[+val];
          else if (tipo === 'inlineStr') val = tag(c, 't').map(x => x.textContent).join('');
          else if (tipo === 'b') val = val === '1';
          else if (tipo !== 'str' && val != null && val !== '' && !isNaN(val)) val = Number(val);
          riga[colonna(c.getAttribute('r') || 'A')] = val;
        });
        return riga;
      });
    }
    return fogli;
  }
  const tabellaDa = (righe) => { if (!righe || !righe.length) return []; const h = righe[0].map(x => String(x == null ? '' : x).trim()); return righe.slice(1).filter(r => r.some(x => x != null && x !== '')).map(r => { const o = {}; h.forEach((k, i) => { o[k] = r[i]; }); return o; }); };
  const colDa = (o, inizio) => { const k = Object.keys(o).find(x => x.startsWith(inizio)); return k ? o[k] : undefined; };
  const normCassa = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').replace(/&/g, ' e ').replace(/\bpata\b/g, 'patatine').replace(/[^a-z0-9]+/g, ' ').trim();
  const bello = (t) => { const x = String(t || '').trim().toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); };
  const ricettaDiSku = (sku) => { const n = normCassa(sku); return S.ricette.find(r => r.tipo !== 'semilavorato' && ((r.nomeCassa && normCassa(r.nomeCassa) === n) || (r.aliasCassa || []).some(a => normCassa(a) === n))); };
  function somiglianzaNomi(a, b) {
    // «pata» (= con le patatine) resta un segno a parte: «Ninetynine + pata» non deve somigliare a «Patatine»
    const parole = (t) => normCassa(String(t || '').replace(/\bpata\b/gi, ' conpata ').replace(/\bgiraffe\b/gi, 'giraffa')).replace(/\b(base|drink)\b/g, ' ').split(' ').filter(x => x.length > 1);
    const A = parole(a), B = parole(b);
    if (!A.length || !B.length) return 0;
    if (A.join(' ') === B.join(' ')) return 1;
    // «+ pata» e le misure (doppio, piccola, media…) devono essere uguali: «Ciaccia + pata» non è «Ciaccia», «Bacon doppio» non è «Bacon + pata doppio»
    const SEGNI = ['conpata', 'doppio', 'triplo', 'piccola', 'media', 'grande', 'caraffa', 'giraffa', 'boccale', 'pinta', 'litro', 'asporto'];
    const segni = (L) => L.filter(x => SEGNI.includes(x)).sort().join(' ');
    if (segni(A) !== segni(B)) return 0;
    // tolti i segni, deve restare almeno una parola in comune («Ciaccia + pata doppio» non è «Chicken + pata doppio»)
    const nucleo = (L) => L.filter(x => !SEGNI.includes(x)), nA = nucleo(A), nB = nucleo(B);
    if (nA.length && nB.length && !nA.some(x => nB.includes(x))) return 0;
    const comuni = A.filter(x => B.includes(x)).length;
    // il nome più corto sta tutto dentro l'altro, e ne è almeno metà (es. «Centauro» e «Centauro (analcolico)»): quasi certo.
    // Una parola sola dentro un nome lungo no («Burrito» non è «Tequila (Burrito Fiestero)», «Amari» non è «Amari (Montenegro)»)
    if (comuni === Math.min(A.length, B.length) && comuni / Math.max(A.length, B.length) >= 0.5) return Math.max(0.65, comuni / Math.max(A.length, B.length));
    return comuni / Math.max(A.length, B.length);
  }
  // che tipo di ricetta è una categoria della cassa (dal nome, o dai prodotti che contiene se il nome manca)
  function tipoCategoria(nome, voci) {
    const n = String(nome || '').toUpperCase(), tutti = voci.map(v => v.sku.toUpperCase()).join(' | ');
    if (voci.filter(v => /\+ ?PATA/i.test(v.sku)).length >= voci.length / 2) return 'combo';
    if (/COCKTAIL/.test(n)) return 'drink';
    if (/BURGER/.test(n)) return 'panino';
    if (/SPIZZICARE|FRITT/.test(n)) return 'fritto';
    if (/DESSERT|DOLC/.test(n)) return 'dolce';
    if (/SALSE|INSALAT|COPERT/.test(n)) return 'altro';
    if (/BIBITE|BEVANDE|BIRR|VINI|CAFFETTERIA|TISANA|ACQUA/.test(n)) return 'bevanda';
    if (/ - (PICCOLA|MEDIA|PINTA|MEZZA PINTA|CARAFFA|BOCCALE)/.test(tutti)) return 'bevanda';
    if (/\bACQUA\b|MEZZA (NAT|GAS)/.test(tutti)) return 'bevanda';
    if (/\bZERO\b/.test(tutti)) return 'drink';
    if (/\b(RUM|WHISKE?Y|AMARI|TEQUILA|VERMOUTH)\b/.test(tutti)) return 'drink';
    return 'salta';
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  function preparaListino(fogli) {
    const P = tabellaDa(fogli['Prodotti']), V = tabellaDa(fogli['Varianti']), C = tabellaDa(fogli['Categorie']);
    // le categorie della cassa (codice → nome): me le ricordo, così servono anche con un file del listino senza categorie
    if (C.length) {
      S.categorieCassa = Object.assign({}, S.categorieCassa || {});
      C.forEach(c => { const id = String(c['ID'] == null ? '' : c['ID']).trim(), nome = String(c['Descrizione'] || '').trim(); if (id && nome) S.categorieCassa[id] = nome; });
      salva();
    }
    const mappaCat = S.categorieCassa || {};
    if (!P.length) {
      if (C.length) return { soloCategorie: C.length, gruppi: [] };
      throw new Error('Nel file non trovo il foglio «Prodotti»: serve l\'esportazione del listino di Cassa in Cloud.');
    }
    const varDi = {}; V.forEach(v => { (varDi[v['Prodotto']] = varDi[v['Prodotto']] || []).push(v); });
    const perCat = {};
    P.forEach(p => {
      const desc = String(p['Descrizione'] || '').trim(); if (!desc) return;
      // il coperto ha un costo (tovagliette, tovaglioli, pane…): diventa una ricetta come le altre
      const grezza = String(p['Categoria'] == null ? '' : p['Categoria']).trim();
      let cat = (mappaCat[grezza] || (UUID.test(grezza) ? '' : grezza)).toUpperCase();
      if (!cat) cat = /^coperto$/i.test(desc) ? 'COPERTI' : UUID.test(grezza) ? grezza : 'SENZA CATEGORIA';
      const vv = varDi[p['ID']] || [];
      // varianti che sono solo «quanti bicchieri» (vino, acqua): stessa ricetta del prodotto
      const soloBicchieri = (et) => /^(NO )?BICC\.?\s*\d*$|^\d+$/i.test(et);
      const voci = [], alias = [];
      vv.forEach(v => {
        const sku = String(colDa(v, 'Descrizione (default') || desc).trim();
        const k = sku.lastIndexOf(' - ');
        const variante = k > 0 ? sku.slice(k + 3).trim() : '', base = k > 0 ? sku.slice(0, k).trim() : sku;
        if (soloBicchieri(variante)) { alias.push(sku); return; }
        voci.push({ sku, prodotto: base, variante, prezzo: Number(v['Prezzo Base']) || 0, alias: [] });
      });
      if (!vv.length || alias.length) voci.unshift({ sku: desc, prodotto: desc, variante: '', prezzo: Number(p['Prezzo Base']) || 0, alias });
      (perCat[cat] = perCat[cat] || []).push(...voci);
    });
    const senzaNomi = Object.keys(perCat).filter(c => UUID.test(c)).length;
    const gruppi = Object.entries(perCat).map(([cat, voci]) => {
      const ignoto = UUID.test(cat), guess = tipoCategoria(ignoto ? '' : cat, voci);
      const nome = ignoto ? 'Categoria senza nome: ' + voci.slice(0, 3).map(v => bello(v.sku)).join(', ') + '…' : bello(cat);
      // il gruppo nell'app è quello con lo stesso nome della categoria di cassa; se non c'è lo creo uguale
      const esiste = ignoto ? '' : Object.keys(M.TIPI).find(k => k !== 'semilavorato' && normCassa(M.TIPI[k]) === normCassa(nome));
      const tipo = guess === 'salta' ? 'salta' : esiste || (ignoto ? guess : '__nuovo');
      return { cat, nome, guess, reparto: ['drink', 'premium', 'bevanda'].includes(guess) || /BIRR|VIN|BIBIT|BEVAND|ACQUA|CAFF|TISAN|ANALCOL|DISTILL|COCKTAIL|BAR/.test(cat) ? 'bar' : 'cucina', tipo, voci };
    }).sort((a, b) => (a.tipo === 'salta') - (b.tipo === 'salta') || a.nome.localeCompare(b.nome));
    // proposta di collegamento: stesso nome di cassa già salvato, oppure nome simile (una ricetta per una voce sola)
    const usate = new Set(), proposte = [];
    gruppi.forEach((g, gi) => g.voci.forEach((v, vi) => {
      v.scelta = g.tipo === 'salta' || v.prezzo <= 0 || v.prezzo > 100 ? '__salta' : '';
      const gia = ricettaDiSku(v.sku) || v.alias.map(ricettaDiSku).find(Boolean); if (gia) { v.scelta = v.scelta === '__salta' && g.tipo === 'salta' ? '__salta' : gia.id; usate.add(gia.id); return; }
      const nomeBase = v.variante && !/^BASE$/i.test(v.variante) ? v.sku : v.prodotto;
      S.ricette.filter(r => r.tipo !== 'semilavorato').forEach(r => { const sc = somiglianzaNomi(nomeBase, r.nome); if (sc >= 0.6) proposte.push({ v, r, sc: sc + (r.tipo === g.tipo || r.tipo === g.guess ? 0.2 : 0) }); });
    }));
    proposte.sort((a, b) => b.sc - a.sc).forEach(({ v, r }) => { if (v.scelta === '' && !usate.has(r.id)) { v.scelta = r.id; usate.add(r.id); } });
    return { gruppi, senzaNomi };
  }
  function preparaVendite(fogli) {
    const nome = Object.keys(fogli).find(k => /venduto/i.test(k)) || Object.keys(fogli)[0];
    let tutte = fogli[nome] || [];
    // la riga dei titoli può non essere la prima: cerco quella con la colonna della quantità
    const qRe = /^(quantit[aà]|q\.?t[aà]|pezzi|venduti)$/i;
    const iTit = tutte.findIndex(r => (r || []).some(x => qRe.test(String(x == null ? '' : x).trim())));
    if (iTit < 0) throw new Error('Non trovo la colonna «Quantità». Serve il resoconto «Venduto per sku» di Cassa in Cloud, esportato in Excel.');
    const righe = tabellaDa(tutte.slice(iTit));
    const chiavi = Object.keys(righe[0] || {});
    const cNome = ['Sku', 'Prodotto', 'Descrizione', 'Articolo', 'Nome', 'Variante'].find(k => chiavi.includes(k)) || chiavi.find(k => /sku|prodott|descriz|articol/i.test(k));
    const cQ = chiavi.find(k => qRe.test(k)), cInc = chiavi.find(k => /^(incasso|totale|importo|venduto)/i.test(k));
    if (!cNome) throw new Error('Non trovo la colonna con il nome dei prodotti (colonne trovate: ' + chiavi.join(', ') + ').');
    ui.ccPerProdotto = cNome !== 'Sku';
    const vendibili = S.ricette.filter(x => x.tipo !== 'semilavorato');
    const out = righe.map(r => {
      const sku = String(r[cNome] || '').trim(); const ric = ricettaDiSku(sku);
      if (ric) return { sku, q: Number(r[cQ]) || 0, incasso: Number(cInc ? r[cInc] : 0) || 0, scelta: ric.id };
      // nessun collegamento già noto: propongo la ricetta col nome più simile (es. «AMARI - MONTENEGRO» → «Montenegro»), da controllare
      const k = sku.lastIndexOf(' - '), variante = k > 0 ? sku.slice(k + 3) : '';
      let best = null, punti = 0;
      vendibili.forEach(x => { const sc = Math.max(somiglianzaNomi(sku, x.nome), variante ? somiglianzaNomi(variante, x.nome) - 0.05 : 0); if (sc > punti) { punti = sc; best = x; } });
      return { sku, q: Number(r[cQ]) || 0, incasso: Number(cInc ? r[cInc] : 0) || 0, scelta: punti >= 0.65 ? best.id : '', proposta: punti >= 0.65 };
    }).filter(r => r.sku && !/^tot(ale)?$/i.test(r.sku));
    if (!out.length) throw new Error('nel file non trovo righe con un nome e una quantità (colonne trovate: ' + chiavi.join(', ') + '). Mandalo a Claude così lo sistemo.');
    return out;
  }
  async function caricaCassa(file, tipo) {
    try {
      const fogli = await leggiXlsx(file);
      if (tipo === 'listino') ui.ccListino = preparaListino(fogli);
      else { ui.ccVendite = preparaVendite(fogli); ui.ccFileVendite = file.name; }
      ridisegnaMantenendo();
    } catch (e) { alert('Non riesco a leggere il file: ' + e.message); }
  }
  const opzioniRicette = (sel, tipo) => {
    const l = S.ricette.filter(r => r.tipo !== 'semilavorato').sort((a, b) => (b.tipo === tipo) - (a.tipo === tipo) || a.nome.localeCompare(b.nome));
    return l.map(r => `<option value="${r.id}" ${sel === r.id ? 'selected' : ''}>${esc(r.nome)} · ${esc(M.TIPI_SINGOLARE[r.tipo] || r.tipo)}</option>`).join('');
  };
  PAGINE.importa = function () {
    const L = ui.ccListino, Vd = ui.ccVendite;
    let listino = `<div class="card form"><h3>1. Listino dei prodotti in vendita</h3>
      <p class="tenue piccolo">In Cassa in Cloud: esporta il listino (il file Excel con i fogli «Prodotti» e «Varianti»). Ogni prodotto e ogni variante (piccola, media, doppio…) diventa una ricetta: se esiste già le aggiorno il prezzo, se no la creo vuota e gli ingredienti li metti tu. Le ricette vanno nei gruppi con gli stessi nomi delle categorie della cassa: per i nomi serve anche l'esportazione delle <b>categorie</b> (puoi caricarla qui, prima o dopo).</p>
      <label class="btn">Scegli il file del listino<input type="file" accept=".xlsx" data-carica="cassa-listino" hidden></label></div>`;
    const nCat = Object.keys(S.categorieCassa || {}).length;
    if (nCat) listino = listino.replace('<label class="btn">Scegli il file del listino', `<p class="tenue piccolo">Categorie della cassa che conosco: <b>${nCat}</b>. Se in cassa ne aggiungi o rinomini, esporta di nuovo anche le categorie e caricale qui.</p><label class="btn">Scegli il file del listino`);
    if (L && L.soloCategorie) {
      listino += `<div class="card evidenza"><h3>Categorie della cassa salvate</h3><p>Ho letto <b>${L.soloCategorie}</b> categorie e me le ricordo. In questo file però non ci sono i prodotti: ora scegli qui sopra il file del listino (con i fogli «Prodotti» e «Varianti») e metto ogni ricetta nella sua categoria.</p>
        <div class="bottoni"><button class="btn" data-az="cc-listino-annulla">Chiudi</button></div></div>`;
    } else if (L) {
      let nuove = 0, agg = 0, salta = 0;
      L.gruppi.forEach(g => g.voci.forEach(v => { if (g.tipo === 'salta' || v.scelta === '__salta') salta++; else if (v.scelta) agg++; else nuove++; }));
      listino += `<div class="card evidenza"><h3>Anteprima del listino</h3><p>Creo <b>${nuove}</b> ricette nuove, collego <b>${agg}</b> a ricette che ci sono già (aggiornando il prezzo), salto <b>${salta}</b> voci.</p>
        <p class="tenue piccolo">Ogni categoria della cassa diventa un gruppo di ricette con lo stesso nome, e le ricette che ci sono già si spostano nel gruppo della loro categoria. I gruppi vecchi che restano vuoti spariscono; le preparazioni restano dove sono. Per ogni categoria puoi scegliere un altro gruppo o «Non importare», e riga per riga puoi cambiare il collegamento.</p>
        ${L.senzaNomi ? `<p class="msg giallo">${L.senzaNomi} categorie hanno solo il codice, senza nome. In Cassa in Cloud esporta anche le <b>categorie</b> e carica qui quel file: poi ricarica il listino.</p>` : ''}
        <div class="bottoni"><button class="btn primario" data-az="cc-listino-ok">Importa il listino</button><button class="btn" data-az="cc-listino-annulla">Annulla</button></div></div>` +
        L.gruppi.map((g, gi) => `<details class="card" ${ui.ccAperto === gi ? 'open' : ''}><summary><b>${esc(g.nome)}</b> · ${g.voci.length} voci · <span class="${g.tipo === 'salta' ? 'tenue' : ''}">${g.tipo === 'salta' ? 'non importata' : g.tipo === '__nuovo' ? 'gruppo nuovo, uguale alla cassa' : 'nel gruppo «' + esc(M.TIPI[g.tipo]) + '»'}</span></summary>
          <label>Gruppo nell'app<select data-cc-g="${gi}">${UUID.test(g.cat) ? '' : `<option value="__nuovo" ${g.tipo === '__nuovo' ? 'selected' : ''}>Gruppo nuovo «${esc(g.nome)}», come in cassa</option>`}<option value="salta" ${g.tipo === 'salta' ? 'selected' : ''}>Non importare</option><optgroup label="Un gruppo che c'è già">${Object.entries(M.TIPI).filter(([k]) => k !== 'semilavorato').map(([k, v]) => `<option value="${k}" ${g.tipo === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</optgroup></select></label>
          ${g.tipo === 'salta' ? '' : g.voci.map((v, vi) => { const r = v.scelta && v.scelta !== '__salta' ? M.ricetta(v.scelta) : null; return `<div class="riga-ed cc-riga"><span>${esc(v.sku)}<small>${euro(v.prezzo)}${r && r.prezzo && Math.abs(r.prezzo - v.prezzo) > 0.005 ? ` · ora ${euro(r.prezzo)}` : ''}</small></span>
            <select data-cc-v="${gi},${vi}"><option value="">＋ Ricetta nuova</option><option value="__salta" ${v.scelta === '__salta' ? 'selected' : ''}>Non importare</option><optgroup label="Collega a una ricetta che c'è già">${opzioniRicette(v.scelta, g.tipo)}</optgroup></select></div>`; }).join('')}
        </details>`).join('');
    }
    let vendite = `<div class="card form"><h3>2. Vendite di un periodo</h3>
      <p class="tenue piccolo">In Cassa in Cloud: resoconto «Venduto per sku» del periodo, esportato in Excel. Scegli prima le date (nel file non ci sono).</p>
      <div class="due"><label>Dal<input type="date" data-cc-data="dal" value="${esc(ui.ccDal || '')}"></label><label>Al<input type="date" data-cc-data="al" value="${esc(ui.ccAl || '')}"></label></div>
      <label class="btn">Scegli il file delle vendite<input type="file" accept=".xlsx" data-carica="cassa-vendite" hidden></label></div>`;
    if (Vd) {
      const coll = Vd.filter(v => v.scelta && v.scelta !== '__salta'), non = Vd.filter(v => !v.scelta || v.scelta === '__nuova'), prop = Vd.filter(v => v.proposta && v.scelta);
      const pezzi = coll.reduce((s, v) => s + v.q, 0), tot = Vd.reduce((s, v) => s + v.q, 0), inc = Vd.reduce((s, v) => s + v.incasso, 0);
      const nome = ui.ccDal && ui.ccAl ? nomeDaDate(ui.ccDal, ui.ccAl) : '';
      vendite += `<div class="card evidenza"><h3>Anteprima delle vendite${ui.ccFileVendite ? ' · ' + esc(ui.ccFileVendite) : ''}</h3>
        ${ui.ccPerProdotto ? '<p class="msg giallo">Questo file è il venduto <b>per prodotto</b>: le varianti (piccola, media, doppio…) sono sommate insieme e non si possono dividere. Meglio esportare il resoconto <b>«Venduto per sku»</b>.</p>' : ''}
        <p>${Vd.length} voci, ${qta(tot)} pezzi, incasso ${euro(inc, 0)}. Collegate a una ricetta: <b>${coll.length}</b> voci (${qta(pezzi)} pezzi). Senza ricetta: <b>${non.length}</b>.</p>
        ${nome ? `<p>Periodo: <b>${esc(nome)}</b>${S.periodiVendita.includes(nome) ? ' (esiste già: sostituisco i numeri)' : ''}</p>` : '<p class="msg giallo">Scegli le date «Dal» e «Al» qui sopra: la data grigia che vedi è solo un suggerimento, il campo è ancora vuoto.</p>'}
        <div class="bottoni"><button class="btn primario" data-az="cc-vendite-ok">Salva le vendite</button><button class="btn" data-az="cc-vendite-annulla">Annulla</button></div></div>
        ${prop.length ? `<div class="card"><h3>Collegate per nome simile: controlla (${prop.length})</h3><p class="tenue piccolo">Queste voci della cassa non erano mai state collegate: ho scelto la ricetta col nome più simile. Se è sbagliata cambiala; salvando me le ricordo per le prossime volte.</p>
          ${Vd.map((v, i) => v.proposta && v.scelta ? `<div class="riga-ed cc-riga"><span>${esc(v.sku)}<small>${qta(v.q)} pezzi · ${euro(v.incasso, 0)}</small></span><select data-cc-vv="${i}"><option value="">Lascia fuori</option><option value="__nuova">＋ Ricetta nuova con questo nome</option>${opzioniRicette(v.scelta, '')}</select></div>` : '').join('')}</div>` : ''}
        ${non.length ? `<div class="card"><h3>Voci senza ricetta (${non.length})</h3><p class="tenue piccolo">Se una di queste è una ricetta con un altro nome, collegala: me lo ricordo per le prossime volte. Le altre (coperto, consegne…) restano fuori.</p>
          ${Vd.map((v, i) => v.scelta && v.scelta !== '__nuova' ? '' : `<div class="riga-ed cc-riga"><span>${esc(v.sku)}<small>${qta(v.q)} pezzi · ${euro(v.incasso, 0)}</small></span><select data-cc-vv="${i}"><option value="">Lascia fuori</option><option value="__nuova" ${v.scelta === '__nuova' ? 'selected' : ''}>＋ Ricetta nuova con questo nome</option>${opzioniRicette('', '')}</select></div>`).join('')}</div>` : ''}`;
    }
    const tipoL = ui.lsTipo || 'semilavorato';
    let lista = `<div class="card form"><h3>3. Ricette da una lista scritta</h3>
      <p class="tenue piccolo">Scrivi (o incolla) una riga per ricetta: il nome, due punti, gli ingredienti separati da virgole. Le dosi sono facoltative, e anche gli ingredienti: una riga con il solo nome crea la ricetta vuota, da completare dopo.<br>Esempio: <i>Cipolle stufate: cipolla affettata 3 kg, olio 200 ml, paprika</i></p>
      <label>Diventano<select data-ls-tipo="1">${Object.entries(M.TIPI).map(([k, v]) => `<option value="${k}" ${tipoL === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      ${tipoL === 'semilavorato' ? `<label>Reparto delle preparazioni<select data-ls-rep="1"><option value="" ${!ui.lsRep ? 'selected' : ''}>Scegli…</option><option value="bar" ${ui.lsRep === 'bar' ? 'selected' : ''}>Bar</option><option value="cucina" ${ui.lsRep === 'cucina' ? 'selected' : ''}>Cucina</option></select></label>` : ''}
      <textarea id="ls-testo" rows="6" placeholder="Cipolle stufate: cipolla, olio, paprika&#10;Salsa del Repub: maionese, senape, paprika">${esc(ui.lsTesto || '')}</textarea>
      <div class="bottoni"><button class="btn" data-az="ls-leggi">Leggi la lista</button></div></div>`;
    if (ui.lsAnte) {
      const nIngr = ui.lsAnte.reduce((s, x) => s + x.ingr.length, 0), nOk = ui.lsAnte.reduce((s, x) => s + x.ingr.filter(i => i.rif).length, 0);
      lista += `<div class="card evidenza"><h3>Anteprima: ${ui.lsAnte.length} ricette, ${nOk} ingredienti su ${nIngr} trovati</h3>
        <p class="tenue piccolo">Controlla che ogni ingrediente sia il prodotto giusto. Quelli non trovati restano scritti nelle note: li aggiungi tu quando arriva la fattura.</p>
        <div class="bottoni"><button class="btn primario" data-az="ls-crea">Crea le ricette</button><button class="btn" data-az="ls-annulla">Annulla</button></div></div>` +
        ui.lsAnte.map((x, i) => `<div class="card"><h3>${esc(x.nome)}${x.gia ? ' <span class="badge giallo">esiste già: la salto</span>' : ''}</h3>
          ${x.ingr.map((g, j) => `<div class="riga-ed cc-riga"><span>${esc(g.testo)}${g.q ? `<small>${qta(g.q)} ${esc(g.u || '')}</small>` : ''}</span><select data-ls="${i},${j}"><option value="">Non trovato: lo metto nelle note</option>${opzioniRif(g.rif)}</select></div>`).join('')}</div>`).join('');
    }
    return { titolo: 'Importa dati', indietro: '#/impostazioni', html: listino + vendite + lista + sezioneListino() };
  };
  AZ['ls-leggi'] = () => { ui.lsTesto = $('#ls-testo').value; ui.lsAnte = leggiListaRicette(ui.lsTesto); if (!ui.lsAnte.length) { alert('Non trovo righe del tipo «Nome: ingrediente, ingrediente».'); ui.lsAnte = null; } ridisegnaMantenendo(); };
  AZ['ls-annulla'] = () => { ui.lsAnte = null; ridisegnaMantenendo(); };
  AZ['ls-crea'] = () => {
    const tipo = ui.lsTipo || 'semilavorato'; let n = 0;
    if (tipo === 'semilavorato' && !ui.lsRep) { alert('Scegli se le preparazioni sono del bar o della cucina.'); return; }
    ui.lsAnte.forEach(x => {
      if (x.gia) return;
      const righe = x.ingr.filter(g => g.rif).map(g => ({ rif: g.rif, quantita: g.q || 0, nota: '' }));
      const mancano = x.ingr.filter(g => !g.rif).map(g => g.testo);
      S.ricette.push({ id: M.uid('r'), nome: x.nome, tipo, ...(tipo === 'semilavorato' ? { reparto: ui.lsRep } : {}), prezzo: null, righe, resa: null, unita: 'g', asporto: [], costiExtra: [], vendite: {},
        note: 'Ricetta da completare: mancano le dosi' + (tipo === 'semilavorato' ? ' e quanto ne viene' : '') + '.' + (mancano.length ? ' Ingredienti da aggiungere: ' + mancano.join(', ') + '.' : '') });
      n++;
    });
    ui.lsAnte = null; ui.lsTesto = ''; ui.tipoRicette = tipo; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0);
    avviso(`Create ${n} ricette in «${M.TIPI[tipo]}»${tipo === 'semilavorato' ? ' (' + (ui.lsRep === 'bar' ? 'bar' : 'cucina') + ')' : ''}. Le trovi con «ingredienti incompleti».`);
  };
  AZ['cc-listino-annulla'] = () => { ui.ccListino = null; ridisegnaMantenendo(); };
  AZ['cc-vendite-annulla'] = () => { ui.ccVendite = null; ridisegnaMantenendo(); };
  AZ['cc-listino-ok'] = () => {
    const L = ui.ccListino; let nuove = 0, agg = 0, spostate = 0, gruppiNuovi = 0;
    const baseVecchi = Object.keys(M.TIPI).filter(k => k !== 'semilavorato' && !(S.tipiExtra || []).some(t => t.id === k));
    L.gruppi.forEach(g => {
      if (g.tipo !== '__nuovo') { g.dest = g.tipo; return; }
      const gia = Object.keys(M.TIPI).find(k => k !== 'semilavorato' && normCassa(M.TIPI[k]) === normCassa(g.nome));
      if (gia) { g.dest = gia; return; }
      if (!g.voci.some(v => v.scelta !== '__salta')) { g.dest = 'salta'; return; }
      const id = 't_' + normCassa(g.nome).replace(/ /g, '_').slice(0, 20) + '_' + Math.random().toString(36).slice(2, 5);
      S.tipiExtra = (S.tipiExtra || []).concat({ id, nome: g.nome, reparto: g.reparto, cassa: g.cat });
      S.impostazioni.soglie[id] = S.impostazioni.soglie[id] || 3.5; M.aggiornaTipi(); g.dest = id; gruppiNuovi++;
    });
    L.gruppi.forEach(g => { if (g.dest === 'salta') return; g.voci.forEach(v => {
      if (v.scelta === '__salta') return;
      if (v.scelta) {
        const r = M.ricetta(v.scelta); if (!r) return;
        if (r.tipo !== 'semilavorato' && r.tipo !== g.dest) { r.tipo = g.dest; spostate++; }
        if (!UUID.test(g.cat)) r.catCassa = g.nome;
        if (!r.nomeCassa) r.nomeCassa = v.sku; else if (normCassa(r.nomeCassa) !== normCassa(v.sku)) r.aliasCassa = Array.from(new Set((r.aliasCassa || []).concat(v.sku)));
        if (v.alias.length) r.aliasCassa = Array.from(new Set((r.aliasCassa || []).concat(v.alias)));
        if (v.prezzo > 0) r.prezzo = v.prezzo; agg++;
      } else {
        const nome = v.variante && !/^BASE$/i.test(v.variante) ? bello(v.prodotto) + ' (' + v.variante.toLowerCase() + ')' : bello(v.prodotto);
        S.ricette.push({ id: M.uid('r'), nome, tipo: g.dest, catCassa: UUID.test(g.cat) ? undefined : g.nome, prezzo: v.prezzo || null, righe: [], resa: null, unita: 'ml', asporto: [], costiExtra: [], vendite: {}, nomeCassa: v.sku, daCassa: true,
          aliasCassa: v.alias.length ? v.alias.slice() : undefined, note: 'Ricetta da completare: creata dal listino della cassa, mancano gli ingredienti.' });
        nuove++;
      }
    }); });
    // i gruppi di base rimasti vuoti spariscono (si possono ricreare in Ricette › Gruppi)
    let tolti = 0;
    if (gruppiNuovi || L.gruppi.some(g => g.tipo === '__nuovo')) baseVecchi.forEach(k => { if (!S.ricette.some(r => r.tipo === k)) { S.tipiNascosti = Array.from(new Set((S.tipiNascosti || []).concat(k))); tolti++; } });
    M.aggiornaTipi(); if (!M.TIPI[ui.tipoRicette] && !SCELTE_REP[ui.tipoRicette]) ui.tipoRicette = '*tutto';
    ui.ccListino = null; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0);
    avviso(`Fatto: ${nuove} ricette nuove, ${agg} aggiornate${spostate ? `, ${spostate} spostate nella categoria della cassa` : ''}${gruppiNuovi ? `, ${gruppiNuovi} gruppi nuovi` : ''}${tolti ? `, ${tolti} gruppi vecchi vuoti tolti` : ''}.`);
  };
  // voce della cassa senza ricetta: la creo con il nome della cassa, nel gruppo della ricetta più simile (poi la sposti se serve)
  function ricettaDaVoceCassa(v) {
    const gia = ricettaDiSku(v.sku); if (gia) return gia;
    const k = v.sku.lastIndexOf(' - '), base = k > 0 ? v.sku.slice(0, k) : v.sku, var_ = k > 0 ? v.sku.slice(k + 3) : '';
    const bello = (t) => t.toLowerCase().replace(/\s*\+\s*/g, ' + ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
    const nome = bello(base) + (var_ && !/^base$/i.test(var_) ? ' (' + var_.toLowerCase() + ')' : '');
    let tipo = 'altro', punti = 0;
    const parole = normCassa(base).split(' ').filter(x => x.length > 2);
    S.ricette.forEach(x => { if (x.tipo === 'semilavorato') return; const B = normCassa(x.nome).split(' '); const sc = parole.filter(w => B.includes(w)).length + (/\bpata\b/.test(normCassa(v.sku)) === /\bpata\b/.test(normCassa(x.nomeCassa || x.nome)) ? 0.5 : 0); if (sc > punti) { punti = sc; tipo = x.tipo; } });
    const r = { id: M.uid('r'), nome, tipo, nomeCassa: v.sku, prezzo: v.q && v.incasso ? Math.round(v.incasso / v.q * 2) / 2 : null, righe: [], asporto: [], vendite: {}, costiExtra: [], note: 'Ricetta da completare: creata dalla vendita della cassa «' + v.sku + '». Metti gli ingredienti e controlla gruppo e prezzo.' };
    S.ricette.push(r); return r;
  }
  AZ['cc-vendite-ok'] = () => {
    const Vd = ui.ccVendite;
    if (!ui.ccDal || !ui.ccAl) { alert('Prima scegli le date «Dal» e «Al» del periodo.'); return; }
    if (ui.ccAl < ui.ccDal) { alert('La data «Al» è prima di «Dal».'); return; }
    const nome = nomeDaDate(ui.ccDal, ui.ccAl); if (!nome) return;
    if (S.periodiVendita.includes(nome) && !confirm(`Il periodo «${nome}» esiste già: sostituisco i suoi numeri con quelli della cassa?`)) return;
    if (!S.periodiVendita.includes(nome)) {
      const nuovo = { dal: ui.ccDal, al: ui.ccAl }, altri = S.periodiVendita.map(p => ({ p, x: dateDiPeriodo(p) })).filter(a => a.x);
      const parz = altri.filter(a => a.x.dal <= nuovo.al && nuovo.dal <= a.x.al && !((a.x.dal <= nuovo.dal && a.x.al >= nuovo.al) || (nuovo.dal <= a.x.dal && nuovo.al >= a.x.al)));
      const contiene = altri.filter(a => nuovo.dal <= a.x.dal && nuovo.al >= a.x.al), dentroA = altri.filter(a => a.x.dal <= nuovo.dal && a.x.al >= nuovo.al);
      if (parz.length && !confirm(`Attenzione: queste date si accavallano in parte con ${parz.map(a => '«' + a.p + '»').join(', ')}.\n\nI giorni in comune verrebbero contati due volte quando guardi insieme i due periodi. Meglio caricare file con date che non si accavallano (per esempio un file per mese).\n\nCarico lo stesso?`)) return;
      if (!parz.length && (contiene.length || dentroA.length)) alert(`Nessun doppione: ${contiene.length ? `questo periodo contiene già ${contiene.map(a => '«' + a.p + '»').join(', ')}` : `questo periodo sta dentro «${dentroA[0].p}»`}. In «Tutto» conto solo il periodo più grande; per un anno o per delle date uso solo i periodi che ci stanno dentro per intero.`);
    }
    if (!S.periodiVendita.includes(nome)) S.periodiVendita.push(nome);
    S.periodiDate = S.periodiDate || {}; S.periodiDate[nome] = { dal: ui.ccDal, al: ui.ccAl };
    S.ricette.forEach(r => { if (r.vendite) delete r.vendite[nome]; });
    let n = 0;
    Vd.forEach(v => {
      if (!v.scelta || v.scelta === '__salta' || !v.q) return;
      if (v.scelta === '__nuova') v.scelta = ricettaDaVoceCassa(v).id;
      const r = M.ricetta(v.scelta); if (!r) return;
      r.vendite = r.vendite || {}; r.vendite[nome] = (r.vendite[nome] || 0) + v.q; n++;
      // collegamento fatto a mano: me lo ricordo
      if (!(r.nomeCassa && normCassa(r.nomeCassa) === normCassa(v.sku)) && !(r.aliasCassa || []).some(a => normCassa(a) === normCassa(v.sku))) r.aliasCassa = (r.aliasCassa || []).concat(v.sku);
    });
    S.periodiCassa[nome] = { incasso: Math.round(Vd.reduce((s, v) => s + v.incasso, 0) * 100) / 100, pezzi: Vd.reduce((s, v) => s + v.q, 0) };
    ui.ccVendite = null; ui.vendPer = nome; salva(); avviso(`Vendite salvate: ${n} voci nel periodo «${nome}».`); vai('#/vendite');
  };
  AZ['pan-per'] = (el) => { ui.panSel = { tipo: 'periodo', per: el.dataset.v }; ridisegnaMantenendo(); };
  AZ['pan-sel'] = (el) => {
    const t = el.dataset.tipo, prima = ui.panSel || {};
    ui.panSel = t === 'periodo' ? { tipo: t, per: el.dataset.v } : t === 'anno' ? { tipo: t, anno: el.dataset.v } : t === 'date' ? { tipo: t, dal: prima.dal || '', al: prima.al || '' } : { tipo: t };
    ridisegnaMantenendo();
  };
  AZ['pan-gruppo'] = (el) => { ui.panGruppo = el.dataset.v; ridisegnaMantenendo(); };
  AZ['pan-cat'] = (el) => { const k = el.dataset.v, l = ui.panCat || []; ui.panCat = l.includes(k) ? l.filter(x => x !== k) : l.concat(k); ridisegnaMantenendo(); };
  AZ['pan-cat-via'] = () => { ui.panCat = []; ridisegnaMantenendo(); };
  AZ['pan-mappa'] = () => {}; // la mappa usa la stessa scelta del pannello
  AZ['pan-completa'] = () => {
    // il tipo con più vendite da completare: «Rivedi» con filtro incomplete, dalle più vendute, in quel periodo
    const pers = selezionePannello().pers, per = pers[pers.length - 1];
    const tg = tipiPannello(), tipi = Array.isArray(tg) ? tg : GRUPPI_MENU[tg];
    const conta = {}; S.ricette.forEach(r => { if (r.tipo !== 'semilavorato' && (!tipi || tipi.includes(r.tipo)) && !completa(r) && (r.vendite || {})[per]) conta[r.tipo] = (conta[r.tipo] || 0) + r.vendite[per]; });
    const tipo = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0] || 'panino';
    ui.tipoRicette = tipo; ui.rivFiltro = 'incomplete'; ui.rivOrdine = 'piu'; ui.rivPer = per; ui.filtroRicette = ''; ui.rivIdx = 0; ui.rivStorico = []; ui.rivFisso = null; ui.bozza = null;
    vai('#/rivedi-ricette');
  };
  // ---------- Ricette da una lista scritta (es. le preparazioni della cucina) ----------
  // Una riga per ricetta: «Cipolle stufate: cipolla affettata 3000 g, olio 200 ml, paprika»
  function leggiListaRicette(testo) {
    const unita = { g: 'g', gr: 'g', grammi: 'g', kg: 'kg', ml: 'ml', cl: 'cl', l: 'l', lt: 'l', litri: 'l', pz: 'pz', pezzi: 'pz', pezzo: 'pz' };
    const fattore = { kg: 1000, cl: 10, l: 1000 };
    // una riga senza «:» è una ricetta con il solo nome: gli ingredienti li metti dopo
    return String(testo || '').split(/\n+/).map(r => r.trim()).filter(Boolean).map(r => r.includes(':') ? r : r + ':').map(r => {
      const k = r.indexOf(':'); const nome = r.slice(0, k).replace(/^[-•*\d.)\s]+/, '').trim();
      const ingr = r.slice(k + 1).split(/[,;]+/).map(x => x.trim()).filter(Boolean).map(x => {
        // «olio 200 ml», «200 ml olio», «paprika»
        let m = x.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/) || null, q = 0, u = '', n = x;
        if (m && (!m[3] || unita[m[3].toLowerCase()])) { n = m[1]; q = numDa(m[2]) || 0; u = m[3] ? unita[m[3].toLowerCase()] : ''; }
        else { m = x.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\s+(.*)$/); if (m && (!m[2] || unita[m[2].toLowerCase()])) { q = numDa(m[1]) || 0; u = m[2] ? unita[m[2].toLowerCase()] : ''; n = m[3]; } }
        if (fattore[u]) { q = q * fattore[u]; u = u === 'kg' ? 'g' : 'ml'; }
        n = n.replace(/^(di|del|della|dello|dei|delle)\s+/i, '').trim();
        // il prodotto o la preparazione che somiglia di più
        let migliore = null, punti = 0;
        S.prodotti.forEach(p => { const sc = Math.max(somiglianzaNomi(n, p.nomeBreve), somiglianzaNomi(n, p.nomeCompleto) - 0.05); if (sc > punti) { punti = sc; migliore = 'p:' + p.id; } });
        S.ricette.filter(x => x.tipo === 'semilavorato').forEach(x => { const sc = somiglianzaNomi(n, x.nome); if (sc > punti) { punti = sc; migliore = 'r:' + x.id; } });
        return { testo: x, nome: n, q, u, rif: punti >= 0.5 ? migliore : '' };
      });
      const gia = S.ricette.find(x => normCassa(x.nome) === normCassa(nome));
      return { nome, ingr, gia: gia ? gia.id : null };
    });
  }
  // ---------- Scegliere un ingrediente scrivendo (invece di scorrere un elenco lunghissimo) ----------
  function campoIngrediente(rg, k) {
    return `<div class="scegli-rif"><input class="cerca-rif" data-cr="${k}" autocomplete="off" value="${esc(rg.rif ? M.nomeRif(rg.rif) : '')}" placeholder="Scrivi per cercare: es. Guinness"><div class="sugg" id="sugg-${k}"></div></div>`;
  }
  function suggerimentiIngrediente(testo, escludiId) {
    const t = normCassa(testo); if (!t) return [];
    const parole = t.split(' ');
    const trova = (s) => { const n = normCassa(s); return parole.every(w => n.includes(w)); };
    const prod = S.prodotti.filter(p => trova(p.nomeBreve + ' ' + p.nomeCompleto + ' ' + (p.nomeFoglio || '') + ' ' + ((M.fornitore(p.fornitoreId) || {}).nome || '')))
      .map(p => { const f = M.fornitore(p.fornitoreId), pr = M.prezzo(p), rf = M.prezzoRiferimento(p);
        return { rif: 'p:' + p.id, nome: p.nomeBreve, inizia: normCassa(p.nomeBreve).startsWith(t),
          info: [f ? f.nome : '', p.nomeCompleto && normCassa(p.nomeCompleto) !== normCassa(p.nomeBreve) ? p.nomeCompleto : '', `${p.confezione} da ${qta(p.contenuto)} ${p.unita}`, pr != null ? euro(pr) : 'senza prezzo', rf ? n2(rf.valore) + ' ' + rf.etichetta : ''].filter(Boolean).join(' · ') }; });
    const ric = S.ricette.filter(r => r.id !== escludiId && trova(r.nome)).map(r => { const c = M.costo(r);
      return { rif: 'r:' + r.id, nome: r.nome, inizia: normCassa(r.nome).startsWith(t), info: (r.tipo === 'semilavorato' ? 'preparazione' : M.TIPI_SINGOLARE[r.tipo]) + (c != null && r.resa ? ' · ' + euro(c / r.resa * 1000) + (r.unita === 'g' ? ' al kg' : ' al litro') : c != null ? ' · ' + euro(c) : '') }; });
    return prod.concat(ric).sort((a, b) => (b.inizia - a.inizia) || a.nome.localeCompare(b.nome)).slice(0, 12);
  }
  function mostraSuggerimenti(el) {
    const k = el.dataset.cr, box = document.getElementById('sugg-' + k); if (!box) return;
    const l = suggerimentiIngrediente(el.value, ui.bozza && ui.bozza.id);
    box.innerHTML = l.length ? l.map((x, i) => `<button type="button" class="sugg-voce ${i === 0 ? 'primo' : ''}" data-az="scegli-rif" data-k="${k}" data-rif="${x.rif}"><b>${esc(x.nome)}</b><small>${esc(x.info)}</small></button>`).join('')
      : (el.value.trim() ? '<p class="tenue piccolo">Nessun prodotto con questo nome. Arriverà con la prossima fattura, oppure crealo in Prodotti.</p>' : '');
  }
  AZ['scegli-rif'] = (el) => {
    const k = +el.dataset.k; if (!ui.bozza || !ui.bozza.righe[k]) return;
    ui.bozza.righe[k].rif = el.dataset.rif; ridisegnaMantenendo();
    // subito pronto per scrivere la dose
    setTimeout(() => { const q = document.querySelector(`input[data-r="${k}"][data-k="quantita"]`); if (q) q.focus(); }, 30);
  };
  // ---------- Dal prodotto alle ricette: «questo fusto va nella Guinness piccola, media, pinta…» ----------
  function collegaARicette(p) {
    const gia = new Set(M.usatoIn('p:' + p.id).dirette.map(r => r.id));
    const cerca = ui.cpCerca && ui.cpProd === p.id ? ui.cpCerca : '';
    let l;
    if (cerca) { const t = normCassa(cerca).split(' '); l = S.ricette.filter(r => r.tipo !== 'semilavorato' && !gia.has(r.id) && t.every(w => normCassa(r.nome).includes(w))); }
    else {
      // proposte: ricette col nome simile al prodotto (es. tutte le «Guinness …»)
      const parole = normCassa(p.nomeBreve).split(' ').filter(w => w.length > 2);
      l = S.ricette.filter(r => r.tipo !== 'semilavorato' && !gia.has(r.id) && parole.length && parole.some(w => normCassa(r.nome).split(' ').includes(w)));
    }
    l = l.sort((a, b) => (a.righe || []).length - (b.righe || []).length || a.nome.localeCompare(b.nome)).slice(0, 15);
    return `<div class="card form"><h3>Mettilo nelle ricette</h3>
      <p class="tenue piccolo">Comodo per birre, bibite e vini: scrivi la dose (in ${esc(p.unita)}) e premi Aggiungi. Il costo della ricetta si calcola da solo.</p>
      <input class="cerca" type="search" placeholder="Cerca una ricetta…" value="${esc(cerca)}" data-cp-cerca="${p.id}">
      <div id="cp-lista">${l.length ? l.map(r => `<div class="riga-ed cc-riga"><span>${esc(r.nome)}<small>${r.prezzo ? 'prezzo ' + euro(r.prezzo) + ' · ' : ''}${(r.righe || []).length ? (r.righe || []).length + ' ingredienti' : 'nessun ingrediente'}</small></span>
        <input type="text" inputmode="decimal" class="senza-frecce" data-cp-dose="${r.id}" placeholder="dose"><span class="u">${esc(p.unita)}</span><button class="btn piccolo" data-az="cp-aggiungi" data-p="${p.id}" data-r="${r.id}">Aggiungi</button></div>`).join('')
        : `<p class="tenue">${cerca ? 'Nessuna ricetta con questo nome.' : 'Nessuna ricetta col nome simile: cercala qui sopra.'}</p>`}</div></div>`;
  }
  AZ['cp-aggiungi'] = (el) => {
    const p = M.prodotto(el.dataset.p), r = M.ricetta(el.dataset.r);
    const campo = document.querySelector(`[data-cp-dose="${r.id}"]`); const q = numDa(campo && campo.value);
    if (!q) { alert('Scrivi la dose (in ' + p.unita + ').'); if (campo) campo.focus(); return; }
    const vuota = !(r.righe || []).length;
    r.righe = (r.righe || []).concat({ rif: 'p:' + p.id, quantita: q, nota: '' });
    // bibite e birre: un ingrediente solo, la ricetta è completa
    if (vuota && r.tipo === 'bevanda' && /^Ricetta da completare/.test(r.note || '')) r.note = String(r.note).replace(/^Ricetta da completare[^.]*\.\s*/, '');
    M.svuota(); salva(); ridisegnaMantenendo();
    const i = M.indicatori(r); avviso(`${r.nome}: costo ${euro(i.costo)}${i.molt ? ' · × ' + n2(i.molt) : ''}`);
  };
  // ---------- Doppioni: lo stesso prodotto arrivato più volte (da fornitori diversi o scritto in modi diversi) ----------
  function principaleDi(l) {
    const usi = (p) => M.usatoIn('p:' + p.id).dirette.length;
    const ultima = (p) => (p.prezzi || []).reduce((m, e) => e.data > m ? e.data : m, '');
    return l.slice().sort((a, b) => usi(b) - usi(a) || (ultima(b) > ultima(a) ? 1 : -1))[0];
  }
  PAGINE.doppioni = function () {
    const gruppi = M.gruppiDoppioni().sort((a, b) => a[0].nomeBreve.localeCompare(b[0].nomeBreve));
    if (!gruppi.length) return { titolo: 'Doppioni', indietro: '#/prodotti', html: '<div class="card evidenza"><h3>Nessun doppione</h3><p>Non ci sono prodotti con lo stesso nome e lo stesso formato.</p></div>' };
    return { titolo: `Doppioni (${gruppi.length})`, indietro: '#/prodotti', html: `
      <div class="card"><p>Questi prodotti hanno lo stesso nome e lo stesso formato: quasi sempre sono la stessa cosa arrivata da fornitori diversi (es. Doreca Italia e Emilia Romagna Doreca) o scritta in modi diversi in fattura. Uniscili: resta un prodotto solo, con i prezzi di tutti, e le fatture future di ognuno finiscono lì.</p>
        <div class="bottoni"><button class="btn primario" data-az="dop-tutti">Unisci tutti i ${gruppi.length} gruppi</button></div></div>
      ${gruppi.map((l, i) => { const pr = principaleDi(l); return `<div class="card"><h3>${esc(pr.nomeBreve)} <small class="tenue">${esc(pr.confezione)} da ${qta(pr.contenuto)} ${esc(pr.unita)}</small></h3>
        ${l.map(p => { const f = M.fornitore(p.fornitoreId); const u = M.usatoIn('p:' + p.id).dirette.length; return `<a class="riga" href="#/prodotto/${p.id}"><span>${esc(f ? f.nome : 'senza fornitore')}<small>${esc(p.nomeCompleto)}${u ? ' · in ' + u + ' ricette' : ''}</small></span><span class="destra">${euro(M.prezzo(p))}${p === pr ? '<small>resta questo</small>' : ''}</span></a>`; }).join('')}
        <div class="bottoni"><button class="btn piccolo" data-az="dop-unisci" data-i="${i}">Unisci in uno</button><button class="btn piccolo" data-az="dop-no" data-ids="${l.map(p => p.id).join(',')}">Sono diversi</button></div></div>`; }).join('')}` };
  };
  function unisciGruppo(l) {
    const pr = principaleDi(l); let n = 0;
    l.forEach(p => { if (p !== pr && !M.unisciProdotti(p.id, pr.id)) n++; });
    delete pr.forseDoppioneDi; return n;
  }
  AZ['dop-unisci'] = (el) => { const g = M.gruppiDoppioni().sort((a, b) => a[0].nomeBreve.localeCompare(b[0].nomeBreve))[+el.dataset.i]; if (!g) return; unisciGruppo(g); salva(); ridisegnaMantenendo(); avviso('Uniti in un prodotto solo.'); };
  AZ['dop-tutti'] = () => { const gg = M.gruppiDoppioni(); if (!confirm(`Unisco ${gg.length} gruppi di doppioni?`)) return; let n = 0; gg.forEach(g => { n += unisciGruppo(g); }); salva(); ridisegnaMantenendo(); avviso(`Uniti ${n} doppioni.`); };
  AZ['dop-no'] = (el) => {
    // prodotti diversi con lo stesso nome: aggiungo il fornitore al nome breve, così non risultano più doppioni
    el.dataset.ids.split(',').map(M.prodotto).filter(Boolean).forEach((p, k) => { if (k > 0) { const f = M.fornitore(p.fornitoreId); p.nomeBreve = p.nomeBreve + ' ' + (f ? f.nome.split(' ')[0].toLowerCase() : k + 1); } });
    salva(); ridisegnaMantenendo();
  };
  // ---------- Prodotti del foglio: uno per uno, decidi cosa diventano ----------
  function listaFoglio() {
    const tenuti = new Set(S.foglioTenuti || []), filtro = ui.fgFiltro || 'dafare';
    const usi = (p) => M.usatoIn('p:' + p.id).dirette.length;
    let l = S.prodotti.filter(p => M.daFoglio(p) && (filtro === 'tutti' || p.id === ui.fgFisso || !tenuti.has(p.id)));
    if (filtro === 'usati') l = l.filter(usi);
    if (filtro === 'nonusati') l = l.filter(p => !usi(p));
    if (ui.fgForn) l = l.filter(p => p.fornitoreId === ui.fgForn || (ui.fgForn === '__nessuno' && !p.fornitoreId));
    return l.sort((a, b) => usi(b) - usi(a) || a.nomeBreve.localeCompare(b.nomeBreve));
  }
  // tutti i prodotti del foglio insieme: proposta dalle fatture, quante ricette li usano, e scelte in blocco
  function propostaFoglio(p, fatt) {
    const s0 = M.somiglianti(p, fatt)[0]; if (!s0) return null;
    const a = M.prezzoRiferimento(p), b = M.prezzoRiferimento(s0.p);
    const rapp = a && b && a.valore && b.valore ? b.valore / a.valore : null;
    // sicura: nome molto simile, stessa unità e prezzo al litro/chilo/pezzo non troppo diverso
    return { p: s0.p, punti: s0.punti, rapp, sicura: s0.punti >= 1 && s0.p.unita === p.unita && rapp != null && rapp > 0.5 && rapp < 1.8 };
  }
  function elencoFoglio(chips, tutti) {
    const l = listaFoglio(), fatt = S.prodotti.filter(x => M.daFattura(x)), sel = new Set(ui.fgSel || []);
    const righe = l.map(p => ({ p, uso: M.usatoIn('p:' + p.id).dirette.length, pr: propostaFoglio(p, fatt) }));
    ui.fgProposte = Object.fromEntries(righe.filter(x => x.pr).map(x => [x.p.id, x.pr.p.id]));
    const nSicure = righe.filter(x => x.pr && x.pr.sicura).length, nNonUsati = righe.filter(x => !x.uso).length;
    return { titolo: 'Prodotti del foglio · tutti insieme', indietro: '#/prodotti', html: chips + `
      <div class="card evidenza sposta-barra"><b>${l.length} prodotti del foglio in questo elenco · spuntati: <span data-fgsel-n>${sel.size}</span></b>
        <div class="bottoni">
          <button class="btn primario" data-az="fg-blocco-collega">Collega gli spuntati alla proposta</button>
          <button class="btn pericolo" data-az="fg-blocco-elimina">Elimina gli spuntati</button>
          <button class="btn" data-az="fg-spunta" data-v="sicure">Spunta le proposte sicure (${nSicure})</button>
          <button class="btn" data-az="fg-spunta" data-v="nonusati">Spunta i non usati (${nNonUsati})</button>
          <button class="btn" data-az="fg-spunta" data-v="tutti">Spunta tutti</button>
          ${sel.size ? '<button class="btn" data-az="fg-spunta" data-v="">Togli le spunte</button>' : ''}
          <button class="btn" data-az="fg-elenco" data-v="">Uno per uno</button>
        </div>
        <p class="tenue piccolo">«Collega» fa passare le ricette al prodotto delle fatture, che darà il prezzo giusto; il prodotto del foglio sparisce. «Elimina» lo mette nel Cestino: se era in qualche ricetta, lì l'ingrediente resta senza costo finché non lo cambi. Per scegliere un prodotto diverso dalla proposta tocca il nome e lo fai uno per uno.</p></div>
      <div class="card lista">${righe.length ? righe.map(({ p, uso, pr }) => {
        const a = M.prezzoRiferimento(p), on = sel.has(p.id);
        return `<div class="riga fg-riga ${on ? 'da-togliere' : ''}"><input type="checkbox" data-fgsel="${p.id}" ${on ? 'checked' : ''} aria-label="Spunta ${esc(p.nomeBreve)}">
          <span><button type="button" class="link-nome" data-az="fg-modifica" data-id="${p.id}"><b>${esc(p.nomeBreve)}</b> <span class="tenue piccolo">${ui.fgApri === p.id ? '▲ chiudi' : '✎ modifica'}</span></button><small>foglio: ${a ? euro(a.valore) + ' ' + a.etichetta.replace('€/', 'al ') : 'senza prezzo'} · ${uso ? `<b>in ${uso} ${uso === 1 ? 'ricetta' : 'ricette'}</b>` : 'in nessuna ricetta'}</small></span>
          <span class="fg-prop">${pr ? `<span class="${pr.sicura ? 'verde-t' : ''}">→ ${esc(pr.p.nomeBreve)}</span><small>${esc((M.fornitore(pr.p.fornitoreId) || {}).nome || '')} · ${(() => { const b = M.prezzoRiferimento(pr.p); return b ? euro(b.valore) + ' ' + b.etichetta.replace('€/', 'al ') : '—'; })()}${pr.rapp != null && (pr.rapp > 1.8 || pr.rapp < 0.5) ? ' · <b class="rosso-t">prezzo molto diverso</b>' : ''}</small>` : '<small class="tenue">nessuna proposta dalle fatture</small>'}</span></div>`
      + (ui.fgApri === p.id ? schedaFoglio(p, pr, uso) : ''); }).join('') : '<p class="tenue centro">Nessun prodotto del foglio in questo elenco.</p>'}</div>` };
  }
  // la scheda che si apre sotto la riga: nome, prezzo, scambio con un prodotto delle fatture, eliminazione
  function schedaFoglio(p, pr, uso) {
    const prezzo = M.prezzo(p);
    return `<div class="fg-scheda form">
      <div class="due"><label>Nome<input data-fgnome="${p.id}" value="${esc(p.nomeBreve)}" autocomplete="off"></label>
        <label>Prezzo della ${esc(p.confezione || 'confezione')} senza IVA (€)<input type="text" inputmode="decimal" autocomplete="off" data-fgprezzo="${p.id}" value="${prezzo != null ? n2(prezzo) : ''}"></label></div>
      <p class="tenue piccolo">Formato: ${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)}. <a href="#/modifica-prodotto/${p.id}">Cambia il formato</a></p>
      <p class="piccolo" style="margin:12px 0 4px"><b>Scambialo con un prodotto delle fatture</b> (le ricette passano a quello, e il prezzo lo faranno le fatture):</p>
      ${pr ? `<button class="btn scelta-lunga" data-az="fg-collega" data-da="${p.id}" data-a="${pr.p.id}"><b>È ${esc(pr.p.nomeBreve)}</b><small>${esc((M.fornitore(pr.p.fornitoreId) || {}).nome || '')} · ${esc(pr.p.nomeCompleto)} · ${descrPrezzo(pr.p)}</small></button>` : ''}
      <div class="scegli-rif"><input class="cerca-rif" data-fg-cerca="${p.id}" autocomplete="off" placeholder="Cerca tra i prodotti delle fatture: es. campari"><div class="sugg" id="sugg-fg"></div></div>
      <div class="bottoni"><button class="btn pericolo" data-az="fg-elimina-uno" data-id="${p.id}">Elimina${uso ? ` (è in ${uso} ${uso === 1 ? 'ricetta' : 'ricette'})` : ''}</button><button class="btn" data-az="fg-modifica" data-id="${p.id}">Chiudi</button></div>
    </div>`;
  }
  PAGINE.foglio = function () {
    const l = listaFoglio(), filtro = ui.fgFiltro || 'dafare';
    const tutti = S.prodotti.filter(p => M.daFoglio(p)), fatti = (S.foglioTenuti || []).filter(id => M.prodotto(id) && M.daFoglio(M.prodotto(id))).length;
    const fornF = {}; tutti.forEach(p => { const k = p.fornitoreId || '__nessuno'; fornF[k] = (fornF[k] || 0) + 1; });
    const chips = `<div class="chips">${[['dafare', 'Da decidere'], ['usati', 'Usati nelle ricette'], ['nonusati', 'Non usati'], ['tutti', 'Tutti (' + tutti.length + ')']].map(([k, v]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-az="fg-filtro" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="chips sotto"><button class="chip ${!ui.fgForn ? 'on' : ''}" data-az="fg-forn" data-v="">Tutti i fornitori</button>${Object.entries(fornF).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<button class="chip ${ui.fgForn === k ? 'on' : ''}" data-az="fg-forn" data-v="${k}">${esc(k === '__nessuno' ? 'Fatti da noi / senza fornitore' : (M.fornitore(k) || {}).nome || '?')} (${n})</button>`).join('')}</div>`;
    let chipsE = chips.replace('</div>', `<button class="chip ${ui.fgElenco ? 'on' : 'giallo'}" data-az="fg-elenco" data-v="${ui.fgElenco ? '' : '1'}">${ui.fgElenco ? '✓ Tutti insieme' : 'Vedi tutti insieme'}</button></div>`);
    const prov = S.ricette.filter(provvisoriaDaFoglio);
    const tenuti = (S.foglioTenuti || []).filter(id => M.prodotto(id) && M.daFoglio(M.prodotto(id))).length;
    const spiega = `<p class="tenue piccolo">Qui ci sono i prodotti che hanno ancora il prezzo del tuo foglio: ${tutti.length} in tutto${tenuti ? `, di cui ${tenuti} che avevi deciso di tenere (li vedi in «Tutti»)` : ''}. Non ci sono quelli già scambiati con un prodotto delle fatture (hanno tenuto il tuo nome, ma il prezzo lo fanno le fatture) né quelli col prezzo del listino di Zonzini.${prov.length ? ` Ci sono anche <a href="#/ricette" data-az="tipo-ricette" data-v="semilavorato">${prov.length} preparazioni</a> (blend, cordial…) che hanno ancora il costo provvisorio del foglio: per sistemarle metti i loro ingredienti.` : ''} In ogni ricetta, sotto ogni ingrediente, è scritto da dove viene il prezzo.</p>`;
    chipsE = chipsE + spiega;
    if (ui.fgElenco) return elencoFoglio(chipsE, tutti);
    if (!l.length) { return { titolo: 'Prodotti del foglio', indietro: '#/prodotti', html: chipsE + `<div class="card evidenza"><h3>Finito</h3><p>Nessun prodotto del foglio in questo elenco. Restano ${tutti.length} prodotti del foglio, di cui ${fatti} li hai tenuti apposta.</p></div>` }; }
    if (ui.fgIdx == null || ui.fgIdx >= l.length) ui.fgIdx = 0;
    const p = l[ui.fgIdx];
    const uso = M.usatoIn('p:' + p.id).dirette;
    const fatt = S.prodotti.filter(x => M.daFattura(x));
    const sim = M.somiglianti(p, fatt).slice(0, 3);
    const forn = M.fornitore(p.fornitoreId);
    return {
      titolo: `Prodotti del foglio · ${ui.fgIdx + 1} di ${l.length}`, indietro: '#/prodotti', html: chipsE + `
      <div class="ctrl">
      <div class="card"><h3 class="grande-t">${esc(p.nomeBreve)}</h3>
        <div class="sottotitolo">Dal tuo foglio${forn ? ' · ' + esc(forn.nome) : ' · senza fornitore'} · ${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)}</div>
        <p>${descrPrezzo(p)}</p>
        <p class="piccolo">${uso.length ? `<b>Usato in ${uso.length} ${uso.length === 1 ? 'ricetta' : 'ricette'}:</b> ${uso.slice(0, 8).map(r => esc(r.nome)).join(', ')}${uso.length > 8 ? '…' : ''}` : '<b>Non è usato in nessuna ricetta.</b>'}</p>
        ${(S.foglioTenuti || []).includes(p.id) ? '<p class="msg grigio">L\'avevi già tenuto così.</p>' : ''}</div>
      <div class="bottoni colonna ctrl-scelte">
        <p class="piccolo"><b>È uno di questi delle fatture?</b> Le ricette passano a quello e il prezzo lo faranno le fatture.</p>
        ${sim.map(s => `<button class="btn scelta-lunga" data-az="fg-collega" data-da="${p.id}" data-a="${s.p.id}"><b>È ${esc(s.p.nomeBreve)}</b><small>${esc((M.fornitore(s.p.fornitoreId) || {}).nome || '')} · ${esc(s.p.nomeCompleto)} · ${descrPrezzo(s.p)}</small></button>`).join('')}
        <div class="scegli-rif"><input class="cerca-rif" data-fg-cerca="${p.id}" autocomplete="off" placeholder="Cerca tra i prodotti delle fatture: es. campari"><div class="sugg" id="sugg-fg"></div></div>
        <p class="piccolo" style="margin-top:14px"><b>Oppure:</b></p>
        <button class="btn scelta-lunga" data-az="fg-prep" data-id="${p.id}"><b>È fatto da noi: diventa una preparazione</b><small>blend, cordial, sciroppi, salse… poi gli metti gli ingredienti. Finché non li metti tiene il costo del foglio.</small></button>
        <button class="btn scelta-lunga" data-az="fg-tieni" data-id="${p.id}"><b>Non c'è nelle fatture: tienilo col prezzo del foglio</b><small>es. fatture che mancano o merce pagata al banco. Se più avanti arriva la fattura, lo ritrovi in «Tutti».</small></button>
        ${uso.length ? '' : `<button class="btn pericolo scelta-lunga" data-az="fg-elimina" data-id="${p.id}"><b>Non serve: eliminalo</b><small>non è in nessuna ricetta</small></button>`}
        <div class="bottoni"><button class="btn piccolo" data-az="fg-indietro" ${ui.fgIdx === 0 && !(ui.st_fg || []).length ? 'disabled' : ''}>‹ Precedente</button><button class="btn piccolo" data-az="fg-salta">Salta ›</button></div>
      </div></div>
      <p class="tenue piccolo">Controlla che il prezzo al litro, al chilo o al pezzo sia simile a quello della fattura: se è molto diverso, il formato di uno dei due è sbagliato (te lo segno da ricontrollare).</p>`
    };
  };
  const fgDopo = (prima) => { const ora = listaFoglio(); if (ora.length >= prima.length) ui.fgIdx = (ui.fgIdx || 0) + 1; ui.fgFisso = null; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['fg-modifica'] = (el) => { ui.fgApri = ui.fgApri === el.dataset.id ? null : el.dataset.id; ridisegnaMantenendo(); };
  AZ['fg-elimina-uno'] = (el) => {
    const p = M.prodotto(el.dataset.id); if (!p) return; const uso = M.usatoIn('p:' + p.id).dirette.length;
    if (!confirm(`Elimino «${p.nomeBreve}»? Finisce nel Cestino.${uso ? `\n\nÈ usato in ${uso} ${uso === 1 ? 'ricetta' : 'ricette'}: lì l'ingrediente resterà senza costo finché non lo cambi.` : ''}`)) return;
    togliProdotto(p.id); ui.fgApri = null; M.svuota(); salva(); ridisegnaMantenendo(); avviso(`«${p.nomeBreve}» nel Cestino.`);
  };
  AZ['fg-elenco'] = (el) => { ui.fgElenco = !!el.dataset.v; ui.fgSel = []; ui.fgIdx = 0; ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['fg-apri-uno'] = (el) => { const l = listaFoglio(); ui.fgElenco = false; ui.fgIdx = Math.max(0, l.findIndex(p => p.id === el.dataset.id)); ui.fgFisso = el.dataset.id; ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['fg-spunta'] = (el) => {
    const v = el.dataset.v, l = listaFoglio(), fatt = S.prodotti.filter(x => M.daFattura(x));
    if (!v) ui.fgSel = [];
    else ui.fgSel = Array.from(new Set((ui.fgSel || []).concat(l.filter(p => v === 'tutti' || (v === 'nonusati' ? !M.usatoIn('p:' + p.id).dirette.length : (propostaFoglio(p, fatt) || {}).sicura)).map(p => p.id))));
    ridisegnaMantenendo();
  };
  AZ['fg-blocco-collega'] = () => {
    const sel = (ui.fgSel || []).filter(id => M.prodotto(id) && (ui.fgProposte || {})[id]); const senza = (ui.fgSel || []).length - sel.length;
    if (!sel.length) { alert('Spunta almeno un prodotto che abbia una proposta dalle fatture.'); return; }
    if (!confirm(`Collego ${sel.length} prodotti del foglio al prodotto delle fatture proposto?${senza ? `\n(${senza} spuntati non hanno proposta: li lascio stare)` : ''}`)) return;
    const err = []; let fatti = 0;
    sel.forEach(id => { const fo = M.prodotto(id); const e = M.collegaAlFoglio(id, ui.fgProposte[id]); if (e) err.push(fo.nomeBreve + ': ' + e); else fatti++; });
    ui.fgSel = []; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0);
    avviso(`Collegati ${fatti}.${err.length ? ' ' + err.length + ' non si possono collegare in automatico: falli uno per uno.' : ''}`);
    if (err.length) setTimeout(() => alert('Da fare uno per uno:\n\n' + err.slice(0, 15).join('\n')), 300);
  };
  AZ['fg-blocco-elimina'] = () => {
    const sel = (ui.fgSel || []).filter(id => M.prodotto(id)); if (!sel.length) { alert('Spunta almeno un prodotto.'); return; }
    const usati = sel.filter(id => M.usatoIn('p:' + id).dirette.length).length;
    if (!confirm(`Elimino ${sel.length} prodotti del foglio? Finiscono nel Cestino.${usati ? `\n\nAttenzione: ${usati} sono usati in qualche ricetta: lì l'ingrediente resterà senza costo finché non lo cambi.` : ''}`)) return;
    const g = M.uid('g'); sel.forEach(id => togliProdotto(id, g));
    ui.fgSel = []; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0); avviso(`${sel.length} prodotti nel Cestino.`);
  };
  AZ['fg-apri'] = () => { ui.fgIdx = 0; ui.st_fg = []; ui.fgFisso = null; };
  AZ['fg-filtro'] = (el) => { ui.fgFiltro = el.dataset.v; ui.fgIdx = 0; ui.st_fg = []; ui.fgFisso = null; ridisegnaMantenendo(); };
  AZ['fg-forn'] = (el) => { ui.fgForn = el.dataset.v || null; ui.fgIdx = 0; ui.st_fg = []; ui.fgFisso = null; ridisegnaMantenendo(); };
  AZ['fg-salta'] = () => { ricordaPosto('fg', 'fgIdx'); ui.fgIdx = (ui.fgIdx || 0) + 1; ui.fgFisso = null; ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['fg-indietro'] = () => tornaIndietro('fg', 'fgIdx');
  AZ['fg-collega'] = (el) => {
    const prima = listaFoglio(); ricorda('fg', 'fgIdx', true);
    const ve = M.prodotto(el.dataset.a), fo = M.prodotto(el.dataset.da);
    const err = M.collegaAlFoglio(el.dataset.da, el.dataset.a); if (err) { ui.st_fg.pop(); alert(err); return; }
    ui.fgApri = null;
    avviso(`Collegato: «${fo.nomeBreve}» ora è ${ve.nomeBreve} delle fatture${ve.dubbio ? ' (prezzo molto diverso: ricontrolla il formato)' : ''}.`);
    fgDopo(prima);
  };
  AZ['fg-tieni'] = (el) => { const prima = listaFoglio(); ricorda('fg', 'fgIdx'); S.foglioTenuti = Array.from(new Set((S.foglioTenuti || []).concat(el.dataset.id))); fgDopo(prima); };
  AZ['fg-elimina'] = (el) => { const p = M.prodotto(el.dataset.id); if (!confirm(`Elimino «${p.nomeBreve}»?`)) return; const prima = listaFoglio(); ricorda('fg', 'fgIdx'); togliProdotto(p.id); fgDopo(prima); };
  AZ['fg-prep'] = (el) => {
    const p = M.prodotto(el.dataset.id), prima = listaFoglio(); ricorda('fg', 'fgIdx');
    const r = inPreparazione(p);
    avviso(`«${r.nome}» ora è una preparazione: la trovi in Ricette › Preparazioni.`);
    fgDopo(prima);
  };
  // dalla scheda di un prodotto creato a mano: diventa una preparazione e si apre subito la modifica
  AZ['prod-prep'] = (el) => {
    const p = M.prodotto(el.dataset.id); if (!p) return;
    if (!confirm(`«${p.nomeBreve}» diventa una preparazione: poi gli metti gli ingredienti e la resa. Le ricette che lo usano passano alla preparazione. Vado?`)) return;
    const r = inPreparazione(p); salva(); ui.bozza = null; ui.scorriP = null;
    avviso(`«${r.nome}» ora è una preparazione.`); vai('#/modifica-ricetta/' + r.id);
  };
  function inPreparazione(p) {
    const costo = M.prezzo(p);
    const r = { id: M.uid('r'), nome: p.nomeBreve, tipo: 'semilavorato', prezzo: null, righe: [], resa: p.contenuto || 1000, unita: p.unita === 'pz' ? 'pz' : p.unita, asporto: [], vendite: {},
      costiExtra: costo != null ? [{ nome: 'Costo dal foglio (provvisorio: toglilo quando metti gli ingredienti)', costo }] : [],
      note: 'Ricetta da completare: mancano gli ingredienti. Era tra i prodotti come «' + p.nomeBreve + '» (' + p.confezione + ' da ' + qta(p.contenuto) + ' ' + p.unita + ').' };
    S.ricette.push(r);
    S.ricette.forEach(x => { (x.righe || []).forEach(rg => { if (rg.rif === 'p:' + p.id) rg.rif = 'r:' + r.id; }); (x.asporto || []).forEach(a => { if (a.rif === 'p:' + p.id) a.rif = 'r:' + r.id; }); });
    S.prodotti = S.prodotti.filter(x => x !== p);
    M.svuota();
    return r;
  }
  // ---------- Listino di un fornitore: prezzi per i prodotti che hai già (senza IVA) ----------
  const numIt = (x) => { if (typeof x === 'number') return x; const t = String(x == null ? '' : x).replace(/[€\s]/g, ''); if (!/\d/.test(t)) return NaN; return parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); };
  function formatoListino(desc) {
    // «SCHWEPPES Ginger Beer cl.18x24» → 24 pezzi da 180 ml; «CAMPARI cl.100» → 1 pezzo da 1000 ml
    const d = String(desc || '');
    let pezzi = 1; const px = d.match(/(?:\d\s*|\b)x\s*(\d{1,3})\b/i); if (px && +px[1] > 1) pezzi = +px[1];
    let m = d.match(/\b(cl|ml|lt|l|kg|gr|g)\s*\.?\s*(\d+(?:[.,]\d+)?)/i) || null, q = null, u = '';
    if (m) { q = parseFloat(m[2].replace(',', '.')); u = m[1].toLowerCase(); }
    else { m = d.match(/(\d+(?:[.,]\d+)?)\s*(cl|ml|lt|l|kg|gr|g)\b/i); if (m) { q = parseFloat(m[1].replace(',', '.')); u = m[2].toLowerCase(); } }
    let unita = null, misura = null;
    if (q != null) { if (u === 'cl') { unita = 'ml'; misura = q * 10; } else if (u === 'ml') { unita = 'ml'; misura = q; } else if (u === 'lt' || u === 'l') { unita = 'ml'; misura = q * 1000; } else if (u === 'kg') { unita = 'g'; misura = q * 1000; } else { unita = 'g'; misura = q; } }
    return { pezzi, unita, misura };
  }
  function leggiListino(fogli) {
    const righe = fogli[Object.keys(fogli)[0]] || [];
    const nCol = Math.max(...righe.slice(0, 200).map(r => (r || []).length));
    let cDesc = -1, cPrezzo = -1, cCat = -1, best = 0, bestP = 0;
    for (let c = 0; c < nCol; c++) {
      const v = righe.slice(0, 300).map(r => (r || [])[c]).filter(x => x != null && String(x).trim() !== '');
      const num = v.filter(x => !isNaN(numIt(x))).length, testo = v.filter(x => /[a-z]{3,}/i.test(String(x)));
      const lung = testo.reduce((s, x) => s + String(x).length, 0) / (testo.length || 1);
      if (num > bestP && num >= v.length * 0.7) { bestP = num; cPrezzo = c; }
      if (testo.length >= v.length * 0.7 && lung > best) { if (best) cCat = cDesc; best = lung; cDesc = c; } else if (testo.length >= v.length * 0.7) cCat = c;
    }
    if (cDesc < 0 || cPrezzo < 0) throw new Error('Non trovo le colonne con la descrizione e il prezzo.');
    return righe.map(r => ({ cat: cCat >= 0 ? String((r || [])[cCat] || '').trim() : '', descrizione: String((r || [])[cDesc] || '').replace(/\s+/g, ' ').trim(), prezzo: numIt((r || [])[cPrezzo]) }))
      .filter(x => x.descrizione && x.prezzo > 0).map(x => Object.assign(x, { f: formatoListino(x.descrizione) }));
  }
  const PAROLE_VUOTE_LIS = new Set(['lt', 'cl', 'ml', 'bott', 'bt', 'vp', 'vap', 'vr', 'vetro', 'pet', 'kg', 'gr', 'con', 'de', 'la', 'il', 'di', 'the', 'fusto', 'fustino', 'bottiglia', 'lattina', 'cartone', 'gin', 'rum', 'rhum', 'vodka', 'whisky', 'liquore', 'amaro', 'bitter', 'sciroppo']);
  const tokLis = (t) => normCassa(t).split(' ').filter(w => w.length > 1 && !PAROLE_VUOTE_LIS.has(w) && !/^\d/.test(w));
  // prezzo del listino portato al formato del prodotto (es. cartone da 24 → una bottiglietta; litro → 70 cl)
  function prezzoPerProdotto(p, v, sconto) {
    let pr = v.prezzo / v.f.pezzi;
    if (v.f.misura && v.f.unita === p.unita && p.contenuto && Math.abs(v.f.misura - p.contenuto) / p.contenuto > 0.05) pr = pr / v.f.misura * p.contenuto;
    return Math.round(pr * (1 - (sconto || 0) / 100) * 10000) / 10000;
  }
  function proposteListino(p, voci) {
    const A = tokLis(p.nomeBreve); if (!A.length) return [];
    // parole in più dal nome completo del foglio (es. «Vermouth Carpano Classico»): aiutano a scegliere tra le varianti
    const extra = normCassa(p.nomeCompleto).split(' ').filter(w => w.length > 3 && !/^\d/.test(w) && !A.includes(w) && !['litro', 'litri', 'bottiglia'].includes(w));
    const zero = (t) => /senza alc|analcol|alcohol free|\b0[,.]0|\b0 ?%|\bzero\b/i.test(t);
    const pZero = zero(p.nomeBreve + ' ' + p.nomeCompleto);
    return voci.map((v, i) => {
      const B = tokLis(v.descrizione), nb = normCassa(v.descrizione);
      const com = A.filter(w => B.some(b => b === w || (w.length >= 5 && b.startsWith(w.slice(0, 5))))).length;
      if (com < A.length) return null;
      const fmt = v.f.unita === p.unita && v.f.misura && Math.abs(v.f.misura - p.contenuto) / p.contenuto < 0.15;
      let s = 1 + (fmt ? 0.5 : 0) - B.length * 0.02 + extra.filter(w => nb.includes(w)).length * 0.1;
      if (pZero !== zero(v.descrizione)) s -= 0.6;
      return { i, s };
    }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 4);
  }
  async function caricaListinoFornitore(file) {
    try {
      const voci = leggiListino(await leggiXlsx(file));
      // i prodotti senza fattura: quelli del tuo foglio, quelli col prezzo scritto a mano e quelli ancora senza prezzo (es. le bottiglie dei lisci)
      const cand = S.prodotti.filter(p => !p.speciale && (M.daFoglio(p) || !M.daFattura(p))).sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve));
      ui.lfVoci = voci; ui.lfFile = file.name;
      // scelgo da solo solo se la prima proposta è chiaramente la migliore (non per «Prosecco», dove ce ne sono tante uguali)
      ui.lfProd = cand.map(p => { const pr = proposteListino(p, voci); const sicura = pr.length && pr[0].s >= 1.4 && (!pr[1] || pr[0].s - pr[1].s >= 0.015); return { id: p.id, proposte: pr.map(x => x.i), auto: sicura ? pr[0].i : -1, scelta: null }; });
      ridisegnaMantenendo();
    } catch (e) { alert('Non riesco a leggere il listino: ' + e.message); }
  }
  const sceltaLf = (x) => { if (x.scelta != null) return x.scelta; const p = M.prodotto(x.id); return p && ui.lfForn && (p.fornitoreId === ui.lfForn || !p.fornitoreId) ? x.auto : -1; };
  function sezioneListino() {
    const fid = ui.lfForn || '', forn = M.fornitore(fid);
    let h = `<div class="card form"><h3>4. Listino di un fornitore</h3>
      <p class="tenue piccolo">Per i prodotti che non hanno ancora una fattura (del tuo foglio, scritti a mano o ancora senza prezzo): prendo i prezzi dal listino (senza IVA). Solo quelli che hai già, gli altri del listino restano fuori. Quando arriverà una fattura, il suo prezzo prenderà il posto di questo.</p>
      <label>Fornitore<select data-lf="forn"><option value="">scegli…</option>${S.fornitori.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(f => `<option value="${f.id}" ${fid === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
      <div class="due"><label>Data del listino<input type="date" data-lf="data" value="${esc(ui.lfData || M.oggi())}"></label><label>Vostro sconto (%)<input type="text" inputmode="decimal" autocomplete="off" data-lf="sconto" value="${esc(ui.lfSconto || '')}" placeholder="0"></label></div>
      <label class="btn">Scegli il file del listino (Excel)<input type="file" accept=".xlsx" data-carica="listino-fornitore" hidden></label></div>`;
    if (!ui.lfProd) return h;
    const voci = ui.lfVoci, sc = numDa(ui.lfSconto) || 0;
    const scelti = ui.lfProd.filter(x => sceltaLf(x) >= 0).length;
    // prima quelli che nel foglio erano di questo fornitore
    const ordine = ui.lfProd.map((x, k) => k).sort((a, b) => { const pa = M.prodotto(ui.lfProd[a].id), pb = M.prodotto(ui.lfProd[b].id); return ((pb && pb.fornitoreId === fid) - (pa && pa.fornitoreId === fid)) || (sceltaLf(ui.lfProd[b]) >= 0) - (sceltaLf(ui.lfProd[a]) >= 0); });
    h += `<div class="card evidenza"><h3>${esc(ui.lfFile)}: ${voci.length} righe</h3><p>Su ${ui.lfProd.length} prodotti senza fattura, <b>${scelti}</b> collegati a una riga del listino${(ui.lfNuovi || []).length ? `; in più <b>${ui.lfNuovi.length}</b> prodotti nuovi da creare` : ''}. Controlla quelli proposti e cerca gli altri. Il prezzo a destra è già portato al formato del tuo prodotto${sc ? `, con il ${n2(sc)}% di sconto` : ''}.</p>
      <div class="bottoni"><button class="btn primario" data-az="lf-ok" ${forn ? '' : 'disabled'}>Metti i prezzi${forn ? ' di ' + esc(forn.nome) : ' (scegli il fornitore)'}</button><button class="btn" data-az="lf-annulla">Annulla</button></div></div>`;
    const nuovi = ui.lfNuovi || [];
    h += `<div class="card form"><h3>Prodotti nuovi da questo listino</h3><p class="tenue piccolo">Per quelli che non hai ancora (es. gli amari, i rum, i whisky): cercali e aggiungili, diventano prodotti con il prezzo del listino.</p>
      <div class="scegli-rif"><input class="cerca-rif" data-lf-nuovo="1" autocomplete="off" placeholder="Cerca nel listino: es. montenegro"><div class="sugg" id="sugg-lf-nuovo"></div></div>
      ${nuovi.map((i, k) => { const v = voci[i]; return `<div class="riga"><span>${esc(v.descrizione)}<small>${v.f.pezzi > 1 ? v.f.pezzi + ' pezzi · ' : ''}${v.f.misura ? qta(v.f.misura) + ' ' + v.f.unita + ' · ' : ''}${euro(v.prezzo / v.f.pezzi * (1 - sc / 100))} a pezzo</small></span><button class="x" data-az="lf-nuovo-togli" data-k="${k}" aria-label="Togli">✕</button></div>`; }).join('')}</div>`;
    h += `<p class="tenue piccolo">In cima i prodotti che nel tuo foglio erano di ${esc(forn ? forn.nome : 'questo fornitore')}: solo per quelli scelgo da solo la riga del listino. Per gli altri, se li comprate da ${esc(forn ? forn.nome : 'lui')}, sceglila tu.</p>
      <div class="card">${ordine.map(k => { const x = ui.lfProd[k]; const p = M.prodotto(x.id); if (!p) return ''; const sel = sceltaLf(x); const v = sel >= 0 ? voci[sel] : null; const fp = M.fornitore(p.fornitoreId);
      return `<div class="lf-riga"><div class="lf-nome"><b>${esc(p.nomeBreve)}</b><small>${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)} · foglio ${euro(M.prezzo(p))}${fp ? ' · ' + esc(fp.nome) : ''}</small></div>
        <div class="lf-scelta"><select data-lf-scelta="${k}"><option value="-1">Non c'è nel listino</option>${x.proposte.concat(sel >= 0 && !x.proposte.includes(sel) ? [sel] : []).map(i => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(voci[i].descrizione)} · ${euro(voci[i].prezzo)}</option>`).join('')}</select>
        <div class="scegli-rif"><input class="cerca-rif" data-lf-cerca="${k}" autocomplete="off" placeholder="Cerca nel listino…"><div class="sugg" id="sugg-lf-${k}"></div></div></div>
        <div class="lf-prezzo">${v ? `<b>${euro(prezzoPerProdotto(p, v, sc))}</b><small>a ${esc(p.confezione)}</small>` : '<span class="tenue">—</span>'}</div></div>`; }).join('')}</div>`;
    return h;
  }
  AZ['lf-annulla'] = () => { ui.lfProd = ui.lfVoci = null; ui.lfNuovi = []; ridisegnaMantenendo(); };
  AZ['lf-nuovo'] = (el) => { ui.lfNuovi = Array.from(new Set((ui.lfNuovi || []).concat(+el.dataset.i))); ridisegnaMantenendo(); setTimeout(() => { const c = document.querySelector('[data-lf-nuovo]'); if (c) c.focus(); }, 30); };
  AZ['lf-nuovo-togli'] = (el) => { ui.lfNuovi.splice(+el.dataset.k, 1); ridisegnaMantenendo(); };
  AZ['lf-scegli'] = (el) => { const x = ui.lfProd[+el.dataset.k]; x.scelta = +el.dataset.i; if (!x.proposte.includes(x.scelta)) x.proposte.unshift(x.scelta); ridisegnaMantenendo(); };
  AZ['lf-ok'] = () => {
    const forn = M.fornitore(ui.lfForn); if (!forn) { alert('Scegli il fornitore.'); return; }
    const data = ui.lfData || M.oggi(), sc = numDa(ui.lfSconto) || 0; let n = 0;
    ui.lfProd.forEach(x => {
      const sel = sceltaLf(x); if (sel < 0) return; const p = M.prodotto(x.id), v = ui.lfVoci[sel]; if (!p) return;
      // il prezzo del foglio (pagato al banco) lascia il posto a quello del listino
      p.prezzi = (p.prezzi || []).filter(e => !/^Foglio/.test(e.origine || ''));
      p.prezzi.push({ data, prezzo: prezzoPerProdotto(p, v, sc), fornitoreId: forn.id, origine: 'Listino ' + forn.nome });
      p.fornitoreId = forn.id;
      // la descrizione del listino di solito è la stessa delle fatture: così la prossima fattura lo riconosce da sola
      const stesso = v.f.misura && v.f.unita === p.unita && Math.abs(v.f.misura - p.contenuto) / p.contenuto < 0.05;
      if (!(p.articoli || []).some(a => a.fornitoreId === forn.id && normCassa(a.descrizione) === normCassa(v.descrizione))) (p.articoli = p.articoli || []).push({ fornitoreId: forn.id, descrizione: v.descrizione, codice: '', confezioniPerUnita: stesso ? v.f.pezzi : 1 });
      n++;
    });
    let c = 0;
    (ui.lfNuovi || []).forEach(i => {
      const v = ui.lfVoci[i]; if (!v) return;
      const g = M.indovinaProdotto({ descrizione: v.descrizione, um: '', quantita: 1, prezzoUnitario: v.prezzo, totale: v.prezzo });
      const unita = v.f.unita || g.unita || 'pz', contenuto = v.f.misura || g.contenuto || 1;
      const nome = String(g.nomeBreve || v.descrizione).replace(/\s*\b(cl|lt|ml|kg|gr|l)\.?\s*$/i, '').trim();
      const p = { id: M.uid('p'), nomeBreve: nome, nomeCompleto: v.descrizione, categoria: M.categoriaDa(v.descrizione + ' ' + String(v.cat).replace(/amari/i, 'amaro')), unita, contenuto,
        confezione: unita === 'ml' ? 'bottiglia' : unita === 'g' ? 'confezione' : 'pezzo', iva: 22, fornitoreId: forn.id, giacenza: 0, scortaMinima: 0, resa: 100, allergeni: [],
        prezzi: [{ data, prezzo: Math.round(v.prezzo / v.f.pezzi * (1 - sc / 100) * 10000) / 10000, fornitoreId: forn.id, origine: 'Listino ' + forn.nome }],
        articoli: [{ fornitoreId: forn.id, descrizione: v.descrizione, codice: '', confezioniPerUnita: v.f.pezzi }] };
      if (p.categoria === 'Da classificare' && v.cat) p.categoria = v.cat.charAt(0) + v.cat.slice(1).toLowerCase();
      S.prodotti.push(p); c++;
    });
    ui.lfProd = ui.lfVoci = null; ui.lfNuovi = []; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0);
    avviso(`Prezzi di ${forn.nome} messi a ${n} prodotti${c ? `, e ${c} prodotti nuovi creati` : ''}.`);
  };
  // ---------- Come arriva in fattura: «1 cartone = 12 pezzi», per ogni articolo del fornitore ----------
  function righeFatturaDi(pId) {
    // l'ultima riga di fattura per ogni articolo (fornitore + codice o descrizione)
    const per = {};
    S.fatture.slice().sort((a, b) => (a.data || '') < (b.data || '') ? -1 : 1).forEach(f => f.righe.forEach(rg => {
      if (rg.prodottoId !== pId || rg.ignora || !(rg.totale > 0)) return;
      per[f.fornitoreId + '|' + (rg.codice || normCassa(rg.descrizione))] = { f, rg };
    }));
    return Object.values(per);
  }
  function pezziInFattura(b) {
    if (!b || !b.id || b._per === 'p:nuovo') return '';
    const l = righeFatturaDi(b.id); if (!l.length) return '';
    return `<div class="card form"><h3>Come arriva in fattura</h3>
      <p class="tenue piccolo">Se in fattura c'è un cartone (o una cassa, un fardello) scrivi quanti pezzi ci sono dentro: il prezzo diventa quello di un pezzo. Il pezzo è quello qui sopra: ${esc(b.confezione)} da ${qta(b.contenuto)} ${esc(b.unita)}.</p>
      ${l.map(({ f, rg }) => { const n = Number(rg.confezioniPerUnita) || 1; const pu = rg.totale / (rg.quantita || 1);
        return `<div class="pz-riga"><div><b>${esc(rg.descrizione)}</b><small>${esc((M.fornitore(f.fornitoreId) || {}).nome || f.fornitoreNome)} · ${dataIt(f.data)} · ${qta(rg.quantita)} ${esc(rg.um || 'pz')} a ${euro(pu)}</small></div>
          <label>1 ${esc(rg.um || 'pezzo')} di fattura = quanti pezzi?<input type="text" inputmode="decimal" autocomplete="off" data-pzr="${f.id}" value="${n}"></label>
          ${(() => { const m = String(rg.descrizione).match(/\bx\s*(\d{1,3})\b/i); return n === 1 && m && +m[1] > 1 ? `<button class="btn piccolo" data-az="pz-suggerito" data-f="${f.id}" data-n="${m[1]}">In descrizione c'è «x ${m[1]}»: metti ${m[1]} pezzi</button>` : ''; })()}
          <p class="piccolo">= <b>${euro(pu / n)}</b> a ${esc(b.confezione)}${b.contenuto ? ` · ${euro(pu / n / b.contenuto * (b.unita === 'pz' ? 1 : 1000))}${b.unita === 'g' ? ' al kg' : b.unita === 'ml' ? ' al litro' : ' al pezzo'}` : ''}</p></div>`; }).join('')}</div>`;
  }
  AZ['pz-suggerito'] = (el) => { const i = document.querySelector(`[data-pzr="${el.dataset.f}"]`); if (!i) return; i.value = el.dataset.n; i.dispatchEvent(new Event('change', { bubbles: true })); };
  // ---------- Gruppi di ricette: crearli (Amari, Rum…), rinominarli, sceglierne il reparto ----------
  // ---------- Costi su tutto un gruppo di ricette ----------
  const costiDi = (k) => ((S.costiGruppo = S.costiGruppo || {})[k] = S.costiGruppo[k] || []);
  const descrCostoGruppo = (g) => { if (!g.rif) return esc(g.nome || 'costo'); const p = M.prodotto(g.rif.slice(2)); return esc(p ? p.nomeBreve : 'prodotto eliminato') + ' ' + qta(Number(g.quantita) || 0) + ' ' + esc(p ? p.unita : ''); };
  PAGINE['costi-gruppo'] = function (k) {
    if (!M.TIPI[k] || k === 'semilavorato') return { titolo: 'Gruppo', indietro: '#/gruppi-ricette', html: '<p class="tenue centro">Gruppo non trovato.</p>' };
    const l = costiDi(k), n = S.ricette.filter(r => r.tipo === k).length;
    const costoDi = (g) => g.rif ? M.costoRiga(g.rif, Number(g.quantita) || 0).costo : Number(g.costo) || 0;
    const tot = l.reduce((t, g) => t + (costoDi(g) || 0), 0);
    return { titolo: 'Costi di ' + M.TIPI[k], indietro: '#/gruppi-ricette', html: `
      <div class="card form"><h3>Su tutte le ${n} ricette di «${esc(M.TIPI[k])}»</h3>
        <p class="tenue piccolo">Si aggiungono al costo di ogni ricetta del gruppo, anche di quelle che creerai dopo. Un prodotto (ghiaccio, cannuccia) segue il prezzo delle fatture; un costo in euro (gas CO2) resta fisso.</p>
        ${l.map((g, i) => g.rif
          ? `<div class="riga-ed"><select data-cg="${i}" data-k="rif">${opzioniProdotti(g.rif)}</select><input type="text" inputmode="decimal" autocomplete="off" data-cg="${i}" data-k="quantita" value="${esc(g.quantita)}" aria-label="Quantità"><span class="tenue piccolo">${esc((M.prodotto(g.rif.slice(2)) || {}).unita || '')} · ${costoDi(g) == null ? 'senza prezzo' : euro(costoDi(g), 3)}</span><button class="x" data-az="cg-togli" data-k="${k}" data-i="${i}" aria-label="Togli">✕</button></div>`
          : `<div class="riga-ed"><input data-cg="${i}" data-k="nome" value="${esc(g.nome)}" placeholder="es. gas CO2" aria-label="Nome"><input type="text" inputmode="decimal" autocomplete="off" data-cg="${i}" data-k="costo" value="${esc(g.costo)}" aria-label="Euro"><span class="tenue piccolo">€</span><button class="x" data-az="cg-togli" data-k="${k}" data-i="${i}" aria-label="Togli">✕</button></div>`).join('') || '<p class="tenue piccolo">Ancora nessun costo.</p>'}
        <div class="bottoni"><button class="btn piccolo" data-az="cg-prodotto" data-k="${k}">＋ Prodotto (es. ghiaccio, cannuccia)</button><button class="btn piccolo" data-az="cg-euro" data-k="${k}">＋ Costo in euro (es. gas CO2)</button></div>
        ${l.length ? `<p class="kpi-riga">In più su ogni ricetta: <b>${euro(tot, 3)}</b></p>` : ''}</div>
      <p class="tenue piccolo">Se una ricetta ha già quel prodotto tra gli ingredienti (es. il ghiaccio) non viene contato due volte. Se una ricetta non li deve avere (es. un cocktail senza cannuccia), aprila in modifica e togli la spunta «Aggiungili anche a questa ricetta».</p>` };
  };
  const cgCambiato = () => { M.svuota(); salva(); };
  AZ['cg-prodotto'] = (el) => { const gh = S.prodotti.find(p => /ghiacci/i.test(p.nomeBreve)); costiDi(el.dataset.k).push({ rif: 'p:' + (gh || S.prodotti[0]).id, quantita: gh ? 180 : 1 }); cgCambiato(); ridisegnaMantenendo(); };
  AZ['cg-euro'] = (el) => { costiDi(el.dataset.k).push({ nome: '', costo: 0 }); cgCambiato(); ridisegnaMantenendo(); };
  AZ['cg-togli'] = (el) => { costiDi(el.dataset.k).splice(+el.dataset.i, 1); cgCambiato(); ridisegnaMantenendo(); };
  AZ['cg-apri'] = (el) => vai('#/costi-gruppo/' + el.dataset.k);

  PAGINE['gruppi-ricette'] = function () {
    const conta = (k) => S.ricette.filter(r => r.tipo === k).length;
    return { titolo: 'Gruppi di ricette', indietro: '#/ricette', html: `
      <div class="card form"><h3>Nuovo gruppo</h3><p class="tenue piccolo">Es. Amari, Rum, Whisky, Grappe, Vini al calice. Poi ci sposti dentro le ricette o ne crei di nuove.</p>
        <div class="due"><label>Nome<input id="gr-nome" placeholder="es. Amari"></label><label>Reparto<select id="gr-rep"><option value="bar">Bar</option><option value="cucina">Cucina</option></select></label></div>
        <div class="bottoni"><button class="btn primario" data-az="gr-crea">Crea il gruppo</button></div></div>
      <div class="card"><h3>I gruppi</h3>
        ${Object.keys(M.TIPI).filter(k => k !== 'semilavorato').map(k => `<div class="gr-riga">
          <input data-gr-nome="${k}" value="${esc(M.TIPI[k])}" aria-label="Nome del gruppo">
          <select data-gr-rep="${k}"><option value="bar" ${M.REPARTO_TIPO[k] === 'bar' ? 'selected' : ''}>Bar</option><option value="cucina" ${M.REPARTO_TIPO[k] === 'cucina' ? 'selected' : ''}>Cucina</option></select>
          <span class="tenue piccolo">${conta(k)} ricette</span>
          <a class="btn piccolo" href="#/costi-gruppo/${k}">Costi${(S.costiGruppo || {})[k] && S.costiGruppo[k].length ? ' (' + S.costiGruppo[k].length + ')' : ''}</a>
          <button class="x" data-az="gr-elimina" data-id="${k}" aria-label="Elimina il gruppo">✕</button></div>`).join('')}
        <p class="tenue piccolo">Il nome si cambia scrivendo. Se elimini un gruppo, le ricette dentro vanno in un altro gruppo dello stesso reparto.</p></div>` };
  };
  AZ['gr-crea'] = () => {
    const nome = ($('#gr-nome').value || '').trim(); if (!nome) { alert('Scrivi il nome del gruppo.'); return; }
    if (Object.values(M.TIPI).some(v => v.toLowerCase() === nome.toLowerCase())) { alert('C\'è già un gruppo con questo nome.'); return; }
    const id = 't_' + normCassa(nome).replace(/ /g, '_').slice(0, 20) + '_' + Math.random().toString(36).slice(2, 5);
    S.tipiExtra = (S.tipiExtra || []).concat({ id, nome, reparto: $('#gr-rep').value });
    M.aggiornaTipi(); S.impostazioni.soglie[id] = 3.5; ui.tipoRicette = id; salva(); avviso(`Gruppo «${nome}» creato.`); vai('#/ricette');
  };
  AZ['gr-elimina'] = (el) => {
    const id = el.dataset.id; if (!M.TIPI[id]) return;
    const dentro = S.ricette.filter(r => r.tipo === id);
    const altri = Object.keys(M.TIPI).filter(k => k !== id && k !== 'semilavorato');
    const dove = altri.find(k => M.REPARTO_TIPO[k] === M.REPARTO_TIPO[id]) || altri[0];
    if (dentro.length && !dove) { alert('È l\'ultimo gruppo: non si può eliminare.'); return; }
    if (!confirm(`Elimino il gruppo «${M.TIPI[id]}»?${dentro.length ? ` Le sue ${dentro.length} ricette vanno in «${M.TIPI[dove]}».` : ''}`)) return;
    dentro.forEach(r => { r.tipo = dove; });
    if ((S.tipiExtra || []).some(x => x.id === id)) S.tipiExtra = S.tipiExtra.filter(x => x.id !== id);
    else S.tipiNascosti = Array.from(new Set((S.tipiNascosti || []).concat(id)));
    M.aggiornaTipi(); if (ui.tipoRicette === id) ui.tipoRicette = dove; salva(); ridisegnaMantenendo();
  };
  AZ['sposta-inizia'] = () => { ui.elim = null; ui.spostaModo = true; ui.spostaSel = []; ridisegnaMantenendo(); };
  AZ['elim-inizia'] = (el) => { ui.spostaModo = false; ui.elim = { tipo: el.dataset.v, sel: [] }; ridisegnaMantenendo(); };
  AZ['elim-fine'] = () => { ui.elim = null; ridisegnaMantenendo(); };
  AZ['elim-nessuno'] = () => { ui.elim.sel = []; ridisegnaMantenendo(); };
  AZ['elim-tutte'] = () => { const s2 = new Set(ui.elim.sel); document.querySelectorAll('[data-elim]').forEach(c => s2.add(c.dataset.elim)); ui.elim.sel = Array.from(s2); ridisegnaMantenendo(); };
  AZ['elim-mai'] = () => {
    const s2 = new Set(ui.elim.sel);
    document.querySelectorAll('[data-elim]').forEach(c => {
      const id = c.dataset.elim;
      if (ui.elim.tipo === 'r') { const r = M.ricetta(id); if (r && !Object.values(r.vendite || {}).some(v => Number(v) > 0) && !M.usatoIn('r:' + id).tutte.length) s2.add(id); }
      else if (!M.usatoIn('p:' + id).tutte.length) s2.add(id);
    });
    ui.elim.sel = Array.from(s2); ridisegnaMantenendo();
  };
  AZ['elim-ok'] = () => {
    const t = ui.elim.tipo, sel = new Set(ui.elim.sel); if (!sel.size) { alert('Spunta almeno ' + (t === 'r' ? 'una ricetta.' : 'un prodotto.')); return; }
    const usati = Array.from(sel).filter(id => M.usatoIn((t === 'r' ? 'r:' : 'p:') + id).tutte.some(x => !sel.has(x.id)));
    const cos = t === 'r' ? (sel.size === 1 ? 'ricetta' : 'ricette') : (sel.size === 1 ? 'prodotto' : 'prodotti');
    if (!confirm(`Elimino ${sel.size} ${cos}?${usati.length ? `\n\nAttenzione: ${usati.length} ${usati.length === 1 ? 'è usato' : 'sono usati'} dentro altre ricette: lì l'ingrediente resterà senza costo.` : ''}\n\nFiniscono nel Cestino: da lì li puoi rimettere.`)) return;
    const gruppo = M.uid('g');
    sel.forEach(id => { if (t === 'r') togliRicetta(id, gruppo); else togliProdotto(id, gruppo); });
    ui.cestino = { tipo: t, n: sel.size, gruppo };
    ui.elim = null; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0);
  };
  AZ['sposta-prod-ok'] = () => {
    const l = ui.elim.sel.map(id => M.prodotto(id)).filter(Boolean);
    if (!l.length) { alert('Spunta almeno un prodotto.'); return; }
    const rep = ($('#sposta-rep') || {}).value, cat = (($('#sposta-cat') || {}).value || '').trim();
    l.forEach(p => { p.reparto = rep; if (cat) p.categoria = cat; });
    ui.spostaRep = rep; ui.spostaCat = cat; ui.elim.sel = [];
    M.svuota(); salva(); ridisegnaMantenendo(); avviso(`${l.length} ${l.length === 1 ? 'prodotto spostato' : 'prodotti spostati'} in ${rep}${cat ? ' › ' + cat : ''}.`);
  };
  AZ['prod-separa'] = (el) => {
    const p = M.prodotto(el.dataset.id), u = p && (p.uniti || []).find(x => x.id === el.dataset.u); if (!u) return;
    if (!confirm(`Separo «${u.prodotto.nomeBreve}» da «${p.nomeBreve}»? Torna un prodotto a sé, con i suoi prezzi e le sue fatture.`)) return;
    const e = M.separaProdotto(p.id, u.id); if (e) { alert(e); return; }
    salva(); ridisegnaMantenendo(); avviso(`«${u.prodotto.nomeBreve}» è di nuovo un prodotto a sé.`);
  };
  AZ['unisci-ok'] = () => {
    const l = ui.elim.sel.map(id => M.prodotto(id)).filter(Boolean);
    if (l.length < 2) { alert('Spunta almeno due prodotti.'); return; }
    const unita = Array.from(new Set(l.map(p => p.unita)));
    if (unita.length > 1) { alert('Non posso unirli, hanno unità diverse:\n' + unita.map(u => u + ': ' + l.filter(p => p.unita === u).map(p => p.nomeBreve).join(', ')).join('\n') + '\n\nTogli la spunta a quelli che non c\'entrano, o sistemane il formato.'); return; }
    // resta quello con il prezzo più recente (è quello che conta)
    const dataDi = (p) => { const v = M.prezzoVoce(p); return (v && v.data) || ''; };
    const resta = l.slice().sort((a, b) => dataDi(b).localeCompare(dataDi(a)) || M.usatoIn('p:' + b.id).tutte.length - M.usatoIn('p:' + a.id).tutte.length)[0];
    const nome = prompt(`Unisco ${l.length} prodotti in uno solo. Come lo chiamo?`, resta.nomeBreve);
    if (nome == null) return;
    const err = []; l.forEach(p => { if (p !== resta) { const e = M.unisciProdotti(p.id, resta.id); if (e) err.push(p.nomeBreve + ': ' + e); } });
    if (nome.trim()) resta.nomeBreve = nome.trim();
    delete resta.forseDoppioneDi;
    ui.elim = null; if (ui.scorriP) ui.scorriP = ui.scorriP.filter(id => M.prodotto(id)); M.svuota(); salva();
    if (err.length) alert('Non uniti:\n' + err.join('\n'));
    vai('#/prodotto/' + resta.id); avviso(`Uniti in «${resta.nomeBreve}».`);
  };
  AZ['elim-rimetti'] = () => {
    const c = ui.cestino; if (!c) return;
    (S.cestino || []).filter(x => x.gruppo === c.gruppo).forEach(rimettiDalCestino);
    ui.cestino = null; M.svuota(); salva(); ridisegnaMantenendo(); avviso(`Rimessi ${c.n} ${c.tipo === 'r' ? (c.n === 1 ? 'ricetta' : 'ricette') : (c.n === 1 ? 'prodotto' : 'prodotti')}.`);
  };
  AZ['ces-tipo'] = (el) => { ui.cestinoTipo = el.dataset.v; ridisegnaMantenendo(); };
  AZ['ces-rimetti'] = (el) => { const c = (S.cestino || []).find(x => x.id === el.dataset.id); if (!c) return; rimettiDalCestino(c); M.svuota(); salva(); ridisegnaMantenendo(); avviso(`Rimesso: ${nomeCestino(c)}.`); };
  AZ['ces-rimetti-gruppo'] = (el) => { const l = (S.cestino || []).filter(x => x.gruppo === el.dataset.g); l.forEach(rimettiDalCestino); M.svuota(); salva(); ridisegnaMantenendo(); avviso(`Rimessi ${l.length}.`); };
  AZ['ces-via'] = (el) => { const c = (S.cestino || []).find(x => x.id === el.dataset.id); if (!c || !confirm(`Elimino per sempre «${nomeCestino(c)}»? Non si potrà più rimettere.`)) return; S.cestino = S.cestino.filter(x => x !== c); salva(); ridisegnaMantenendo(); };
  AZ['ces-svuota'] = () => { if (!confirm(`Svuoto il cestino? Le ${(S.cestino || []).length} cose dentro spariscono per sempre.`)) return; S.cestino = []; salva(); ridisegnaMantenendo(); };
  AZ['sposta-fine'] = () => { ui.spostaModo = false; ui.spostaSel = []; ridisegnaMantenendo(); };
  AZ['sposta-tutte'] = () => { document.querySelectorAll('[data-sposta]').forEach(c => { c.checked = true; }); ui.spostaSel = Array.from(document.querySelectorAll('[data-sposta]')).map(c => c.dataset.sposta); ridisegnaMantenendo(); };
  AZ['sposta-ok'] = () => {
    const dove = $('#sposta-in').value, sel = ui.spostaSel || []; if (!sel.length) { alert('Spunta almeno una ricetta.'); return; }
    sel.forEach(id => { const r = M.ricetta(id); if (r) r.tipo = dove; });
    ui.spostaModo = false; ui.spostaSel = []; salva(); avviso(`${sel.length} ${sel.length === 1 ? 'ricetta spostata' : 'ricette spostate'} in «${M.TIPI[dove]}».`); ui.tipoRicette = dove; ridisegnaMantenendo();
  };
  // ---------- Metti in ordine i dati: tutti gli strumenti di sistemazione in un posto, nell'ordine giusto ----------
  function passiOrdine() {
    const daFoglio = S.prodotti.filter(p => M.daFoglio(p) && !(S.foglioTenuti || []).includes(p.id)).length;
    const coppieF = (() => { const v = new Set(); let n = 0; S.fornitori.forEach(f => fornitoriSimili(f).forEach(x => { const k = [f.id, x.id].sort().join('|'); if (!v.has(k)) { v.add(k); n++; } })); return n; })();
    const impossibili = S.ricette.filter(r => r.tipo !== 'semilavorato' && r.prezzo && (() => { const i = M.indicatori(r); return i.costo != null && i.costo > i.netto; })()).length;
    const cartoni = S.prodotti.filter(p => p.dubbio).length;
    const incomplete = S.ricette.filter(r => r.tipo !== 'semilavorato' && (!(r.righe || []).length || /^Ricetta da completare/.test(r.note || ''))).length;
    const fattDaFare = S.fatture.filter(f => f.stato !== 'registrata').length;
    // [titolo, quanti, indirizzo, spiegazione, nome breve, azione]
    return [
      ['Fornitori nuovi: vendono merce o solo servizi?', fornitoriDaControllare().length, '#/controllo-fatture', 'Così i prodotti di bollette e servizi spariscono da soli.', 'fornitori nuovi'],
      ['Fornitori che sono lo stesso', coppieF, '#/fornitori', 'Es. Sebar e SE.BA.R: uniscili.', 'fornitori doppi'],
      ['Fatture da completare', fattDaFare, '#/fatture', 'Righe ancora da collegare a un prodotto.', 'fatture', 'ord-fatture'],
      ['Prodotti nuovi da controllare', nuoviDaCompletare(), '#/controllo', 'Nome breve, categoria e formato dei prodotti arrivati dalle fatture.', 'prodotti nuovi'],
      ['Prodotti doppi', M.gruppiDoppioni().length, '#/doppioni', 'Lo stesso prodotto arrivato due volte: uniscilo.', 'doppioni'],
      ['Prodotti del tuo foglio', daFoglio, '#/foglio', 'Collegali alle fatture, falli diventare preparazioni, tienili o eliminali.', 'del foglio', 'fg-apri'],
      ['Cartoni contati come un pezzo', cartoni + impossibili, '#/formati', impossibili ? `${impossibili} ricette costano più del prezzo: c'è un cartone da sistemare.` : 'Scrivi quanti pezzi ci sono nel cartone.', 'cartoni', 'ord-cartoni'],
      ['Ricette senza ingredienti completi', incomplete, '#/rivedi-ricette', 'Una per una, dalle più vendute.', 'ricette', 'ord-ricette']
    ];
  }
  PAGINE.ordine = function () {
    const passi = passiOrdine(), fatti = passi.filter(x => !x[1]).length;
    const strumenti = [
      ['#/formati', 'ord-formati', 'Ricontrolla i formati', 'tutti i prodotti, uno dopo l\'altro'],
      ['#/rivedi-ricette', 'ord-rivedi', 'Rivedi le ricette', 'tutte, una per una, dalle più vendute'],
      ['#/doppioni', '', 'Unisci i doppioni', 'prodotti con lo stesso nome e formato'],
      ['#/foglio', 'fg-apri', 'Prodotti del foglio', 'tutti quelli che hai messo tu'],
      ['#/pulizia', '', 'Pulizia dati del foglio', 'collegamenti con le fatture'],
      ['#/cestino', '', 'Cestino', 'quello che hai eliminato']
    ];
    return { titolo: 'Metti in ordine i dati', indietro: '#/altro', html: `
      <div class="card larga"><div class="avanzamento"><span style="width:${Math.round(fatti / passi.length * 100)}%"></span></div><p class="tenue piccolo">Fatti ${fatti} passi su ${passi.length}. Vai in quest'ordine: ognuno rende più facile il successivo.</p></div>
      <div class="card lista larga">${passi.map(([t, n, h, sp, , az], i) => `<a class="riga" href="${h}" ${az ? `data-az="${az}"` : ''}><span><b>${i + 1}. ${t}</b><small>${sp}</small></span><span class="badge ${n ? 'giallo' : 'verde'}">${n ? n : 'fatto'}</span></a>`).join('')}</div>
      <h2 class="sezione">Strumenti</h2>
      <div class="griglia-voci">${strumenti.map(([h, az, t, sp]) => `<a class="voce" href="${h}" ${az ? `data-az="${az}"` : ''}><b>${t}</b><span>${sp}</span></a>`).join('')}</div>` };
  };
  AZ['ord-ricette'] = () => { ui.tipoRicette = '*tutto'; ui.filtroRicette = ''; ui.rivFiltro = 'incomplete'; ui.rivOrdine = haVendite() ? 'piu' : 'nome'; ui.rivPer = '*'; ui.rivIdx = 0; ui.rivStorico = []; ui.rivFisso = null; ui.bozza = null; };
  AZ['ord-rivedi'] = () => { ui.tipoRicette = '*tutto'; ui.filtroRicette = ''; ui.rivFiltro = 'tutte'; ui.rivOrdine = haVendite() ? 'piu' : 'nome'; ui.rivPer = '*'; ui.rivIdx = 0; ui.rivStorico = []; ui.rivFisso = null; ui.bozza = null; };
  AZ['ord-formati'] = () => { ui.fmtCat = ''; ui.fmtRep = ''; ui.fmtForn = ''; ui.fmtFiltro = 'tutti'; ui.fmtIdx = 0; };
  AZ['ord-cartoni'] = () => { ui.fmtCat = ''; ui.fmtRep = ''; ui.fmtForn = ''; ui.fmtFiltro = 'cartoni'; ui.fmtIdx = 0; };
  AZ['ord-fatture'] = () => { ui.statoFatt = 'dafare'; ui.filtroFatt = ''; };
  // ---------- Costi del locale: tutte le fatture, non solo la merce (bollette, servizi, materiali, attrezzatura…) ----------
  const CAT_SPESA = {
    merce: ['Merce: bar e cucina', 'var(--verde)'],
    materiali: ['Pulizia e materiali (fuori dalle ricette)', '#8a6d3b'],
    affitto: ['Affitto', '#4a235a'],
    personale: ['Personale', '#1a5276'],
    luce: ['Luce e gas', '#c0392b'],
    acqua: ['Acqua', '#2e86c1'],
    telefono: ['Telefono e internet', '#7d3c98'],
    utenze: ['Altre bollette', '#cd6155'],
    rifiuti: ['Immondizia e rifiuti', '#6e2c00'],
    siae: ['SIAE e musica', '#d35400'],
    abbonamenti: ['Abbonamenti, programmi e noleggi', '#117864'],
    consulenze: ['Commercialista e consulenze', '#2c3e8f'],
    manutenzioni: ['Manutenzioni e riparazioni', '#16808a'],
    attrezzatura: ['Attrezzatura e arredo', '#6b5b95'],
    pubblicita: ['Pubblicità e marketing', '#b9770e'],
    assicurazioni: ['Assicurazioni', '#5d6d7e'],
    tasse: ['Tasse e imposte', '#922b21'],
    banca: ['Banca e pagamenti', '#566573'],
    eventi: ['Eventi e spettacoli', '#a04000'],
    altro: ['Altro', '#7f8c8d']
  };
  // dalle righe delle fatture di un fornitore di servizi: cosa ci paghiamo (affitto, gas, acqua, buoni pasto…)
  const RIGHE_SPESA = [
    ['affitto', /affitto|locazion|canone (mensile )?(del )?(locale|azienda)/], ['personale', /buoni pasto|ordine buoni|buono pasto|\bbpe\b/], ['siae', /\bsiae\b|diritto d.?autore|\bscf\b/],
    ['rifiuti', /rifiut|\btari\b|igiene ambientale|raccolta differenziata|smaltimento/], ['acqua', /servizio acqua|\bacqua\b.*(fornitura|servizio)|idric|fognatur|depurazion/],
    ['luce', /energia|\bkwh\b|gas naturale|\bsmc\b|oneri generali di sistema|quota potenza/], ['telefono', /telefon|internet|fibra|adsl|\bsim\b|traffico/],
    ['assicurazioni', /assicura|polizza|premio di/], ['consulenze', /notai|onorari|consulenza del lavoro|elaborazione (paghe|cedolini)|contabilit|commercialist/],
    ['pubblicita', /marketing|promozione|pubblicit|sponsor|grafic|volantin|stampa/], ['abbonamenti', /abbonament|canone|licenza|noleggio|whatsapp|software|registratore|piattaforma|\bsky\b/],
    ['manutenzioni', /riparazion|intervento|assistenza tecnica|manutenz|bonifica|pulizia|disinfest|estintor/]
  ];
  const cacheCatSpesa = {};
  // il tipo di spesa di un fornitore: quello scelto a mano, altrimenti lo indovino dalle righe delle sue fatture e dal nome
  function categoriaSpesa(f) {
    if (!f) return 'altro';
    if (f.catSpesa) return f.catSpesa;
    if (cacheCatSpesa[f.id]) return cacheCatSpesa[f.id];
    const n = normCassa(f.nome);
    let c = /\b(siae|scf)\b|\bs i a e\b/.test(n) ? 'siae' : /\b(sky|dazn)\b/.test(n) ? 'abbonamenti' : null;
    if (!c && f.servizi) {
      const conta = {};
      S.fatture.filter(x => x.fornitoreId === f.id).forEach(x => (x.righe || []).forEach(rg => { const t = normCassa(rg.descrizione); const k = (RIGHE_SPESA.find(([, re]) => re.test(t)) || [])[0]; if (k) conta[k] = (conta[k] || 0) + 1; }));
      const top = Object.entries(conta).sort((a, b) => b[1] - a[1])[0]; if (top) c = top[0];
    }
    if (!c) {
      if (/\b(siae|scf)\b/.test(n)) c = 'siae';
      else if (/\b(hera|acque|acqua|acquedott)\b/.test(n)) c = 'acqua';
      else if (/\b(enel|acea|engie|eni|enimoov|edison|iren|a2a|energia|luce|gas|estra|sorgenia|illumia|aeg)\b/.test(n)) c = 'luce';
      else if (/\b(fastweb|tim|telecom|vodafone|wind|iliad|aruba)\b/.test(n)) c = 'telefono';
      else if (/\b(sky|dazn|plateform|cassa in cloud|teamsystem)\b/.test(n)) c = 'abbonamenti';
      else if (/\b(studio|consulenz|commercialist|notai|avvocat|paghe|lavoro|caf)\b/.test(n)) c = 'consulenze';
      else if (/\b(assicura|generali|allianz|unipol|cattolica|reale mutua)\b/.test(n)) c = 'assicurazioni';
      else if (/\b(nexi|banca|bancario|sumup|satispay|paypal|pos|credit)\b/.test(n)) c = 'banca';
      else if (/\b(grafic|flyeralarm|stampa|tipograf|pubblicit|xmenu|menu|marketing)\b/.test(n)) c = 'pubblicita';
      else if (/\b(associazione|asd|spettacol|musica|eventi|servicefest)\b/.test(n)) c = 'eventi';
      else if (/\b(ecologic|rifiuti|ambiente)\b/.test(n)) c = 'rifiuti';
      else if (/\b(service|servizi|assistenza|termotecnic|ferramenta|manutenz|pulizi|estintor|antincendio|idraulic|elettric)\b/.test(n)) c = 'manutenzioni';
      else if (/\b(immobiliar|affitt|locazion)\b/.test(n)) c = 'affitto';
      else if (/\b(amazon|ikea|iper|leroy|brico|mediaworld|unieuro)\b/.test(n)) c = 'attrezzatura';
      else c = f.servizi ? 'altro' : 'merce';
    }
    cacheCatSpesa[f.id] = c; return c;
  }
  // quanto pesa ogni fattura su ogni tipo di spesa (senza IVA; le note di credito tolgono)
  // prodotti che stanno in almeno una ricetta (o nei costi di un gruppo): il loro costo è già nel costo dei drink e dei piatti
  let usatiInRicette = null;
  const prodottiInRicette = () => { const u = new Set(); S.ricette.forEach(r => (r.righe || []).forEach(rg => rg.rif && u.add(rg.rif))); Object.values(S.costiGruppo || {}).forEach(l => (l || []).forEach(g => g.rif && u.add(g.rif))); return u; };
  function speseFattura(f) {
    const segno = f.tipoDoc === 'TD04' ? -1 : 1; let tot = Number(f.imponibile || f.totale) || 0;
    const forn = M.fornitore(f.fornitoreId), cat = categoriaSpesa(forn), out = {};
    // righe collegate a un prodotto: «Non food» nei materiali, il resto nella merce (anche da un fornitore di servizi, es. tovagliette dalla tipografia)
    const foC = M.fornitore(f.fornitoreId), cassa = foC && foC.casseAMeta ? M.prodottiACassa(foC.id) : null;
    let nf = 0, me = 0, meRic = 0, extra = 0; f.righe.forEach(rg => { const k = cassa && !rg.ignora ? M.moltiplicaRiga(f, rg, cassa) : 1, t = (Number(rg.totale) || 0) * k; extra += t - (Number(rg.totale) || 0); const p = rg.prodottoId && M.prodotto(rg.prodottoId); if (!p || rg.ignora) return; const inRic = (usatiInRicette || prodottiInRicette()).has(p.id); if (inRic) meRic += t; if (M.reparto(p) === 'Non food' && !inRic) nf += t; else me += t; });
    tot += extra;
    // fornitore di servizi (commercialista, tipografia…): nella merce solo quello che sta davvero in una ricetta (es. le tovagliette del coperto), il resto è del suo tipo di spesa
    if (cat !== 'merce') { if (cat === 'materiali') { out.merce = segno * meRic; out.materiali = segno * (tot - meRic); return out; } out.materiali = segno * nf; out.merce = segno * meRic; out[cat] = (out[cat] || 0) + segno * (tot - nf - meRic); return out; }
    // fornitore di merce: il resto (anche trasporti e sconti) va nella merce
    out.materiali = segno * nf; out.merce = segno * (tot - nf); return out;
  }
  function speseTra(dal, al) {
    const per = {}, perForn = {}, perMese = {};
    usatiInRicette = prodottiInRicette();
    S.fatture.forEach(f => {
      if (!f.data || (dal && f.data < dal) || (al && f.data > al)) return;
      // note di credito fatte dal locale stesso per «storno corrispettivi» (buoni pasto dei clienti): sono incasso, non spese
      if ((f.righe || []).some(rg => /storno\s+(dei\s+)?corrispettiv/i.test(rg.descrizione || ''))) return;
      const x = speseFattura(f), m = f.data.slice(0, 7);
      Object.entries(x).forEach(([c, v]) => { if (!v) return; per[c] = (per[c] || 0) + v; const k = c + '|' + (f.fornitoreId || f.fornitoreNome); perForn[k] = (perForn[k] || 0) + v; perMese[m] = (perMese[m] || 0) + v; });
    });
    usatiInRicette = null;
    return { per, perForn, perMese, totale: Object.values(per).reduce((s, v) => s + v, 0) };
  }
  // spese fisse che non arrivano in fattura (personale, TARI, assicurazione…): le scrive Tommi, al mese o all'anno
  const fissiDi = () => (S.costiFissi = S.costiFissi || []);
  const mesiTra = (dal, al) => { if (!dal || !al) return 0; const a = new Date(dal + 'T00:00:00'), b = new Date(al + 'T00:00:00'); return Math.max(0, (b - a) / 86400000 + 1) / 30.4375; };
  const fissiAlMese = () => fissiDi().reduce((t, x) => t + (Number(x.euro) || 0) / (x.ogni === 'anno' ? 12 : 1), 0);
  // margine medio a pezzo e pezzi venduti al mese, dalle vendite caricate dalla cassa
  function venditeMedie() {
    const pers = senzaDoppi(S.periodiVendita.slice()); let pezzi = 0, marg = 0, pezziM = 0, incasso = 0, mesi = 0;
    pers.forEach(pp => { const d = dateDiPeriodo(pp); if (d) mesi += mesiTra(d.dal, d.al); });
    S.ricette.forEach(r => { if (r.tipo === 'semilavorato') return; const i = M.indicatori(r);
      pers.forEach(pp => { const q = Number((r.vendite || {})[pp]) || 0; if (!q) return; pezzi += q; incasso += q * (i.netto || 0); if (i.margine != null && i.molt != null) { marg += q * i.margine; pezziM += q; } }); });
    return { mesi, pezziAlMese: mesi ? pezzi / mesi : null, incassoAlMese: mesi ? incasso / mesi : null, margineMedio: pezziM ? marg / pezziM : null };
  }
  // incasso senza IVA nelle date scelte, dalle vendite della cassa (solo i periodi che cadono in quelle date, in proporzione ai giorni)
  function incassoTra(dal, al) {
    const g = (x) => new Date(x + 'T00:00:00').getTime() / 86400000;
    let incasso = 0, giorni = 0;
    senzaDoppi(S.periodiVendita.slice()).forEach(pp => {
      const d = dateDiPeriodo(pp); if (!d) return;
      const a = Math.max(g(d.dal), dal ? g(dal) : -Infinity), b = Math.min(g(d.al), al ? g(al) : Infinity);
      if (b < a) return;
      const quota = (b - a + 1) / (g(d.al) - g(d.dal) + 1);
      let tot = 0; S.ricette.forEach(r => { if (r.tipo === 'semilavorato') return; const q = Number((r.vendite || {})[pp]) || 0; if (q) tot += q * (M.indicatori(r).netto || 0); });
      if (!tot) return;
      incasso += tot * quota; giorni += b - a + 1;
    });
    return giorni ? { alMese: incasso / (giorni / 30.4375), mesi: giorni / 30.4375 } : null;
  }
  // le soglie: quanto di solito pesa ogni spesa su quello che incassi (bar e pub in Italia)
  const SOGLIE_LOCALE = [
    { k: 'merce', cat: () => ['merce'], nome: 'Merce', ok: 30, max: 35, cosa: (X) => X.per.merce || 0,
      rosso: 'La merce costa troppo rispetto a quello che incassi: alza i prezzi delle ricette sotto la soglia (Pannello → «Sotto la soglia»), controlla sprechi, omaggi e dosi.' },
    { k: 'personale', cat: () => ['personale'], nome: 'Personale', ok: 30, max: 35, cosa: (X) => X.per.personale || 0, manca: 'Scrivi il costo del personale in «Spese fisse senza fattura».',
      rosso: 'Il personale pesa troppo: guarda i turni nelle sere più vuote, oppure servono più incassi nelle stesse ore.' },
    { k: 'affitto', cat: () => ['affitto'], nome: 'Affitto', ok: 10, max: 12, cosa: (X) => X.per.affitto || 0,
      rosso: 'L\'affitto non si abbassa facilmente: l\'unica strada è incassare di più (più giorni o più serate piene, prezzi un po\' più alti).' },
    { k: 'utenze', cat: () => ['luce', 'acqua', 'utenze'], nome: 'Luce, gas e acqua', ok: 5, max: 7, cosa: (X) => (X.per.luce || 0) + (X.per.acqua || 0) + (X.per.utenze || 0),
      rosso: 'Le bollette pesano tanto: confronta il prezzo della luce e del gas con altre offerte, e guarda cosa resta acceso a locale chiuso.' },
    { k: 'resto', cat: (X) => Object.keys(X.per).filter(c => !['merce', 'personale', 'affitto', 'luce', 'acqua', 'utenze'].includes(c)), nome: 'Tutte le altre spese', ok: 12, max: 16, cosa: (X) => X.totale - ['merce', 'personale', 'affitto', 'luce', 'acqua', 'utenze'].reduce((t, c) => t + (X.per[c] || 0), 0),
      rosso: 'Le altre spese sono alte: apri «Per tipo di spesa» qui sotto e guarda le più grosse (abbonamenti, pubblicità, consulenze…), una alla volta.' }
  ];
  function schedaSalute(X, mesiP, dal, al) {
    if (!mesiP) return '';
    const auto = incassoTra(dal, al), man = Number(S.incassoMese) || 0, inc = man || (auto && auto.alMese) || 0;
    const campo = `<label class="incasso-man">Incasso vero al mese, senza IVA <small class="tenue">(se lo sai dalla cassa o dal commercialista, è più giusto)</small><input type="text" inputmode="decimal" autocomplete="off" data-incasso-man value="${man ? esc(String(man)) : ''}" placeholder="${auto ? 'dalle vendite: ' + Math.round(auto.alMese) : 'es. 40000'}"></label>`;
    if (!inc) return `<div class="card larga form"><h3>Come va il locale</h3><p class="tenue">Per dirti se spendi troppo serve l'incasso: carica le vendite della cassa per queste date, oppure scrivilo qui.</p>${campo}</div>`;
    // vendite caricate a pezzi (meno di quanto si spende): non è un conto credibile, meglio chiedere l'incasso vero
    if (!man && X.totale / mesiP > inc) return `<div class="card larga form"><h3>Come va il locale</h3><p class="msg giallo">Le vendite caricate per queste date danno circa ${euro(inc, 0)} al mese, meno di quanto spendi (${euro(X.totale / mesiP, 0)} al mese): sembrano incomplete. Scrivi qui l'incasso vero al mese, senza IVA, e ti dico voce per voce se spendi troppo.</p>${campo}</div>`;
    // da dove arriva il numero: fornitore per fornitore (e le spese scritte a mano), al mese e in tutto il periodo
    const daDove = (cats) => {
      const voci = [];
      cats.forEach(c => Object.entries(X.perForn).forEach(([k, val]) => { if (!k.startsWith(c + '|') || !val) return; const id = k.slice(c.length + 1), f = M.fornitore(id); voci.push({ id, nome: id.startsWith('fisso:') ? id.slice(6) : (f ? f.nome : id), fisso: id.startsWith('fisso:'), cat: c, val }); }));
      if (!voci.length) return '<p class="tenue piccolo salute-dove">Nessuna fattura di questo tipo in queste date.</p>';
      voci.sort((a, b) => b.val - a.val);
      const piu = cats.length > 1, primi = voci.slice(0, 40);
      return `<div class="salute-dove"><p class="tenue piccolo">Da dove arriva, nelle date scelte (${Math.round(mesiP * 10) / 10 === 1 ? '1 mese' : String(Math.round(mesiP * 10) / 10).replace('.', ',') + ' mesi'}):</p>
        ${primi.map(x => { const dentro = `<span>${esc(x.nome)}${x.fisso ? ' <small class="tenue">scritta a mano</small>' : ''}${piu && CAT_SPESA[x.cat] ? ` <small class="tenue">· ${CAT_SPESA[x.cat][0]}</small>` : ''}</span><span class="salute-dove-num">${euro(x.val / mesiP, 0)} al mese<small class="tenue">${euro(x.val, 0)} in tutto</small></span>`;
          return x.fisso ? `<div class="riga piccola">${dentro}</div>` : `<a class="riga piccola" href="#/fornitore/${esc(x.id)}">${dentro}</a>`; }).join('')}
        ${voci.length > primi.length ? `<p class="tenue piccolo">…e altri ${voci.length - primi.length}: li trovi tutti in «Per tipo di spesa» qui sotto.</p>` : ''}</div>`;
    };
    const righe = SOGLIE_LOCALE.map(z => {
      const v = z.cosa(X) / mesiP, pc = v / inc * 100;
      if (!v && z.manca) return `<div class="salute-riga"><div class="salute-testa"><b>${z.nome}</b><span class="badge grigio">manca</span></div><p class="tenue piccolo">${z.manca}</p></div>`;
      const st = pc <= z.ok ? 'verde' : pc <= z.max ? 'giallo' : 'rosso';
      return `<details class="salute-riga"><summary><div class="salute-testa"><b>${z.nome} <span class="salute-apri" aria-hidden="true">›</span></b><span class="salute-num">${euro(v, 0)} al mese · <b class="badge ${st}">${Math.round(pc)}%</b></span></div>
        <div class="salute-barra"><b class="${st}" style="width:${Math.min(100, pc / (z.max * 1.6) * 100)}%"></b><i style="left:${z.ok / (z.max * 1.6) * 100}%"></i><i style="left:${z.max / (z.max * 1.6) * 100}%"></i></div>
        <p class="tenue piccolo">Va bene fino al ${z.ok}%, attenzione fino al ${z.max}%.${st === 'rosso' ? '' : st === 'giallo' ? ' Sei al limite.' : ''}</p></summary>${daDove(z.cat(X))}</details>${st === 'rosso' ? `<p class="msg rosso">${z.rosso}</p>` : ''}`;
    }).join('');
    const spese = X.totale / mesiP, utile = inc - spese, pu = utile / inc * 100, stU = pu >= 10 ? 'verde' : pu >= 5 ? 'giallo' : 'rosso';
    return `<div class="card larga form"><h3>Come va il locale</h3>
      <p class="tenue piccolo">Ogni spesa confrontata con quello che incassi: su 100 € incassati, quanti se ne vanno lì. Verde va bene, giallo attenzione, rosso c'è da intervenire. Tocca una voce per vedere da dove arriva il numero.</p>
      <div class="kpi-griglia">${kpi('Incasso al mese', euro(inc, 0), man ? 'scritto da te' : 'dalle vendite della cassa, senza IVA')}${kpi('Spese al mese', euro(spese, 0), 'tutte, merce compresa')}${kpi('Resta al mese', euro(utile, 0), Math.round(pu) + '% dell\'incasso, prima delle tasse sull\'utile', stU)}</div>
      <p class="msg ${stU}">${stU === 'verde' ? 'Il locale guadagna bene: di solito un bar o un pub tiene tra il 10 e il 18% dell\'incasso.' : stU === 'giallo' ? 'Il locale sta in piedi ma guadagna poco: di solito si tiene almeno il 10% dell\'incasso. Guarda qui sotto la voce più rossa o più gialla.' : 'Il locale spende quasi tutto quello che incassa, o di più: guarda qui sotto la voce rossa, è da lì che si parte.'}</p>
      ${righe}
      ${campo}
      ${!man && auto ? '<p class="tenue piccolo">L\'incasso è calcolato dalle vendite delle ricette: se in cassa ci sono cose senza ricetta, l\'incasso vero è più alto e le percentuali sono un po\' più basse di così.</p>' : ''}</div>`;
  }
  const coperturaFatture = () => { const d = S.fatture.map(f => f.data).filter(Boolean).sort(); return d.length ? { dal: d[0], al: d[d.length - 1] } : null; };
  PAGINE.costi = function () {
    const anni = Array.from(new Set(S.fatture.map(f => (f.data || '').slice(0, 4)).filter(Boolean))).sort();
    const sel = ui.costiSel || { tipo: 'anno', anno: anni[anni.length - 1] };
    const mesiFatt = Array.from(new Set(S.fatture.map(f => (f.data || '').slice(0, 7)).filter(m => m.length === 7))).sort().reverse();
    const nomeMeseLungo = (m) => ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'][+m.slice(5) - 1] + ' ' + m.slice(0, 4);
    let dal = null, al = null, etich = 'Tutto';
    if (sel.tipo === 'anno') { dal = sel.anno + '-01-01'; al = sel.anno + '-12-31'; etich = sel.anno; }
    if (sel.tipo === 'mese') { dal = sel.mese + '-01'; al = sel.mese + '-31'; etich = nomeMeseLungo(sel.mese); }
    if (sel.tipo === 'date') { dal = sel.dal || null; al = sel.al || null; etich = 'dal ' + (dal ? dataIt(dal) : '…') + ' al ' + (al ? dataIt(al) : '…'); }
    const X = speseTra(dal, al), cop = coperturaFatture();
    // mesi del periodo scelto (l'anno in corso conta fino all'ultima fattura)
    const finoA = al && cop && al > cop.al ? cop.al : al, daA = dal || (cop && cop.dal), mesiP = sel.tipo === 'mese' ? 1 : mesiTra(daA, finoA || (cop && cop.al));
    const fissi = fissiDi().filter(x => Number(x.euro) > 0).map(x => ({ nome: x.nome || 'Spesa fissa', v: (Number(x.euro) || 0) / (x.ogni === 'anno' ? 12 : 1) * mesiP, cat: x.cat || 'altro' }));
    fissi.forEach(x => { X.per[x.cat] = (X.per[x.cat] || 0) + x.v; X.perForn[x.cat + '|fisso:' + x.nome] = (X.perForn[x.cat + '|fisso:' + x.nome] || 0) + x.v; X.totale += x.v; });
    const cats = Object.keys(CAT_SPESA).filter(c => X.per[c]).sort((a, b) => X.per[b] - X.per[a]);
    const max = Math.max(1, ...cats.map(c => X.per[c]));
    const mesi = Object.keys(X.perMese).sort(), maxM = Math.max(1, ...mesi.map(m => X.perMese[m]));
    const nomeMese = (m) => { const [a, mm] = m.split('-'); return ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'][+mm - 1] + ' ' + a; };
    return { titolo: 'Costi del locale', indietro: '#/altro', html: `
      <div class="chips"><button class="chip ${sel.tipo === 'tutto' ? 'on' : ''}" data-az="costi-sel" data-tipo="tutto">Tutto</button>${anni.map(a => `<button class="chip ${sel.tipo === 'anno' && sel.anno === a ? 'on' : ''}" data-az="costi-sel" data-tipo="anno" data-v="${a}">${a}</button>`).join('')}<select class="chip chip-tendina ${sel.tipo === 'mese' ? 'on' : ''}" data-costi-mese data-no-cerca="1" aria-label="Un mese"><option value="">Un mese…</option>${mesiFatt.map(m => `<option value="${m}" ${sel.tipo === 'mese' && sel.mese === m ? 'selected' : ''}>${nomeMeseLungo(m)}</option>`).join('')}</select><button class="chip ${sel.tipo === 'date' ? 'on' : ''}" data-az="costi-sel" data-tipo="date">📅 Scegli le date</button></div>
      ${sel.tipo === 'date' ? `<div class="card form"><div class="due"><label>Dal<input type="date" data-costi-data="dal" value="${esc(sel.dal || '')}"></label><label>Al<input type="date" data-costi-data="al" value="${esc(sel.al || '')}"></label></div></div>` : ''}
      <div class="kpi-griglia">${kpi('Spese totali', euro(X.totale, 0), 'senza IVA, da tutte le fatture · ' + esc(etich))}${kpi('Merce', euro(X.per.merce || 0, 0), 'già nel costo delle ricette · ' + (X.totale ? Math.round((X.per.merce || 0) / X.totale * 100) + '% del totale' : ''))}${kpi('Tutto il resto', euro(X.totale - (X.per.merce || 0), 0), 'affitto, bollette, servizi, pulizia…')}</div>
      ${cop ? `<p class="tenue piccolo">Fatture caricate dal ${dataIt(cop.dal)} al ${dataIt(cop.al)}. Qui sotto puoi scegliere un solo mese o le date che vuoi. Attenzione: alcune bollette arrivano ogni due mesi e alcune spese una volta l'anno, quindi un mese da solo può sembrare più caro o più leggero del vero; due o tre mesi insieme danno un conto più giusto. Quello che non arriva in fattura (personale, TARI…) scrivilo in «Spese fisse senza fattura».</p>` : ''}
      ${schedaSalute(X, mesiP, daA, finoA || (cop && cop.al))}
      <div class="card larga"><h3>Per tipo di spesa</h3>
        ${cats.length ? cats.map(c => { const fs = Object.entries(X.perForn).filter(([k]) => k.startsWith(c + '|')).map(([k, v]) => { const id = k.slice(c.length + 1); const f = M.fornitore(id); return { id, nome: f ? f.nome : id, v }; }).sort((a, b) => b.v - a.v);
          return `<details class="costo-cat"><summary><span class="costo-nome"><i style="background:${CAT_SPESA[c][1]}"></i>${CAT_SPESA[c][0]}</span><span class="costo-barra"><b style="width:${Math.max(2, X.per[c] / max * 100)}%;background:${CAT_SPESA[c][1]}"></b></span><span class="costo-val">${euro(X.per[c], 0)}</span></summary>
            ${fs.map(x => x.id.startsWith('fisso:') ? `<div class="riga piccola"><span>${esc(x.id.slice(6))} <small class="tenue">scritta a mano</small></span><span>${euro(x.v, 0)}</span></div>` : `<a class="riga piccola" href="#/fornitore/${esc(x.id)}"><span>${esc(x.nome)}</span><span>${euro(x.v, 0)}</span></a>`).join('')}</details>`; }).join('') : '<p class="tenue">Nessuna fattura in queste date.</p>'}
        <p class="tenue piccolo">Tocca un tipo per vedere i fornitori. Se un fornitore è nel tipo sbagliato, aprilo e cambia «Tipo di spesa».</p></div>
      ${schedaFissi()}
      ${schedaPareggio(X, mesiP)}
      ${mesi.length > 1 ? `<div class="card larga"><h3>Mese per mese <small class="tenue">· tocca un mese per vederlo da solo</small></h3>${mesi.map(m => `<div class="costo-cat"><div class="costo-riga cliccabile" data-az="costi-sel" data-tipo="mese" data-v="${m}" role="button" tabindex="0"><span class="costo-nome">${nomeMese(m)}</span><span class="costo-barra"><b style="width:${Math.max(2, X.perMese[m] / maxM * 100)}%"></b></span><span class="costo-val">${euro(X.perMese[m], 0)}</span></div></div>`).join('')}</div>` : ''}` };
  };
  function schedaFissi() {
    const l = fissiDi(), opz = (sel) => Object.entries(CAT_SPESA).filter(([k]) => k !== 'merce' && k !== 'materiali').map(([k, v]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${v[0]}</option>`).join('');
    const proposte = [['Personale (stipendi, contributi, TFR)', 'personale'], ['Immondizia (TARI)', 'rifiuti'], ['Assicurazione', 'assicurazioni'], ['Tasse e imposte', 'tasse']].filter(([n]) => !l.some(x => x.nome === n));
    return `<div class="card larga form"><h3>Spese fisse senza fattura</h3>
      <p class="tenue piccolo">Quello che paghi ma che non arriva in fattura: il costo totale del personale, la TARI, l'assicurazione… Scrivi il nome che vuoi e quanto, al mese o all'anno. Entra nei conti qui sopra e nel conto per andare in pari.</p>
      ${l.map((x, i) => `<div class="fisso-riga"><input data-fisso="${i}" data-k="nome" value="${esc(x.nome)}" placeholder="es. Personale" aria-label="Nome"><input type="text" inputmode="decimal" autocomplete="off" data-fisso="${i}" data-k="euro" value="${esc(x.euro)}" placeholder="0" aria-label="Euro">
        <select data-fisso="${i}" data-k="ogni" aria-label="Ogni quanto"><option value="mese" ${x.ogni !== 'anno' ? 'selected' : ''}>€ al mese</option><option value="anno" ${x.ogni === 'anno' ? 'selected' : ''}>€ all'anno</option></select>
        <select data-fisso="${i}" data-k="cat" aria-label="Tipo di spesa">${opz(x.cat || 'altro')}</select><button class="x" data-az="fisso-togli" data-i="${i}" aria-label="Togli">✕</button></div>`).join('')}
      <div class="bottoni">${proposte.map(([n, c]) => `<button class="btn piccolo" data-az="fisso-nuovo" data-nome="${esc(n)}" data-cat="${c}">＋ ${esc(n.replace(/ \(.*$/, ''))}</button>`).join('')}<button class="btn piccolo" data-az="fisso-nuovo" data-nome="" data-cat="altro">＋ Altra spesa</button></div>
      ${l.length ? `<p class="kpi-riga">In tutto: <b>${euro(fissiAlMese(), 0)} al mese</b></p>` : ''}</div>`;
  }
  function schedaPareggio(X, mesiP) {
    const V = venditeMedie();
    const fissiMese = mesiP ? (X.totale - (X.per.merce || 0)) / mesiP : 0; // la merce è già nel costo dei drink; i materiali (detersivi, carta…) no
    if (!fissiMese) return '';
    const pezzi = V.margineMedio ? fissiMese / V.margineMedio : null;
    const stato = pezzi && V.pezziAlMese ? V.pezziAlMese - pezzi : null;
    return `<div class="card larga"><h3>Quanto vendere per andare in pari</h3>
      <div class="kpi-griglia">${kpi('Spese del locale al mese', euro(fissiMese, 0), 'tutto tranne la merce (che è già nel costo dei drink), in media nel periodo scelto')}${kpi('Guadagno medio a pezzo', V.margineMedio != null ? euro(V.margineMedio) : '—', 'prezzo senza IVA meno merce, sulle ricette vendute')}${kpi('Pezzi da vendere al mese', pezzi ? qta(Math.round(pezzi)) : '—', 'per coprire le spese del locale')}${kpi('Pezzi venduti al mese', V.pezziAlMese ? qta(Math.round(V.pezziAlMese)) : '—', 'in media, dalle vendite della cassa', stato == null ? '' : stato >= 0 ? 'verde' : 'rosso')}</div>
      ${stato != null ? `<p class="msg ${stato >= 0 ? 'verde' : 'rosso'}">${stato >= 0 ? `Sei sopra di circa <b>${qta(Math.round(stato))} pezzi al mese</b>: quelli sono il guadagno del locale (circa ${euro(stato * V.margineMedio, 0)} al mese, prima delle tasse sull'utile).` : `Mancano circa <b>${qta(Math.round(-stato))} pezzi al mese</b> per coprire le spese.`}</p>` : '<p class="tenue piccolo">Per il conto servono le vendite della cassa e le ricette con il costo.</p>'}
      <p class="tenue piccolo">È una stima: usa il guadagno medio di quello che vendi. Più ricette complete hai e più spese hai scritto (personale compreso), più è giusta.</p></div>`;
  }
  AZ['fisso-nuovo'] = (el) => { fissiDi().push({ id: M.uid('cf'), nome: el.dataset.nome || '', euro: '', ogni: 'mese', cat: el.dataset.cat || 'altro' }); salva(); ridisegnaMantenendo(); };
  AZ['fisso-togli'] = (el) => { fissiDi().splice(+el.dataset.i, 1); salva(); ridisegnaMantenendo(); };
  AZ['costi-sel'] = (el) => { const t = el.dataset.tipo, p = ui.costiSel || {}; ui.costiSel = t === 'anno' ? { tipo: t, anno: el.dataset.v } : t === 'mese' ? { tipo: t, mese: el.dataset.v } : t === 'date' ? { tipo: t, dal: p.dal || '', al: p.al || '' } : { tipo: t }; ridisegnaMantenendo(); };
  AZ['ordine-ricette'] = (el) => { ui.ordineRicette = el.dataset.v; ridisegnaMantenendo(); };
  AZ['ric-per'] = (el) => { ui.ricPer = el.dataset.v; ridisegnaMantenendo(); };
  AZ['ric-dacomp'] = () => { ui.ricDaComp = !ui.ricDaComp; ridisegnaMantenendo(); };
  AZ['riv-inizia'] = () => { const o = ordineRic(); ui.rivOrdine = o === 'vendute' ? 'piu' : o === 'menovendute' ? 'meno' : 'nome'; if (o === 'vendute' || o === 'menovendute') ui.rivPer = ui.ricPer || '*'; ui.rivIdx = 0; ui.rivStorico = []; ui.rivFisso = null; ui.rivFiltro = ui.ricDaComp ? 'incomplete' : (ui.rivFiltro || 'darivedere'); ui.bozza = null; vai('#/rivedi-ricette'); };
  AZ['riv-tipo'] = (el) => { ui.tipoRicette = el.dataset.v; if (SCELTE_REP[el.dataset.v]) ui.repRicette = el.dataset.v; ui.rivIdx = 0; ui.rivFisso = null; ui.rivStorico = []; ui.bozza = null; ridisegnaMantenendo(); };
  AZ['riv-filtro'] = (el) => { ui.rivFiltro = el.dataset.v; ui.rivIdx = 0; ui.rivFisso = null; ui.rivStorico = []; ui.bozza = null; ridisegnaMantenendo(); };
  AZ['riv-ordine'] = (el) => { ui.rivOrdine = el.dataset.v; ui.rivIdx = 0; ui.rivFisso = null; ui.rivStorico = []; ui.bozza = null; ridisegnaMantenendo(); };
  AZ['riv-per'] = (el) => { ui.rivPer = el.dataset.v; ui.rivIdx = 0; ui.rivFisso = null; ui.rivStorico = []; ui.bozza = null; ridisegnaMantenendo(); };
  AZ['nota-via'] = (el) => {
    const r = M.ricetta(el.dataset.id); if (!r) return;
    r.note = ''; if (ui.bozza && ui.bozza._per === 'r:' + r.id) ui.bozza.note = '';
    salva(); ridisegnaMantenendo();
  };
  AZ['riv-salta'] = () => {
    const l = listaRivedi(), cor = l[ui.rivIdx || 0];
    if (cor) (ui.rivStorico = ui.rivStorico || []).push({ id: cor.id });
    if (cor && cor.id === ui.rivFisso) { ui.rivFisso = null; const n = listaRivedi(); ui.rivIdx = n.length < l.length ? (ui.rivIdx || 0) : (ui.rivIdx || 0) + 1; }
    else ui.rivIdx = (ui.rivIdx || 0) + 1;
    ui.bozza = null; ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['riv-indietro'] = () => {
    // torno alla ricetta di prima così com'è salvata (anche se è già uscita dall'elenco «da rivedere») e la puoi correggere
    const u = (ui.rivStorico || []).pop();
    const prec = u && M.ricetta(u.id);
    if (prec) { ui.rivFisso = prec.id; const i = listaRivedi().indexOf(prec); ui.rivIdx = i >= 0 ? i : 0; }
    else ui.rivIdx = Math.max(0, (ui.rivIdx || 0) - 1);
    ui.bozza = null; ridisegnaMantenendo(); window.scrollTo(0, 0);
  };
  AZ['riv-salva'] = () => {
    const prima = listaRivedi(); const pos = ui.rivIdx || 0;
    const b = salvaBozzaRicetta(); if (!b) return;
    const r = M.ricetta(b.id); r.rivista = true; salva();
    (ui.rivStorico = ui.rivStorico || []).push({ id: r.id });
    if (ui.rivFisso === r.id) ui.rivFisso = null;
    // se la ricetta è uscita dall'elenco (era «da rivedere») resto allo stesso posto, sennò vado avanti
    ui.rivIdx = listaRivedi().length < prima.length ? pos : pos + 1;
    ridisegnaMantenendo(); window.scrollTo(0, 0); avviso('Salvata: ' + b.nome);
  };
  AZ['elimina-ricetta'] = () => {
    const b = ui.bozza; const uso = M.usatoIn('r:' + b.id).dirette;
    if (!confirm(uso.length ? `${b.nome} è usata in ${uso.map(r => r.nome).join(', ')}. Eliminarla lo stesso?` : 'Eliminare ' + b.nome + '?')) return;
    togliRicetta(b.id); ui.bozza = null; salva(); vai('#/ricette'); avviso('Ricetta spostata nel Cestino: da lì la puoi rimettere.');
  };
  AZ['duplica-ricetta'] = (el) => { const r = JSON.parse(JSON.stringify(M.ricetta(el.dataset.id))); r.id = M.uid('r'); r.nome += ' (copia)'; r.vendite = {}; S.ricette.push(r); salva(); vai('#/modifica-ricetta/' + r.id); };
  AZ['registra-fattura'] = (el) => { const f = S.fatture.find(x => x.id === el.dataset.id); M.registraFattura(f); salva(); window.scrollTo(0, 0); disegna(); avviso('Fattura registrata: costi aggiornati.'); };
  AZ['annulla-fattura'] = (el) => { if (!confirm('Annullare la registrazione? Tolgo i prezzi di questa fattura.')) return; const f = S.fatture.find(x => x.id === el.dataset.id); M.annullaFattura(f); salva(); ridisegnaMantenendo(); };
  AZ['stato-fatt'] = (el) => { ui.statoFatt = el.dataset.v; ridisegnaMantenendo(); };
  AZ['toggle-casse'] = (el) => {
    const fo = M.fornitore(el.dataset.id); if (!fo) return; fo.casseAMeta = el.checked;
    // ricalcolo i prezzi delle sue fatture registrate, nell'altro verso se l'ho spento
    S.fatture.filter(f => f.fornitoreId === fo.id && f.stato === 'registrata').forEach(f => {
      const an = M.analizzaFattura(f);
      an.prodotti.forEach(x => { const p = M.prodotto(x.prodottoId); const e = p && (p.prezzi || []).find(v => v.fatturaId === f.id); if (!e || x.nuovo == null) return; if (x.raddoppiata) { e.prezzo = x.nuovo; e.listino = x.listino; e.raddoppiato = true; } else if (e.raddoppiato) { e.prezzo = x.nuovo; e.listino = x.listino; delete e.raddoppiato; } });
    });
    M.svuota(); salva(); ridisegnaMantenendo(); avviso(fo.casseAMeta ? 'Prezzi a cassa raddoppiati.' : 'Prezzi a cassa tornati come in fattura.');
  };
  AZ['riga-merce'] = (el) => {
    const f = S.fatture.find(x => x.id === el.dataset.id); if (!f) return; const rg = f.righe[+el.dataset.k]; if (!rg) return;
    M.annullaFattura(f); rg.ignora = false; rg.automatico = false; rg.prodottoId = null; rg.forzaMerce = true;
    // non va più saltata in automatico nelle prossime fatture dello stesso fornitore
    const nn = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
    S.ignorati = (S.ignorati || []).filter(x => !(x.fornitoreId === f.fornitoreId && ((rg.codice && x.codice === rg.codice) || nn(x.descrizione) === nn(rg.descrizione))));
    salva(); ridisegnaMantenendo(); avviso('Ora scegli il prodotto per questa riga (o creane uno nuovo), poi registra di nuovo la fattura.');
  };
  AZ['elimina-fattura'] = (el) => { if (!confirm('Eliminare la fattura? Finisce nel Cestino.')) return; const f = S.fatture.find(x => x.id === el.dataset.id); nelCestino('fatture', f); M.annullaFattura(f); S.fatture = S.fatture.filter(x => x !== f); salva(); vai('#/fatture'); };
  AZ.pagata = (el) => { const f = S.fatture.find(x => x.id === el.dataset.id); f.scadenze[+el.dataset.k].pagata = el.checked; salva(); setTimeout(ridisegnaMantenendo, 150); };
  AZ['nuovo-fornitore'] = () => { const n = prompt('Nome del fornitore'); if (!n) return; const f = { id: M.uid('f'), nome: n.trim(), piva: '', telefono: '', email: '', referente: '', giorniConsegna: '', note: '' }; S.fornitori.push(f); salva(); vai('#/fornitore/' + f.id); };
  AZ['elimina-fornitore'] = (el) => { if (!confirm('Eliminare il fornitore? Prodotti e fatture restano. Il fornitore finisce nel Cestino.')) return; const fo = M.fornitore(el.dataset.id); if (fo) nelCestino('fornitori', fo); S.fornitori = S.fornitori.filter(f => f.id !== el.dataset.id); salva(); vai('#/fornitori'); };
  AZ['inizia-conta'] = () => { ui.conta = { rep: '', cats: [], valori: {} }; ridisegnaMantenendo(); };
  AZ['esci-conta'] = () => { ui.conta = null; ridisegnaMantenendo(); };
  AZ['conta-filtro'] = (el) => { cambiaReparti(ui.conta, el); ridisegnaMantenendo(); };
  const passo = (id, d) => { const p = M.prodotto(id); const v = ui.conta.valori[id] != null ? ui.conta.valori[id] : (Number(p.giacenza) || 0); ui.conta.valori[id] = Math.max(0, Math.round((v + d) * 100) / 100); ridisegnaMantenendo(); };
  AZ['conta-meno'] = (el) => passo(el.dataset.id, -1);
  AZ['conta-piu'] = (el) => passo(el.dataset.id, 1);
  AZ['salva-conta'] = () => {
    const v = ui.conta.valori; const righe = [];
    Object.entries(v).forEach(([id, reale]) => { const p = M.prodotto(id); const teorica = Number(p.giacenza) || 0; righe.push({ prodottoId: id, teorica, reale, valore: (reale - teorica) * (M.prezzo(p) || 0) }); p.giacenza = reale; });
    if (!righe.length) { ui.conta = null; ridisegnaMantenendo(); return; }
    S.conte.push({ id: M.uid('c'), data: M.oggi(), righe, differenzaValore: righe.reduce((s, r) => s + r.valore, 0) });
    ui.conta = null; salva(); ridisegnaMantenendo(); avviso('Conta salvata.');
  };
  AZ.copia = (el) => { navigator.clipboard.writeText(el.dataset.testo).then(() => avviso('Ordine copiato.'), () => alert(el.dataset.testo)); };
  const nomeDaDate = (dal, al) => {
    const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    if (!dal || !al) return '';
    const [a1, m1] = dal.split('-').map(Number), [a2, m2] = al.split('-').map(Number);
    const M1 = mesi[m1 - 1], M2 = mesi[m2 - 1], cap = (s) => s[0].toUpperCase() + s.slice(1);
    if (a1 === a2 && m1 === 1 && m2 === 12) return String(a1);
    if (a1 === a2 && m1 === m2) return cap(M1) + ' ' + a1;
    if (a1 === a2) return cap(M1.slice(0, 3)) + '-' + M2.slice(0, 3) + ' ' + a1;
    return cap(M1.slice(0, 3)) + ' ' + a1 + ' - ' + M2.slice(0, 3) + ' ' + a2;
  };
  AZ['vend-per'] = (el) => { ui.vendPer = el.dataset.v; ridisegnaMantenendo(); };
  AZ['vend-nuovo'] = () => { ui.vendNuovo = {}; ridisegnaMantenendo(); };
  AZ['vend-annulla'] = () => { ui.vendNuovo = null; ridisegnaMantenendo(); };
  AZ['vend-crea'] = () => {
    const dal = $('#vn-dal').value, al = $('#vn-al').value;
    const nome = ($('#vn-nome').value || '').trim() || nomeDaDate(dal, al);
    if (!nome) { alert('Metti le date oppure un nome.'); return; }
    if (dal && al && al < dal) { alert('La data di fine è prima di quella di inizio.'); return; }
    if (S.periodiVendita.includes(nome)) { alert('Esiste già un periodo con questo nome.'); return; }
    S.periodiVendita.push(nome); S.periodiDate = S.periodiDate || {}; if (dal && al) S.periodiDate[nome] = { dal, al };
    ui.vendPer = nome; ui.vendNuovo = null; salva(); ridisegnaMantenendo();
  };
  AZ['vend-rinomina'] = () => {
    const vec = ui.vendPer; const n = (prompt('Nuovo nome del periodo', vec) || '').trim();
    if (!n || n === vec) return; if (S.periodiVendita.includes(n)) { alert('Esiste già.'); return; }
    S.periodiVendita = S.periodiVendita.map(x => x === vec ? n : x);
    S.periodiScaricati = S.periodiScaricati.map(x => x === vec ? n : x);
    if (S.periodiDate && S.periodiDate[vec]) { S.periodiDate[n] = S.periodiDate[vec]; delete S.periodiDate[vec]; }
    S.ricette.forEach(r => { if (r.vendite && r.vendite[vec] != null) { r.vendite[n] = r.vendite[vec]; delete r.vendite[vec]; } });
    (S.eventi || []).forEach(() => {});
    ui.vendPer = n; salva(); ridisegnaMantenendo();
  };
  AZ['vend-elimina'] = () => {
    const vec = ui.vendPer; if (!confirm(`Elimino il periodo «${vec}» e le sue vendite? Finisce nel Cestino.`)) return;
    const vend = {}; S.ricette.forEach(r => { if (r.vendite && r.vendite[vec] != null) vend[r.id] = r.vendite[vec]; });
    nelCestino('periodi', { nome: vec, date: (S.periodiDate || {})[vec] || null, cassa: S.periodiCassa[vec] || null, scaricato: S.periodiScaricati.includes(vec), vendite: vend });
    S.periodiVendita = S.periodiVendita.filter(x => x !== vec); S.periodiScaricati = S.periodiScaricati.filter(x => x !== vec);
    if (S.periodiDate) delete S.periodiDate[vec]; if (S.periodiCassa) delete S.periodiCassa[vec];
    S.ricette.forEach(r => { if (r.vendite) delete r.vendite[vec]; });
    ui.vendPer = null; salva(); ridisegnaMantenendo();
  };
  AZ['nuovo-periodo'] = () => { const n = prompt('Nome del periodo (es. Novembre 2026)'); if (!n || S.periodiVendita.includes(n)) return; S.periodiVendita.push(n.trim()); salva(); ridisegnaMantenendo(); };
  AZ.scarica = (el) => {
    const pp = el.dataset.p; const acc = {};
    S.ricette.forEach(r => { const q = (r.vendite || {})[pp]; if (q) M.consumoBase(r, q, acc); });
    const elenco = Object.entries(acc).map(([id, q]) => { const p = M.prodotto(id); return { p, conf: q / (p.contenuto || 1) }; }).filter(x => !x.p.speciale);
    if (!elenco.length) { alert('Nessuna vendita in questo periodo.'); return; }
    if (!confirm(`Tolgo dal magazzino gli ingredienti di ${pp}:\n` + elenco.slice(0, 12).map(x => `${x.p.nomeBreve}: ${qta(Math.round(x.conf * 100) / 100)} ${x.p.confezione}`).join('\n') + (elenco.length > 12 ? '\n…' : '') + '\nProcedo?')) return;
    elenco.forEach(x => { x.p.giacenza = Math.round(((Number(x.p.giacenza) || 0) - x.conf) * 100) / 100; });
    S.periodiScaricati.push(pp); salva(); ridisegnaMantenendo(); avviso('Magazzino aggiornato.');
  };
  AZ['mappa-gruppo'] = (el) => { ui.mappaGruppo = el.dataset.v; ridisegnaMantenendo(); };
  AZ['mappa-periodo'] = (el) => { ui.mappaPeriodo = el.dataset.v; ridisegnaMantenendo(); };
  AZ['sim-modo'] = (el) => { ui.sim.modo = el.dataset.v; ridisegnaMantenendo(); };
  AZ['sim-perc'] = (el) => { ui.sim.inPercentuale = el.checked; ridisegnaMantenendo(); };
  AZ['sim-calcola'] = () => ridisegnaMantenendo();
  AZ['nuovo-evento'] = () => { const n = prompt('Nome dell\'evento'); if (!n) return; const e = { id: M.uid('e'), nome: n.trim(), data: M.oggi(), righe: [], extraPerPezzo: [], note: '' }; S.eventi.push(e); salva(); vai('#/evento/' + e.id); };
  AZ['ev-togli'] = (el) => { const e = S.eventi.find(x => x.id === el.dataset.id); e.righe.splice(+el.dataset.k, 1); salva(); ridisegnaMantenendo(); };
  AZ['elimina-evento'] = (el) => { if (!confirm('Eliminare l\'evento? Finisce nel Cestino.')) return; const ev = S.eventi.find(x => x.id === el.dataset.id); if (ev) nelCestino('eventi', ev); S.eventi = S.eventi.filter(x => x.id !== el.dataset.id); salva(); vai('#/eventi'); };
  const dateOlio = () => { const d = datePredefiniteOlio(); return { dal: ui.olioDal || d.dal, al: ui.olioAl || d.al }; };
  AZ['olio-usa'] = () => { const d = dateOlio(), k = calcoloOlio(d.dal, d.al); if (!k.c || k.spesa <= 0) return; const o = S.impostazioni.olio; o.spesaAnnua = Math.round(k.spesa * 100) / 100; o.grammiFritti = Math.round(k.grammi); o.origine = 'dal ' + dataIt(d.dal) + ' al ' + dataIt(d.al); M.svuota(); salva(); ridisegnaMantenendo(); avviso('Costo dell\'olio aggiornato: le ricette dei fritti si ricalcolano.'); };
  AZ['olio-date-def'] = () => { ui.olioDal = ui.olioAl = null; ridisegnaMantenendo(); };
  AZ['olio-escludi'] = (el) => { const o = S.impostazioni.olio, l = new Set(o.esclusi || []); if (l.has(el.dataset.id)) l.delete(el.dataset.id); else l.add(el.dataset.id); o.esclusi = Array.from(l); salva(); ridisegnaMantenendo(); };
  AZ['olio-togli'] = (el) => { const r = M.ricetta(el.dataset.id), rg = r && rigaOlio(r); if (!rg) return; if (!confirm(`Tolgo la frittura da «${r.nome}»? Non costerà più olio.`)) return; r.righe = r.righe.filter(x => x !== rg); M.svuota(); salva(); ridisegnaMantenendo(); };
  AZ['olio-aggiungi'] = () => { const id = ($('#olio-nuova') || {}).value, gr = numDa(($('#olio-nuova-g') || {}).value); const r = M.ricetta(id); if (!r) { alert('Scegli la ricetta.'); return; } if (!gr) { alert('Scrivi quanti grammi vanno nell\'olio per una porzione.'); return; } const rif = rifOlio(); if (!rif) { alert('Manca il prodotto «Olio di frittura».'); return; } r.righe = (r.righe || []).concat({ rif, quantita: gr }); M.svuota(); salva(); ridisegnaMantenendo(); avviso(`«${r.nome}» aggiunta ai fritti.`); };
  AZ['olio-da-tabella'] = () => { const o = S.impostazioni.olio; o.grammiFritti = o.dettaglio.reduce((s, d) => s + d[1] * d[2], 0); salva(); ridisegnaMantenendo(); };
  AZ['olio-riga'] = () => { S.impostazioni.olio.dettaglio.push(['Nuovo piatto', 0, 0]); salva(); ridisegnaMantenendo(); };
  AZ['esporta-excel'] = esportaExcel;
  AZ['controlla-casella'] = () => controllaCasella(true);
  AZ['pc-usa'] = (el) => { ui.prezziNuovi = ui.prezziNuovi || {}; ui.prezziNuovi[el.dataset.id] = +el.dataset.v; ridisegnaMantenendo(); };
  AZ['pc-tutti'] = () => { ui.prezziNuovi = {}; S.ricette.forEach(r => { if (r.tipo !== 'semilavorato' && completa(r) && M.indicatori(r).sotto) { const c = prezzoConsigliato(r), pr = M.indicatori(r).prezzo; if (c && !(pr && c > pr * 2.5)) ui.prezziNuovi[r.id] = c; } }); ridisegnaMantenendo(); };
  AZ['pc-annulla'] = () => { ui.prezziNuovi = {}; ridisegnaMantenendo(); };
  AZ['pc-salva'] = () => {
    const l = Object.entries(ui.prezziNuovi || {}).filter(([id, v]) => M.ricetta(id) && v > 0);
    if (!l.length) { alert('Non hai scritto nessun prezzo nuovo.'); return; }
    if (!confirm(`Cambio il prezzo di ${l.length} ${l.length === 1 ? 'ricetta' : 'ricette'}? Ricordati di cambiarli anche nella cassa.`)) return;
    l.forEach(([id, v]) => { M.ricetta(id).prezzo = v; });
    ui.prezziNuovi = {}; M.svuota(); salva(); ridisegnaMantenendo(); avviso('Prezzi cambiati.');
  };
  AZ['aum-per'] = (el) => { ui.aumGiorni = el.dataset.v; ridisegnaMantenendo(); };
  AZ['all-scegli'] = () => { ui.allScegli = !ui.allScegli; if (ui.allScegli) ui.allMod = false; ridisegnaMantenendo(); };
  AZ['all-mod'] = () => { if (!ui.allMod) ui.allScegli = false; ui.allMod = !ui.allMod; ridisegnaMantenendo(); };
  // quali prodotti (anche dentro le preparazioni) portano un allergene in una ricetta
  function fontiAllergene(r, a, pila) {
    pila = pila || []; if (pila.includes(r.id)) return [];
    let l = [];
    (r.righe || []).forEach(rg => {
      const o = M.rif(rg.rif); if (!o) return;
      if (rg.rif.startsWith('p:')) { if ((o.allergeni || []).includes(a)) l.push(o.nomeBreve); }
      else { if ((o.allergeni || []).includes(a)) l.push(o.nome + ' (segnato a mano)'); l = l.concat(fontiAllergene(o, a, pila.concat(r.id))); }
    });
    return Array.from(new Set(l));
  }
  AZ['all-cella'] = (el) => {
    const r = M.ricetta(el.dataset.id), a = el.dataset.v; if (!r) return;
    const fonti = fontiAllergene(r, a);
    if (fonti.length) { avviso(`${a} in «${r.nome}» arriva da: ${fonti.join(', ')}. Per toglierlo cambia la scheda di quel prodotto.`); return; }
    r.allergeni = r.allergeni || [];
    const c = r.allergeni.includes(a);
    r.allergeni = c ? r.allergeni.filter(x => x !== a) : r.allergeni.concat(a);
    salva(); ridisegnaMantenendo();
    avviso(c ? `Tolto: ${a} da «${r.nome}»` : `Aggiunto: ${a} a «${r.nome}»`);
  };
  AZ['all-rep'] = (el) => { ui.allRep = el.dataset.v; ridisegnaMantenendo(); };
  AZ.stampa = () => window.print();
  // tabella degli allergeni in PDF (su iPhone e iPad «stampa» dall'app sulla schermata Home non funziona: il PDF si condivide, si stampa o si salva)
  AZ['all-pdf'] = async () => {
    modale('<h3>Preparo il PDF…</h3><div class="rotella"></div>');
    try {
      if (!window.jspdf) await caricaScript('jspdf.umd.min.js');
      if (!window.jspdf.jsPDF.API.autoTable) await caricaScript('jspdf.plugin.autotable.min.js');
      const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const rep = ui.allRep || '*tutto';
      const l = [].concat(...gruppiAllergeni(false).map(G => G.l));
      const body = []; let g = null;
      l.forEach(r => { const gg = M.TIPI[r.tipo] || ''; if (gg !== g) { g = gg; body.push([{ content: gg, colSpan: M.ALLERGENI.length + 1, styles: { fillColor: [235, 230, 220], fontStyle: 'bold' } }]); } const al = M.allergeniRicetta(r); body.push([r.nome + (!(r.righe || []).length ? '  (da completare)' : '')].concat(M.ALLERGENI.map(a => al.includes(a) ? 'X' : ''))); });
      doc.setFontSize(15); doc.text('Repub · Allergeni' + (rep === '*bar' ? ' · Bar' : rep === '*cucina' ? ' · Cucina' : ''), 10, 12);
      doc.setFontSize(8.5); doc.text('Sostanze che provocano allergie o intolleranze (Reg. UE 1169/2011), aggiornato al ' + dataIt(M.oggi()) + '. Per informazioni chiedi al personale.', 10, 17);
      doc.autoTable({
        startY: 21, head: [['Piatto o drink'].concat(M.ALLERGENI)], body, theme: 'grid', margin: { left: 10, right: 10 },
        styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: [210, 205, 195], lineWidth: 0.1, valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [40, 40, 40], fontStyle: 'bold', minCellHeight: 26, valign: 'bottom' },
        columnStyles: Object.assign({ 0: { cellWidth: 'auto' } }, ...M.ALLERGENI.map((a, k) => ({ [k + 1]: { cellWidth: 14, halign: 'center' } }))),
        didParseCell: (d) => { if (d.section === 'head' && d.column.index > 0) { d.cell.raw0 = d.cell.text[0]; d.cell.text = ['']; } if (d.section === 'body' && d.column.index > 0 && d.cell.raw === 'X') { d.cell.text = ['']; d.cell.segno = true; } },
        didDrawCell: (d) => {
          if (d.section === 'head' && d.column.index > 0 && d.cell.raw0) { doc.setFontSize(7.5); doc.setFont(undefined, 'bold'); doc.text(d.cell.raw0, d.cell.x + d.cell.width / 2 + 1.2, d.cell.y + d.cell.height - 1.5, { angle: 90 }); }
          if (d.section === 'body' && d.cell.segno) { doc.setFillColor(29, 84, 70); doc.circle(d.cell.x + d.cell.width / 2, d.cell.y + d.cell.height / 2, 1.4, 'F'); }
        }
      });
      const nome = 'Allergeni Repub ' + M.oggi() + '.pdf', blob = doc.output('blob'), file = new File([blob], nome, { type: 'application/pdf' });
      chiudiModale();
      const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
      if (ios && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Allergeni Repub' }); } catch (e) { /* chiuso */ } return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { chiudiModale(); alert('Non sono riuscito a fare il PDF: ' + e.message); }
  };
  AZ['copia-sheet'] = () => copiaSuSheet(true);
  AZ['copia-sheet-scarica'] = () => scaricaUltimaCopia();
  AZ['copia-codice'] = () => { const t = ($('#codice-sheet') || {}).textContent || ''; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => avviso('Codice copiato.')).catch(() => { const r = document.createRange(); r.selectNodeContents($('#codice-sheet')); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); alert('Il codice è selezionato: copialo con Comando + C.'); }); };
  AZ['scarica-copia'] = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' })); a.download = 'gestionale-repub-' + M.oggi() + '.json'; a.click(); };
  AZ.ripristina = () => {
    if (!confirm('Cancello tutto quello che hai fatto e riparto dai dati della prova. Sicuro?')) return;
    if (CLOUD) { const cas = S.casella, ch = S.impostazioni.chiaveClaude; prepara(JSON.parse(JSON.stringify(window.DATI_INIZIALI))); S.casella = Object.assign(cas, { visti: [] }); S.impostazioni.chiaveClaude = ch; salva(); vai('#/pannello'); disegna(); return; }
    localStorage.removeItem(CHIAVE); location.hash = '#/pannello'; location.reload();
  };
  AZ.esci = () => { if (confirm('Vuoi uscire?')) firebase.auth().signOut(); };
  AZ['porta-locali'] = () => { if (confirm('Porto online le fatture salvate su questo dispositivo? Quelle già presenti vengono saltate.')) portaFattureLocali(); };

  document.addEventListener('keydown', (e) => {
    if (e.target.dataset && e.target.dataset.cr != null) {
      if (e.key === 'Enter') { e.preventDefault(); const b = document.querySelector(`#sugg-${e.target.dataset.cr} .sugg-voce`); if (b) b.click(); return; }
      if (e.key === 'Escape') { const box = document.getElementById('sugg-' + e.target.dataset.cr); if (box) box.innerHTML = ''; return; }
    }
    const h = location.hash || '';
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.fmtRighe) {
      e.preventDefault(); const t = e.target, id = t.dataset.fmtRighe; t.blur();
      setTimeout(() => { const b = $(`[data-az="fmt-giusto"][data-id="${id}"]`); if (b) b.click(); else { const p = M.prodotto(id); if (p) { p.formatoOk = true; p.daCompletare = false; salva(); } } }, 80); return;
    }
    if (h.startsWith('#/pulizia') && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName || '')) {
      if (e.key === 'Enter') { const b = $('[data-az="pul-si"]'); if (b) { e.preventDefault(); b.click(); } }
      if (e.key === 'ArrowRight') { e.preventDefault(); AZ['pul-salta'](); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); AZ['pul-indietro'](); }
      return;
    }
    if (!(h.startsWith('#/controllo') || h.startsWith('#/formati')) || /INPUT|SELECT|TEXTAREA/.test((e.target.tagName || ''))) return;
    const f = h.startsWith('#/controllo-fatture') ? 'ctrlf' : h.startsWith('#/formati') ? 'fmt' : 'ctrl';
    if (e.key === 'Enter') { const b = $({ ctrlf: '[data-az="ctrlf-ok"]', ctrl: '[data-az="ctrl-giusto"]', fmt: '[data-az="fmt-giusto"]' }[f]); if (b) { e.preventDefault(); b.click(); } }
    if (e.key === 'ArrowRight') { e.preventDefault(); AZ[f + '-salta'](); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); AZ[f + '-indietro'](); }
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-az]');
    if (!el || el.tagName === 'SELECT') return;
    const fn = AZ[el.dataset.az]; if (!fn) return;
    if (el.type !== 'checkbox') e.preventDefault();
    const prima = location.hash;
    try { fn(el, e); } catch (err) { console.error(err); alert('Qualcosa non ha funzionato (' + (el.dataset.az || '') + '): ' + (err && err.message || err) + '\nFai una foto di questo messaggio e mandala a Claude.'); return; }
    // un collegamento che prepara qualcosa (filtri, posizione) e poi deve comunque aprire la sua pagina
    const h = el.tagName === 'A' && el.getAttribute('href');
    if (h && h.startsWith('#') && el.dataset.az !== 'indietro' && location.hash === prima && h !== prima) vai(h);
  });

  // ---------- Campi ----------
  document.addEventListener('input', (e) => {
    const el = e.target; const d = el.dataset;
    if (d.filtro === 'vendFiltro') { ui.vendFiltro = el.value; const f = el.value.toLowerCase(); document.querySelectorAll('.vend-riga').forEach(x => { x.style.display = !f || x.textContent.toLowerCase().includes(f) ? '' : 'none'; }); document.querySelectorAll('.griglia-vend > .card').forEach(c => { c.style.display = [...c.querySelectorAll('.vend-riga')].some(x => x.style.display !== 'none') ? '' : 'none'; }); return; }
    if (d.filtro === 'fatture') { ui.filtroFatt = el.value; const x = $('#lista-fatt'); if (x) x.innerHTML = listaFatture(); return; }
    if (d.filtro === 'fornitori') { ui.filtroForn = el.value; const t = normCassa(el.value); document.querySelectorAll('#lista-forn [data-nome]').forEach(x => { x.hidden = t && !x.dataset.nome.includes(t); }); return; }
    if (d.filtro === 'prodotti') { ui.filtroProdotti = el.value; $('#lista').innerHTML = listaProdotti(); return; }
    if (d.filtro === 'ricette') {
      ui.filtroRicette = el.value; $('#lista').innerHTML = listaRicette();
      const bt = $('[data-az="riv-inizia"]'); if (bt) bt.textContent = 'Rivedi ' + (el.value ? 'quelle con «' + el.value + '»' : 'le ' + nomeScelta(ui.tipoRicette)) + ' una per una';
      return;
    }
    if (d.media && ui.bozza) { ui.bozza.media = el.checked; ridisegnaMantenendo(); return; }
    if (d.pc) { ui.prezziNuovi = ui.prezziNuovi || {}; const n = numDa(el.value); if (n > 0) ui.prezziNuovi[d.pc] = n; else delete ui.prezziNuovi[d.pc]; const b = document.querySelector('[data-az="pc-salva"]'); if (b) b.textContent = 'Salva i prezzi nuovi' + (Object.keys(ui.prezziNuovi).length ? ' (' + Object.keys(ui.prezziNuovi).length + ')' : ''); return; }
    if (d.spr) { ui['sposta' + d.spr] = el.value; return; }
    if (d.cs) { CS()[d.cs] = el.value.trim(); salva(); return; }
    if (d.b != null && ui.bozza && el.value === '__nuovo') return; // lo gestisce il «change»
    if (d.b != null && ui.bozza) { ui.bozza[d.b] = el.value; if (d.ridisegna) ridisegnaMantenendo(); return; }
    if (d.vd != null && ui.bozza) { ui.bozza.venditaDiretta[d.vd] = el.value; return; }
    if (d.cr != null) { mostraSuggerimenti(el); return; }
    if (d.lfNuovo) {
      const box = $('#sugg-lf-nuovo'), t = normCassa(el.value).split(' ').filter(Boolean);
      const l = t.length ? ui.lfVoci.map((v, i) => ({ v, i })).filter(({ v }) => t.every(w => normCassa(v.descrizione + ' ' + v.cat).includes(w))).slice(0, 15) : [];
      box.innerHTML = l.map(({ v, i }) => `<button type="button" class="sugg-voce" data-az="lf-nuovo" data-i="${i}"><b>${esc(v.descrizione)}</b><small>${esc(v.cat)} · ${euro(v.prezzo)}</small></button>`).join('') || (t.length ? '<p class="tenue piccolo">Niente nel listino con queste parole.</p>' : '');
      return;
    }
    if (d.lfCerca != null) {
      const box = document.getElementById('sugg-lf-' + d.lfCerca), t = tokLis(el.value).length ? normCassa(el.value).split(' ').filter(Boolean) : normCassa(el.value).split(' ').filter(Boolean);
      const l = t.length ? ui.lfVoci.map((v, i) => ({ v, i })).filter(({ v }) => t.every(w => normCassa(v.descrizione).includes(w))).slice(0, 12) : [];
      box.innerHTML = l.map(({ v, i }) => `<button type="button" class="sugg-voce" data-az="lf-scegli" data-k="${d.lfCerca}" data-i="${i}"><b>${esc(v.descrizione)}</b><small>${esc(v.cat)} · ${euro(v.prezzo)}</small></button>`).join('') || (t.length ? '<p class="tenue piccolo">Niente nel listino con queste parole.</p>' : '');
      return;
    }
    if (d.fgCerca) {
      const box = $('#sugg-fg'), t = normCassa(el.value).split(' ').filter(Boolean);
      const l = t.length ? S.prodotti.filter(x => M.daFattura(x) && t.every(w => normCassa(x.nomeBreve + ' ' + x.nomeCompleto + ' ' + ((M.fornitore(x.fornitoreId) || {}).nome || '')).includes(w))).slice(0, 12) : [];
      box.innerHTML = l.map(x => `<button type="button" class="sugg-voce" data-az="fg-collega" data-da="${d.fgCerca}" data-a="${x.id}"><b>${esc(x.nomeBreve)}</b><small>${esc((M.fornitore(x.fornitoreId) || {}).nome || '')} · ${esc(x.nomeCompleto)} · ${descrPrezzo(x)}</small></button>`).join('') || (t.length ? '<p class="tenue piccolo">Nessun prodotto delle fatture con questo nome.</p>' : '');
      return;
    }
    if (d.cercaForn) {
      const t = normCassa(el.value).split(' ').filter(Boolean), box = $('#sugg-forn');
      const l = t.length ? S.fornitori.filter(x => x.id !== d.cercaForn && t.every(w => normCassa(x.nome).includes(w))).slice(0, 10) : [];
      box.innerHTML = l.map(x => `<button type="button" class="sugg-voce" data-az="unisci-fornitore" data-id="${d.cercaForn}" data-a="${x.id}"><b>Unisci dentro «${esc(x.nome)}»</b><small>${S.fatture.filter(z => z.fornitoreId === x.id).length} fatture · ${S.prodotti.filter(p => p.fornitoreId === x.id).length} prodotti</small></button>`).join('') || (t.length ? '<p class="tenue piccolo">Nessun fornitore con questo nome.</p>' : '');
      return;
    }
    if (d.cpCerca) { ui.cpCerca = el.value; ui.cpProd = d.cpCerca; const p = M.prodotto(d.cpCerca); const tmp = document.createElement('div'); tmp.innerHTML = collegaARicette(p); $('#cp-lista').innerHTML = tmp.querySelector('#cp-lista').innerHTML; return; }
    if (d.r != null && ui.bozza) { ui.bozza.righe[+d.r][d.k] = el.value; aggiornaAnteprima(); return; }
    if (d.ccData) { ui[d.ccData === 'dal' ? 'ccDal' : 'ccAl'] = el.value; return; }
    if (d.e != null && ui.bozza) { ui.bozza.costiExtra[+d.e][d.k] = el.value; aggiornaAnteprima(); return; }
    if (d.a != null && ui.bozza) { ui.bozza.asporto[+d.a][d.k] = el.value; return; }
    if (d.v != null && ui.bozza) { ui.bozza.vendite = ui.bozza.vendite || {}; const x = numDa(el.value); if (x) ui.bozza.vendite[d.v] = x; else delete ui.bozza.vendite[d.v]; return; }
    if (d.conta) { const x = numDa(el.value); if (x == null) delete ui.conta.valori[d.conta]; else ui.conta.valori[d.conta] = x; return; }
    if (d.sim) { ui.sim[d.sim] = el.value; return; }
  });
  function aggiornaAnteprima() {
    const el = $('.anteprima'); if (!el || !ui.bozza) return;
    const b = ui.bozza; M.svuota();
    const tmp = Object.assign({}, b, { id: '_bozza', righe: b.righe.map(rg => Object.assign({}, rg, { quantita: numDa(rg.quantita) || 0 })), costiExtra: (b.costiExtra || []).map(x => Object.assign({}, x, { costo: numDa(x.costo) || 0 })) });
    const c = M.costoRicetta(tmp).totale;
    const pr = numDa(b.prezzo);
    el.innerHTML = `Costo: <b>${euro(c, 3)}</b>${b.tipo !== 'semilavorato' && pr && c ? ` · moltiplicatore × ${n2(pr / c)}` : ''}`;
  }
  // trascinare i file sulla finestra: fatture (.xml, .p7m, .zip) ovunque, file Excel nella pagina «Importa dalla cassa»
  document.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); document.body.classList.add('trascina'); } });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('trascina'); });
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); document.body.classList.remove('trascina');
    if (!S) return;
    const file = Array.from(e.dataTransfer.files);
    const fatture = file.filter(f => /\.(xml|p7m|zip)$/i.test(f.name));
    const excel = file.filter(f => /\.xlsx$/i.test(f.name));
    if (fatture.length) { if (!(location.hash || '').startsWith('#/fatture')) vai('#/fatture'); caricaXML(fatture); return; }
    if (excel.length) {
      if (!(location.hash || '').startsWith('#/importa')) { vai('#/importa'); }
      const tipo = /venduto/i.test(excel[0].name) ? 'vendite' : 'listino';
      caricaCassa(excel[0], tipo); return;
    }
    alert('Posso leggere fatture elettroniche (.xml, .p7m, .zip) o i file Excel della cassa (.xlsx).');
  });
  document.addEventListener('change', (e) => {
    { const el = e.target, d = el.dataset || {};
      if (d.senzaCg != null && ui.bozza) { if (el.checked) delete ui.bozza.senzaCostiGruppo; else ui.bozza.senzaCostiGruppo = true; aggiornaAnteprima(); return; }
      if (d.cg != null) { const k = qui().split('/')[2], g = costiDi(k)[+d.cg]; if (!g) return;
        if (d.k === 'rif') g.rif = el.value; else if (d.k === 'nome') g.nome = el.value.trim(); else g[d.k] = numDa(el.value) || 0;
        M.svuota(); salva(); ridisegnaMantenendo(); return; } }
    const el = e.target; const d = el.dataset;
    if (d.ricOrdine != null) { ui.ordineRicette = el.value; ridisegnaMantenendo(); return; }
    if (d.prodOrdine != null) { ui.ordineProd = el.value; ridisegnaMantenendo(); return; }
    if (d.ricPeriodo != null) { ui.ricPer = el.value; ridisegnaMantenendo(); return; }
    if (d.panPeriodo != null) { if (el.value) { ui.panSel = { tipo: 'periodo', per: el.value }; ridisegnaMantenendo(); } return; }
    if (d.carica === 'xml') { caricaXML(Array.from(el.files)); el.value = ''; return; }
    if (d.carica === 'foto') { if (el.files[0]) caricaFoto(el.files[0]); el.value = ''; return; }
    if (d.carica === 'listino-fornitore') { if (el.files[0]) caricaListinoFornitore(el.files[0]); el.value = ''; return; }
    if (d.lf) { if (d.lf === 'forn') ui.lfForn = el.value; if (d.lf === 'data') ui.lfData = el.value; if (d.lf === 'sconto') ui.lfSconto = el.value; ridisegnaMantenendo(); return; }
    if (d.pzr && ui.bozza) {
      const n = numDa(el.value); if (!n || n <= 0) return;
      M.cambiaPezziPerRiga(ui.bozza.id, d.pzr, n);
      // la scheda in modifica prende subito i prezzi e gli articoli aggiornati
      const p = M.prodotto(ui.bozza.id); ui.bozza.prezzi = JSON.parse(JSON.stringify(p.prezzi || [])); ui.bozza.articoli = JSON.parse(JSON.stringify(p.articoli || []));
      delete p.dubbio; delete ui.bozza.dubbio; M.svuota(); salva(); ridisegnaMantenendo(); avviso('Fatto: prezzo per pezzo aggiornato, anche nelle ricette.'); return;
    }
    if (d.panData) { const sel = ui.panSel || { tipo: 'date' }; sel[d.panData] = el.value; ui.panSel = Object.assign({ tipo: 'date' }, sel); ridisegnaMantenendo(); return; }
    if (d.ordRicette) { ui.ordineRicette = el.value; ridisegnaMantenendo(); return; }
    if (d.catSpesa) { const f = M.fornitore(d.catSpesa); if (f) { f.catSpesa = el.value; delete cacheCatSpesa[f.id]; salva(); avviso('Tipo di spesa cambiato.'); } return; }
    if (d.fisso != null) { const x = fissiDi()[+d.fisso]; if (!x) return; x[d.k] = d.k === 'euro' ? (numDa(el.value) || 0) : el.value.trim(); salva(); ridisegnaMantenendo(); return; }
    if (d.incassoMan != null) { S.incassoMese = numDa(el.value) || 0; salva(); ridisegnaMantenendo(); return; }
    if (d.costiMese != null) { ui.costiSel = el.value ? { tipo: 'mese', mese: el.value } : { tipo: 'tutto' }; ridisegnaMantenendo(); return; }
    if (d.costiData) { const sel = Object.assign({ tipo: 'date' }, ui.costiSel || {}); sel.tipo = 'date'; sel[d.costiData] = el.value; ui.costiSel = sel; ridisegnaMantenendo(); return; }
    if (d.fgnome) { const p = M.prodotto(d.fgnome), v = el.value.trim(); if (p && v && v !== p.nomeBreve) { p.nomeBreve = v; salva(); avviso('Nome cambiato.'); } return; }
    if (d.fgprezzo) {
      const p = M.prodotto(d.fgprezzo), v = numDa(el.value); if (!p || v == null || v <= 0) return;
      if (M.prezzo(p) != null && Math.abs(M.prezzo(p) - v) < 0.001) return;
      p.prezzi = (p.prezzi || []).concat({ data: M.oggi(), fornitoreId: p.fornitoreId, prezzo: v, origine: 'Foglio (corretto a mano)' });
      M.svuota(); salva(); ridisegnaMantenendo(); avviso('Prezzo cambiato: le ricette che lo usano sono aggiornate.'); return;
    }
    if (d.fgsel) { const set = new Set(ui.fgSel || []); if (el.checked) set.add(d.fgsel); else set.delete(d.fgsel); ui.fgSel = Array.from(set); el.closest('.riga').classList.toggle('da-togliere', el.checked); const n = document.querySelector('[data-fgsel-n]'); if (n) n.textContent = set.size; return; }
    if (d.elim && ui.elim) { const set = new Set(ui.elim.sel); if (el.checked) set.add(d.elim); else set.delete(d.elim); ui.elim.sel = Array.from(set); el.closest('label').classList.toggle(ui.elim.tipo === 'u' || ui.elim.tipo === 's' ? 'da-unire' : 'da-togliere', el.checked); const n = document.querySelector('[data-elim-n]'); if (n) n.textContent = set.size; return; }
    if (d.sposta) { const set = new Set(ui.spostaSel || []); if (el.checked) set.add(d.sposta); else set.delete(d.sposta); ui.spostaSel = Array.from(set); const b = document.querySelector('.sposta-barra b'); if (b) b.textContent = `Sposta le ricette spuntate (${set.size})`; return; }
    if (d.grNome) { const v = el.value.trim(); if (!v) return; const t = (S.tipiExtra || []).find(x => x.id === d.grNome); if (t) t.nome = v; else { S.nomiTipi = S.nomiTipi || {}; S.nomiTipi[d.grNome] = v; } M.aggiornaTipi(); salva(); avviso('Nome cambiato.'); return; }
    if (d.grRep) { const t = (S.tipiExtra || []).find(x => x.id === d.grRep); if (t) t.reparto = el.value; else { S.repartiTipi = S.repartiTipi || {}; S.repartiTipi[d.grRep] = el.value; } M.aggiornaTipi(); salva(); avviso('Reparto cambiato.'); return; }
    if (d.lfScelta != null) { ui.lfProd[+d.lfScelta].scelta = +el.value; ridisegnaMantenendo(); return; }
    if (d.carica === 'cassa-listino' || d.carica === 'cassa-vendite') { if (el.files[0]) caricaCassa(el.files[0], d.carica === 'cassa-listino' ? 'listino' : 'vendite'); el.value = ''; return; }
    if (d.ccG != null) { ui.ccAperto = +d.ccG; ui.ccListino.gruppi[+d.ccG].tipo = el.value; ui.ccListino.gruppi[+d.ccG].voci.forEach(v => { if (el.value !== 'salta' && v.scelta === '__salta' && v.prezzo > 0 && v.prezzo <= 100) v.scelta = ''; }); ridisegnaMantenendo(); return; }
    if (d.ccV != null) { const [gi, vi] = d.ccV.split(',').map(Number); ui.ccAperto = gi; ui.ccListino.gruppi[gi].voci[vi].scelta = el.value; ridisegnaMantenendo(); return; }
    if (d.lsTipo) { ui.lsTipo = el.value; ridisegnaMantenendo(); return; }
    if (d.lsRep) { ui.lsRep = el.value; return; }
    if (d.ls != null) { const [i, j] = d.ls.split(',').map(Number); ui.lsAnte[i].ingr[j].rif = el.value; return; }
    if (d.ccVv != null) { ui.ccVendite[+d.ccVv].scelta = el.value; if (!el.value || el.value === '__nuova') ui.ccVendite[+d.ccVv].proposta = false; ridisegnaMantenendo(); return; }
    if (d.ccData) { ui[d.ccData === 'dal' ? 'ccDal' : 'ccAl'] = el.value; ridisegnaMantenendo(); return; }
    if (d.carica === 'copia') {
      const fr = new FileReader(); fr.onload = () => { try { const x = JSON.parse(fr.result); if (!x.prodotti || !x.ricette) throw 0; if (!confirm('Sostituisco tutti i dati con questa copia?')) return; prepara(x); salva(); disegna(); avviso('Copia caricata.'); } catch (er) { alert('Il file non è una copia valida.'); } }; fr.readAsText(el.files[0]); el.value = ''; return;
    }
    if (d.r != null && d.k === 'rif' && ui.bozza) { ui.bozza.righe[+d.r].rif = el.value; ridisegnaMantenendo(); return; }
    if (d.r != null && d.k === 'misura' && ui.bozza) { ui.bozza.righe[+d.r].misura = el.value; aggiornaAnteprima(); return; }
    if (d.a != null && d.k === 'rif' && ui.bozza) { ui.bozza.asporto[+d.a].rif = el.value; return; }
    if (d.b === 'fornitoreId' && ui.bozza && el.value === '__nuovo') {
      const n = prompt('Nome del fornitore nuovo'); if (!n || !n.trim()) { el.value = ui.bozza.fornitoreId || ''; return; }
      const gia = S.fornitori.find(f => f.nome.trim().toLowerCase() === n.trim().toLowerCase());
      const f = gia || { id: M.uid('f'), nome: n.trim(), piva: '', telefono: '', email: '', referente: '', giorniConsegna: '', note: '' };
      if (!gia) S.fornitori.push(f);
      ui.bozza.fornitoreId = f.id; salva(); ridisegnaMantenendo(); avviso(gia ? `«${f.nome}» c'era già: l'ho scelto.` : `Fornitore «${f.nome}» creato.`); return;
    }
    if (d.b != null && ui.bozza && el.tagName === 'SELECT') { ui.bozza[d.b] = el.value; if (d.ridisegna) ridisegnaMantenendo(); return; }
    if (d.fr != null) {
      const f = S.fatture.find(x => location.hash.endsWith(x.id)); const rg = f.righe[+d.fr];
      if (d.k === 'scelta') {
        if (el.value === '__nuovo') { nuovoProdottoDaRiga(f, +d.fr); return; }
        rg.ignora = el.value === '__ignora';
        rg.prodottoId = rg.ignora || !el.value ? null : el.value; rg.automatico = false;
        if (rg.prodottoId) {
          const p = M.prodotto(rg.prodottoId); const nn = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
          const a = (p.articoli || []).find(x => x.fornitoreId === f.fornitoreId && ((rg.codice && x.codice === rg.codice) || nn(x.descrizione) === nn(rg.descrizione)));
          rg.confezioniPerUnita = a ? a.confezioniPerUnita : 1;
        }
      } else rg.confezioniPerUnita = numDa(el.value) || 1;
      salva(); ridisegnaMantenendo(); return;
    }
    if (d.allGruppo != null || d.allRicetta) {
      const ex = allEsclusi(), k = d.allGruppo != null ? 'gruppi' : 'ricette', v = d.allGruppo != null ? d.allGruppo : d.allRicetta;
      ex[k] = el.checked ? ex[k].filter(x => x !== v) : ex[k].concat(v);
      salva(); ridisegnaMantenendo(); return;
    }
    if (d.fmtSel) { ui[d.fmtSel] = el.value; if (el.value && fmtFiltro() === 'ricette') ui.fmtFiltro = 'tutti'; ui.fmtIdx = 0; ridisegnaMantenendo(); return; }
    if (d.fmtf && el.value) {
      const p = M.prodotto(d.fmtf); if (!p) return;
      let id = el.value;
      if (id === '__nuovo') {
        const n = prompt('Nome del fornitore nuovo'); if (!n || !n.trim()) { el.value = ''; return; }
        const gia = S.fornitori.find(f => f.nome.trim().toLowerCase() === n.trim().toLowerCase());
        const f = gia || { id: M.uid('f'), nome: n.trim(), piva: '', telefono: '', email: '', referente: '', giorniConsegna: '', note: '' };
        if (!gia) S.fornitori.push(f);
        id = f.id;
      }
      ricorda('fmt', 'fmtIdx'); p.fornitoreId = id; fmtAvanti(p); return;
    }
    if (d.fmtRighe) {
      const n = numDa(el.value); if (!n || n <= 0) return;
      M.cambiaPezziPerRiga(d.fmtRighe, d.fattura, n); const pp = M.prodotto(d.fmtRighe); if (pp) { delete pp.dubbio; if (pp.unita === 'pz' && n > 1 && /cartone|confezione|scatola|pezzo/i.test(pp.confezione)) pp.confezione = 'pezzo'; } salva(); ridisegnaMantenendo(); avviso('Prezzi ricalcolati.'); return;
    }
    if (d.ctrl) {
      const p = M.prodotto(d.ctrl); if (!p) return;
      p[d.k] = d.k === 'contenuto' ? (numDa(el.value) || 1) : el.value.trim();
      salva(); if (d.k !== 'nomeBreve') ridisegnaMantenendo(); return;
    }
    if (d.azChange === 'ctrl-unisci' && el.value) {
      const da = M.prodotto(d.id), a = M.prodotto(el.value);
      if (!confirm(`Unisco «${da.nomeBreve}» dentro «${a.nomeBreve}»? Prezzi, fatture e ricette passano a ${a.nomeBreve}.`)) { el.value = ''; return; }
      const err = M.unisciProdotti(da.id, a.id); if (err) { alert(err); el.value = ''; return; }
      salva(); if ((location.hash || '').startsWith('#/prodotto/')) vai('#/prodotto/' + a.id); else ridisegnaMantenendo(); avviso('Uniti.'); return;
    }
    if (d.forn) { const f = M.fornitore(d.forn); f[d.k] = el.value.trim(); salva(); return; }
    if (d.vend) { const r = M.ricetta(d.vend); r.vendite = r.vendite || {}; const x = numDa(el.value); if (x) r.vendite[d.p] = x; else delete r.vendite[d.p]; salva(); return; }
    if (d.soglia) { S.impostazioni.soglie[d.soglia] = numDa(el.value); salva(); return; }
    if (d.imp) { const numerici = ['ivaVendita', 'sogliaAumento', 'mlDash', 'mlDrop', 'arrotonda']; S.impostazioni[d.imp] = numerici.includes(d.imp) ? numDa(el.value) : el.value.trim(); if (d.imp === 'mlDash' || d.imp === 'mlDrop') M.svuota(); salva(); avviso('Salvato.'); return; }
    if (d.cas) { S.casella[d.cas] = el.value.trim(); salva(); avviso('Salvato.'); return; }
    if (d.olio) { S.impostazioni.olio[d.olio] = numDa(el.value) || 0; delete S.impostazioni.olio.origine; salva(); ridisegnaMantenendo(); return; }
    if (d.olioData) { ui['olio' + (d.olioData === 'dal' ? 'Dal' : 'Al')] = el.value || null; ridisegnaMantenendo(); return; }
    if (d.olioG) { const r = M.ricetta(d.olioG), rg = r && rigaOlio(r); const n = numDa(el.value); if (rg && n > 0) { rg.quantita = n; M.svuota(); salva(); ridisegnaMantenendo(); } return; }
    if (d.olioProd) { const o = S.impostazioni.olio; const l = new Set(olioScelti()); if (el.checked) l.add(d.olioProd); else l.delete(d.olioProd); o.prodotti = Array.from(l); salva(); ridisegnaMantenendo(); return; }
    if (d.od != null) { const riga = S.impostazioni.olio.dettaglio[+d.od]; riga[+d.c] = d.c === '0' ? el.value : (numDa(el.value) || 0); salva(); ridisegnaMantenendo(); return; }
    if (d.ev) { const ev = S.eventi.find(x => x.id === d.ev); ev.righe[+d.k][d.c] = numDa(el.value) || 0; salva(); ridisegnaMantenendo(); return; }
    if (d.evc) { const ev = S.eventi.find(x => x.id === d.evc); ev[d.c] = el.value; salva(); return; }
    if (d.azChange === 'ev-aggiungi' && el.value) { const ev = S.eventi.find(x => x.id === d.id); const r = M.ricetta(el.value); ev.righe.push({ ricettaId: r.id, prezzo: r.prezzo || 0, previsti: 0 }); salva(); ridisegnaMantenendo(); return; }
    if (d.azChange === 'ev-extra') { const ev = S.eventi.find(x => x.id === d.id); ev.extraPerPezzo = el.value ? [{ rif: el.value, quantita: 1 }] : []; salva(); ridisegnaMantenendo(); return; }
    if (d.sim) { ui.sim[d.sim] = el.value; if (el.tagName === 'SELECT') ridisegnaMantenendo(); return; }
  });

  function partenza() {
    disegna(); segnaStoria();
    if (S.casella.url && (!S.casella.ultimoControllo || Date.now() - new Date(S.casella.ultimoControllo) > 15 * 60e3)) setTimeout(() => controllaCasella(false), 800);
    if (copiaDovuta()) setTimeout(() => copiaSuSheet(false), 4000);
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // l'app aperta sul telefono resta in memoria per giorni: quando torni a usarla controllo se c'è una versione nuova e la carico
  const VERSIONE_APP = 'repub-v141';
  let avvisoAggiornamento = false;
  async function controllaVersione() {
    if (location.protocol !== 'https:') return;
    try {
      const t = await (await fetch('sw.js?v=' + Date.now(), { cache: 'no-store' })).text();
      const m = t.match(/VERSIONE = '([^']+)'/); if (!m || m[1] === VERSIONE_APP) return;
      const occupato = ui.bozza || ui.conta || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
      if (!occupato) { location.reload(); return; }
      if (!avvisoAggiornamento) { avvisoAggiornamento = true; avviso('C\'è una versione nuova dell\'app: si carica appena finisci quello che stai facendo.'); }
    } catch (e) { /* senza rete: va bene così */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') controllaVersione(); });
  setInterval(controllaVersione, 10 * 60e3);
  window.addEventListener('hashchange', () => { if (avvisoAggiornamento) controllaVersione(); });
  avvia();
})();
