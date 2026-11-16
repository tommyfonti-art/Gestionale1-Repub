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
    if (!S.migrazioneServizi) {
      S.fornitori.forEach(f => { if (f.servizi === undefined && M.pareServizi(f.nome) && S.fatture.some(x => x.fornitoreId === f.id)) M.segnaServizi(f.id, true); });
      S.migrazioneServizi = true;
    }
    // una volta: le ricette in più (drink, panini, fritti, dolci) entrano anche nei dati già salvati
    S.impostazioni = S.impostazioni || {}; S.impostazioni.soglie = S.impostazioni.soglie || {};
    if (S.impostazioni.soglie.dolce == null) S.impostazioni.soglie.dolce = 3.5;
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
    // i prodotti dei fornitori già confermati non vanno ricontrollati
    S.fornitori.forEach(f => { if (f.controllato) confermaProdottiDi(f); });
    // fatture doppie (es. lette insieme da due dispositivi): ne tengo una
    const viste = new Set();
    S.fatture = S.fatture.filter(f => { const k = [f.piva || f.fornitoreNome, f.numero, f.data].join('|'); if (viste.has(k)) return false; viste.add(k); return true; });
    M.usa(S);
  }

  // ---------- Salvataggio online (Firebase) ----------
  let db = null, utente = null, ultimoSalvato = new Map(), timerCloud = null;
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
    ultimoSalvato = nuovi;
    for (let i = 0; i < ops.length; i += 400) {
      const b = db.batch();
      ops.slice(i, i + 400).forEach(([k, v]) => { const ref = db.doc(k); if (v == null) b.delete(ref); else b.set(ref, { json: v, da: utente.email || '', quando: Date.now() }); });
      b.commit().catch(e => avviso('Non riesco a salvare online: ' + e.message));
    }
  }
  async function caricaCloud() {
    const gen = await db.doc('dati/generale').get();
    if (!gen.exists) return null;
    const stato = JSON.parse(gen.data().json);
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
      if (document.visibilityState !== 'visible' || !utente || !S || timerCloud || ui.bozza || ui.conta) return;
      try {
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

  PAGINE.pannello = function () {
    const bar = S.ricette.filter(r => ['drink', 'premium'].includes(r.tipo)).map(r => M.indicatori(r)).filter(i => i.incidenza != null);
    const cucina = S.ricette.filter(r => ['panino', 'fritto', 'dolce'].includes(r.tipo)).map(r => M.indicatori(r)).filter(i => i.incidenza != null);
    const media = (l) => l.length ? l.reduce((s, i) => s + i.incidenza, 0) / l.length : null;
    const oggi = M.oggi(); const tra30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const aumenti = [];
    S.prodotti.forEach(p => {
      const l = (p.prezzi || []).slice().sort((a, b) => a.data < b.data ? -1 : 1);
      if (l.length < 2) return;
      const a = l[l.length - 2], b = l[l.length - 1];
      const v = (b.prezzo / a.prezzo - 1) * 100;
      if (Math.abs(v) >= (S.impostazioni.sogliaAumento || 3)) aumenti.push({ p, v, data: b.data });
    });
    aumenti.sort((a, b) => a.data < b.data ? 1 : -1);
    const sotto = S.ricette.filter(r => r.tipo !== 'semilavorato' && M.indicatori(r).sotto);
    const scorta = M.sottoScorta();
    const daFare = S.fatture.filter(f => f.stato !== 'registrata');
    return {
      titolo: 'Gestionale Repub', html: `
      <div class="kpi-griglia">
        ${kpi('Incidenza media bar', perc(media(bar)), 'costo sul prezzo senza IVA')}
        ${kpi('Incidenza media cucina', perc(media(cucina)), 'costo sul prezzo senza IVA')}
        ${kpi('Valore del magazzino', euro(M.valoreMagazzino(), 0), 'prezzi senza IVA')}
        ${kpi('Ricette', S.ricette.filter(r => r.tipo !== 'semilavorato').length, 'drink, cucina e dolci')}
      </div>
      ${!S.fatture.length ? `<div class="card evidenza"><h3>Prova con una fattura</h3><p>Carica una fattura di esempio e guarda come l'app aggiorna da sola i costi di panini e drink.</p>
        <div class="bottoni">${window.FATTURE_ESEMPIO.map((x, i) => `<button class="btn" data-az="esempio" data-i="${i}">${esc(x.nome)}</button>`).join('')}</div></div>` : ''}
      ${fornitoriDaControllare().length ? `<div class="card"><h3>Fornitori nuovi da controllare</h3><p class="tenue">Dimmi chi vende merce e chi manda solo bollette o servizi: vale per tutte le loro fatture.</p><a class="btn primario" href="#/controllo-fatture">Controllo rapido (${fornitoriDaControllare().length})</a></div>` : ''}
      ${nuoviDaCompletare() ? `<div class="card"><h3>Prodotti nuovi da completare</h3><p class="tenue">Creati in automatico dalle fatture: controlla nome breve e formato.</p>${S.prodotti.filter(p => p.daCompletare).slice(0, 6).map(p => `<a class="riga" href="#/prodotto/${p.id}"><span>${esc(p.nomeBreve)}<small>${esc(p.nomeCompleto)}</small></span><span class="badge giallo">da completare</span></a>`).join('')}<div class="bottoni"><a class="btn primario" href="#/controllo">Controllo rapido (${nuoviDaCompletare()})</a><a class="btn" href="#/prodotti" data-az="vai-nuovi">Vedi l'elenco</a></div></div>` : ''}
      ${daFare.length ? `<div class="card"><h3>Fatture da completare</h3>${daFare.map(f => `<a class="riga" href="#/fattura/${f.id}"><span>${esc(f.fornitoreNome)} · n. ${esc(f.numero)}</span><span class="badge giallo">${M.daAbbinare(f)} righe da collegare</span></a>`).join('')}</div>` : ''}
      <div class="card"><h3>Prezzi cambiati</h3>${aumenti.length ? aumenti.slice(0, 8).map(x => `<a class="riga" href="#/prodotto/${x.p.id}"><span>${esc(x.p.nomeBreve)}<small>${dataIt(x.data)}</small></span><span class="badge ${x.v > 0 ? 'rosso' : 'verde'}">${x.v > 0 ? '+' : ''}${n2(x.v, 1)}%</span></a>`).join('') : '<p class="tenue">Nessun cambio di prezzo. Compariranno qui quando registri le fatture.</p>'}</div>
      <div class="card"><h3>Sotto la soglia del moltiplicatore</h3>${sotto.length ? sotto.map(r => { const i = M.indicatori(r); return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>${M.TIPI_SINGOLARE[r.tipo]} · soglia × ${n2(i.soglia)}</small></span>${badgeMolt(i)}</a>`; }).join('') : '<p class="tenue">Tutte le ricette sono sopra la soglia.</p>'}</div>
      <div class="card"><h3>Sotto la scorta minima</h3>${scorta.length ? scorta.map(p => `<a class="riga" href="#/prodotto/${p.id}"><span>${esc(p.nomeBreve)}<small>${esc((M.fornitore(p.fornitoreId) || {}).nome || '')}</small></span><span>${qta(p.giacenza)} / ${qta(p.scortaMinima)} ${esc(p.confezione)}</span></a>`).join('') + '<a class="link" href="#/ordini">Prepara gli ordini ›</a>' : '<p class="tenue">Niente sotto scorta.</p>'}</div>
`
    };
  };

  // ----- Prodotti -----
  // un fornitore confermato «vende merce»: i suoi prodotti creati dalle fatture entrano già buoni
  function confermaProdottiDi(f) {
    if (!f || f.servizi) return 0;
    const sue = new Set(S.fatture.filter(x => x.fornitoreId === f.id).map(x => x.id));
    let n = 0;
    S.prodotti.forEach(p => { if (p.daCompletare && (sue.has(p.creatoDa) || p.fornitoreId === f.id)) { p.daCompletare = false; n++; } });
    return n;
  }
  const nuoviDaCompletare = () => S.prodotti.filter(p => p.daCompletare).length;
  function categorie() { return Array.from(new Set(S.prodotti.map(p => p.categoria))).sort(); }
  function listaProdotti() {
    const f = ui.filtroProdotti.toLowerCase();
    const l = S.prodotti.filter(p => (ui.categoria === 'Tutte' || (ui.categoria === '__nuovi' ? p.daCompletare : p.categoria === ui.categoria)) && (!f || (p.nomeBreve + ' ' + p.nomeCompleto).toLowerCase().includes(f)))
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
      <a class="btn largo" href="#/formati" data-az="fmt-categoria">${ui.categoria && ui.categoria !== 'Tutte' && ui.categoria !== '__nuovi' ? `Ricontrolla i formati: solo ${esc(ui.categoria)}` : 'Ricontrolla i formati, uno dopo l\'altro'}</a>
      <input class="cerca" type="search" placeholder="Cerca un prodotto" value="${esc(ui.filtroProdotti)}" data-filtro="prodotti">
      <div class="chips">${(nuoviDaCompletare() ? [['__nuovi', 'Da completare (' + nuoviDaCompletare() + ')']] : []).concat([['Tutte', 'Tutte']], categorie().map(c => [c, c])).map(([v, t]) => `<button class="chip ${ui.categoria === v ? 'on' : ''} ${v === '__nuovi' ? 'giallo' : ''}" data-az="categoria" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>
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
        <button class="btn primario grande" data-az="ctrl-giusto" data-id="${p.id}">✓ È giusto</button>
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
    return S.prodotti.filter(p => !p.speciale && (filtro === 'tutti' || (filtro === 'ricette' ? usati.has(p.id) : !p.formatoOk))
      && (!ui.fmtCat || p.categoria === ui.fmtCat) && (!ui.fmtForn || daForn(p)))
      .sort((x, y) => (x.categoria || '').localeCompare(y.categoria || '') || x.nomeBreve.localeCompare(y.nomeBreve));
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
    const chips = `<div class="chips">${[['ricette', 'Usati nelle ricette'], ['dacontrollare', 'Non ancora ricontrollati'], ['tutti', 'Tutti']].map(([k, v]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-az="fmt-filtro" data-v="${k}">${v}</button>`).join('')}</div>
      <div class="card form filtri-fmt"><div class="due">
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
    const conto = ur ? `<div class="card form"><h3>Il conto, passo per passo</h3>
        <p>In fattura${ur.f.fornitoreNome ? ' di <b>' + esc(forn ? forn.nome : ur.f.fornitoreNome) + '</b>' : ''} del ${dataIt(ur.f.data)}:<br><b>${esc(ur.rg.descrizione)}</b><br>${qta(ur.rg.quantita)} ${esc(ur.rg.um || '')} a ${euro(ur.rg.prezzoUnitario, 3)}</p>
        <label>Ogni riga di fattura (1 ${esc(ur.rg.um || 'pezzo')}) contiene quante «${esc(p.confezione)}»?<input type="number" step="any" inputmode="decimal" data-fmt-righe="${p.id}" data-fattura="${ur.f.id}" value="${esc(perRiga)}"></label>
        <p class="msg grigio">${pr != null ? `Quindi: <b>${euro(pr, 3)}</b> a ${esc(p.confezione)} · ${esc(p.confezione)} da ${qta(p.contenuto)} ${esc(p.unita)} · <b>${rif ? n2(rif.valore) + ' ' + rif.etichetta : ''}</b>` : 'Senza prezzo.'}</p>
      </div>` : `<div class="card"><h3>Prezzo</h3><p>${pr != null ? `${euro(pr, 3)} a ${esc(p.confezione)} · <b>${rif ? n2(rif.valore) + ' ' + rif.etichetta : ''}</b>` : 'Senza prezzo.'}</p><p class="tenue piccolo">Non arriva da nessuna fattura: il prezzo è quello del foglio o messo a mano.</p></div>`;
    return {
      titolo: `Ricontrollo formati · ${ui.fmtIdx + 1} di ${lista.length}`, indietro: '#/prodotti', html: chips + `
      <div class="ctrl">
      <div class="card form">
        <h3 class="grande-t">${esc(p.nomeBreve)}${p.formatoOk ? ' <span class="badge verde">ricontrollato</span>' : ''}</h3>
        <div class="sottotitolo">${esc(p.nomeCompleto)}<br>${esc(forn ? forn.nome : 'senza fornitore')} · ${esc(p.categoria || '')}${usoRic ? ` · usato in ${usoRic} ${usoRic === 1 ? 'ricetta' : 'ricette'}` : ''}</div>
        <label>Nome breve<input data-ctrl="${p.id}" data-k="nomeBreve" value="${esc(p.nomeBreve)}"></label>
        <label>Si compra a<input data-ctrl="${p.id}" data-k="confezione" value="${esc(p.confezione)}" placeholder="bottiglia, kg, cartone…"></label>
        <div class="due">
          <label>Che contiene<input type="number" step="any" inputmode="decimal" data-ctrl="${p.id}" data-k="contenuto" value="${esc(p.contenuto)}"></label>
          <label>Unità<select data-ctrl="${p.id}" data-k="unita">${['ml', 'g', 'pz'].map(u => `<option ${p.unita === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        </div>
        <p class="tenue piccolo">Esempi: bottiglia da 700 ml · kg da 1000 g · cartone da 24 pz · fusto da 30000 ml.</p>
      </div>
      ${conto}
      <div class="bottoni colonna ctrl-scelte">
        <button class="btn primario grande" data-az="fmt-giusto" data-id="${p.id}">✓ Giusto, avanti</button>
        <div class="bottoni"><button class="btn piccolo" data-az="fmt-indietro">‹ Precedente</button><button class="btn piccolo" data-az="fmt-salta">Salta ›</button><a class="btn piccolo" href="#/prodotto/${p.id}">Scheda completa</a></div>
      </div></div>
      <p class="tenue piccolo">Sul Mac: Invio = «Giusto, avanti», frecce = precedente e successivo. Le modifiche si salvano da sole e il costo delle ricette si aggiorna subito.</p>`
    };
  };

  // ----- Ricette -----
  function listaRicette() {
    const f = ui.filtroRicette.toLowerCase();
    const l = S.ricette.filter(r => r.tipo === ui.tipoRicette && (!f || r.nome.toLowerCase().includes(f))).sort((a, b) => a.nome.localeCompare(b.nome));
    if (!l.length) return '<p class="tenue centro">Nessuna ricetta.</p>';
    return l.map(r => {
      if (r.tipo === 'semilavorato') {
        const c = M.costo(r);
        return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>resa ${qta(r.resa)} ${esc(r.unita)}</small></span><span class="destra">${euro(c)}<small>${c != null && r.resa ? euro(c / r.resa * 1000) + ' al ' + (r.unita === 'g' ? 'kg' : 'litro') : ''}</small></span></a>`;
      }
      const i = M.indicatori(r);
      return `<a class="riga" href="#/ricetta/${r.id}"><span>${esc(r.nome)}<small>costo ${euro(i.costo)} · prezzo ${euro(i.prezzo)}</small></span><span class="destra">${badgeMolt(i)}<small>incidenza ${perc(i.incidenza)}</small></span></a>`;
    }).join('');
  }
  PAGINE.ricette = function () {
    return {
      titolo: 'Ricette', azione: '<a class="btn-top" href="#/modifica-ricetta/nuovo">＋ Nuova</a>', html: `
      <input class="cerca" type="search" placeholder="Cerca una ricetta" value="${esc(ui.filtroRicette)}" data-filtro="ricette">
      <div class="chips">${Object.entries(M.TIPI).map(([k, v]) => `<button class="chip ${ui.tipoRicette === k ? 'on' : ''}" data-az="tipo-ricette" data-v="${k}">${esc(v)}</button>`).join('')}</div>
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
        ${kpi('Costo', euro(i.costo))}
        ${kpi('Prezzo di vendita', euro(i.prezzo), 'senza IVA ' + euro(i.netto))}
        ${kpi('Moltiplicatore', i.molt == null ? '—' : '× ' + n2(i.molt), i.soglia ? 'soglia × ' + n2(i.soglia) : '', i.sotto ? 'rosso' : 'verde')}
        ${kpi('Incidenza', perc(i.incidenza), 'margine ' + euro(i.margine) + ' a pezzo')}
      </div>`}
      ${cr.mancanti.length ? `<p class="msg rosso">Mancano i prezzi di: ${esc(cr.mancanti.join(', '))}.</p>` : ''}
      <div class="card"><h3>Ingredienti</h3><table class="tab"><tr><th>Ingrediente</th><th class="n">Dose</th><th class="n">Costo</th><th class="n">Peso</th></tr>${righe}
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
        ${b.righe.map((rg, k) => `<div class="riga-ed"><select data-r="${k}" data-k="rif" data-ridisegna="1">${opzioniRif(rg.rif, b.id)}</select>
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
      ${rs.prodotti.map(x => { const p = M.prodotto(x.prodottoId); const v = x.prima && x.dopo ? (x.dopo / x.prima - 1) * 100 : null; return `<tr><td><a href="#/prodotto/${x.prodottoId}">${esc(p ? p.nomeBreve : '?')}</a><small>+${qta(x.confezioni)} × ${esc(p ? p.confezione : '')} in magazzino</small></td><td class="n">${euro(x.prima)}</td><td class="n">${euro(x.dopo)}</td><td class="n ${v > 0 ? 'rosso-t' : 'verde-t'}">${v == null ? '' : (v > 0 ? '+' : '') + n2(v, 1) + '%'}</td></tr>`; }).join('')}</table>
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
      ['fornitori', 'Fornitori', 'contatti, spesa, prodotti'], ['magazzino', 'Magazzino', 'giacenze e conta veloce'], ['ordini', 'Ordini', 'cosa ordinare a chi'],
['vendite', 'Vendite', 'pezzi venduti per periodo'], ['mappa', 'Mappa del menu', 'cosa vende e cosa rende'],
      ['simulatore', 'Simulatore', 'e se cambia un prezzo?'], ['eventi', 'Eventi', 'listini per le serate'], ['olio', 'Costo olio', 'quanto costa friggere'],
      ['impostazioni', 'Impostazioni', 'soglie, IVA, esportazione']
    ];
    return { titolo: 'Altro', html: `<div class="griglia-voci">${voci.map(v => `<a class="voce" href="#/${v[0]}"><b>${v[1]}</b><span>${v[2]}</span></a>`).join('')}</div>` };
  };

  // ----- Fornitori -----
  PAGINE.fornitori = function () {
    const spesa = {}; S.fatture.filter(f => f.stato === 'registrata').forEach(f => { spesa[f.fornitoreId] = (spesa[f.fornitoreId] || 0) + (f.tipoDoc === 'TD04' ? -1 : 1) * (f.imponibile || f.totale); });
    return {
      titolo: 'Fornitori', indietro: '#/altro', azione: '<button class="btn-top" data-az="nuovo-fornitore">＋ Nuovo</button>', html: `<div class="card lista">${S.fornitori.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(f => {
        const np = S.prodotti.filter(p => p.fornitoreId === f.id).length;
        return `<a class="riga" href="#/fornitore/${f.id}"><span>${esc(f.nome)}<small>${f.servizi ? 'servizi · ' : ''}${np} prodotti${f.giorniConsegna ? ' · consegna ' + esc(f.giorniConsegna) : ''}</small></span><span>${spesa[f.id] ? euro(spesa[f.id], 0) : ''}</span></a>`;
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
        <label>Unisci dentro<select id="unisci-forn"><option value="">scegli…</option>${S.fornitori.filter(x => x.id !== id).sort((x, y) => x.nome.localeCompare(y.nome)).map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></label>
        <button class="btn piccolo" data-az="unisci-fornitore" data-id="${id}">Unisci</button></div>
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
        titolo: 'Conta del magazzino', indietro: '#/magazzino', html: `
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
      <div class="kpi-griglia">${kpi('Valore totale', euro(M.valoreMagazzino(), 0))}${kpi('Sotto scorta', M.sottoScorta().length, '<a href="#/ordini">ordini ›</a>')}</div>
      <button class="btn primario largo" data-az="inizia-conta">Inizia una conta veloce</button>
      <div class="card"><h3>Per categoria</h3>${perCat.map(x => `<div class="riga"><span>${esc(x.c)}</span><span>${euro(x.v, 0)}</span></div>`).join('')}</div>
      ${ultima ? `<div class="card"><h3>Ultima conta: ${dataIt(ultima.data)}</h3>
        <p>Differenza tra quello che dovevi avere e quello che c'era: <b class="${ultima.differenzaValore < 0 ? 'rosso-t' : ''}">${euro(ultima.differenzaValore)}</b></p>
        <table class="tab"><tr><th>Prodotto</th><th class="n">In app</th><th class="n">Contato</th><th class="n">Valore</th></tr>
        ${ultima.righe.filter(r => Math.abs(r.reale - r.teorica) > 0.001).map(r => { const p = M.prodotto(r.prodottoId); return `<tr><td>${esc(p ? p.nomeBreve : '?')}</td><td class="n">${qta(r.teorica)}</td><td class="n">${qta(r.reale)}</td><td class="n ${r.valore < 0 ? 'rosso-t' : ''}">${euro(r.valore)}</td></tr>`; }).join('')}</table>
        <p class="tenue piccolo">Le differenze negative sono sprechi, omaggi, rotture o ammanchi. «In app» comprende i carichi delle fatture e gli scarichi delle vendite.</p></div>` : ''}`
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
    const gruppi = [['drink', 'premium'], ['panino', 'combo'], ['fritto'], ['dolce']];
    const nomiG = ['Bar', 'Panini', 'Fritti', 'Dolci'];
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
      <div class="card"><h3>${esc(per)}</h3><p class="tenue">${date ? `dal ${dataIt(date.dal)} al ${dataIt(date.al)} · ` : ''}${qta(tot)} pezzi · incasso ${euro(incasso, 0)}${scaricato ? ' · magazzino già scaricato' : ''}</p>
        <div class="bottoni">${scaricato ? '' : `<button class="btn piccolo" data-az="scarica" data-p="${esc(per)}">Scarica il magazzino</button>`}<button class="btn piccolo" data-az="vend-rinomina">Rinomina</button><button class="btn piccolo" data-az="vend-elimina">Elimina il periodo</button></div></div>
      <input class="cerca" placeholder="Cerca una ricetta" value="${esc(ui.vendFiltro || '')}" data-filtro="vendFiltro">
      <div class="griglia-vend">${blocchi}</div>
      <p class="tenue piccolo">Scegli il periodo in alto e scrivi quanti pezzi hai venduto: si salva da solo. I periodi possono essere lunghi quanto vuoi (un mese, una stagione, un anno).</p>`
    };
  };

  // ----- Mappa del menu -----
  PAGINE.mappa = function () {
    const periodi = S.periodiVendita;
    const per = ui.mappaPeriodo || (periodi.includes('2025') ? '2025' : periodi[periodi.length - 1]);
    const gruppi = { cucina: ['panino', 'fritto', 'combo', 'dolce'], bar: ['drink', 'premium'] };
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
      <div class="card form"><h3>Prezzi</h3>
        <label>IVA sul prezzo di vendita (%)<input type="number" step="any" data-imp="ivaVendita" value="${esc(im.ivaVendita)}"></label>
        <label>Quando un prodotto arriva da più fornitori, usa<select data-imp="metodoPrezzo">${[['ultimo', 'l\'ultimo prezzo pagato'], ['minimo', 'il prezzo più basso'], ['media', 'la media tra i fornitori']].map(([k, v]) => `<option value="${k}" ${im.metodoPrezzo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Segnala gli aumenti a partire da (%)<input type="number" step="any" data-imp="sogliaAumento" value="${esc(im.sogliaAumento)}"></label></div>
      <div class="card form"><h3>Fatture</h3>
        <label class="interruttore"><input type="checkbox" data-az="imp-bool" data-k="autoCrea" ${im.autoCrea !== false ? 'checked' : ''}> Crea in automatico i prodotti nuovi che arrivano dalle fatture</label>
        <label class="interruttore"><input type="checkbox" data-az="imp-bool" data-k="autoRegistra" ${im.autoRegistra !== false ? 'checked' : ''}> Registra subito le fatture complete (prezzi e magazzino si aggiornano da soli)</label>
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
          <button class="btn" data-az="scarica-copia">Scarica una copia dei dati</button>
          <label class="btn">Carica una copia dei dati<input type="file" accept=".json" hidden data-carica="copia"></label>
          <button class="btn pericolo" data-az="ripristina">Ricomincia con i dati della prova</button>
        </div></div>`
    };
  };

  // ---------- Disegno ----------
  const ALTRE = [['fornitori', 'Fornitori'], ['magazzino', 'Magazzino'], ['ordini', 'Ordini'], ['vendite', 'Vendite'], ['mappa', 'Mappa del menu'], ['simulatore', 'Simulatore'], ['eventi', 'Eventi'], ['olio', 'Costo olio'], ['impostazioni', 'Impostazioni']];
  const TAB = [['pannello', 'Pannello', 'M3 12l9-8 9 8v8a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'], ['prodotti', 'Prodotti', 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10'], ['ricette', 'Ricette', 'M6 3h12M8 3v6l-4 12h16L16 9V3'], ['fatture', 'Fatture', 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8'], ['altro', 'Altro', 'M5 12h.01M12 12h.01M19 12h.01']];
  const SEZIONE = { 'controllo-fatture': 'fatture', controllo: 'prodotti', formati: 'prodotti', prodotto: 'prodotti', 'modifica-prodotto': 'prodotti', ricetta: 'ricette', 'modifica-ricetta': 'ricette', fattura: 'fatture' };
  function disegna() {
    if (!S) return;
    const [, nome, arg] = (location.hash || '#/pannello').split('/');
    const fn = PAGINE[nome] || PAGINE.pannello;
    if (!(nome === 'modifica-prodotto' || nome === 'modifica-ricetta')) ui.bozza = null;
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
  window.addEventListener('hashchange', () => { disegna(); window.scrollTo(0, 0); });

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
      const dal = new Date(Date.now() - 60 * 864e5).toISOString();
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
    vai(dest);
  };
  AZ.esempio = (el) => { const x = window.FATTURE_ESEMPIO[+el.dataset.i]; aggiungiFatture(M.leggiFatturaXML(x.xml, x.nome + '.xml')); };
  AZ['vai-nuovi'] = () => { ui.categoria = '__nuovi'; vai('#/prodotti'); };
  AZ.categoria = (el) => { ui.categoria = el.dataset.v; ridisegnaMantenendo(); };
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
  const ctrlFAvanti = () => { salva(); ridisegnaMantenendo(); };
  AZ['ctrlf-ok'] = (el) => { const f = M.fornitore(el.dataset.id); f.controllato = true; const n = confermaProdottiDi(f); if (n) avviso(`${n} prodotti di ${f.nome} confermati.`); ctrlFAvanti(); };
  AZ['ctrlf-servizi'] = (el) => { const f = M.fornitore(el.dataset.id); const n = M.segnaServizi(f.id, true); f.controllato = true; ctrlFAvanti(); avviso(`${f.nome}: solo fatture, ${n} prodotti tolti.`); };
  AZ['ctrlf-merce'] = (el) => { const f = M.fornitore(el.dataset.id); const n = M.togliServizi(f.id); f.controllato = true; ctrlFAvanti(); avviso(`${f.nome}: creati ${n} prodotti.`); };
  AZ['ctrlf-salta'] = () => { ui.ctrlFIdx = (ui.ctrlFIdx || 0) + 1; ridisegnaMantenendo(); };
  AZ['ctrlf-indietro'] = () => { ui.ctrlFIdx = Math.max(0, (ui.ctrlFIdx || 0) - 1); ridisegnaMantenendo(); };
  AZ['fmt-categoria'] = () => { ui.fmtCat = ui.categoria && ui.categoria !== 'Tutte' && ui.categoria !== '__nuovi' ? ui.categoria : ''; ui.fmtForn = ''; ui.fmtFiltro = ui.fmtCat ? 'tutti' : 'ricette'; ui.fmtIdx = 0; vai('#/formati'); };
  AZ['fmt-fornitore'] = (el) => { ui.fmtForn = el.dataset.id; ui.fmtCat = ''; ui.fmtFiltro = 'tutti'; ui.fmtIdx = 0; vai('#/formati'); };
  AZ['fmt-filtro'] = (el) => { ui.fmtFiltro = el.dataset.v; ui.fmtIdx = 0; ridisegnaMantenendo(); };
  AZ['fmt-giusto'] = (el) => { const p = M.prodotto(el.dataset.id); p.formatoOk = true; p.daCompletare = false; if ((ui.fmtFiltro || 'ricette') !== 'dacontrollare') ui.fmtIdx = (ui.fmtIdx || 0) + 1; salva(); ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['fmt-salta'] = () => { ui.fmtIdx = (ui.fmtIdx || 0) + 1; ridisegnaMantenendo(); window.scrollTo(0, 0); };
  AZ['fmt-indietro'] = () => { ui.fmtIdx = Math.max(0, (ui.fmtIdx || 0) - 1); ridisegnaMantenendo(); window.scrollTo(0, 0); };
  const ctrlAvanti = (rimosso) => { if (!rimosso) ui.ctrlIdx = (ui.ctrlIdx || 0) + 1; salva(); ridisegnaMantenendo(); };
  AZ['ctrl-giusto'] = (el) => { M.prodotto(el.dataset.id).daCompletare = false; ctrlAvanti(true); };
  AZ['ctrl-materiale'] = (el) => { const p = M.prodotto(el.dataset.id); p.categoria = 'Non alimentare'; p.daCompletare = false; ctrlAvanti(true); avviso('Segnato come materiale.'); };
  AZ['ctrl-togli'] = (el) => { const p = M.prodotto(el.dataset.id); M.togliProdotto(p.id); ctrlAvanti(true); avviso(`Tolto «${p.nomeBreve}»: le prossime fatture lo salteranno.`); };
  AZ['ctrl-servizi'] = (el) => { const forn = M.fornitore(el.dataset.id); if (!confirm(`${forn.nome} non vende merce? Tolgo tutti i prodotti creati dalle sue fatture.`)) return; const n = M.segnaServizi(forn.id, true); ctrlAvanti(true); avviso(`Tolti ${n} prodotti di ${forn.nome}.`); };
  AZ['ctrl-salta'] = () => ctrlAvanti(false);
  AZ['ctrl-indietro'] = () => { ui.ctrlIdx = Math.max(0, (ui.ctrlIdx || 0) - 1); ridisegnaMantenendo(); };
  AZ['unisci-fornitore'] = (el) => {
    const sel = $('#unisci-forn'); if (!sel || !sel.value) { alert('Scegli il fornitore in cui unirlo.'); return; }
    const da = M.fornitore(el.dataset.id), a = M.fornitore(sel.value);
    if (!confirm(`Unisco «${da.nome}» dentro «${a.nome}»? Fatture e prodotti passano a ${a.nome}.`)) return;
    M.unisciFornitori(da.id, a.id); salva(); vai('#/fornitore/' + a.id); avviso('Fornitori uniti.');
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
  AZ['aggiungi-riga'] = () => { ui.bozza.righe.push({ rif: '', quantita: '', nota: '' }); ridisegnaMantenendo(); };
  AZ['togli-riga'] = (el) => { ui.bozza.righe.splice(+el.dataset.k, 1); ridisegnaMantenendo(); };
  AZ['aggiungi-extra'] = () => { (ui.bozza.costiExtra = ui.bozza.costiExtra || []).push({ nome: '', costo: '' }); ridisegnaMantenendo(); };
  AZ['togli-extra'] = (el) => { ui.bozza.costiExtra.splice(+el.dataset.k, 1); ridisegnaMantenendo(); };
  AZ['aggiungi-asporto'] = () => { (ui.bozza.asporto = ui.bozza.asporto || []).push({ rif: '', quantita: 1 }); ridisegnaMantenendo(); };
  AZ['togli-asporto'] = (el) => { ui.bozza.asporto.splice(+el.dataset.k, 1); ridisegnaMantenendo(); };
  AZ['salva-ricetta'] = () => {
    const b = ui.bozza; if (!b.nome.trim()) { alert('Scrivi il nome.'); return; }
    b.righe = b.righe.filter(rg => rg.rif).map(rg => Object.assign(rg, { quantita: numDa(rg.quantita) || 0 }));
    b.costiExtra = (b.costiExtra || []).filter(e => e.nome || e.costo).map(e => Object.assign(e, { costo: numDa(e.costo) || 0 }));
    b.asporto = (b.asporto || []).filter(a => a.rif).map(a => Object.assign(a, { quantita: numDa(a.quantita) || 1 }));
    b.prezzo = numDa(b.prezzo); b.resa = numDa(b.resa);
    const nuovo = b._per === 'r:nuovo'; delete b._per;
    if (nuovo) S.ricette.push(b); else S.ricette[S.ricette.findIndex(r => r.id === b.id)] = b;
    ui.bozza = null; ui.tipoRicette = b.tipo; salva(); vai('#/ricetta/' + b.id);
  };
  AZ['elimina-ricetta'] = () => {
    const b = ui.bozza; const uso = M.usatoIn('r:' + b.id).dirette;
    if (!confirm(uso.length ? `${b.nome} è usata in ${uso.map(r => r.nome).join(', ')}. Eliminarla lo stesso?` : 'Eliminare ' + b.nome + '?')) return;
    S.ricette = S.ricette.filter(r => r.id !== b.id); ui.bozza = null; salva(); vai('#/ricette');
  };
  AZ['duplica-ricetta'] = (el) => { const r = JSON.parse(JSON.stringify(M.ricetta(el.dataset.id))); r.id = M.uid('r'); r.nome += ' (copia)'; r.vendite = {}; S.ricette.push(r); salva(); vai('#/modifica-ricetta/' + r.id); };
  AZ['registra-fattura'] = (el) => { const f = S.fatture.find(x => x.id === el.dataset.id); M.registraFattura(f); salva(); window.scrollTo(0, 0); disegna(); avviso('Fattura registrata: costi aggiornati.'); };
  AZ['annulla-fattura'] = (el) => { if (!confirm('Annullare la registrazione? Tolgo i prezzi e la merce di questa fattura.')) return; const f = S.fatture.find(x => x.id === el.dataset.id); M.annullaFattura(f); salva(); ridisegnaMantenendo(); };
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
    const h = location.hash || '';
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
    fn(el, e);
  });

  // ---------- Campi ----------
  document.addEventListener('input', (e) => {
    const el = e.target; const d = el.dataset;
    if (d.filtro === 'vendFiltro') { ui.vendFiltro = el.value; const f = el.value.toLowerCase(); document.querySelectorAll('.vend-riga').forEach(x => { x.style.display = !f || x.textContent.toLowerCase().includes(f) ? '' : 'none'; }); document.querySelectorAll('.griglia-vend > .card').forEach(c => { c.style.display = [...c.querySelectorAll('.vend-riga')].some(x => x.style.display !== 'none') ? '' : 'none'; }); return; }
    if (d.filtro === 'prodotti') { ui.filtroProdotti = el.value; $('#lista').innerHTML = listaProdotti(); return; }
    if (d.filtro === 'ricette') { ui.filtroRicette = el.value; $('#lista').innerHTML = listaRicette(); return; }
    if (d.b != null && ui.bozza) { ui.bozza[d.b] = el.value; if (d.ridisegna) ridisegnaMantenendo(); return; }
    if (d.vd != null && ui.bozza) { ui.bozza.venditaDiretta[d.vd] = el.value; return; }
    if (d.r != null && ui.bozza) { ui.bozza.righe[+d.r][d.k] = el.value; aggiornaAnteprima(); return; }
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
  document.addEventListener('change', (e) => {
    const el = e.target; const d = el.dataset;
    if (d.carica === 'xml') { caricaXML(Array.from(el.files)); el.value = ''; return; }
    if (d.carica === 'foto') { if (el.files[0]) caricaFoto(el.files[0]); el.value = ''; return; }
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
        if (rg.prodottoId) { const p = M.prodotto(rg.prodottoId); const a = (p.articoli || []).find(x => x.fornitoreId === f.fornitoreId); rg.confezioniPerUnita = a ? a.confezioniPerUnita : 1; }
      } else rg.confezioniPerUnita = numDa(el.value) || 1;
      salva(); ridisegnaMantenendo(); return;
    }
    if (d.fmtSel) { ui[d.fmtSel] = el.value; if (el.value && (ui.fmtFiltro || 'ricette') === 'ricette') ui.fmtFiltro = 'tutti'; ui.fmtIdx = 0; ridisegnaMantenendo(); return; }
    if (d.fmtRighe) {
      const n = numDa(el.value); if (!n || n <= 0) return;
      M.cambiaPezziPerRiga(d.fmtRighe, d.fattura, n); salva(); ridisegnaMantenendo(); avviso('Prezzi e magazzino ricalcolati.'); return;
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
      salva(); ridisegnaMantenendo(); avviso('Uniti.'); return;
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
    disegna();
    if (S.casella.url && (!S.casella.ultimoControllo || Date.now() - new Date(S.casella.ultimoControllo) > 15 * 60e3)) setTimeout(() => controllaCasella(false), 800);
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  avvia();
})();
