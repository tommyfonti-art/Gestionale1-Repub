// Gestionale Repub — interfaccia
(function () {
  'use strict';
  const M = window.Motore;
  const CHIAVE = 'gestionaleRepub.v1';
  let S;
  const ui = { filtroProdotti: '', categoria: 'Tutte', tipoRicette: 'drink', filtroRicette: '', bozza: null, conta: null, mappaPeriodo: null, mappaGruppo: 'cucina', sim: { modo: 'prodotto', prodottoId: '', valore: '', ricettaId: '', prezzo: '' } };

  // ---------- Utilità ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n2 = (n, d) => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('it-IT', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const euro = (n, d) => (n == null || isNaN(n)) ? '—' : n2(n, d) + ' €';
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

  // ---------- Salvataggio online (Firebase) ----------
  let db = null, utente = null, ultimoSalvato = new Map(), timerCloud = null, inVolo = 0, ultimoTimbro = null;
  const COLL = ['prodotti', 'ricette', 'fatture', 'fornitori'];
  function documenti(stato) {
    const m = new Map(); const resto = {};
    Object.keys(stato).forEach(k => { if (!COLL.includes(k)) resto[k] = stato[k]; });
    m.set('dati/generale', JSON.stringify(resto));
    COLL.forEach(c => (stato[c] || []).forEach(x => m.set(c + '/' + x.id, JSON.stringify(x))));
    return m;
  }
  function salvaCloud() { clearTimeout(timerCloud); timerCloud = setTimeout(scriviCloud, 400); }
  async function scriviCloud() {
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
      b.commit().then(() => { inVolo--; }, e => {
        inVolo--;
        // al prossimo salvataggio questi documenti vengono rimandati
        parte.forEach(([k, v]) => { if (v == null) ultimoSalvato.set(k, '(da cancellare)'); else ultimoSalvato.delete(k); });
        avviso('Non riesco a salvare online: ' + e.message + '. Riprovo alla prossima modifica.');
      });
    }
  }
  async function caricaCloud() {
    const gen = await db.doc('dati/generale').get();
    if (!gen.exists) return null;
    const stato = JSON.parse(gen.data().json);
    ultimoTimbro = gen.data().timbro || null;
    for (const c of COLL) {
      const snap = await db.collection(c).get();
      stato[c] = snap.docs.map(d => JSON.parse(d.data().json));
    }
    return stato;
  }
  function caricaScriptOrdinati(lista) { return lista.reduce((p, src) => p.then(() => caricaScript(src)), Promise.resolve()); }
  function datiDelDispositivo() { try { const t = localStorage.getItem(CHIAVE); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function schermataAccesso(msg) {
    $('#testa').innerHTML = '<span></span><h1>Gestionale Repub</h1><span></span>';
    $('#tabbar').innerHTML = ''; $('#contenuto').className = '';
    $('#contenuto').innerHTML = `<div class="card form accesso"><h3>Entra nel gestionale</h3>${msg ? `<p class="msg rosso">${esc(msg)}</p>` : ''}
      <label>Email<input id="acc-email" type="email" autocomplete="username" autocapitalize="none"></label>
      <label>Password<span class="campo-occhio"><input id="acc-pw" type="password" autocomplete="current-password"><button type="button" class="occhio" data-occhio="acc-pw" aria-label="Mostra la password">${OCCHIO}</button></span></label>
      <div class="bottoni colonna"><button class="btn primario" id="acc-ok">Entra</button><button class="btn piccolo" id="acc-dim">Ho dimenticato la password</button></div></div>`;
    const entra = () => firebase.auth().signInWithEmailAndPassword($('#acc-email').value.trim(), $('#acc-pw').value)
      .catch(e => schermataAccesso(/password|credential|user-not-found|invalid/i.test(e.code || '') ? 'Email o password sbagliate.' : 'Accesso non riuscito: ' + e.message));
    $('#acc-ok').onclick = entra;
    $('#acc-pw').onkeydown = (e) => { if (e.key === 'Enter') entra(); };
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
      $('#contenuto').innerHTML = '<p class="tenue centro">Carico i dati…</p><div class="rotella"></div>';
      try {
        let stato = await caricaCloud();
        if (stato) ultimoSalvato = documenti(stato);
        else { stato = await sceltaPrimoAvvio(); ultimoSalvato = new Map(); }
        prepara(stato); salva();
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
        ultimoSalvato = nuovi; prepara(stato); ridisegnaMantenendo();
      } catch (e) { /* riprovo la prossima volta */ }
    });
  }

  // ---------- Pezzi grafici ----------
  function badgeMolt(ind) {
    if (ind.molt == null) return '<span class="badge grigio">senza costo</span>';
    return `<span class="badge ${ind.sotto ? 'rosso' : 'verde'}">× ${n2(ind.molt)}</span>`;
  }
  function kpi(etichetta, valore, sotto, cls) {
    return `<div class="kpi ${cls || ''}"><div class="kpi-v">${valore}</div><div class="kpi-e">${esc(etichetta)}</div>${sotto ? `<div class="kpi-s">${sotto}</div>` : ''}</div>`;
  }
  function grafico(punti, etichettaY) {
    if (!punti || punti.length < 2) return '<p class="tenue">Il grafico compare quando ci sono almeno due prezzi in date diverse.</p>';
    const W = 320, H = 140, P = 28;
    const ys = punti.map(p => p.y); let min = Math.min(...ys), max = Math.max(...ys);
    if (max === min) { max += max * 0.05 || 1; min -= min * 0.05 || 1; }
    const x = i => P + i * (W - 2 * P) / (punti.length - 1);
    const y = v => H - P + 6 - (v - min) / (max - min) * (H - 2 * P);
    const linea = punti.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etichettaY)}">
      <path d="${linea}" fill="none" stroke="var(--accento)" stroke-width="2.5" stroke-linejoin="round"/>
      ${punti.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="4" fill="var(--accento)"/><text x="${x(i)}" y="${y(p.y) - 9}" text-anchor="middle" class="g-val">${n2(p.y)}</text><text x="${x(i)}" y="${H - 4}" text-anchor="middle" class="g-x">${esc(p.x)}</text>`).join('')}
    </svg>`;
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

  // ---------- Pagine ----------
  const PAGINE = {};

  // Analisi del menu per un periodo: quanto vende e quanto rende ogni ricetta con gli ingredienti completi
  const GRUPPI_MENU = { tutto: null, get bar() { return M.tipiDi('bar'); }, get cucina() { return M.tipiDi('cucina'); } };
  const completa = (r) => { const c = M.costoRicetta(r); return c.totale > 0 && !c.mancanti.length && !/^Ricetta da completare/.test(r.note || ''); };
  function analisiMenu(per, gruppo) {
    const tipi = GRUPPI_MENU[gruppo];
    const vendute = S.ricette.filter(r => r.tipo !== 'semilavorato' && (!tipi || tipi.includes(r.tipo)) && ((r.vendite || {})[per] || 0) > 0);
    const voci = vendute.filter(completa).map(r => { const i = M.indicatori(r); return { r, q: r.vendite[per], i, tot: r.vendite[per] * i.margine }; }).filter(x => x.i.margine != null);
    const pezziTutti = vendute.reduce((s, r) => s + r.vendite[per], 0), pezziOk = voci.reduce((s, x) => s + x.q, 0);
    let gruppoDi = () => null, sogliaQ = 0, sogliaM = 0;
    if (voci.length >= 2) {
      sogliaQ = 0.7 * pezziOk / voci.length;
      sogliaM = voci.reduce((s, x) => s + x.q * x.i.margine, 0) / pezziOk;
      gruppoDi = (x) => x.q >= sogliaQ ? (x.i.margine >= sogliaM ? 'vincenti' : 'rendere') : (x.i.margine >= sogliaM ? 'spingere' : 'ripensare');
    }
    voci.forEach(x => { x.g = gruppoDi(x); });
    return { vendute, voci, pezziTutti, pezziOk, sogliaQ, sogliaM };
  }
  const QUADRANTI = {
    vincenti: ['Vincenti', 'Vendono tanto e fanno guadagnare tanto. Non toccarli.', 'var(--verde)'],
    rendere: ['Da far rendere di più', 'Vendono tanto ma guadagnano poco a pezzo. Rivedi il costo o il prezzo.', 'var(--giallo)'],
    spingere: ['Da spingere', 'Guadagnano bene ma vendono poco. Mettili in vista, consigliali.', 'var(--accento)'],
    ripensare: ['Da ripensare', 'Vendono poco e guadagnano poco. Da cambiare o togliere.', 'var(--rosso)']
  };

  PAGINE.pannello = function () {
    const conVendite = S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp]));
    const per = conVendite.includes(ui.panPer) ? ui.panPer : conVendite[conVendite.length - 1];
    const gruppo = ui.panGruppo || 'tutto';
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
    if (per) {
      const A = analisiMenu(per, gruppo);
      const iva = 1 + (S.impostazioni.ivaVendita || 0) / 100;
      const incassoRic = A.vendute.reduce((s, r) => s + r.vendite[per] * (r.prezzo || 0), 0);
      const cassa = gruppo === 'tutto' && S.periodiCassa[per] ? S.periodiCassa[per].incasso : null;
      const nettoOk = A.voci.reduce((s, x) => s + x.q * x.i.netto, 0), costoOk = A.voci.reduce((s, x) => s + x.q * x.i.costo, 0);
      const su100 = nettoOk ? costoOk / nettoOk * 100 : null;
      const copertura = A.pezziTutti ? A.pezziOk / A.pezziTutti : 0;
      const daCompletare = A.vendute.filter(r => !completa(r)).sort((a, b) => b.vendite[per] - a.vendite[per]);
      const scelte = `<div class="chips">${conVendite.map(pp => `<button class="chip ${per === pp ? 'on' : ''}" data-az="pan-per" data-v="${esc(pp)}">${esc(pp)}</button>`).join('')}</div>
        <div class="chips sotto">${[['tutto', 'Tutto il locale'], ['bar', 'Bar'], ['cucina', 'Cucina']].map(([k, v]) => `<button class="chip ${gruppo === k ? 'on' : ''}" data-az="pan-gruppo" data-v="${k}">${v}</button>`).join('')}</div>`;
      const top = (lista, titolo, spiega, valore) => `<div class="card"><h3>${titolo}</h3><p class="tenue piccolo">${spiega}</p>${lista.length ? lista.map((x, k) => `<a class="riga" href="#/ricetta/${x.r.id}"><span>${k + 1}. ${esc(x.r.nome)}</span><span class="destra">${valore(x)}</span></a>`).join('') : '<p class="tenue">Ancora nessuna ricetta completa venduta.</p>'}</div>`;
      const piuVendute = A.vendute.slice().sort((a, b) => b.vendite[per] - a.vendite[per]).slice(0, 5).map(r => ({ r, q: r.vendite[per] }));
      const piuGuadagno = A.voci.slice().sort((a, b) => b.tot - a.tot).slice(0, 5);
      const menoAPezzo = A.voci.filter(x => x.i.molt != null).sort((a, b) => a.i.molt - b.i.molt).slice(0, 5);
      andamento = `${scelte}
      <div class="kpi-griglia">
        ${kpi('Incasso', euro(cassa != null ? cassa : incassoRic, 0), cassa != null ? 'dalla cassa, IVA compresa' : 'pezzi venduti × prezzo, IVA compresa')}
        ${kpi('Su 100 € incassati', su100 == null ? '—' : euro(su100, 0) + ' di merce', 'ingredienti, senza contare l\'IVA', su100 == null ? '' : su100 > 30 ? 'rosso' : su100 > 25 ? 'giallo' : 'verde')}
        ${kpi('Guadagno sulla merce', euro(A.voci.reduce((s, x) => s + x.tot, 0), 0), 'incasso senza IVA meno ingredienti, prima di personale e spese')}
        ${kpi('Calcolato su', Math.round(copertura * 100) + '% delle vendite', 'il resto non ha ancora la ricetta completa', copertura < 0.6 ? 'giallo' : '')}
      </div>
      ${daCompletare.length ? `<div class="card larga"><h3>Ricette vendute ma senza ingredienti completi (${daCompletare.length})</h3><p class="tenue piccolo">Finché non le completi i conti sono parziali. Parti da quelle che vendono di più:</p>
        ${daCompletare.slice(0, 5).map(r => `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}</span><span class="destra">${qta(r.vendite[per])} venduti</span></a>`).join('')}
        <div class="bottoni"><button class="btn primario" data-az="pan-completa">Completale una per una, dalle più vendute</button></div></div>` : ''}
      <div class="card larga"><h3>La mappa del menu · ${esc(per)}</h3>
        <p class="tenue piccolo">Ogni ricetta finisce in una delle quattro caselle, secondo quanto vende e quanto fa guadagnare a pezzo rispetto alla media (${euro(A.sogliaM)} a pezzo).</p>
        ${A.voci.length >= 2 ? `<div class="quadranti">${Object.entries(QUADRANTI).map(([k, [nome, spiega, col]]) => { const l = A.voci.filter(x => x.g === k).sort((a, b) => b.tot - a.tot); return `<div class="quad" style="border-color:${col}"><h4 style="color:${col}">${nome} <small>(${l.length})</small></h4><p class="tenue piccolo">${spiega}</p>${l.slice(0, 6).map(x => `<a class="riga piccola" href="#/ricetta/${x.r.id}"><span>${esc(x.r.nome)}</span><small>${qta(x.q)} · ${euro(x.i.margine)}</small></a>`).join('')}${l.length > 6 ? `<p class="tenue piccolo">e altre ${l.length - 6}</p>` : ''}</div>`; }).join('')}</div>
          <p class="tenue piccolo">Accanto al nome: pezzi venduti · guadagno a pezzo. <a href="#/mappa" data-az="pan-mappa">Vedi la mappa con il grafico ›</a></p>` : '<p class="tenue">Servono almeno due ricette complete con delle vendite in questo periodo.</p>'}
      </div>
      <div class="griglia-tre">
        ${top(piuVendute, 'I più venduti', 'Pezzi venduti nel periodo.', x => qta(x.q) + ' pz')}
        ${top(piuGuadagno, 'Fanno guadagnare di più', 'Guadagno sulla merce in tutto il periodo.', x => euro(x.tot, 0))}
        ${top(menoAPezzo, 'Rendono meno a pezzo', 'Il moltiplicatore più basso tra quelli venduti.', x => badgeMolt(x.i))}
      </div>`;
    } else {
      andamento = `<div class="card evidenza"><h3>Carica le vendite</h3><p>Qui vedrai com'è andato il periodo: incasso, quanto se ne va in merce, cosa vende e cosa fa guadagnare. Servono le vendite della cassa.</p><a class="btn primario" href="#/importa">Importa dalla cassa</a></div>`;
    }

    return {
      titolo: 'Gestionale Repub', html: `${andamento}
      <h2 class="sezione">Da fare</h2>
      ${(() => { const p = passiOrdine(), n = p.filter(x => x[1]).length; return n ? `<a class="card riga evidenza" href="#/ordine"><span><b>Metti in ordine i dati</b><small>${n} passi da fare: fornitori, prodotti, foglio, cartoni, ricette. Tutti gli strumenti in un posto, nell'ordine giusto.</small></span><span class="badge giallo">${n}</span></a>` : ''; })()}
      ${(() => { const n = S.prodotti.filter(p => M.daFoglio(p) && !(S.foglioTenuti || []).includes(p.id)).length; return n && S.fatture.length ? `<div class="card evidenza"><h3>Prodotti del tuo foglio (${n})</h3><p class="tenue">Uno per uno: collegali a quelli delle fatture, trasformali in preparazioni se li fate voi, tienili o eliminali.</p><a class="btn primario" href="#/foglio" data-az="fg-apri">Inizia</a></div>` : ''; })()}
      ${fornitoriDaControllare().length ? `<div class="card"><h3>Fornitori nuovi da controllare</h3><p class="tenue">Dimmi chi vende merce e chi manda solo bollette o servizi: vale per tutte le loro fatture.</p><a class="btn primario" href="#/controllo-fatture">Controllo rapido (${fornitoriDaControllare().length})</a></div>` : ''}
      ${nuoviDaCompletare() ? `<div class="card"><h3>Prodotti nuovi da completare</h3><p class="tenue">Creati in automatico dalle fatture: controlla nome breve e formato.</p>${S.prodotti.filter(p => p.daCompletare).slice(0, 6).map(p => `<a class="riga" href="#/prodotto/${p.id}"><span>${esc(p.nomeBreve)}<small>${esc(p.nomeCompleto)}</small></span><span class="badge giallo">da completare</span></a>`).join('')}<div class="bottoni"><a class="btn primario" href="#/controllo">Controllo rapido (${nuoviDaCompletare()})</a><a class="btn" href="#/prodotti" data-az="vai-nuovi">Vedi l'elenco</a></div></div>` : ''}
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
      ${M.gruppiDoppioni().length ? `<div class="card"><h3>Prodotti doppi</h3><p class="tenue">${M.gruppiDoppioni().length} prodotti compaiono più volte con lo stesso nome e formato (es. da due fornitori): uniscili, così nelle ricette ne trovi uno solo.</p><a class="btn primario" href="#/doppioni">Vedi e unisci</a></div>` : ''}
      ${daFare.length ? `<div class="card"><h3>Fatture da completare</h3>${daFare.map(f => `<a class="riga" href="#/fattura/${f.id}"><span>${esc(f.fornitoreNome)} · n. ${esc(f.numero)}</span><span class="badge giallo">${M.daAbbinare(f)} righe da collegare</span></a>`).join('')}</div>` : ''}
      <div class="card"><h3>Prezzi cambiati</h3>${aumenti.length ? aumenti.slice(0, 8).map(x => `<a class="riga" href="#/prodotto/${x.p.id}"><span>${esc(x.p.nomeBreve)}<small>${dataIt(x.data)}</small></span><span class="badge ${x.v > 0 ? 'rosso' : 'verde'}">${x.v > 0 ? '+' : ''}${n2(x.v, 1)}%</span></a>`).join('') : '<p class="tenue">Nessun cambio di prezzo. Compariranno qui quando registri le fatture.</p>'}</div>
      <div class="card"><h3>Sotto la soglia del moltiplicatore</h3>${sotto.length ? sotto.map(r => { const i = M.indicatori(r); return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>${M.TIPI_SINGOLARE[r.tipo]} · soglia × ${n2(i.soglia)}</small></span>${badgeMolt(i)}</a>`; }).join('') : '<p class="tenue">Tutte le ricette complete sono sopra la soglia.</p>'}</div>
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
  const diFornitore = (p, id) => p.fornitoreId === id || (p.prezzi || []).some(e => e.fornitoreId === id) || (p.articoli || []).some(e => e.fornitoreId === id);
  function fornitoriConProdotti() {
    return S.fornitori.filter(f => !f.servizi).map(f => ({ f, n: S.prodotti.filter(p => diFornitore(p, f.id)).length })).filter(x => x.n).sort((x, y) => x.f.nome.localeCompare(y.f.nome));
  }
  function listaProdotti() {
    const f = ui.filtroProdotti.toLowerCase();
    const perForn = ui.prodVista === 'fornitori';
    const l = S.prodotti.filter(p => (perForn ? (!ui.fornProd || diFornitore(p, ui.fornProd)) : (ui.categoria === '__nuovi' ? p.daCompletare : ((!ui.reparto || M.reparto(p) === ui.reparto) && (ui.categoria === 'Tutte' || p.categoria === ui.categoria)))) && (!f || (p.nomeBreve + ' ' + p.nomeCompleto).toLowerCase().includes(f)))
      .sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve));
    if (!l.length) return '<p class="tenue centro">Nessun prodotto.</p>';
    return l.map(p => {
      const pr = M.prezzo(p), rif = M.prezzoRiferimento(p);
      const sc = p.scortaMinima > 0 && (p.giacenza || 0) < p.scortaMinima;
      return `<a class="riga" href="#/prodotto/${p.id}"><span>${esc(p.nomeBreve)}<small>${esc(p.nomeCompleto)}</small></span>
        <span class="destra">${p.speciale ? euro(rif && rif.valore, 2) + '<small>' + esc(rif ? rif.etichetta : '') + '</small>' : euro(pr) + `<small>${rif ? n2(rif.valore) + ' ' + rif.etichetta : 'senza prezzo'}</small>`}${sc ? '<span class="badge rosso">scorta</span>' : ''}${p.daCompletare ? '<span class="badge giallo">da completare</span>' : ''}</span></a>`;
    }).join('');
  }
  PAGINE.prodotti = function () {
    return {
      titolo: 'Prodotti', azione: '<a class="btn-top" href="#/modifica-prodotto/nuovo">＋ Nuovo</a>', html: `
      ${nuoviDaCompletare() ? `<a class="btn primario largo" href="#/controllo">Controllo rapido dei prodotti nuovi (${nuoviDaCompletare()})</a>` : ''}
      ${M.gruppiDoppioni().length ? `<a class="btn largo" href="#/doppioni">Doppioni da unire (${M.gruppiDoppioni().length})</a>` : ''}
      ${(() => { const n = S.prodotti.filter(p => M.daFoglio(p) && !(S.foglioTenuti || []).includes(p.id)).length; return n ? `<a class="btn largo" href="#/foglio" data-az="fg-apri">Prodotti del tuo foglio da collegare alle fatture (${n})</a>` : ''; })()}
      ${ui.prodVista === 'fornitori'
        ? (ui.fornProd && M.fornitore(ui.fornProd) ? `<a class="btn primario largo" href="#/formati" data-az="fmt-fornitore" data-id="${ui.fornProd}">Metti a posto tutti i prodotti di ${esc(M.fornitore(ui.fornProd).nome)}, uno dopo l'altro</a>` : '<p class="tenue">Scegli un fornitore: vedi tutta la sua roba e la sistemi in un colpo con la fattura sotto mano.</p>')
        : `<a class="btn largo" href="#/formati" data-az="fmt-categoria">${ui.categoria && ui.categoria !== 'Tutte' && ui.categoria !== '__nuovi' ? `Ricontrolla i formati: solo ${esc(ui.categoria)}` : ui.reparto ? `Ricontrolla i formati: tutto ${esc(ui.reparto)}` : 'Ricontrolla i formati, uno dopo l\'altro'}</a>`}
      <input class="cerca" type="search" placeholder="Cerca un prodotto" value="${esc(ui.filtroProdotti)}" data-filtro="prodotti">
      <div class="chips"><button class="chip ${ui.prodVista !== 'fornitori' ? 'on' : ''}" data-az="prod-vista" data-v="categorie">Per categoria</button><button class="chip ${ui.prodVista === 'fornitori' ? 'on' : ''}" data-az="prod-vista" data-v="fornitori">Per fornitore</button></div>
      ${ui.prodVista === 'fornitori' ? `<div class="chips">${fornitoriConProdotti().map(x => `<button class="chip ${ui.fornProd === x.f.id ? 'on' : ''}" data-az="forn-prod" data-v="${x.f.id}">${esc(x.f.nome)} (${x.n})</button>`).join('')}</div>` : `<div class="chips">${(nuoviDaCompletare() ? [['__nuovi', 'Da completare (' + nuoviDaCompletare() + ')']] : []).map(([v, t]) => `<button class="chip ${ui.categoria === v ? 'on' : ''} giallo" data-az="categoria" data-v="${esc(v)}">${esc(t)}</button>`).join('')}${[['', 'Tutto']].concat(repartiUsati().map(r => [r, r])).map(([v, t]) => `<button class="chip ${(ui.reparto || '') === v && ui.categoria !== '__nuovi' ? 'on' : ''}" data-az="reparto" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>
      ${ui.reparto && ui.categoria !== '__nuovi' ? `<div class="chips sotto">${[['Tutte', 'Tutto ' + ui.reparto]].concat(categorie().filter(c => S.prodotti.some(p => p.categoria === c && M.reparto(p) === ui.reparto)).map(c => [c, c])).map(([v, t]) => `<button class="chip ${ui.categoria === v ? 'on' : ''}" data-az="categoria" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>` : ''}</div>`}
      <div class="card lista" id="lista">${listaProdotti()}</div>`
    };
  };

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
      titolo: p.nomeBreve, indietro: '#/prodotti', azione: `<a class="btn-top" href="#/modifica-prodotto/${p.id}">Modifica</a>`, html: `
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
        ${grafico(storico.map(e => ({ x: dataIt(e.data).slice(0, 5), y: e.prezzo })), 'Prezzo')}
        <table class="tab"><tr><th>Data</th><th>Fornitore</th><th class="n">Prezzo</th><th>Da</th></tr>
        ${storico.slice().reverse().map(e => `<tr><td>${dataIt(e.data)}</td><td>${esc((M.fornitore(e.fornitoreId) || {}).nome || '—')}</td><td class="n">${euro(e.prezzo)}${e.sconto ? `<small>sconto ${n2(e.sconto, 0)}%</small>` : ''}</td><td>${e.fatturaId ? `<a href="#/fattura/${e.fatturaId}">${esc(e.origine)}</a>` : esc(e.origine || 'a mano')}</td></tr>`).join('')}</table>
        <button class="btn piccolo" data-az="prezzo-mano" data-id="${p.id}">＋ Aggiungi un prezzo a mano</button></div>`}
      ${ultimi.length > 1 ? `<div class="card"><h3>Confronto fornitori</h3><table class="tab"><tr><th>Fornitore</th><th>Ultimo acquisto</th><th class="n">Prezzo</th></tr>
        ${ultimi.sort((a, b) => a[1].prezzo - b[1].prezzo).map(([fid, e], i) => `<tr><td>${esc((M.fornitore(fid) || {}).nome || '—')}${i === 0 ? ' <span class="badge verde">il più basso</span>' : ''}</td><td>${dataIt(e.data)}</td><td class="n">${euro(e.prezzo)}</td></tr>`).join('')}</table></div>` : ''}
      <div class="card"><h3>Dove viene usato</h3>${uso.tutte.length ? uso.tutte.map(r => {
        const diretta = (r.righe || []).find(rg => rg.rif === 'p:' + p.id);
        return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>${diretta ? qta(diretta.quantita) + ' ' + esc(p.unita) + ' · ' + euro(M.costoUnita(p) * diretta.quantita, 3) : 'dentro una preparazione'}</small></span><span class="destra">${euro(M.costo(r))}<small>${M.TIPI_SINGOLARE[r.tipo]}</small></span></a>`;
      }).join('') : '<p class="tenue">Non è usato in nessuna ricetta.</p>'}</div>
      ${!p.speciale ? collegaARicette(p) : ''}
      ${!p.speciale ? `<div class="card form"><h3>È lo stesso di un altro prodotto?</h3><p class="tenue piccolo">Uniscilo: resta l'altro, con i prezzi, le fatture e le ricette di tutti e due.</p>
        <label>Unisci dentro<select data-az-change="ctrl-unisci" data-id="${p.id}"><option value="">scegli il prodotto…</option>${S.prodotti.filter(x => x.id !== p.id && !x.speciale).sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve)).map(x => `<option value="${x.id}">${esc(x.nomeBreve)} · ${esc(x.nomeCompleto)} · ${esc((M.fornitore(x.fornitoreId) || {}).nome || '')}</option>`).join('')}</select></label></div>` : ''}
      ${(p.articoli || []).length ? `<div class="card"><h3>Come compare nelle fatture</h3>${p.articoli.map(a => `<div class="riga"><span>${esc(a.descrizione)}<small>${esc((M.fornitore(a.fornitoreId) || {}).nome || '')}${a.codice ? ' · codice ' + esc(a.codice) : ''}</small></span><span>${a.confezioniPerUnita > 1 ? a.confezioniPerUnita + ' ' + esc(p.confezione) + ' per unità' : ''}</span></div>`).join('')}</div>` : ''}
      ${p.note ? `<div class="card"><h3>Note</h3><p>${esc(p.note)}</p></div>` : ''}
      <button class="btn piccolo" data-az="simula-prodotto" data-id="${p.id}">Simula un cambio di prezzo</button>`
    };
  };

  PAGINE['modifica-prodotto'] = function (id) {
    if (!ui.bozza || ui.bozza._per !== 'p:' + id) {
      const base = id === 'nuovo' ? { id: M.uid('p'), nomeBreve: '', nomeCompleto: '', categoria: ui.categoria !== 'Tutte' ? ui.categoria : '', unita: 'ml', contenuto: 1000, confezione: 'bottiglia', iva: 22, giacenza: 0, scortaMinima: 0, resa: 100, allergeni: [], venditaDiretta: null, fornitoreId: '', articoli: [], prezzi: [], note: '' } : JSON.parse(JSON.stringify(M.prodotto(id)));
      base._per = 'p:' + id; base._prezzo = M.prezzo(base) == null ? '' : '';
      ui.bozza = base;
    }
    const b = ui.bozza;
    const campo = (et, k, tipo, extra) => `<label>${et}<input type="${tipo || 'text'}" data-b="${k}" value="${esc(b[k])}" ${extra || ''}></label>`;
    const vd = b.venditaDiretta || {};
    return {
      titolo: id === 'nuovo' ? 'Nuovo prodotto' : 'Modifica ' + b.nomeBreve, indietro: id === 'nuovo' ? '#/prodotti' : '#/prodotto/' + id, html: `
      <div class="card form">
        ${campo('Nome breve (quello delle ricette)', 'nomeBreve')}
        ${campo('Nome completo', 'nomeCompleto')}
        <label>Categoria<input list="cat-list" data-b="categoria" value="${esc(b.categoria)}"><datalist id="cat-list">${categorie().map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <div class="due">
          <label>Unità<select data-b="unita">${['ml', 'g', 'pz'].map(u => `<option ${b.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
          ${campo('Contenuto della confezione', 'contenuto', 'number', 'step="any" inputmode="decimal"')}
        </div>
        <div class="due">
          ${campo('Tipo di confezione', 'confezione')}
          ${campo('IVA %', 'iva', 'number', 'step="any" inputmode="decimal"')}
        </div>
        <label>Fornitore principale<select data-b="fornitoreId"><option value="">Fatto in casa / nessuno</option>${S.fornitori.slice().sort((a, c) => a.nome.localeCompare(c.nome)).map(f => `<option value="${f.id}" ${b.fornitoreId === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
        ${id === 'nuovo' ? campo('Prezzo della confezione senza IVA', '_prezzo', 'number', 'step="any" inputmode="decimal"') : ''}
        <div class="due">
          ${campo('In casa (confezioni)', 'giacenza', 'number', 'step="any" inputmode="decimal"')}
          ${campo('Scorta minima', 'scortaMinima', 'number', 'step="any" inputmode="decimal"')}
        </div>
        ${campo('Resa % (scarto, calo in cottura)', 'resa', 'number', 'step="any" inputmode="decimal"')}
      </div>
      ${pezziInFattura(b)}
      <div class="card form"><h3>Allergeni</h3><div class="chips">${M.ALLERGENI.map(a => `<button class="chip ${(b.allergeni || []).includes(a) ? 'on' : ''}" data-az="allergene" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>
      <div class="card form"><h3>Vendita diretta</h3>
        <label class="interruttore"><input type="checkbox" data-az="vd-attiva" ${b.venditaDiretta ? 'checked' : ''}> Lo vendo anche così com'è (al calice, liscio…)</label>
        ${b.venditaDiretta ? `<div class="due">
          <label>Nome della porzione<input data-vd="nomePorzione" value="${esc(vd.nomePorzione || '')}"></label>
          <label>Porzione (${esc(b.unita)})<input type="number" step="any" inputmode="decimal" data-vd="porzione" value="${esc(vd.porzione || '')}"></label></div>
          <div class="due"><label>Prezzo della porzione<input type="number" step="any" inputmode="decimal" data-vd="prezzoPorzione" value="${esc(vd.prezzoPorzione || '')}"></label>
          <label>Prezzo della confezione intera<input type="number" step="any" inputmode="decimal" data-vd="prezzoIntero" value="${esc(vd.prezzoIntero || '')}"></label></div>` : ''}
      </div>
      <div class="card form"><label>Note<textarea data-b="note" rows="3">${esc(b.note)}</textarea></label></div>
      <div class="bottoni"><button class="btn primario" data-az="salva-prodotto">Salva</button>${id !== 'nuovo' ? '<button class="btn pericolo" data-az="elimina-prodotto">Elimina</button>' : ''}</div>`
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
          <label>Contiene<input type="number" step="any" inputmode="decimal" data-ctrl="${p.id}" data-k="contenuto" value="${esc(p.contenuto)}"></label>
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
  function listaFormati() {
    const usati = new Set();
    S.ricette.forEach(r => (r.righe || []).concat(r.asporto || []).forEach(rg => { const m = /^p:(.+)$/.exec(rg.rif); if (m) usati.add(m[1]); }));
    const filtro = ui.fmtFiltro || 'ricette';
    const daForn = (p) => p.fornitoreId === ui.fmtForn || (p.prezzi || []).some(e => e.fornitoreId === ui.fmtForn) || (p.articoli || []).some(e => e.fornitoreId === ui.fmtForn);
    return S.prodotti.filter(p => !p.speciale && (filtro === 'tutti' || (filtro === 'ricette' ? usati.has(p.id) : filtro === 'cartoni' ? cartoneSospetto(p) : !p.formatoOk))
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
    const filtro = ui.fmtFiltro || 'ricette';
    const forniConProdotti = S.fornitori.filter(f => !f.servizi && S.prodotti.some(p => p.fornitoreId === f.id || (p.prezzi || []).some(e => e.fornitoreId === f.id))).sort((x, y) => x.nome.localeCompare(y.nome));
    const nCartoni = S.prodotti.filter(p => !p.speciale && cartoneSospetto(p)).length;
    const chips = `<div class="chips">${[['ricette', 'Usati nelle ricette'], ['cartoni', 'Cartoni senza pezzi (' + nCartoni + ')'], ['dacontrollare', 'Non ancora ricontrollati'], ['tutti', 'Tutti']].map(([k, v]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-az="fmt-filtro" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="card form filtri-fmt"><div class="filtri3">
        <label>Solo il reparto<select data-fmt-sel="fmtRep"><option value="">Tutti i reparti</option>${M.REPARTI.map(r => `<option ${ui.fmtRep === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        <label>Solo la categoria<select data-fmt-sel="fmtCat"><option value="">Tutte le categorie</option>${categorie().map(c => `<option ${ui.fmtCat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label>Solo il fornitore<select data-fmt-sel="fmtForn"><option value="">Tutti i fornitori</option>${forniConProdotti.map(f => `<option value="${f.id}" ${ui.fmtForn === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
      </div></div>`;
    if (!lista.length) return { titolo: 'Ricontrollo formati', indietro: '#/prodotti', html: chips + '<div class="card evidenza"><h3>Finito</h3><p>Non ci sono prodotti in questo elenco.</p><a class="btn primario" href="#/prodotti">Vai ai prodotti</a></div>' };
    if (ui.fmtIdx == null || ui.fmtIdx >= lista.length) ui.fmtIdx = 0;
    const p = lista[ui.fmtIdx];
    const forn = M.fornitore(p.fornitoreId);
    const ur = ultimaRiga(p);
    const art = ur ? (p.articoli || []).find(a => a.fornitoreId === ur.f.fornitoreId && ((ur.rg.codice && a.codice === ur.rg.codice) || a.descrizione === ur.rg.descrizione)) : null;
    const perRiga = ur ? (Number(ur.rg.confezioniPerUnita) || 1) : null;
    const pr = M.prezzo(p), rif = M.prezzoRiferimento(p);
    const usoRic = M.usatoIn('p:' + p.id).tutte.length;
    const conto = ur ? `<div class="card form"><h3>Livello in più: quanti «${esc(p.confezione)}» ci sono in ogni ${esc(ur.rg.um || 'confezione')} di fattura</h3>
        <p>In fattura${ur.f.fornitoreNome ? ' di <b>' + esc(forn ? forn.nome : ur.f.fornitoreNome) + '</b>' : ''} del ${dataIt(ur.f.data)}:<br><b>${esc(ur.rg.descrizione)}</b><br>${qta(ur.rg.quantita)} ${esc(ur.rg.um || '')} a ${euro(ur.rg.prezzoUnitario, 3)}</p>
        ${cartoneSospetto(p) ? `<p class="msg giallo">In fattura c'è scritto <b>${esc(ur.rg.um)}</b>, ma adesso è contato come un pezzo solo. Scrivi quanti pezzi ci sono dentro e premi Invio.</p>` : ''}
        <label>1 ${esc(ur.rg.um || 'pezzo')} di fattura = quanti «${esc(p.confezione)}»? (es. cartone da 12 bottiglie: scrivi 12)<input type="number" step="any" inputmode="decimal" data-fmt-righe="${p.id}" data-fattura="${ur.f.id}" value="${esc(perRiga)}"></label>
        <p class="msg grigio"><b>Riassunto:</b> 1 ${esc(ur.rg.um || 'confezione')} di fattura = ${qta(perRiga)} ${esc(p.confezione)} · 1 ${esc(p.confezione)} = ${qta(p.contenuto)} ${esc(p.unita)}</p>
        <p class="msg grigio">${pr != null ? `Quindi: <b>${euro(pr, 3)}</b> a ${esc(p.confezione)} · ${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)} · <b>${rif ? n2(rif.valore) + ' ' + rif.etichetta : ''}</b>` : 'Senza prezzo.'}</p>
      </div>` : `<div class="card"><h3>Prezzo</h3><p>${pr != null ? `${euro(pr, 3)} a ${esc(p.confezione)} · <b>${rif ? n2(rif.valore) + ' ' + rif.etichetta : ''}</b>` : 'Senza prezzo.'}</p><p class="tenue piccolo">Non arriva da nessuna fattura: il prezzo è quello del foglio o messo a mano.</p></div>`;
    return {
      titolo: `Ricontrollo formati · ${ui.fmtIdx + 1} di ${lista.length}`, indietro: '#/prodotti', html: chips + `
      <div class="ctrl">
      <div class="card form">
        <h3 class="grande-t">${esc(p.nomeBreve)}${p.formatoOk ? ' <span class="badge verde">ricontrollato</span>' : ''}</h3>
        <div class="sottotitolo">${esc(p.nomeCompleto)}<br>${esc(forn ? forn.nome : 'senza fornitore')} · ${esc(p.categoria || '')}${usoRic ? ` · usato in ${usoRic} ${usoRic === 1 ? 'ricetta' : 'ricette'}` : ''}</div>
        <label>Nome breve<input data-ctrl="${p.id}" data-k="nomeBreve" value="${esc(p.nomeBreve)}"></label>
        <div class="due">
          <label>Reparto<select data-ctrl="${p.id}" data-k="reparto">${M.REPARTI.map(r => `<option ${M.reparto(p) === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
          <label>Categoria<input list="cat-fmt" data-ctrl="${p.id}" data-k="categoria" value="${esc(p.categoria)}"><datalist id="cat-fmt">${categorie().map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
        </div>
        <label>Si compra a<input data-ctrl="${p.id}" data-k="confezione" value="${esc(p.confezione)}" placeholder="bottiglia, kg, cartone…"></label>
        <div class="due">
          <label>Che contiene<input type="number" step="any" inputmode="decimal" data-ctrl="${p.id}" data-k="contenuto" value="${esc(p.contenuto)}"></label>
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
  function listaRicette() {
    const f = ui.filtroRicette.toLowerCase();
    const l = S.ricette.filter(r => r.tipo === ui.tipoRicette && (!f || r.nome.toLowerCase().includes(f))).sort((a, b) => a.nome.localeCompare(b.nome));
    if (!l.length) return '<p class="tenue centro">Nessuna ricetta.</p>';
    // ordinamento: dal guadagno più basso, o dal moltiplicatore più basso (così i problemi stanno in cima)
    const ord = ui.ordineRicette || 'nome';
    if (ord !== 'nome' && l[0].tipo !== 'semilavorato') {
      if (ord === 'vendute') { const pp = periodoVendite(); l.sort((a, b) => vendutiDi(b, pp) - vendutiDi(a, pp)); }
      else {
        const k = ord === 'guadagno' ? 'margine' : 'molt';
        const v = (r) => { const x = M.indicatori(r)[k]; return x == null ? Infinity : x; };
        l.sort((a, b) => v(a) - v(b));
      }
    }
    if (ui.spostaModo) { const sel = new Set(ui.spostaSel || []); return l.map(r => `<label class="riga spunta-riga"><input type="checkbox" data-sposta="${r.id}" ${sel.has(r.id) ? 'checked' : ''}><span>${esc(r.nome)}</span></label>`).join(''); }
    return l.map(r => {
      if (r.tipo === 'semilavorato') {
        const c = M.costo(r);
        return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>resa ${qta(r.resa)} ${esc(r.unita)}</small></span><span class="destra">${euro(c)}<small>${c != null && r.resa ? euro(c / r.resa * 1000) + ' al ' + (r.unita === 'g' ? 'kg' : 'litro') : ''}</small></span></a>`;
      }
      const i = M.indicatori(r);
      // ricette con solo una parte degli ingredienti: i numeri sono troppo belli, lo dico chiaro
      const parziale = /^Ricetta da completare/.test(r.note || '');
      return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>costo ${euro(i.costo)} → prezzo ${euro(i.prezzo)}</small></span><span class="destra">${parziale ? '<span class="badge giallo">ingredienti incompleti</span>' : badgeMolt(i)}<small>${i.margine != null ? 'guadagni ' + euro(i.margine) : ''}</small></span></a>`;
    }).join('');
  }
  PAGINE.ricette = function () {
    return {
      titolo: 'Ricette', azione: '<a class="btn-top" href="#/modifica-ricetta/nuovo">＋ Nuova</a>', html: `
      <input class="cerca" type="search" placeholder="Cerca una ricetta" value="${esc(ui.filtroRicette)}" data-filtro="ricette">
      <div class="chips">${Object.entries(M.TIPI).map(([k, v]) => `<button class="chip ${ui.tipoRicette === k ? 'on' : ''}" data-az="tipo-ricette" data-v="${k}">${esc(v)}</button>`).join('')}</div>
      ${ui.tipoRicette !== 'semilavorato' ? `<div class="chips sotto"><span class="tenue piccolo">Ordina per:</span>${[['nome', 'Nome'], ['vendute', 'Più vendute'], ['guadagno', 'Guadagno più basso'], ['molt', 'Moltiplicatore più basso']].map(([k, v]) => `<button class="chip ${(ui.ordineRicette || 'nome') === k ? 'on' : ''}" data-az="ordine-ricette" data-v="${k}">${v}</button>`).join('')}</div>` : ''}
      ${ui.spostaModo ? `<div class="card evidenza sposta-barra"><b>Sposta le ricette spuntate (${(ui.spostaSel || []).length})</b>
        <label>nel gruppo<select id="sposta-in">${Object.entries(M.TIPI).filter(([k]) => k !== ui.tipoRicette).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
        <div class="bottoni"><button class="btn primario" data-az="sposta-ok">Sposta</button><button class="btn" data-az="sposta-tutte">Spunta tutte quelle visibili</button><button class="btn" data-az="sposta-fine">Annulla</button></div></div>` : ''}
      <div class="bottoni"><button class="btn piccolo" data-az="sposta-inizia">Sposta ricette in un altro gruppo</button><a class="btn piccolo" href="#/gruppi-ricette">＋ Nuovo gruppo / gestisci i gruppi</a></div>
      <div class="bottoni"><button class="btn" data-az="riv-inizia">Rivedi ${ui.filtroRicette ? 'quelle con «' + esc(ui.filtroRicette) + '»' : 'le ' + esc((M.TIPI[ui.tipoRicette] || 'ricette').toLowerCase())} una per una</button></div>
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
      return `<tr><td><a href="${link}">${esc(M.nomeRif(rg.rif))}</a>${rg.nota ? `<small>${esc(rg.nota)}</small>` : ''}</td><td class="n">${qta(rg.quantita)} ${esc(M.unitaRif(rg.rif))}</td><td class="n">${rg.costo == null ? '<span class="badge rosso">manca</span>' : euro(rg.costo, 3)}</td><td class="n tenue">${perc(quota, 0)}</td></tr>`;
    }).join('') + (r.costiExtra || []).map(e => `<tr><td>${esc(e.nome)}</td><td></td><td class="n">${euro(e.costo, 3)}</td><td class="n tenue">${perc(cr.totale ? e.costo / cr.totale : null, 0)}</td></tr>`).join('');
    return {
      titolo: r.nome, indietro: '#/ricette', azione: `<a class="btn-top" href="#/modifica-ricetta/${r.id}">Modifica</a>`, html: `
      ${semi ? `<div class="kpi-griglia">${kpi('Costo della preparazione', euro(cr.totale))}${kpi('Resa', qta(r.resa) + ' ' + esc(r.unita))}${kpi(r.unita === 'g' ? 'Costo al kg' : 'Costo al litro', euro(cr.totale != null && r.resa ? cr.totale / r.resa * 1000 : null))}${kpi('Costo per 10 ' + esc(r.unita), euro(cr.totale != null && r.resa ? cr.totale / r.resa * 10 : null, 3))}</div>` : `
      <div class="kpi-griglia">
        ${kpi('Costo', euro(i.costo), 'senza IVA')}
        ${kpi('Prezzo di vendita', euro(i.prezzo), 'senza IVA ' + euro(i.netto))}
        ${kpi('Moltiplicatore', i.molt == null ? '—' : '× ' + n2(i.molt), 'prezzo con IVA ÷ costo' + (i.soglia ? ' · soglia × ' + n2(i.soglia) : ''), i.sotto ? 'rosso' : 'verde')}
        ${kpi('Incidenza', perc(i.incidenza), 'margine ' + euro(i.margine) + ' a pezzo')}
      </div>`}
      ${cr.mancanti.length ? `<p class="msg rosso">Mancano i prezzi di: ${esc(cr.mancanti.join(', '))}.</p>` : ''}
      <div class="card"><h3>Ingredienti</h3>${r.media ? '<p class="msg grigio">Il cliente ne sceglie uno: il costo è la media di questi.</p>' : ''}<table class="tab"><tr><th>Ingrediente</th><th class="n">Dose</th><th class="n">Costo</th><th class="n">Peso</th></tr>${righe}
        <tr class="totale"><td>Totale</td><td></td><td class="n">${euro(cr.totale, 3)}</td><td></td></tr></table></div>
      ${asp && (r.asporto || []).length ? `<div class="card"><h3>Da asporto</h3><div class="dati">
        ${(r.asporto || []).map(a => `<div><span>${esc(M.nomeRif(a.rif))} × ${qta(a.quantita)}</span><b>${euro(M.costoRiga(a.rif, a.quantita).costo, 3)}</b></div>`).join('')}
        <div><span>Costo da asporto</span><b>${euro(asp.totale)}</b></div>
        <div><span>Moltiplicatore da asporto</span><b>× ${n2(r.prezzo / asp.totale)}</b></div></div></div>` : ''}
      <div class="card"><h3>Allergeni</h3>${all.length ? `<div class="chips">${all.map(a => `<span class="chip on">${esc(a)}</span>`).join('')}</div>` : '<p class="tenue">Nessun allergene segnato negli ingredienti.</p>'}<p class="tenue piccolo">Presi in automatico dalle schede dei prodotti.</p></div>
      ${!semi && periodi.length ? `<div class="card"><h3>Vendite</h3><table class="tab"><tr><th>Periodo</th><th class="n">Pezzi</th><th class="n">Incasso</th><th class="n">Margine</th></tr>
        ${periodi.map(pp => `<tr><td>${esc(pp)}</td><td class="n">${qta(r.vendite[pp])}</td><td class="n">${euro(r.vendite[pp] * r.prezzo, 0)}</td><td class="n">${euro(i.margine != null ? r.vendite[pp] * i.margine : null, 0)}</td></tr>`).join('')}</table>
        <p class="tenue piccolo">Margine senza IVA, con il costo di oggi.</p></div>` : ''}
      <div class="card"><h3>Andamento del costo</h3>${grafico(and.map(x => ({ x: dataIt(x.data).slice(0, 5), y: x.costo })), 'Costo')}</div>
      ${uso.tutte.length ? `<div class="card"><h3>Usata in</h3>${uso.tutte.map(x => `<a class="riga" href="#/ricetta/${x.id}"><span>${esc(x.nome)}</span><span>${euro(M.costo(x))}</span></a>`).join('')}</div>` : ''}
      ${r.note ? `<div class="card"><h3>Note</h3><p>${esc(r.note)}</p></div>` : ''}
      <div class="bottoni">${!semi ? `<button class="btn" data-az="simula-ricetta" data-id="${r.id}">Simula un altro prezzo</button>` : ''}<button class="btn" data-az="duplica-ricetta" data-id="${r.id}">Duplica</button></div>`
    };
  };

  // Rivedere le ricette una per una: ingredienti, dosi e prezzo, poi «Salva e avanti»
  function periodoVendite() {
    const con = S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp]));
    if (ui.rivPer && con.includes(ui.rivPer)) return ui.rivPer;
    return con[con.length - 1] || '';
  }
  const vendutiDi = (r, pp) => (pp && (r.vendite || {})[pp]) || 0;
  function listaRivedi() {
    const filtro = ui.rivFiltro || 'darivedere';
    const cerca = (ui.filtroRicette || '').toLowerCase();
    const ord = ui.rivOrdine || 'nome', pp = periodoVendite();
    const l = S.ricette.filter(r => r.tipo === ui.tipoRicette && (!cerca || r.nome.toLowerCase().includes(cerca)) && (filtro === 'tutte' || r.id === ui.rivFisso || (filtro === 'incomplete' ? /^Ricetta da completare/.test(r.note || '') || !(r.righe || []).length : !r.rivista)))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    if (ord === 'piu') l.sort((a, b) => vendutiDi(b, pp) - vendutiDi(a, pp));
    if (ord === 'meno') l.sort((a, b) => vendutiDi(a, pp) - vendutiDi(b, pp));
    if (ord === 'nonvendute') return l.filter(r => !vendutiDi(r, pp));
    return l;
  }
  PAGINE['rivedi-ricette'] = function () {
    const lista = listaRivedi();
    const filtro = ui.rivFiltro || 'darivedere';
    const tutte = S.ricette.filter(r => r.tipo === ui.tipoRicette);
    const fatte = tutte.filter(r => r.rivista).length;
    const titolo = 'Rivedi ' + (M.TIPI[ui.tipoRicette] || 'ricette').toLowerCase() + (ui.filtroRicette ? ' «' + ui.filtroRicette + '»' : '');
    const chips = `<div class="chips">${Object.entries(M.TIPI).map(([k, v]) => `<button class="chip ${ui.tipoRicette === k ? 'on' : ''}" data-az="riv-tipo" data-v="${k}">${esc(v)}</button>`).join('')}</div>
      <div class="chips sotto">${[['darivedere', 'Da rivedere (' + (tutte.length - fatte) + ')'], ['incomplete', 'Con ingredienti incompleti'], ['tutte', 'Tutte (' + tutte.length + ')']].map(([k, v]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-az="riv-filtro" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="chips sotto"><span class="tenue piccolo">Ordine:</span>${[['nome', 'Per nome'], ['piu', 'Più vendute prima'], ['meno', 'Meno vendute prima'], ['nonvendute', 'Solo mai vendute']].map(([k, v]) => `<button class="chip ${(ui.rivOrdine || 'nome') === k ? 'on' : ''}" data-az="riv-ordine" data-v="${k}">${v}</button>`).join('')}</div>
      ${(ui.rivOrdine || 'nome') !== 'nome' ? `<div class="chips sotto"><span class="tenue piccolo">Vendite del periodo:</span>${S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp])).map(pp => `<button class="chip ${periodoVendite() === pp ? 'on' : ''}" data-az="riv-per" data-v="${esc(pp)}">${esc(pp)}</button>`).join('') || '<span class="tenue piccolo">nessuna vendita caricata</span>'}</div>` : ''}`;
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
        ${periodoVendite() ? `<p class="tenue piccolo">Venduti nel periodo «${esc(periodoVendite())}»: <b>${qta(vendutiDi(r, periodoVendite()))}</b></p>` : ''}
        ${b.note ? `<p class="msg ${/^Ricetta da completare/.test(b.note) ? 'giallo' : 'grigio'}">${esc(b.note)}</p>` : ''}
        ${semi ? `<div class="due"><label>Quanto ne viene<input type="number" step="any" inputmode="decimal" data-b="resa" value="${esc(b.resa)}"></label><label>Unità<select data-b="unita">${['ml', 'g', 'pz'].map(u => `<option ${b.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>`
          : `<label>Prezzo di vendita (con IVA)<input type="number" step="any" inputmode="decimal" data-b="prezzo" value="${esc(b.prezzo)}"></label>`}
        <h3>Ingredienti</h3>
        ${!semi ? `<label class="spunta"><input type="checkbox" data-media="1" ${b.media ? 'checked' : ''}> Il cliente ne sceglie uno (amari, rum, grappe…): il costo è la <b>media</b> degli ingredienti, non la somma</label>` : ''}
        ${b.righe.map((rg, k) => `<div class="riga-ed">${campoIngrediente(rg, k)}
          <input type="number" step="any" inputmode="decimal" data-r="${k}" data-k="quantita" value="${esc(rg.quantita)}" placeholder="dose"><span class="u">${esc(M.unitaRif(rg.rif))}</span>
          <button class="x" data-az="togli-riga" data-k="${k}" aria-label="Togli">✕</button></div>`).join('')}
        <button class="btn piccolo" data-az="aggiungi-riga">＋ Aggiungi ingrediente</button>
        <p class="anteprima">Costo: <b>${euro(c, 3)}</b>${!semi && pr && c ? ` · moltiplicatore × ${n2(pr / c)}` : ''}</p>
        <label>Note<textarea data-b="note" rows="2">${esc(b.note)}</textarea></label>
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
      const base = id === 'nuovo' ? { id: M.uid('r'), nome: '', tipo: ui.tipoRicette, prezzo: null, righe: [], resa: null, unita: 'ml', asporto: [], costiExtra: [], vendite: {}, note: '' } : JSON.parse(JSON.stringify(M.ricetta(id)));
      base._per = 'r:' + id; ui.bozza = base;
    }
    const b = ui.bozza;
    M.svuota();
    const anteprima = M.costoRicetta(Object.assign({}, b, { id: '_bozza' }));
    const semi = b.tipo === 'semilavorato';
    return {
      titolo: id === 'nuovo' ? 'Nuova ricetta' : 'Modifica ' + b.nome, indietro: id === 'nuovo' ? '#/ricette' : '#/ricetta/' + id, html: `
      <div class="card form">
        <label>Nome<input data-b="nome" value="${esc(b.nome)}"></label>
        <div class="due"><label>Tipo<select data-b="tipo" data-ridisegna="1">${Object.entries(M.TIPI_SINGOLARE).map(([k, v]) => `<option value="${k}" ${b.tipo === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        ${semi ? `<label>Quanto ne viene<input type="number" step="any" inputmode="decimal" data-b="resa" value="${esc(b.resa)}"></label>` : `<label>Prezzo di vendita<input type="number" step="any" inputmode="decimal" data-b="prezzo" value="${esc(b.prezzo)}"></label>`}</div>
        ${semi ? `<label>Unità della preparazione<select data-b="unita">${['ml', 'g', 'pz'].map(u => `<option ${b.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>` : ''}
      </div>
      <div class="card form"><h3>Ingredienti</h3>
        ${b.tipo !== 'semilavorato' ? `<label class="spunta"><input type="checkbox" data-media="1" ${b.media ? 'checked' : ''}> Il cliente ne sceglie uno (amari, rum, grappe…): il costo è la <b>media</b> degli ingredienti, non la somma</label>` : ''}
        ${b.righe.map((rg, k) => `<div class="riga-ed">${campoIngrediente(rg, k)}
          <input type="number" step="any" inputmode="decimal" data-r="${k}" data-k="quantita" value="${esc(rg.quantita)}" placeholder="dose"><span class="u">${esc(M.unitaRif(rg.rif))}</span>
          <button class="x" data-az="togli-riga" data-k="${k}" aria-label="Togli">✕</button></div>`).join('')}
        <button class="btn piccolo" data-az="aggiungi-riga">＋ Aggiungi ingrediente</button>
        <p class="anteprima">Costo: <b>${euro(anteprima.totale, 3)}</b>${!semi && b.prezzo && anteprima.totale ? ` · moltiplicatore × ${n2(b.prezzo / anteprima.totale)}` : ''}</p>
      </div>
      <div class="card form"><h3>Costi fissi (guarnizioni, sale…)</h3>
        ${(b.costiExtra || []).map((e, k) => `<div class="riga-ed"><input data-e="${k}" data-k="nome" value="${esc(e.nome)}" placeholder="nome"><input type="number" step="any" inputmode="decimal" data-e="${k}" data-k="costo" value="${esc(e.costo)}" placeholder="€"><button class="x" data-az="togli-extra" data-k="${k}">✕</button></div>`).join('')}
        <button class="btn piccolo" data-az="aggiungi-extra">＋ Aggiungi costo fisso</button></div>
      ${!semi ? `<div class="card form"><h3>Da asporto</h3>
        ${(b.asporto || []).map((a, k) => `<div class="riga-ed"><select data-a="${k}" data-k="rif">${opzioniProdotti(a.rif, p => p.categoria === 'Non alimentare')}</select><input type="number" step="any" inputmode="decimal" data-a="${k}" data-k="quantita" value="${esc(a.quantita)}"><button class="x" data-az="togli-asporto" data-k="${k}">✕</button></div>`).join('')}
        <button class="btn piccolo" data-az="aggiungi-asporto">＋ Aggiungi materiale da asporto</button></div>
      <div class="card form"><h3>Vendite</h3><div class="due">${S.periodiVendita.map(pp => `<label>${esc(pp)}<input type="number" inputmode="numeric" data-v="${esc(pp)}" value="${esc((b.vendite || {})[pp] || '')}"></label>`).join('')}</div></div>` : ''}
      <div class="card form"><label>Note<textarea data-b="note" rows="3">${esc(b.note)}</textarea></label></div>
      <div class="bottoni"><button class="btn primario" data-az="salva-ricetta">Salva</button>${id !== 'nuovo' ? '<button class="btn pericolo" data-az="elimina-ricetta">Elimina</button>' : ''}</div>`
    };
  };

  // ----- Fatture -----
  PAGINE.fatture = function () {
    const l = S.fatture.slice().sort((a, b) => (a.data || '') < (b.data || '') ? 1 : -1);
    const daCtrl = fornitoriDaControllare().length;
    return {
      titolo: 'Fatture', html: `
      ${daCtrl ? `<a class="btn primario largo" href="#/controllo-fatture">Controllo rapido: ${daCtrl} ${daCtrl === 1 ? 'fornitore' : 'fornitori'} da controllare</a>` : ''}
      <div class="card"><h3>Carica</h3>
        <div class="bottoni colonna">
          <label class="btn primario">Fatture elettroniche (.xml, .p7m o .zip)<input type="file" accept=".xml,.p7m,.zip,application/xml,text/xml,application/zip" multiple hidden data-carica="xml"></label>
          <label class="btn">Foto o PDF di una fattura<input type="file" accept="image/*,application/pdf" hidden data-carica="foto"></label>
        </div>
        <p class="tenue piccolo">Puoi scegliere più fatture insieme, anche il file .zip scaricato dal portale. Le foto le legge Claude: serve la chiave in Impostazioni.</p>
        <div class="casella">${S.casella.url ? `<div><b>Casella delle fatture</b><small>${S.casella.ultimoControllo ? 'ultimo controllo ' + new Date(S.casella.ultimoControllo).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'mai controllata'}${S.casella.fotoInAttesa ? ' · ' + S.casella.fotoInAttesa + ' foto in attesa' : ''}</small></div><button class="btn piccolo" data-az="controlla-casella">Controlla adesso</button>` : `<div><b>Casella delle fatture</b><small>non ancora collegata</small></div><a class="btn piccolo" href="#/impostazioni">Collega</a>`}</div>
        <details><summary>Fatture di esempio per la prova</summary><div class="bottoni">${window.FATTURE_ESEMPIO.map((x, i) => `<button class="btn piccolo" data-az="esempio" data-i="${i}">${esc(x.nome)}</button>`).join('')}</div></details>
      </div>
      <div class="card lista">${l.length ? l.map(f => `<a class="riga" href="#/fattura/${f.id}"><span>${esc((M.fornitore(f.fornitoreId) || {}).nome || f.fornitoreNome)}<small>n. ${esc(f.numero)} del ${dataIt(f.data)}${f.tipoDoc === 'TD04' ? ' · nota di credito' : ''}${f.origine === 'foto' ? ' · da foto' : ''}</small></span><span class="destra">${euro(f.totale)}${f.stato === 'registrata' ? '<span class="badge verde">registrata</span>' : `<span class="badge giallo">${M.daAbbinare(f) ? M.daAbbinare(f) + ' da collegare' : 'da registrare'}</span>`}</span></a>`).join('') : '<p class="tenue centro">Nessuna fattura caricata.</p>'}</div>`
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
      if (reg) coll = rg.ignora ? '<span class="tenue">non è merce: ignorata</span>' : p ? `→ <a href="#/prodotto/${p.id}">${esc(p.nomeBreve)}</a> · ${qta(conf)} × ${esc(p.confezione)}${p.daCompletare ? ' <span class="badge giallo">nuovo, da completare</span>' : ''}` : '';
      else coll = `<select data-fr="${k}" data-k="scelta">
          <option value="">Collega a un prodotto…</option>
          <option value="__nuovo">＋ Crea un prodotto nuovo</option>
          <option value="__ignora" ${rg.ignora ? 'selected' : ''}>Non è merce (trasporto, cauzione…): ignora</option>
          <optgroup label="Prodotti">${S.prodotti.slice().sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve)).map(x => `<option value="${x.id}" ${rg.prodottoId === x.id ? 'selected' : ''}>${esc(x.nomeBreve)}</option>`).join('')}</optgroup></select>
        ${p ? `<div class="conv"><label>1 ${esc(rg.um || 'unità')} in fattura =<input type="number" step="any" inputmode="decimal" data-fr="${k}" data-k="confezioniPerUnita" value="${esc(rg.confezioniPerUnita)}"> ${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)}</label>
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
  PAGINE.altro = function () {
    const voci = [
      ['fornitori', 'Fornitori', 'contatti, spesa, prodotti'], ['magazzino', 'Magazzino', 'inventario ogni sei mesi'],
['vendite', 'Vendite', 'pezzi venduti per periodo'], ['mappa', 'Mappa del menu', 'cosa vende e cosa rende'],
      ['simulatore', 'Simulatore', 'e se cambia un prezzo?'], ['eventi', 'Eventi', 'listini per le serate'], ['olio', 'Costo olio', 'quanto costa friggere'],
      ['ordine', 'Metti in ordine i dati', 'tutti gli strumenti di sistemazione, in ordine'],
      ['foglio', 'Prodotti del foglio', 'collegali a quelli delle fatture, uno per uno'],
      ['importa', 'Importa dati', 'cassa, liste di ricette, listini dei fornitori'],
      ['impostazioni', 'Impostazioni', 'soglie, IVA, esportazione']
    ];
    return { titolo: 'Altro', html: `<div class="griglia-voci">${voci.map(v => `<a class="voce" href="#/${v[0]}"><b>${v[1]}</b><span>${v[2]}</span></a>`).join('')}</div>` };
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
      const lista = S.prodotti.filter(p => !p.speciale && (c.categoria === 'Tutte' || p.categoria === c.categoria)).sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve));
      return {
        titolo: 'Inventario', indietro: '#/magazzino', html: `
        <p class="tenue">Scrivi quante confezioni ci sono davvero (anche a metà: 0,5). Quelle che non tocchi restano come sono.</p>
        <div class="chips">${['Tutte'].concat(cats).map(x => `<button class="chip ${c.categoria === x ? 'on' : ''}" data-az="conta-cat" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <div class="card">${lista.map(p => { const v = c.valori[p.id]; return `<div class="conta ${v != null ? 'toccato' : ''}"><span>${esc(p.nomeBreve)}<small>${esc(p.confezione)} · in app ${qta(p.giacenza)}</small></span>
          <button class="tondo" data-az="conta-meno" data-id="${p.id}">−</button><input type="number" step="any" inputmode="decimal" data-conta="${p.id}" value="${v != null ? v : ''}" placeholder="${qta(p.giacenza)}"><button class="tondo" data-az="conta-piu" data-id="${p.id}">＋</button></div>`; }).join('')}</div>
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
  PAGINE.mappa = function () {
    const periodi = S.periodiVendita;
    const per = ui.mappaPeriodo || (periodi.includes('2025') ? '2025' : periodi[periodi.length - 1]);
    const gruppi = { cucina: M.tipiDi('cucina'), bar: M.tipiDi('bar') };
    const voci = S.ricette.filter(r => gruppi[ui.mappaGruppo].includes(r.tipo)).map(r => ({ r, q: (r.vendite || {})[per] || 0, i: M.indicatori(r) })).filter(x => x.q > 0 && x.i.margine != null);
    let html = `<div class="chips">${Object.keys(gruppi).map(g => `<button class="chip ${ui.mappaGruppo === g ? 'on' : ''}" data-az="mappa-gruppo" data-v="${g}">${g === 'bar' ? 'Bar' : 'Cucina'}</button>`).join('')}</div>
      <div class="chips">${periodi.map(pp => `<button class="chip ${per === pp ? 'on' : ''}" data-az="mappa-periodo" data-v="${esc(pp)}">${esc(pp)}</button>`).join('')}</div>`;
    if (voci.length < 2) return { titolo: 'Mappa del menu', indietro: '#/altro', html: html + '<p class="tenue centro">Servono le vendite di almeno due ricette in questo periodo.</p>' };
    const tot = voci.reduce((s, x) => s + x.q, 0);
    const sogliaQ = 0.7 * tot / voci.length;
    const sogliaM = voci.reduce((s, x) => s + x.q * x.i.margine, 0) / tot;
    const gruppo = (x) => x.q >= sogliaQ ? (x.i.margine >= sogliaM ? 'vincenti' : 'rendere') : (x.i.margine >= sogliaM ? 'spingere' : 'ripensare');
    const NOMI = { vincenti: ['Vincenti', 'vendono tanto e rendono tanto: non toccarli'], rendere: ['Da far rendere di più', 'vendono tanto ma rendono poco: rivedi costo o prezzo'], spingere: ['Da spingere', 'rendono bene ma vendono poco: mettili in vista'], ripensare: ['Da ripensare', 'vendono poco e rendono poco'] };
    const W = 340, H = 260, P = 34;
    const maxQ = Math.max(...voci.map(x => x.q)), maxM = Math.max(...voci.map(x => x.i.margine)), minM = Math.min(0, ...voci.map(x => x.i.margine));
    const X = q => P + 10 + q / maxQ * (W - P - 24), Y = m => H - P - 10 - (m - minM) / (maxM - minM || 1) * (H - P - 30);
    const col = { vincenti: 'var(--verde)', rendere: 'var(--giallo)', spingere: 'var(--accento)', ripensare: 'var(--rosso)' };
    html += `<div class="card"><svg class="mappa" viewBox="0 0 ${W} ${H}">
      <line x1="${X(sogliaQ)}" y1="8" x2="${X(sogliaQ)}" y2="${H - P}" class="asse-s"/><line x1="${P}" y1="${Y(sogliaM)}" x2="${W - 6}" y2="${Y(sogliaM)}" class="asse-s"/>
      <line x1="${P}" y1="${H - P}" x2="${W - 6}" y2="${H - P}" class="asse"/><line x1="${P}" y1="8" x2="${P}" y2="${H - P}" class="asse"/>
      <text x="${W / 2}" y="${H - 8}" text-anchor="middle" class="g-x">quanto vende →</text><text x="12" y="${H / 2}" transform="rotate(-90 12 ${H / 2})" text-anchor="middle" class="g-x">quanto rende a pezzo →</text>
      ${voci.map((x, k) => `<circle cx="${X(x.q)}" cy="${Y(x.i.margine)}" r="9" fill="${col[gruppo(x)]}" stroke="#fff" stroke-width="1.5"/><text x="${X(x.q)}" y="${Y(x.i.margine) + 3.5}" text-anchor="middle" class="g-num">${k + 1}</text>`).join('')}
    </svg><p class="tenue piccolo">Rende = margine a pezzo senza IVA (${euro(sogliaM)} di media). Vende = pezzi venduti (la soglia è il 70% della media, ${n2(sogliaQ, 0)} pezzi).</p></div>`;
    html += Object.keys(NOMI).map(g => { const l = voci.filter(x => gruppo(x) === g); return l.length ? `<div class="card"><h3><span class="punto" style="background:${col[g]}"></span>${NOMI[g][0]}</h3><p class="tenue piccolo">${NOMI[g][1]}</p>${l.map(x => `<a class="riga" href="#/ricetta/${x.r.id}"><span><span><span class="num" style="background:${col[g]}">${voci.indexOf(x) + 1}</span>${esc(x.r.nome)}</span><small>${qta(x.q)} venduti</small></span><span class="destra">${euro(x.i.margine)}<small>a pezzo · ${euro(x.q * x.i.margine, 0)} in tutto</small></span></a>`).join('')}</div>` : ''; }).join('');
    return { titolo: 'Mappa del menu', indietro: '#/altro', html };
  };

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
        <div class="due"><label>${sm.inPercentuale ? 'Aumento in %' : 'Nuovo prezzo (senza IVA)'}<input type="number" step="any" inputmode="decimal" data-sim="valore" value="${esc(sm.valore)}"></label>
        <label class="interruttore"><input type="checkbox" data-az="sim-perc" ${sm.inPercentuale ? 'checked' : ''}> in percentuale</label></div>` : `
        <label>Ricetta<select data-sim="ricettaId"><option value="">Scegli…</option>${S.ricette.filter(r => r.tipo !== 'semilavorato').sort((a, b) => a.nome.localeCompare(b.nome)).map(r => `<option value="${r.id}" ${sm.ricettaId === r.id ? 'selected' : ''}>${esc(r.nome)} (ora ${euro(r.prezzo)})</option>`).join('')}</select></label>
        <label>Nuovo prezzo di vendita<input type="number" step="any" inputmode="decimal" data-sim="prezzo" value="${esc(sm.prezzo)}"></label>`}
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
        <div class="due"><label>Prezzo<input type="number" step="any" inputmode="decimal" data-ev="${id}" data-k="${k}" data-c="prezzo" value="${esc(rg.prezzo)}"></label><label>Pezzi previsti<input type="number" inputmode="numeric" data-ev="${id}" data-k="${k}" data-c="previsti" value="${esc(rg.previsti)}"></label></div>
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
  PAGINE.olio = function () {
    const o = S.impostazioni.olio;
    const tot = (o.dettaglio || []).reduce((s, d) => s + d[1] * d[2], 0);
    const c = M.costoOlioGrammo();
    return {
      titolo: 'Costo dell\'olio', indietro: '#/altro', html: `
      <p class="tenue">Il tuo metodo: quanto spendi di olio in un anno, diviso i grammi di cibo che friggi in un anno. Viene il costo dell'olio per ogni grammo fritto, che entra nelle ricette dei fritti.</p>
      <div class="kpi-griglia">${kpi('Per grammo fritto', euro(c, 5))}${kpi('Su 255 g di patatine', euro(c * 255, 3))}</div>
      <div class="card form"><label>Spesa per l'olio in un anno (€)<input type="number" step="any" inputmode="decimal" data-olio="spesaAnnua" value="${esc(o.spesaAnnua)}"></label>
        <label>Grammi fritti in un anno<input type="number" inputmode="numeric" data-olio="grammiFritti" value="${esc(o.grammiFritti)}"></label>
        ${tot ? `<button class="btn piccolo" data-az="olio-da-tabella">Usa il totale della tabella (${qta(tot)} g)</button>` : ''}</div>
      <div class="card scorri"><h3>Da dove vengono i grammi</h3><table class="tab"><tr><th>Piatto</th><th class="n">Porzioni</th><th class="n">Grammi</th><th class="n">Totale</th></tr>
        ${(o.dettaglio || []).map((d, k) => `<tr><td><input class="mini largo" data-od="${k}" data-c="0" value="${esc(d[0])}"></td><td class="n"><input class="mini" type="number" data-od="${k}" data-c="1" value="${esc(d[1])}"></td><td class="n"><input class="mini" type="number" data-od="${k}" data-c="2" value="${esc(d[2])}"></td><td class="n">${qta(d[1] * d[2])}</td></tr>`).join('')}
        <tr class="totale"><td>Totale</td><td></td><td></td><td class="n">${qta(tot)}</td></tr></table>
        <button class="btn piccolo" data-az="olio-riga">＋ Aggiungi piatto</button></div>`
    };
  };

  // ----- Impostazioni -----
  PAGINE.impostazioni = function () {
    const im = S.impostazioni;
    return {
      titolo: 'Impostazioni', indietro: '#/altro', html: `
      <div class="card form"><h3>Soglie del moltiplicatore</h3><p class="tenue piccolo">Sotto questo numero la ricetta diventa rossa.</p>
        <div class="due">${Object.keys(M.TIPI).filter(t => t !== 'semilavorato').map(t => `<label>${esc(M.TIPI[t])}<input type="number" step="any" inputmode="decimal" data-soglia="${t}" value="${esc((im.soglie || {})[t])}"></label>`).join('')}</div></div>
      <div class="card"><h3>Dati dalla cassa</h3><p class="tenue piccolo">Listino dei prodotti in vendita e venduto di un periodo, dai file esportati da Cassa in Cloud.</p><a class="btn" href="#/importa">Importa dalla cassa</a></div>
      <div class="card form"><h3>Prezzi</h3>
        <label>IVA sul prezzo di vendita (%)<input type="number" step="any" data-imp="ivaVendita" value="${esc(im.ivaVendita)}"></label>
        <label>Quando un prodotto arriva da più fornitori, usa<select data-imp="metodoPrezzo">${[['ultimo', 'l\'ultimo prezzo pagato'], ['minimo', 'il prezzo più basso'], ['media', 'la media tra i fornitori']].map(([k, v]) => `<option value="${k}" ${im.metodoPrezzo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Segnala gli aumenti a partire da (%)<input type="number" step="any" data-imp="sogliaAumento" value="${esc(im.sogliaAumento)}"></label></div>
      <div class="card form"><h3>Fatture</h3>
        <label class="interruttore"><input type="checkbox" data-az="imp-bool" data-k="autoCrea" ${im.autoCrea !== false ? 'checked' : ''}> Crea in automatico i prodotti nuovi che arrivano dalle fatture</label>
        <label class="interruttore"><input type="checkbox" data-az="imp-bool" data-k="autoRegistra" ${im.autoRegistra !== false ? 'checked' : ''}> Registra subito le fatture complete (i prezzi si aggiornano da soli)</label>
        <p class="tenue piccolo">Le spese di trasporto, le cauzioni e simili vengono saltate da sole. Le fatture lette da foto restano sempre da controllare prima di registrarle.</p></div>
      <div class="card form"><h3>Casella delle fatture</h3>
        <p class="tenue piccolo">L'indirizzo dell'app web creata nella casella Gmail delle fatture e la parola segreta scritta nel suo programma. Il gestionale la controlla da solo ogni volta che lo apri.</p>
        <label>Indirizzo dell'app web<input data-cas="url" value="${esc(S.casella.url)}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
        <label>Parola segreta<span class="campo-occhio"><input type="password" id="cas-chiave" data-cas="chiave" value="${esc(S.casella.chiave)}" autocomplete="off"><button type="button" class="occhio" data-occhio="cas-chiave" aria-label="Mostra">${OCCHIO}</button></span></label>
        <button class="btn piccolo" data-az="controlla-casella">Prova adesso</button></div>
      <div class="card form"><h3>Lettura delle foto</h3>
        <p class="tenue piccolo">Serve una chiave della piattaforma per sviluppatori di Anthropic (console.anthropic.com), a consumo: pochi centesimi a foto. Resta salvata solo su questo dispositivo.</p>
        <label>Chiave<span class="campo-occhio"><input type="password" id="imp-chiave" autocomplete="off" data-imp="chiaveClaude" value="${esc(im.chiaveClaude)}" placeholder="sk-ant-…"><button type="button" class="occhio" data-occhio="imp-chiave" aria-label="Mostra">${OCCHIO}</button></span></label>
        <label>Modello<input data-imp="modelloClaude" value="${esc(im.modelloClaude)}"></label></div>
      ${CLOUD && utente ? `<div class="card"><h3>Account</h3><p>Sei entrato come <b>${esc(utente.email)}</b>. I dati sono online e uguali su tutti i dispositivi.</p>
        <div class="bottoni colonna">${(datiDelDispositivo() || {}).fatture && datiDelDispositivo().fatture.length ? `<button class="btn" data-az="porta-locali">Porta online le fatture salvate su questo dispositivo (${datiDelDispositivo().fatture.length})</button>` : ''}<button class="btn" data-az="esci">Esci</button></div></div>` : ''}
      <div class="card"><h3>Dati</h3>
        <p class="tenue piccolo">${CLOUD ? 'Salvati online su Firebase.' : 'In questa prova i dati sono salvati su questo dispositivo.'}</p>
        <div class="bottoni colonna">
          <button class="btn" data-az="esporta-excel">Esporta in Excel</button>
          <a class="btn" href="#/foglio">Prodotti del foglio: collegali a quelli delle fatture</a>
          <button class="btn" data-az="scarica-copia">Scarica una copia dei dati</button>
          <label class="btn">Carica una copia dei dati<input type="file" accept=".json" hidden data-carica="copia"></label>
          <button class="btn pericolo" data-az="ripristina">Ricomincia con i dati della prova</button>
        </div></div>`
    };
  };

  // ---------- Disegno ----------
  const ALTRE = [['fornitori', 'Fornitori'], ['magazzino', 'Magazzino'], ['vendite', 'Vendite'], ['mappa', 'Mappa del menu'], ['simulatore', 'Simulatore'], ['eventi', 'Eventi'], ['olio', 'Costo olio'], ['foglio', 'Prodotti del foglio'], ['importa', 'Importa dalla cassa'], ['impostazioni', 'Impostazioni']];
  const TAB = [['pannello', 'Pannello', 'M3 12l9-8 9 8v8a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'], ['prodotti', 'Prodotti', 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10'], ['ricette', 'Ricette', 'M6 3h12M8 3v6l-4 12h16L16 9V3'], ['fatture', 'Fatture', 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8'], ['altro', 'Altro', 'M5 12h.01M12 12h.01M19 12h.01']];
  const SEZIONE = { ordine: 'pannello', 'gruppi-ricette': 'ricette', foglio: 'prodotti', doppioni: 'prodotti', importa: 'altro', 'controllo-fatture': 'fatture', controllo: 'prodotti', pulizia: 'altro', formati: 'prodotti', prodotto: 'prodotti', 'modifica-prodotto': 'prodotti', ricetta: 'ricette', 'modifica-ricetta': 'ricette', 'rivedi-ricette': 'ricette', fattura: 'fatture' };
  function disegna() {
    if (!S) return;
    const [, nome, arg] = (location.hash || '#/pannello').split('/');
    const fn = PAGINE[nome] || PAGINE.pannello;
    if (!(nome === 'modifica-prodotto' || nome === 'modifica-ricetta' || nome === 'rivedi-ricette')) ui.bozza = null;
    if (nome !== 'magazzino') ui.conta = null;
    let pag;
    try { pag = fn(arg); } catch (e) { console.error(e); pag = { titolo: 'Errore', html: `<p class="msg rosso">Qualcosa non ha funzionato: ${esc(e.message)}</p>` }; }
    const sez = SEZIONE[nome] || (PAGINE[nome] && TAB.some(t => t[0] === nome) ? nome : (PAGINE[nome] ? 'altro' : 'pannello'));
    $('#testa').innerHTML = `${pag.indietro ? `<a class="indietro" href="${pag.indietro}" data-az="indietro" aria-label="Indietro">‹</a>` : '<span></span>'}<h1>${esc(pag.titolo)}</h1>${pag.azione || '<span></span>'}`;
    $('#contenuto').innerHTML = pag.html;
    // sul telefono: barra in basso; su Mac e iPad: colonna a sinistra con tutte le sezioni
    const PAGINA_DI = { fornitore: 'fornitori', evento: 'eventi' };
    const attiva = PAGINA_DI[nome] || nome;
    $('#tabbar').innerHTML = '<div class="marchio">Gestionale <span>Repub</span></div>' +
      TAB.map(t => `<a href="#/${t[0]}" class="${sez === t[0] ? 'on' : ''} ${t[0] === 'altro' ? 'solo-stretto' : ''}"><svg viewBox="0 0 24 24"><path d="${t[2]}"/></svg><span>${t[1]}</span></a>`).join('') +
      '<div class="gruppo solo-largo">Altro</div>' +
      ALTRE.map(v => `<a href="#/${v[0]}" class="solo-largo secondaria ${attiva === v[0] ? 'on' : ''}"><span>${v[1]}</span></a>`).join('');
    $('#contenuto').className = ['pannello', 'prodotto', 'ricetta', 'fattura', 'fornitore', 'evento', 'impostazioni', 'mappa', 'scadenze', 'magazzino', 'modifica-prodotto', 'modifica-ricetta', undefined].includes(nome) && !(nome === 'magazzino' && ui.conta) ? 'colonne' : '';
    document.title = pag.titolo + ' · Gestionale Repub';
  }
  function ridisegnaMantenendo() { const y = window.scrollY; disegna(); window.scrollTo(0, y); }

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
      const l = voci().filter(({ o, gruppo }) => tutte || !t.length || t.every(w => normCassa(o.text + ' ' + gruppo).includes(w))).slice(0, 40);
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
  new MutationObserver(() => document.querySelectorAll('#contenuto select').forEach(rendiCercabile)).observe(document.getElementById('contenuto') || document.body, { childList: true, subtree: true });
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
    if (t) { tornando = null; requestAnimationFrame(() => window.scrollTo(0, t.y || 0)); } else window.scrollTo(0, 0);
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
        <label>Contenuto di una confezione<input id="np-cont" type="number" step="any" value="${cont}"></label></div>
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
  async function esportaExcel() {
    try {
      if (!window.XLSX) await caricaScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
      const X = window.XLSX; const wb = X.utils.book_new();
      const r2 = (n) => n == null ? '' : Math.round(n * 1000) / 1000;
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(S.prodotti.map(p => ({ 'Nome breve': p.nomeBreve, 'Nome completo': p.nomeCompleto, Categoria: p.categoria, Fornitore: (M.fornitore(p.fornitoreId) || {}).nome || '', Confezione: p.confezione, Contenuto: p.contenuto, Unità: p.unita, 'Prezzo senza IVA': r2(M.prezzo(p)), 'IVA %': p.iva, 'In casa': p.giacenza, 'Valore': r2(M.valoreGiacenza(p)), 'Scorta minima': p.scortaMinima, Allergeni: (p.allergeni || []).join(', ') }))), 'Prodotti');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(S.ricette.map(r => { const i = M.indicatori(r); return { Ricetta: r.nome, Tipo: M.TIPI_SINGOLARE[r.tipo], Costo: r2(i.costo), Prezzo: r.prezzo || '', 'Prezzo senza IVA': r2(i.netto), Moltiplicatore: r2(i.molt), 'Incidenza %': i.incidenza == null ? '' : r2(i.incidenza * 100), 'Margine a pezzo': r2(i.margine), Ingredienti: (r.righe || []).map(rg => `${M.nomeRif(rg.rif)} ${rg.quantita} ${M.unitaRif(rg.rif)}`).join('; '), Allergeni: M.allergeniRicetta(r).join(', ') }; })), 'Ricette');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(S.fatture.map(f => ({ Fornitore: (M.fornitore(f.fornitoreId) || {}).nome || f.fornitoreNome, Numero: f.numero, Data: f.data, Tipo: f.tipoDoc === 'TD04' ? 'Nota di credito' : 'Fattura', Imponibile: f.imponibile, Totale: f.totale, Stato: f.stato === 'registrata' ? 'Registrata' : 'Da registrare' }))), 'Fatture');
      X.writeFile(wb, 'Gestionale Repub ' + M.oggi() + '.xlsx');
    } catch (e) { alert(e.message); }
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
  AZ.reparto = (el) => { ui.reparto = el.dataset.v; ui.categoria = 'Tutte'; ridisegnaMantenendo(); };
  AZ['prod-vista'] = (el) => { ui.prodVista = el.dataset.v; ridisegnaMantenendo(); };
  AZ['forn-prod'] = (el) => { ui.fornProd = ui.fornProd === el.dataset.v ? '' : el.dataset.v; ridisegnaMantenendo(); };
  AZ['tipo-ricette'] = (el) => { ui.tipoRicette = el.dataset.v; ridisegnaMantenendo(); };
  AZ.allergene = (el) => { const a = el.dataset.v, b = ui.bozza; b.allergeni = b.allergeni || []; b.allergeni = b.allergeni.includes(a) ? b.allergeni.filter(x => x !== a) : b.allergeni.concat(a); ridisegnaMantenendo(); };
  AZ['vd-attiva'] = (el) => { ui.bozza.venditaDiretta = el.checked ? { nomePorzione: ui.bozza.unita === 'ml' ? 'calice' : 'porzione', porzione: ui.bozza.unita === 'ml' ? 150 : 1, prezzoPorzione: null, prezzoIntero: null } : null; ridisegnaMantenendo(); };
  AZ['salva-prodotto'] = () => {
    const b = ui.bozza; if (!b.nomeBreve.trim()) { alert('Scrivi il nome breve.'); return; }
    ['contenuto', 'iva', 'giacenza', 'scortaMinima', 'resa'].forEach(k => { b[k] = numDa(b[k]) || 0; });
    if (!b.contenuto) b.contenuto = 1; if (!b.resa) b.resa = 100;
    if (b.venditaDiretta) ['porzione', 'prezzoPorzione', 'prezzoIntero'].forEach(k => { b.venditaDiretta[k] = numDa(b.venditaDiretta[k]); });
    const pr = numDa(b._prezzo);
    const nuovo = b._per === 'p:nuovo';
    delete b._per; delete b._prezzo;
    b.daCompletare = false;
    if (nuovo) { if (pr != null) b.prezzi.push({ data: M.oggi(), fornitoreId: b.fornitoreId, prezzo: pr, origine: 'a mano' }); b.interno = !b.fornitoreId; S.prodotti.push(b); }
    else { const i = S.prodotti.findIndex(p => p.id === b.id); S.prodotti[i] = b; }
    ui.bozza = null; salva(); vai('#/prodotto/' + b.id);
  };
  AZ['elimina-prodotto'] = () => {
    const b = ui.bozza; const uso = M.usatoIn('p:' + b.id).dirette;
    if (uso.length && !confirm(`${b.nomeBreve} è usato in ${uso.map(r => r.nome).join(', ')}. Eliminarlo lo stesso?`)) return;
    if (!uso.length && !confirm('Eliminare ' + b.nomeBreve + '?')) return;
    S.fatture.forEach(f => f.righe.forEach(rg => { if (rg.prodottoId === b.id) { rg.prodottoId = null; rg.ignora = true; rg.automatico = true; } }));
    S.prodotti = S.prodotti.filter(p => p.id !== b.id); ui.bozza = null; salva(); vai('#/prodotti');
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
      if (u.dati) { const d = JSON.parse(u.dati); S.prodotti = d.p; S.ricette = d.r; S.fornitori = d.fo; S.ignorati = d.ig; if (d.f) S.fatture = d.f; M.svuota(); salva(); avviso('Ho annullato l\'ultima scelta: puoi rifarla.'); }
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
  AZ['fmt-categoria'] = () => { ui.fmtCat = ui.categoria && ui.categoria !== 'Tutte' && ui.categoria !== '__nuovi' ? ui.categoria : ''; ui.fmtRep = ui.categoria !== '__nuovi' ? (ui.reparto || '') : ''; ui.fmtForn = ''; ui.fmtFiltro = ui.fmtCat || ui.fmtRep ? 'tutti' : 'ricette'; ui.fmtIdx = 0; vai('#/formati'); };
  AZ['fmt-fornitore'] = (el) => { ui.fmtForn = el.dataset.id; ui.fmtCat = ''; ui.fmtRep = ''; ui.fmtFiltro = 'tutti'; ui.fmtIdx = 0; vai('#/formati'); };
  AZ['fmt-filtro'] = (el) => { ui.fmtFiltro = el.dataset.v; ui.fmtIdx = 0; ui.st_fmt = []; ridisegnaMantenendo(); };
  AZ['fmt-giusto'] = (el) => { ricorda('fmt', 'fmtIdx'); const p = M.prodotto(el.dataset.id); p.formatoOk = true; p.daCompletare = false; delete p.dubbio; if (!['dacontrollare', 'cartoni'].includes(ui.fmtFiltro || 'ricette')) ui.fmtIdx = (ui.fmtIdx || 0) + 1; salva(); ridisegnaMantenendo(); window.scrollTo(0, 0); };
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
      <label>Prezzo della ${esc(p.confezione)} senza IVA<input id="pm-p" type="number" step="any" inputmode="decimal"></label>
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
  function salvaBozzaRicetta() {
    const b = ui.bozza; if (!b.nome.trim()) { alert('Scrivi il nome.'); return null; }
    delete b._rivedi;
    b.righe = b.righe.filter(rg => rg.rif).map(rg => Object.assign(rg, { quantita: numDa(rg.quantita) || 0 }));
    b.costiExtra = (b.costiExtra || []).filter(e => e.nome || e.costo).map(e => Object.assign(e, { costo: numDa(e.costo) || 0 }));
    b.asporto = (b.asporto || []).filter(a => a.rif).map(a => Object.assign(a, { quantita: numDa(a.quantita) || 1 }));
    b.prezzo = numDa(b.prezzo); b.resa = numDa(b.resa);
    const nuovo = b._per === 'r:nuovo'; delete b._per;
    // se ha aggiunto ingredienti a una ricetta segnata come incompleta, tolgo l'avviso
    const prima = nuovo ? null : M.ricetta(b.id);
    const doseOk = b.righe.length && b.righe.every(rg => rg.quantita > 0) && (b.tipo !== 'semilavorato' || b.resa > 0);
    if (prima && /^Ricetta da completare/.test(b.note || '') && (b.righe.length > (prima.righe || []).length || doseOk)) b.note = String(b.note).replace(/^Ricetta da completare[^.]*\.\s*/, '');
    if (nuovo) S.ricette.push(b); else S.ricette[S.ricette.findIndex(r => r.id === b.id)] = b;
    ui.bozza = null; ui.tipoRicette = b.tipo; salva(); return b;
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
  const normCassa = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '').replace(/&/g, ' e ').replace(/\bpata\b/g, 'patatine').replace(/[^a-z0-9]+/g, ' ').trim();
  const bello = (t) => { const x = String(t || '').trim().toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); };
  const ricettaDiSku = (sku) => { const n = normCassa(sku); return S.ricette.find(r => r.tipo !== 'semilavorato' && ((r.nomeCassa && normCassa(r.nomeCassa) === n) || (r.aliasCassa || []).some(a => normCassa(a) === n))); };
  function somiglianzaNomi(a, b) {
    const A = normCassa(a).replace(/\b(base|drink)\b/g, ' ').split(' ').filter(x => x.length > 1), B = normCassa(b).replace(/\b(base|drink)\b/g, ' ').split(' ').filter(x => x.length > 1);
    if (!A.length || !B.length) return 0;
    if (A.join(' ') === B.join(' ')) return 1;
    const comuni = A.filter(x => B.includes(x)).length;
    // tutto il nome più corto sta dentro l'altro (es. «Centauro» e «Centauro (analcolico)»): quasi certo
    if (comuni === Math.min(A.length, B.length)) return Math.max(0.65, comuni / Math.max(A.length, B.length));
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
    const P = tabellaDa(fogli['Prodotti']), V = tabellaDa(fogli['Varianti']);
    if (!P.length) throw new Error('Nel file non trovo il foglio «Prodotti»: serve l\'esportazione del listino di Cassa in Cloud.');
    const varDi = {}; V.forEach(v => { (varDi[v['Prodotto']] = varDi[v['Prodotto']] || []).push(v); });
    const perCat = {};
    P.forEach(p => {
      const desc = String(p['Descrizione'] || '').trim(); if (!desc) return;
      // il coperto ha un costo (tovagliette, tovaglioli, pane…): diventa una ricetta come le altre
      const cat = /^coperto$/i.test(desc) ? 'COPERTO' : String(p['Categoria'] || 'Senza categoria');
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
    const gruppi = Object.entries(perCat).map(([cat, voci]) => {
      const tipo = tipoCategoria(UUID.test(cat) ? '' : cat, voci);
      return { cat, nome: UUID.test(cat) ? 'Categoria senza nome: ' + voci.slice(0, 3).map(v => bello(v.sku)).join(', ') + '…' : bello(cat), tipo, voci };
    }).sort((a, b) => (a.tipo === 'salta') - (b.tipo === 'salta') || a.nome.localeCompare(b.nome));
    // proposta di collegamento: stesso nome di cassa già salvato, oppure nome simile (una ricetta per una voce sola)
    const usate = new Set(), proposte = [];
    gruppi.forEach((g, gi) => g.voci.forEach((v, vi) => {
      v.scelta = g.tipo === 'salta' || v.prezzo <= 0 || v.prezzo > 100 ? '__salta' : '';
      const gia = ricettaDiSku(v.sku) || v.alias.map(ricettaDiSku).find(Boolean); if (gia) { v.scelta = v.scelta === '__salta' && g.tipo === 'salta' ? '__salta' : gia.id; usate.add(gia.id); return; }
      const nomeBase = v.variante && !/^BASE$/i.test(v.variante) ? v.sku : v.prodotto;
      S.ricette.filter(r => r.tipo !== 'semilavorato').forEach(r => { const sc = somiglianzaNomi(nomeBase, r.nome); if (sc >= 0.6) proposte.push({ v, r, sc: sc + (r.tipo === g.tipo ? 0.2 : 0) }); });
    }));
    proposte.sort((a, b) => b.sc - a.sc).forEach(({ v, r }) => { if (v.scelta === '' && !usate.has(r.id)) { v.scelta = r.id; usate.add(r.id); } });
    return { gruppi };
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
    const out = righe.map(r => {
      const sku = String(r[cNome] || '').trim(); const ric = ricettaDiSku(sku);
      return { sku, q: Number(r[cQ]) || 0, incasso: Number(cInc ? r[cInc] : 0) || 0, scelta: ric ? ric.id : '' };
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
      <p class="tenue piccolo">In Cassa in Cloud: esporta il listino (il file Excel con i fogli «Prodotti» e «Varianti»). Ogni prodotto e ogni variante (piccola, media, doppio…) diventa una ricetta: se esiste già le aggiorno il prezzo, se no la creo vuota e gli ingredienti li metti tu.</p>
      <label class="btn">Scegli il file del listino<input type="file" accept=".xlsx" data-carica="cassa-listino" hidden></label></div>`;
    if (L) {
      let nuove = 0, agg = 0, salta = 0;
      L.gruppi.forEach(g => g.voci.forEach(v => { if (g.tipo === 'salta' || v.scelta === '__salta') salta++; else if (v.scelta) agg++; else nuove++; }));
      listino += `<div class="card evidenza"><h3>Anteprima del listino</h3><p>Creo <b>${nuove}</b> ricette nuove, collego <b>${agg}</b> a ricette che ci sono già (aggiornando il prezzo), salto <b>${salta}</b> voci.</p>
        <p class="tenue piccolo">Per ogni categoria scegli che tipo di ricetta diventa, oppure «Non importare». Riga per riga puoi cambiare il collegamento.</p>
        <div class="bottoni"><button class="btn primario" data-az="cc-listino-ok">Importa il listino</button><button class="btn" data-az="cc-listino-annulla">Annulla</button></div></div>` +
        L.gruppi.map((g, gi) => `<details class="card" ${ui.ccAperto === gi ? 'open' : ''}><summary><b>${esc(g.nome)}</b> · ${g.voci.length} voci · <span class="${g.tipo === 'salta' ? 'tenue' : ''}">${g.tipo === 'salta' ? 'non importata' : esc(M.TIPI[g.tipo])}</span></summary>
          <label>Diventano<select data-cc-g="${gi}"><option value="salta" ${g.tipo === 'salta' ? 'selected' : ''}>Non importare</option>${Object.entries(M.TIPI).filter(([k]) => k !== 'semilavorato').map(([k, v]) => `<option value="${k}" ${g.tipo === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
          ${g.tipo === 'salta' ? '' : g.voci.map((v, vi) => { const r = v.scelta && v.scelta !== '__salta' ? M.ricetta(v.scelta) : null; return `<div class="riga-ed cc-riga"><span>${esc(v.sku)}<small>${euro(v.prezzo)}${r && r.prezzo && Math.abs(r.prezzo - v.prezzo) > 0.005 ? ` · ora ${euro(r.prezzo)}` : ''}</small></span>
            <select data-cc-v="${gi},${vi}"><option value="">＋ Ricetta nuova</option><option value="__salta" ${v.scelta === '__salta' ? 'selected' : ''}>Non importare</option><optgroup label="Collega a una ricetta che c'è già">${opzioniRicette(v.scelta, g.tipo)}</optgroup></select></div>`; }).join('')}
        </details>`).join('');
    }
    let vendite = `<div class="card form"><h3>2. Vendite di un periodo</h3>
      <p class="tenue piccolo">In Cassa in Cloud: resoconto «Venduto per sku» del periodo, esportato in Excel. Scegli prima le date (nel file non ci sono).</p>
      <div class="due"><label>Dal<input type="date" data-cc-data="dal" value="${esc(ui.ccDal || '')}"></label><label>Al<input type="date" data-cc-data="al" value="${esc(ui.ccAl || '')}"></label></div>
      <label class="btn">Scegli il file delle vendite<input type="file" accept=".xlsx" data-carica="cassa-vendite" hidden></label></div>`;
    if (Vd) {
      const coll = Vd.filter(v => v.scelta && v.scelta !== '__salta'), non = Vd.filter(v => !v.scelta);
      const pezzi = coll.reduce((s, v) => s + v.q, 0), tot = Vd.reduce((s, v) => s + v.q, 0), inc = Vd.reduce((s, v) => s + v.incasso, 0);
      const nome = ui.ccDal && ui.ccAl ? nomeDaDate(ui.ccDal, ui.ccAl) : '';
      vendite += `<div class="card evidenza"><h3>Anteprima delle vendite${ui.ccFileVendite ? ' · ' + esc(ui.ccFileVendite) : ''}</h3>
        ${ui.ccPerProdotto ? '<p class="msg giallo">Questo file è il venduto <b>per prodotto</b>: le varianti (piccola, media, doppio…) sono sommate insieme e non si possono dividere. Meglio esportare il resoconto <b>«Venduto per sku»</b>.</p>' : ''}
        <p>${Vd.length} voci, ${qta(tot)} pezzi, incasso ${euro(inc, 0)}. Collegate a una ricetta: <b>${coll.length}</b> voci (${qta(pezzi)} pezzi). Senza ricetta: <b>${non.length}</b>.</p>
        ${nome ? `<p>Periodo: <b>${esc(nome)}</b>${S.periodiVendita.includes(nome) ? ' (esiste già: sostituisco i numeri)' : ''}</p>` : '<p class="msg giallo">Scegli le date «Dal» e «Al» qui sopra: la data grigia che vedi è solo un suggerimento, il campo è ancora vuoto.</p>'}
        <div class="bottoni"><button class="btn primario" data-az="cc-vendite-ok">Salva le vendite</button><button class="btn" data-az="cc-vendite-annulla">Annulla</button></div></div>
        ${non.length ? `<div class="card"><h3>Voci senza ricetta (${non.length})</h3><p class="tenue piccolo">Se una di queste è una ricetta con un altro nome, collegala: me lo ricordo per le prossime volte. Le altre (coperto, consegne…) restano fuori.</p>
          ${Vd.map((v, i) => v.scelta ? '' : `<div class="riga-ed cc-riga"><span>${esc(v.sku)}<small>${qta(v.q)} pezzi · ${euro(v.incasso, 0)}</small></span><select data-cc-vv="${i}"><option value="">Lascia fuori</option>${opzioniRicette('', '')}</select></div>`).join('')}</div>` : ''}`;
    }
    const tipoL = ui.lsTipo || 'semilavorato';
    let lista = `<div class="card form"><h3>3. Ricette da una lista scritta</h3>
      <p class="tenue piccolo">Scrivi (o incolla) una riga per ricetta: il nome, due punti, gli ingredienti separati da virgole. Le dosi sono facoltative: le puoi mettere dopo.<br>Esempio: <i>Cipolle stufate: cipolla affettata 3 kg, olio 200 ml, paprika</i></p>
      <label>Diventano<select data-ls-tipo="1">${Object.entries(M.TIPI).map(([k, v]) => `<option value="${k}" ${tipoL === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
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
    ui.lsAnte.forEach(x => {
      if (x.gia) return;
      const righe = x.ingr.filter(g => g.rif).map(g => ({ rif: g.rif, quantita: g.q || 0, nota: '' }));
      const mancano = x.ingr.filter(g => !g.rif).map(g => g.testo);
      S.ricette.push({ id: M.uid('r'), nome: x.nome, tipo, prezzo: null, righe, resa: null, unita: 'g', asporto: [], costiExtra: [], vendite: {},
        note: 'Ricetta da completare: mancano le dosi' + (tipo === 'semilavorato' ? ' e quanto ne viene' : '') + '.' + (mancano.length ? ' Ingredienti da aggiungere: ' + mancano.join(', ') + '.' : '') });
      n++;
    });
    ui.lsAnte = null; ui.lsTesto = ''; ui.tipoRicette = tipo; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0);
    avviso(`Create ${n} ricette in «${M.TIPI[tipo]}». Le trovi con «ingredienti incompleti».`);
  };
  AZ['cc-listino-annulla'] = () => { ui.ccListino = null; ridisegnaMantenendo(); };
  AZ['cc-vendite-annulla'] = () => { ui.ccVendite = null; ridisegnaMantenendo(); };
  AZ['cc-listino-ok'] = () => {
    const L = ui.ccListino; let nuove = 0, agg = 0;
    L.gruppi.forEach(g => { if (g.tipo === 'salta') return; g.voci.forEach(v => {
      if (v.scelta === '__salta') return;
      if (v.scelta) {
        const r = M.ricetta(v.scelta); if (!r) return;
        if (!r.nomeCassa) r.nomeCassa = v.sku; else if (normCassa(r.nomeCassa) !== normCassa(v.sku)) r.aliasCassa = Array.from(new Set((r.aliasCassa || []).concat(v.sku)));
        if (v.alias.length) r.aliasCassa = Array.from(new Set((r.aliasCassa || []).concat(v.alias)));
        if (v.prezzo > 0) r.prezzo = v.prezzo; agg++;
      } else {
        const nome = v.variante && !/^BASE$/i.test(v.variante) ? bello(v.prodotto) + ' (' + v.variante.toLowerCase() + ')' : bello(v.prodotto);
        S.ricette.push({ id: M.uid('r'), nome, tipo: g.tipo, prezzo: v.prezzo || null, righe: [], resa: null, unita: 'ml', asporto: [], costiExtra: [], vendite: {}, nomeCassa: v.sku, daCassa: true,
          aliasCassa: v.alias.length ? v.alias.slice() : undefined, note: 'Ricetta da completare: creata dal listino della cassa, mancano gli ingredienti.' });
        nuove++;
      }
    }); });
    ui.ccListino = null; M.svuota(); salva(); ridisegnaMantenendo(); window.scrollTo(0, 0);
    avviso(`Fatto: ${nuove} ricette nuove, ${agg} aggiornate. Le trovi in Ricette, con «ingredienti incompleti».`);
  };
  AZ['cc-vendite-ok'] = () => {
    const Vd = ui.ccVendite;
    if (!ui.ccDal || !ui.ccAl) { alert('Prima scegli le date «Dal» e «Al» del periodo.'); return; }
    if (ui.ccAl < ui.ccDal) { alert('La data «Al» è prima di «Dal».'); return; }
    const nome = nomeDaDate(ui.ccDal, ui.ccAl); if (!nome) return;
    if (S.periodiVendita.includes(nome) && !confirm(`Il periodo «${nome}» esiste già: sostituisco i suoi numeri con quelli della cassa?`)) return;
    if (!S.periodiVendita.includes(nome)) S.periodiVendita.push(nome);
    S.periodiDate = S.periodiDate || {}; S.periodiDate[nome] = { dal: ui.ccDal, al: ui.ccAl };
    S.ricette.forEach(r => { if (r.vendite) delete r.vendite[nome]; });
    let n = 0;
    Vd.forEach(v => {
      if (!v.scelta || v.scelta === '__salta' || !v.q) return;
      const r = M.ricetta(v.scelta); if (!r) return;
      r.vendite = r.vendite || {}; r.vendite[nome] = (r.vendite[nome] || 0) + v.q; n++;
      // collegamento fatto a mano: me lo ricordo
      if (!(r.nomeCassa && normCassa(r.nomeCassa) === normCassa(v.sku)) && !(r.aliasCassa || []).some(a => normCassa(a) === normCassa(v.sku))) r.aliasCassa = (r.aliasCassa || []).concat(v.sku);
    });
    S.periodiCassa[nome] = { incasso: Math.round(Vd.reduce((s, v) => s + v.incasso, 0) * 100) / 100, pezzi: Vd.reduce((s, v) => s + v.q, 0) };
    ui.ccVendite = null; ui.vendPer = nome; salva(); avviso(`Vendite salvate: ${n} voci nel periodo «${nome}».`); vai('#/vendite');
  };
  AZ['pan-per'] = (el) => { ui.panPer = el.dataset.v; ridisegnaMantenendo(); };
  AZ['pan-gruppo'] = (el) => { ui.panGruppo = el.dataset.v; ridisegnaMantenendo(); };
  AZ['pan-mappa'] = () => { ui.mappaPeriodo = ui.panPer || null; if (ui.panGruppo && ui.panGruppo !== 'tutto') ui.mappaGruppo = ui.panGruppo; };
  AZ['pan-completa'] = () => {
    // il tipo con più vendite da completare: «Rivedi» con filtro incomplete, dalle più vendute, in quel periodo
    const conVendite = S.periodiVendita.filter(pp => S.ricette.some(r => (r.vendite || {})[pp]));
    const per = conVendite.includes(ui.panPer) ? ui.panPer : conVendite[conVendite.length - 1];
    const tipi = GRUPPI_MENU[ui.panGruppo || 'tutto'];
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
    return String(testo || '').split(/\n+/).map(r => r.trim()).filter(r => r && r.includes(':')).map(r => {
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
    const prod = S.prodotti.filter(p => trova(p.nomeBreve + ' ' + p.nomeCompleto + ' ' + ((M.fornitore(p.fornitoreId) || {}).nome || '')))
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
  PAGINE.foglio = function () {
    const l = listaFoglio(), filtro = ui.fgFiltro || 'dafare';
    const tutti = S.prodotti.filter(p => M.daFoglio(p)), fatti = (S.foglioTenuti || []).filter(id => M.prodotto(id) && M.daFoglio(M.prodotto(id))).length;
    const fornF = {}; tutti.forEach(p => { const k = p.fornitoreId || '__nessuno'; fornF[k] = (fornF[k] || 0) + 1; });
    const chips = `<div class="chips">${[['dafare', 'Da decidere'], ['usati', 'Usati nelle ricette'], ['nonusati', 'Non usati'], ['tutti', 'Tutti (' + tutti.length + ')']].map(([k, v]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-az="fg-filtro" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="chips sotto"><button class="chip ${!ui.fgForn ? 'on' : ''}" data-az="fg-forn" data-v="">Tutti i fornitori</button>${Object.entries(fornF).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<button class="chip ${ui.fgForn === k ? 'on' : ''}" data-az="fg-forn" data-v="${k}">${esc(k === '__nessuno' ? 'Fatti da noi / senza fornitore' : (M.fornitore(k) || {}).nome || '?')} (${n})</button>`).join('')}</div>`;
    if (!l.length) { return { titolo: 'Prodotti del foglio', indietro: '#/prodotti', html: chips + `<div class="card evidenza"><h3>Finito</h3><p>Nessun prodotto del foglio in questo elenco. Restano ${tutti.length} prodotti del foglio, di cui ${fatti} li hai tenuti apposta.</p></div>` }; }
    if (ui.fgIdx == null || ui.fgIdx >= l.length) ui.fgIdx = 0;
    const p = l[ui.fgIdx];
    const uso = M.usatoIn('p:' + p.id).dirette;
    const fatt = S.prodotti.filter(x => M.daFattura(x));
    const sim = M.somiglianti(p, fatt).slice(0, 3);
    const forn = M.fornitore(p.fornitoreId);
    return {
      titolo: `Prodotti del foglio · ${ui.fgIdx + 1} di ${l.length}`, indietro: '#/prodotti', html: chips + `
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
  AZ['fg-apri'] = () => { ui.fgIdx = 0; ui.st_fg = []; ui.fgFisso = null; };
  AZ['fg-filtro'] = (el) => { ui.fgFiltro = el.dataset.v; ui.fgIdx = 0; ui.st_fg = []; ui.fgFisso = null; ridisegnaMantenendo(); };
  AZ['fg-forn'] = (el) => { ui.fgForn = el.dataset.v || null; ui.fgIdx = 0; ui.st_fg = []; ui.fgFisso = null; ridisegnaMantenendo(); };
  AZ['fg-salta'] = () => { ricordaPosto('fg', 'fgIdx'); ui.fgIdx = (ui.fgIdx || 0) + 1; ui.fgFisso = null; ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['fg-indietro'] = () => tornaIndietro('fg', 'fgIdx');
  AZ['fg-collega'] = (el) => {
    const prima = listaFoglio(); ricorda('fg', 'fgIdx', true);
    const ve = M.prodotto(el.dataset.a), fo = M.prodotto(el.dataset.da);
    const err = M.collegaAlFoglio(el.dataset.da, el.dataset.a); if (err) { ui.st_fg.pop(); alert(err); return; }
    avviso(`Collegato: «${fo.nomeBreve}» ora è ${ve.nomeBreve} delle fatture${ve.dubbio ? ' (prezzo molto diverso: ricontrolla il formato)' : ''}.`);
    fgDopo(prima);
  };
  AZ['fg-tieni'] = (el) => { const prima = listaFoglio(); ricorda('fg', 'fgIdx'); S.foglioTenuti = Array.from(new Set((S.foglioTenuti || []).concat(el.dataset.id))); fgDopo(prima); };
  AZ['fg-elimina'] = (el) => { const p = M.prodotto(el.dataset.id); if (!confirm(`Elimino «${p.nomeBreve}»?`)) return; const prima = listaFoglio(); ricorda('fg', 'fgIdx'); S.prodotti = S.prodotti.filter(x => x !== p); fgDopo(prima); };
  AZ['fg-prep'] = (el) => {
    const p = M.prodotto(el.dataset.id), prima = listaFoglio(); ricorda('fg', 'fgIdx');
    const costo = M.prezzo(p);
    const r = { id: M.uid('r'), nome: p.nomeBreve, tipo: 'semilavorato', prezzo: null, righe: [], resa: p.contenuto || 1000, unita: p.unita === 'pz' ? 'pz' : p.unita, asporto: [], vendite: {},
      costiExtra: costo != null ? [{ nome: 'Costo dal foglio (provvisorio: toglilo quando metti gli ingredienti)', costo }] : [],
      note: 'Ricetta da completare: mancano gli ingredienti. Era nel foglio come «' + p.nomeBreve + '» (' + p.confezione + ' da ' + qta(p.contenuto) + ' ' + p.unita + ').' };
    S.ricette.push(r);
    S.ricette.forEach(x => { (x.righe || []).forEach(rg => { if (rg.rif === 'p:' + p.id) rg.rif = 'r:' + r.id; }); (x.asporto || []).forEach(a => { if (a.rif === 'p:' + p.id) a.rif = 'r:' + r.id; }); });
    S.prodotti = S.prodotti.filter(x => x !== p);
    avviso(`«${r.nome}» ora è una preparazione: la trovi in Ricette › Preparazioni.`);
    fgDopo(prima);
  };
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
      const cand = S.prodotti.filter(p => M.daFoglio(p)).sort((a, b) => a.nomeBreve.localeCompare(b.nomeBreve));
      ui.lfVoci = voci; ui.lfFile = file.name;
      // scelgo da solo solo se la prima proposta è chiaramente la migliore (non per «Prosecco», dove ce ne sono tante uguali)
      ui.lfProd = cand.map(p => { const pr = proposteListino(p, voci); const sicura = pr.length && pr[0].s >= 1.4 && (!pr[1] || pr[0].s - pr[1].s >= 0.015); return { id: p.id, proposte: pr.map(x => x.i), auto: sicura ? pr[0].i : -1, scelta: null }; });
      ridisegnaMantenendo();
    } catch (e) { alert('Non riesco a leggere il listino: ' + e.message); }
  }
  const sceltaLf = (x) => { if (x.scelta != null) return x.scelta; const p = M.prodotto(x.id); return p && ui.lfForn && p.fornitoreId === ui.lfForn ? x.auto : -1; };
  function sezioneListino() {
    const fid = ui.lfForn || '', forn = M.fornitore(fid);
    let h = `<div class="card form"><h3>4. Listino di un fornitore</h3>
      <p class="tenue piccolo">Per i prodotti del tuo foglio che non hanno ancora una fattura: prendo i prezzi dal listino (senza IVA). Solo quelli che hai già, gli altri del listino restano fuori. Quando arriverà una fattura, il suo prezzo prenderà il posto di questo.</p>
      <label>Fornitore<select data-lf="forn"><option value="">scegli…</option>${S.fornitori.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(f => `<option value="${f.id}" ${fid === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
      <div class="due"><label>Data del listino<input type="date" data-lf="data" value="${esc(ui.lfData || M.oggi())}"></label><label>Vostro sconto (%)<input type="number" step="any" inputmode="decimal" data-lf="sconto" value="${esc(ui.lfSconto || '')}" placeholder="0"></label></div>
      <label class="btn">Scegli il file del listino (Excel)<input type="file" accept=".xlsx" data-carica="listino-fornitore" hidden></label></div>`;
    if (!ui.lfProd) return h;
    const voci = ui.lfVoci, sc = numDa(ui.lfSconto) || 0;
    const scelti = ui.lfProd.filter(x => sceltaLf(x) >= 0).length;
    // prima quelli che nel foglio erano di questo fornitore
    const ordine = ui.lfProd.map((x, k) => k).sort((a, b) => { const pa = M.prodotto(ui.lfProd[a].id), pb = M.prodotto(ui.lfProd[b].id); return ((pb && pb.fornitoreId === fid) - (pa && pa.fornitoreId === fid)) || (sceltaLf(ui.lfProd[b]) >= 0) - (sceltaLf(ui.lfProd[a]) >= 0); });
    h += `<div class="card evidenza"><h3>${esc(ui.lfFile)}: ${voci.length} righe</h3><p>Su ${ui.lfProd.length} prodotti del tuo foglio, <b>${scelti}</b> collegati a una riga del listino${(ui.lfNuovi || []).length ? `; in più <b>${ui.lfNuovi.length}</b> prodotti nuovi da creare` : ''}. Controlla quelli proposti e cerca gli altri. Il prezzo a destra è già portato al formato del tuo prodotto${sc ? `, con il ${n2(sc)}% di sconto` : ''}.</p>
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
          <label>1 ${esc(rg.um || 'pezzo')} di fattura = quanti pezzi?<input type="number" step="any" inputmode="decimal" data-pzr="${f.id}" value="${n}"></label>
          ${(() => { const m = String(rg.descrizione).match(/\bx\s*(\d{1,3})\b/i); return n === 1 && m && +m[1] > 1 ? `<button class="btn piccolo" data-az="pz-suggerito" data-f="${f.id}" data-n="${m[1]}">In descrizione c'è «x ${m[1]}»: metti ${m[1]} pezzi</button>` : ''; })()}
          <p class="piccolo">= <b>${euro(pu / n)}</b> a ${esc(b.confezione)}${b.contenuto ? ` · ${euro(pu / n / b.contenuto * (b.unita === 'pz' ? 1 : 1000))}${b.unita === 'g' ? ' al kg' : b.unita === 'ml' ? ' al litro' : ' al pezzo'}` : ''}</p></div>`; }).join('')}</div>`;
  }
  AZ['pz-suggerito'] = (el) => { const i = document.querySelector(`[data-pzr="${el.dataset.f}"]`); if (!i) return; i.value = el.dataset.n; i.dispatchEvent(new Event('change', { bubbles: true })); };
  // ---------- Gruppi di ricette: crearli (Amari, Rum…), rinominarli, sceglierne il reparto ----------
  PAGINE['gruppi-ricette'] = function () {
    const conta = (k) => S.ricette.filter(r => r.tipo === k).length;
    const extra = new Set((S.tipiExtra || []).map(t => t.id));
    return { titolo: 'Gruppi di ricette', indietro: '#/ricette', html: `
      <div class="card form"><h3>Nuovo gruppo</h3><p class="tenue piccolo">Es. Amari, Rum, Whisky, Grappe, Vini al calice. Poi ci sposti dentro le ricette o ne crei di nuove.</p>
        <div class="due"><label>Nome<input id="gr-nome" placeholder="es. Amari"></label><label>Reparto<select id="gr-rep"><option value="bar">Bar</option><option value="cucina">Cucina</option></select></label></div>
        <div class="bottoni"><button class="btn primario" data-az="gr-crea">Crea il gruppo</button></div></div>
      <div class="card"><h3>I gruppi</h3>
        ${Object.keys(M.TIPI).filter(k => k !== 'semilavorato').map(k => `<div class="gr-riga">
          <input data-gr-nome="${k}" value="${esc(M.TIPI[k])}" aria-label="Nome del gruppo">
          <select data-gr-rep="${k}"><option value="bar" ${M.REPARTO_TIPO[k] === 'bar' ? 'selected' : ''}>Bar</option><option value="cucina" ${M.REPARTO_TIPO[k] === 'cucina' ? 'selected' : ''}>Cucina</option></select>
          <span class="tenue piccolo">${conta(k)} ricette</span>
          ${extra.has(k) ? `<button class="x" data-az="gr-elimina" data-id="${k}" aria-label="Elimina il gruppo">✕</button>` : '<span></span>'}</div>`).join('')}
        <p class="tenue piccolo">Il nome si cambia scrivendo. I gruppi di base non si possono eliminare; quelli creati da te sì (le ricette dentro tornano in «Drink» o «Panini»).</p></div>` };
  };
  AZ['gr-crea'] = () => {
    const nome = ($('#gr-nome').value || '').trim(); if (!nome) { alert('Scrivi il nome del gruppo.'); return; }
    if (Object.values(M.TIPI).some(v => v.toLowerCase() === nome.toLowerCase())) { alert('C\'è già un gruppo con questo nome.'); return; }
    const id = 't_' + normCassa(nome).replace(/ /g, '_').slice(0, 20) + '_' + Math.random().toString(36).slice(2, 5);
    S.tipiExtra = (S.tipiExtra || []).concat({ id, nome, reparto: $('#gr-rep').value });
    M.aggiornaTipi(); S.impostazioni.soglie[id] = 3.5; ui.tipoRicette = id; salva(); avviso(`Gruppo «${nome}» creato.`); vai('#/ricette');
  };
  AZ['gr-elimina'] = (el) => {
    const t = (S.tipiExtra || []).find(x => x.id === el.dataset.id); if (!t) return;
    const dentro = S.ricette.filter(r => r.tipo === t.id); const dove = t.reparto === 'cucina' ? 'panino' : 'drink';
    if (!confirm(`Elimino il gruppo «${t.nome}»?${dentro.length ? ` Le sue ${dentro.length} ricette vanno in «${M.TIPI[dove]}».` : ''}`)) return;
    dentro.forEach(r => { r.tipo = dove; }); S.tipiExtra = S.tipiExtra.filter(x => x !== t); M.aggiornaTipi(); if (ui.tipoRicette === t.id) ui.tipoRicette = dove; salva(); ridisegnaMantenendo();
  };
  AZ['sposta-inizia'] = () => { ui.spostaModo = true; ui.spostaSel = []; ridisegnaMantenendo(); };
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
    return [
      ['Fornitori nuovi: vendono merce o solo servizi?', fornitoriDaControllare().length, '#/controllo-fatture', 'Così i prodotti di bollette e servizi spariscono da soli.'],
      ['Fornitori che sono lo stesso', coppieF, '#/fornitori', 'Es. Sebar e SE.BA.R: uniscili.'],
      ['Prodotti nuovi da controllare', nuoviDaCompletare(), '#/controllo', 'Nome breve, categoria e formato dei prodotti arrivati dalle fatture.'],
      ['Prodotti doppi', M.gruppiDoppioni().length, '#/doppioni', 'Lo stesso prodotto arrivato due volte: uniscilo.'],
      ['Prodotti del tuo foglio', daFoglio, '#/foglio', 'Collegali alle fatture, falli diventare preparazioni, tienili o eliminali.'],
      ['Cartoni contati come un pezzo', cartoni + impossibili, '#/formati', impossibili ? `${impossibili} ricette costano più del prezzo: c'è un cartone da sistemare.` : 'Scrivi quanti pezzi ci sono nel cartone.'],
      ['Ricette senza ingredienti completi', incomplete, '#/ricette', 'Con «Rivedi una per una», dalle più vendute.']
    ];
  }
  PAGINE.ordine = function () {
    const passi = passiOrdine(), fatti = passi.filter(x => !x[1]).length;
    return { titolo: 'Metti in ordine i dati', indietro: '#/pannello', html: `
      <div class="card"><p>Fai i passi in quest'ordine: ognuno rende più facile il successivo. Fatti ${fatti} su ${passi.length}.</p></div>
      <div class="card lista">${passi.map(([t, n, h, sp], i) => `<a class="riga" href="${h}" ${h === '#/ricette' ? 'data-az="ord-ricette"' : h === '#/foglio' ? 'data-az="fg-apri"' : ''}><span><b>${i + 1}. ${t}</b><small>${sp}</small></span><span class="badge ${n ? 'giallo' : 'verde'}">${n ? n : 'fatto'}</span></a>`).join('')}</div>` };
  };
  AZ['ord-ricette'] = () => { ui.rivFiltro = 'incomplete'; ui.rivOrdine = 'piu'; };
  AZ['ordine-ricette'] = (el) => { ui.ordineRicette = el.dataset.v; ridisegnaMantenendo(); };
  AZ['riv-inizia'] = () => { ui.rivIdx = 0; ui.rivStorico = []; ui.rivFisso = null; ui.rivFiltro = ui.rivFiltro || 'darivedere'; ui.bozza = null; vai('#/rivedi-ricette'); };
  AZ['riv-tipo'] = (el) => { ui.tipoRicette = el.dataset.v; ui.rivIdx = 0; ui.rivFisso = null; ui.rivStorico = []; ui.bozza = null; ridisegnaMantenendo(); };
  AZ['riv-filtro'] = (el) => { ui.rivFiltro = el.dataset.v; ui.rivIdx = 0; ui.rivFisso = null; ui.rivStorico = []; ui.bozza = null; ridisegnaMantenendo(); };
  AZ['riv-ordine'] = (el) => { ui.rivOrdine = el.dataset.v; ui.rivIdx = 0; ui.rivFisso = null; ui.rivStorico = []; ui.bozza = null; ridisegnaMantenendo(); };
  AZ['riv-per'] = (el) => { ui.rivPer = el.dataset.v; ui.rivIdx = 0; ui.rivFisso = null; ui.rivStorico = []; ui.bozza = null; ridisegnaMantenendo(); };
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
    S.ricette = S.ricette.filter(r => r.id !== b.id); ui.bozza = null; salva(); vai('#/ricette');
  };
  AZ['duplica-ricetta'] = (el) => { const r = JSON.parse(JSON.stringify(M.ricetta(el.dataset.id))); r.id = M.uid('r'); r.nome += ' (copia)'; r.vendite = {}; S.ricette.push(r); salva(); vai('#/modifica-ricetta/' + r.id); };
  AZ['registra-fattura'] = (el) => { const f = S.fatture.find(x => x.id === el.dataset.id); M.registraFattura(f); salva(); window.scrollTo(0, 0); disegna(); avviso('Fattura registrata: costi aggiornati.'); };
  AZ['annulla-fattura'] = (el) => { if (!confirm('Annullare la registrazione? Tolgo i prezzi di questa fattura.')) return; const f = S.fatture.find(x => x.id === el.dataset.id); M.annullaFattura(f); salva(); ridisegnaMantenendo(); };
  AZ['elimina-fattura'] = (el) => { if (!confirm('Eliminare la fattura?')) return; const f = S.fatture.find(x => x.id === el.dataset.id); M.annullaFattura(f); S.fatture = S.fatture.filter(x => x !== f); salva(); vai('#/fatture'); };
  AZ.pagata = (el) => { const f = S.fatture.find(x => x.id === el.dataset.id); f.scadenze[+el.dataset.k].pagata = el.checked; salva(); setTimeout(ridisegnaMantenendo, 150); };
  AZ['nuovo-fornitore'] = () => { const n = prompt('Nome del fornitore'); if (!n) return; const f = { id: M.uid('f'), nome: n.trim(), piva: '', telefono: '', email: '', referente: '', giorniConsegna: '', note: '' }; S.fornitori.push(f); salva(); vai('#/fornitore/' + f.id); };
  AZ['elimina-fornitore'] = (el) => { if (!confirm('Eliminare il fornitore? Prodotti e fatture restano.')) return; S.fornitori = S.fornitori.filter(f => f.id !== el.dataset.id); salva(); vai('#/fornitori'); };
  AZ['inizia-conta'] = () => { ui.conta = { categoria: 'Tutte', valori: {} }; ridisegnaMantenendo(); };
  AZ['esci-conta'] = () => { ui.conta = null; ridisegnaMantenendo(); };
  AZ['conta-cat'] = (el) => { ui.conta.categoria = el.dataset.v; ridisegnaMantenendo(); };
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
    const vec = ui.vendPer; if (!confirm(`Elimino il periodo «${vec}» e le sue vendite?`)) return;
    S.periodiVendita = S.periodiVendita.filter(x => x !== vec); S.periodiScaricati = S.periodiScaricati.filter(x => x !== vec);
    if (S.periodiDate) delete S.periodiDate[vec];
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
  AZ['elimina-evento'] = (el) => { if (!confirm('Eliminare l\'evento?')) return; S.eventi = S.eventi.filter(x => x.id !== el.dataset.id); salva(); vai('#/eventi'); };
  AZ['olio-da-tabella'] = () => { const o = S.impostazioni.olio; o.grammiFritti = o.dettaglio.reduce((s, d) => s + d[1] * d[2], 0); salva(); ridisegnaMantenendo(); };
  AZ['olio-riga'] = () => { S.impostazioni.olio.dettaglio.push(['Nuovo piatto', 0, 0]); salva(); ridisegnaMantenendo(); };
  AZ['esporta-excel'] = esportaExcel;
  AZ['controlla-casella'] = () => controllaCasella(true);
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
    fn(el, e);
    // un collegamento che prepara qualcosa (filtri, posizione) e poi deve comunque aprire la sua pagina
    const h = el.tagName === 'A' && el.getAttribute('href');
    if (h && h.startsWith('#') && el.dataset.az !== 'indietro' && location.hash === prima && h !== prima) vai(h);
  });

  // ---------- Campi ----------
  document.addEventListener('input', (e) => {
    const el = e.target; const d = el.dataset;
    if (d.filtro === 'vendFiltro') { ui.vendFiltro = el.value; const f = el.value.toLowerCase(); document.querySelectorAll('.vend-riga').forEach(x => { x.style.display = !f || x.textContent.toLowerCase().includes(f) ? '' : 'none'; }); document.querySelectorAll('.griglia-vend > .card').forEach(c => { c.style.display = [...c.querySelectorAll('.vend-riga')].some(x => x.style.display !== 'none') ? '' : 'none'; }); return; }
    if (d.filtro === 'fornitori') { ui.filtroForn = el.value; const t = normCassa(el.value); document.querySelectorAll('#lista-forn [data-nome]').forEach(x => { x.hidden = t && !x.dataset.nome.includes(t); }); return; }
    if (d.filtro === 'prodotti') { ui.filtroProdotti = el.value; $('#lista').innerHTML = listaProdotti(); return; }
    if (d.filtro === 'ricette') {
      ui.filtroRicette = el.value; $('#lista').innerHTML = listaRicette();
      const bt = $('[data-az="riv-inizia"]'); if (bt) bt.textContent = 'Rivedi ' + (el.value ? 'quelle con «' + el.value + '»' : 'le ' + (M.TIPI[ui.tipoRicette] || 'ricette').toLowerCase()) + ' una per una';
      return;
    }
    if (d.media && ui.bozza) { ui.bozza.media = el.checked; ridisegnaMantenendo(); return; }
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
    const el = e.target; const d = el.dataset;
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
    if (d.sposta) { const set = new Set(ui.spostaSel || []); if (el.checked) set.add(d.sposta); else set.delete(d.sposta); ui.spostaSel = Array.from(set); const b = document.querySelector('.sposta-barra b'); if (b) b.textContent = `Sposta le ricette spuntate (${set.size})`; return; }
    if (d.grNome) { const v = el.value.trim(); if (!v) return; const t = (S.tipiExtra || []).find(x => x.id === d.grNome); if (t) t.nome = v; else { S.nomiTipi = S.nomiTipi || {}; S.nomiTipi[d.grNome] = v; } M.aggiornaTipi(); salva(); avviso('Nome cambiato.'); return; }
    if (d.grRep) { const t = (S.tipiExtra || []).find(x => x.id === d.grRep); if (t) t.reparto = el.value; else { S.repartiTipi = S.repartiTipi || {}; S.repartiTipi[d.grRep] = el.value; } M.aggiornaTipi(); salva(); avviso('Reparto cambiato.'); return; }
    if (d.lfScelta != null) { ui.lfProd[+d.lfScelta].scelta = +el.value; ridisegnaMantenendo(); return; }
    if (d.carica === 'cassa-listino' || d.carica === 'cassa-vendite') { if (el.files[0]) caricaCassa(el.files[0], d.carica === 'cassa-listino' ? 'listino' : 'vendite'); el.value = ''; return; }
    if (d.ccG != null) { ui.ccAperto = +d.ccG; ui.ccListino.gruppi[+d.ccG].tipo = el.value; ui.ccListino.gruppi[+d.ccG].voci.forEach(v => { if (el.value !== 'salta' && v.scelta === '__salta' && v.prezzo > 0 && v.prezzo <= 100) v.scelta = ''; }); ridisegnaMantenendo(); return; }
    if (d.ccV != null) { const [gi, vi] = d.ccV.split(',').map(Number); ui.ccAperto = gi; ui.ccListino.gruppi[gi].voci[vi].scelta = el.value; ridisegnaMantenendo(); return; }
    if (d.lsTipo) { ui.lsTipo = el.value; return; }
    if (d.ls != null) { const [i, j] = d.ls.split(',').map(Number); ui.lsAnte[i].ingr[j].rif = el.value; return; }
    if (d.ccVv != null) { ui.ccVendite[+d.ccVv].scelta = el.value; ridisegnaMantenendo(); return; }
    if (d.ccData) { ui[d.ccData === 'dal' ? 'ccDal' : 'ccAl'] = el.value; ridisegnaMantenendo(); return; }
    if (d.carica === 'copia') {
      const fr = new FileReader(); fr.onload = () => { try { const x = JSON.parse(fr.result); if (!x.prodotti || !x.ricette) throw 0; if (!confirm('Sostituisco tutti i dati con questa copia?')) return; prepara(x); salva(); disegna(); avviso('Copia caricata.'); } catch (er) { alert('Il file non è una copia valida.'); } }; fr.readAsText(el.files[0]); el.value = ''; return;
    }
    if (d.r != null && d.k === 'rif' && ui.bozza) { ui.bozza.righe[+d.r].rif = el.value; ridisegnaMantenendo(); return; }
    if (d.a != null && d.k === 'rif' && ui.bozza) { ui.bozza.asporto[+d.a].rif = el.value; return; }
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
    if (d.fmtSel) { ui[d.fmtSel] = el.value; if (el.value && (ui.fmtFiltro || 'ricette') === 'ricette') ui.fmtFiltro = 'tutti'; ui.fmtIdx = 0; ridisegnaMantenendo(); return; }
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
    if (d.imp) { const numerici = ['ivaVendita', 'sogliaAumento']; S.impostazioni[d.imp] = numerici.includes(d.imp) ? numDa(el.value) : el.value.trim(); salva(); avviso('Salvato.'); return; }
    if (d.cas) { S.casella[d.cas] = el.value.trim(); salva(); avviso('Salvato.'); return; }
    if (d.olio) { S.impostazioni.olio[d.olio] = numDa(el.value) || 0; salva(); ridisegnaMantenendo(); return; }
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
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  avvia();
})();
