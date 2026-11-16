// Motore dei calcoli: costi, ricette, fatture. Nessuna parte grafica qui.
(function (G) {
  'use strict';
  const M = {};
  M.ALLERGENI = ['Glutine', 'Crostacei', 'Uova', 'Pesce', 'Arachidi', 'Soia', 'Latte', 'Frutta a guscio', 'Sedano', 'Senape', 'Sesamo', 'Solfiti', 'Lupini', 'Molluschi'];
  M.TIPI = { drink: 'Drink', premium: 'Gin tonic e premium', panino: 'Panini', fritto: 'Fritti', combo: 'Combinazioni', semilavorato: 'Preparazioni' };
  M.TIPI_SINGOLARE = { drink: 'drink', premium: 'premium', panino: 'panino', fritto: 'fritto', combo: 'combinazione', semilavorato: 'preparazione' };
  M.UNITA = { ml: 'ml', g: 'g', pz: 'pz' };

  let S = null;            // stato
  let simulazione = null;  // { prodottoId: prezzo } per il simulatore
  let cache = new Map();
  M.usa = function (stato) { S = stato; M.svuota(); };
  M.stato = () => S;
  M.svuota = function () { cache = new Map(); };
  M.simula = function (s) { simulazione = s; M.svuota(); };

  M.uid = (pref) => (pref || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  M.oggi = () => new Date().toISOString().slice(0, 10);
  M.prodotto = (id) => S.prodotti.find(p => p.id === id);
  M.ricetta = (id) => S.ricette.find(r => r.id === id);
  M.fornitore = (id) => S.fornitori.find(f => f.id === id);
  M.rif = function (rif) {
    if (!rif) return null;
    const [t, id] = rif.split(':');
    return t === 'p' ? M.prodotto(id) : M.ricetta(id);
  };
  M.nomeRif = function (rif) {
    const o = M.rif(rif);
    if (!o) return '(eliminato)';
    return rif.startsWith('p:') ? o.nomeBreve : o.nome;
  };
  M.unitaRif = function (rif) {
    const o = M.rif(rif);
    if (!o) return '';
    if (rif.startsWith('p:')) return o.unita;
    return o.tipo === 'semilavorato' ? (o.unita || 'ml') : 'pz';
  };

  // ---------- Prezzi dei prodotti ----------
  M.costoOlioGrammo = function () {
    const o = S.impostazioni.olio || {};
    return o.grammiFritti > 0 ? o.spesaAnnua / o.grammiFritti : null;
  };
  M.ultimiPerFornitore = function (p, data) {
    const per = {};
    (p.prezzi || []).forEach(e => {
      if (data && e.data > data) return;
      const k = e.fornitoreId || '_';
      if (!per[k] || e.data >= per[k].data) per[k] = e;
    });
    return per;
  };
  M.prezzoVoce = function (p, data) {
    // prezzo per confezione, senza IVA
    if (simulazione && simulazione[p.id] != null && !data) return { prezzo: simulazione[p.id] };
    if (p.speciale === 'olio') { const c = M.costoOlioGrammo(); return c == null ? null : { prezzo: c * (p.contenuto || 1) }; }
    const lista = (p.prezzi || []).filter(e => !data || e.data <= data);
    if (!lista.length) return null;
    const metodo = S.impostazioni.metodoPrezzo || 'ultimo';
    if (metodo === 'ultimo') {
      let u = lista[0];
      lista.forEach(e => { if (e.data >= u.data) u = e; });
      return u;
    }
    const ultimi = Object.values(M.ultimiPerFornitore(p, data));
    if (metodo === 'minimo') return ultimi.reduce((a, b) => (b.prezzo < a.prezzo ? b : a));
    const media = ultimi.reduce((s, e) => s + e.prezzo, 0) / ultimi.length;
    return { prezzo: media, media: true };
  };
  M.prezzo = (p, data) => { const v = M.prezzoVoce(p, data); return v ? v.prezzo : null; };
  M.prezzoPrecedente = function (p) {
    const l = (p.prezzi || []).slice().sort((a, b) => a.data < b.data ? -1 : 1);
    return l.length > 1 ? l[l.length - 2] : null;
  };
  M.costoUnita = function (p, data) {
    const pr = M.prezzo(p, data);
    if (pr == null || !p.contenuto) return null;
    const resa = (p.resa || 100) / 100;
    return pr / p.contenuto / resa;
  };
  // Prezzo di riferimento leggibile: €/litro, €/kg, €/pezzo
  M.prezzoRiferimento = function (p, data) {
    const c = M.costoUnita(p, data);
    if (c == null) return null;
    if (p.unita === 'ml') return { valore: c * 1000, etichetta: '€/litro' };
    if (p.unita === 'g') return { valore: c * 1000, etichetta: p.speciale === 'olio' ? '€/kg fritto' : '€/kg' };
    return { valore: c, etichetta: '€/pezzo' };
  };

  // ---------- Costo delle ricette ----------
  M.costoRiga = function (rif, quantita, data, pila) {
    const o = M.rif(rif);
    if (!o) return { costo: null, mancante: '(ingrediente eliminato)' };
    if (rif.startsWith('p:')) {
      const c = M.costoUnita(o, data);
      return c == null ? { costo: null, mancante: o.nomeBreve } : { costo: c * quantita };
    }
    const cr = M.costoRicetta(o, data, pila);
    if (cr.totale == null) return { costo: null, mancante: o.nome };
    const perUnita = o.tipo === 'semilavorato' && o.resa ? cr.totale / o.resa : cr.totale;
    return { costo: perUnita * quantita, mancanti: cr.mancanti };
  };
  M.costoRicetta = function (r, data, pila) {
    const chiave = r.id + '|' + (data || '');
    if (!pila && cache.has(chiave)) return cache.get(chiave);
    pila = pila || [];
    if (pila.includes(r.id)) return { totale: null, righe: [], mancanti: ['giro di ricette: ' + r.nome] };
    pila = pila.concat(r.id);
    let tot = 0; const mancanti = []; const righe = [];
    (r.righe || []).forEach(rg => {
      const c = M.costoRiga(rg.rif, Number(rg.quantita) || 0, data, pila);
      righe.push({ rif: rg.rif, quantita: rg.quantita, nota: rg.nota, costo: c.costo });
      if (c.costo == null) mancanti.push(c.mancante); else tot += c.costo;
      if (c.mancanti) c.mancanti.forEach(m => mancanti.includes(m) || mancanti.push(m));
    });
    (r.costiExtra || []).forEach(e => { tot += Number(e.costo) || 0; });
    const ris = { totale: righe.length || (r.costiExtra || []).length ? tot : null, righe, mancanti };
    if (pila.length === 1) cache.set(chiave, ris);
    return ris;
  };
  M.costo = (r, data) => M.costoRicetta(r, data).totale;
  M.costoAsporto = function (r) {
    const base = M.costo(r);
    if (base == null) return null;
    let extra = 0;
    (r.asporto || []).forEach(a => { const c = M.costoRiga(a.rif, Number(a.quantita) || 0); extra += c.costo || 0; });
    return { totale: base + extra, extra };
  };
  M.indicatori = function (r, prezzoForzato) {
    const costo = M.costo(r);
    const prezzo = prezzoForzato != null ? prezzoForzato : r.prezzo;
    const iva = S.impostazioni.ivaVendita || 0;
    const netto = prezzo ? prezzo / (1 + iva / 100) : null;
    const molt = costo && prezzo ? prezzo / costo : null;
    const incidenza = costo != null && netto ? costo / netto : null;
    const margine = netto != null && costo != null ? netto - costo : null;
    const soglia = (S.impostazioni.soglie || {})[r.tipo];
    const sotto = molt != null && soglia ? molt < soglia : false;
    return { costo, prezzo, netto, molt, incidenza, margine, soglia, sotto };
  };
  M.allergeniRicetta = function (r, pila) {
    pila = pila || [];
    if (pila.includes(r.id)) return [];
    const set = new Set();
    (r.righe || []).forEach(rg => {
      const o = M.rif(rg.rif);
      if (!o) return;
      if (rg.rif.startsWith('p:')) (o.allergeni || []).forEach(a => set.add(a));
      else M.allergeniRicetta(o, pila.concat(r.id)).forEach(a => set.add(a));
    });
    return M.ALLERGENI.filter(a => set.has(a));
  };
  // Ricette che usano un prodotto o una ricetta (anche indirettamente)
  M.usatoIn = function (rif) {
    const dirette = S.ricette.filter(r => (r.righe || []).some(rg => rg.rif === rif));
    const tutte = new Set(dirette.map(r => r.id));
    let coda = dirette.slice();
    while (coda.length) {
      const r = coda.shift();
      S.ricette.forEach(x => {
        if (!tutte.has(x.id) && (x.righe || []).some(rg => rg.rif === 'r:' + r.id)) { tutte.add(x.id); coda.push(x); }
      });
    }
    return { dirette, tutte: S.ricette.filter(r => tutte.has(r.id)) };
  };
  // Date in cui cambia il costo di una ricetta, per il grafico dell'andamento
  M.dateCosto = function (r, pila) {
    pila = pila || [];
    if (pila.includes(r.id)) return [];
    const date = new Set();
    (r.righe || []).forEach(rg => {
      const o = M.rif(rg.rif);
      if (!o) return;
      if (rg.rif.startsWith('p:')) (o.prezzi || []).forEach(e => date.add(e.data));
      else M.dateCosto(o, pila.concat(r.id)).forEach(d => date.add(d));
    });
    return Array.from(date).sort();
  };
  M.andamento = function (r) {
    return M.dateCosto(r).map(d => ({ data: d, costo: M.costo(r, d) })).filter(x => x.costo != null);
  };
  // Consumo di prodotti base per una ricetta (scioglie le preparazioni)
  M.consumoBase = function (r, molt, acc, pila) {
    acc = acc || {}; pila = pila || [];
    if (pila.includes(r.id)) return acc;
    (r.righe || []).forEach(rg => {
      const o = M.rif(rg.rif); if (!o) return;
      const q = (Number(rg.quantita) || 0) * molt;
      if (rg.rif.startsWith('p:')) acc[o.id] = (acc[o.id] || 0) + q;
      else {
        const f = o.tipo === 'semilavorato' && o.resa ? q / o.resa : q;
        M.consumoBase(o, f, acc, pila.concat(r.id));
      }
    });
    return acc;
  };

  // ---------- Magazzino ----------
  M.valoreGiacenza = function (p) {
    const pr = M.prezzo(p);
    return pr == null || p.speciale ? 0 : (Number(p.giacenza) || 0) * pr;
  };
  M.valoreMagazzino = () => S.prodotti.reduce((s, p) => s + M.valoreGiacenza(p), 0);
  M.sottoScorta = () => S.prodotti.filter(p => p.scortaMinima > 0 && (Number(p.giacenza) || 0) < p.scortaMinima);

  // ---------- Fatture elettroniche ----------
  function testo(el, nome) {
    if (!el) return '';
    const t = el.getElementsByTagNameNS ? el.getElementsByTagNameNS('*', nome) : el.getElementsByTagName(nome);
    return t && t.length ? (t[0].textContent || '').trim() : '';
  }
  function tutti(el, nome) { return Array.from(el.getElementsByTagNameNS('*', nome)); }
  const num = (s) => { const n = parseFloat(String(s || '').replace(',', '.')); return isNaN(n) ? 0 : n; };

  M.estraiXML = function (buffer) {
    // Funziona per i file .xml e per i .xml.p7m (firmati): cerca il testo XML dentro il file.
    const bytes = new Uint8Array(buffer);
    let s = new TextDecoder('utf-8').decode(bytes);
    if (s.indexOf('FatturaElettronica') !== -1 && s.trim().startsWith('<')) return s;
    s = new TextDecoder('latin1').decode(bytes);
    let i = s.indexOf('<?xml');
    if (i === -1) i = s.search(/<[a-zA-Z0-9]*:?FatturaElettronica[\s>]/);
    if (i === -1) {
      // a volte il p7m è in base64
      try {
        const b = atob(s.replace(/[^A-Za-z0-9+/=]/g, ''));
        const arr = new Uint8Array(b.length); for (let k = 0; k < b.length; k++) arr[k] = b.charCodeAt(k);
        return M.estraiXML(arr.buffer);
      } catch (e) { return null; }
    }
    const fine = s.search(/<\/[a-zA-Z0-9]*:?FatturaElettronica>/);
    if (fine === -1) return null;
    const chiusura = s.slice(fine).indexOf('>') + fine + 1;
    // ripulisce eventuali byte di firma finiti in mezzo al testo
    let xml = s.slice(i, chiusura);
    xml = xml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    try { xml = decodeURIComponent(escape(xml)); } catch (e) { /* già leggibile */ }
    return xml;
  };

  M.leggiFatturaXML = function (xmlText, nomeFile) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Il file non è una fattura elettronica leggibile.');
    const ced = tutti(doc, 'CedentePrestatore')[0];
    if (!ced) throw new Error('Nel file non trovo il fornitore: forse non è una fattura elettronica.');
    const nomeForn = testo(ced, 'Denominazione') || (testo(ced, 'Nome') + ' ' + testo(ced, 'Cognome')).trim();
    const piva = testo(tutti(ced, 'IdFiscaleIVA')[0], 'IdCodice');
    const corpi = tutti(doc, 'FatturaElettronicaBody');
    return corpi.map((corpo, k) => {
      const dg = tutti(corpo, 'DatiGeneraliDocumento')[0];
      const righe = tutti(corpo, 'DettaglioLinee').map(l => {
        const sc = tutti(l, 'ScontoMaggiorazione').map(x => ({ tipo: testo(x, 'Tipo'), perc: num(testo(x, 'Percentuale')), importo: num(testo(x, 'Importo')) }));
        let sconto = 0;
        sc.forEach(x => { if (x.perc) sconto += (x.tipo === 'MG' ? -x.perc : x.perc); });
        const cod = tutti(l, 'CodiceArticolo').map(c => testo(c, 'CodiceValore')).filter(Boolean);
        const q = testo(l, 'Quantita');
        return {
          n: num(testo(l, 'NumeroLinea')), descrizione: testo(l, 'Descrizione'), codice: cod[0] || '',
          quantita: q === '' ? 1 : num(q), um: testo(l, 'UnitaMisura'), prezzoUnitario: num(testo(l, 'PrezzoUnitario')),
          sconto, scontoImporto: sc.reduce((s, x) => s + (x.perc ? 0 : x.importo), 0),
          totale: num(testo(l, 'PrezzoTotale')), aliquota: num(testo(l, 'AliquotaIVA')),
          prodottoId: null, confezioniPerUnita: 1, ignora: false
        };
      });
      const scadenze = tutti(corpo, 'DettaglioPagamento').map(d => ({ data: testo(d, 'DataScadenzaPagamento'), importo: num(testo(d, 'ImportoPagamento')), pagata: false })).filter(x => x.importo || x.data);
      const imponibile = tutti(corpo, 'DatiRiepilogo').reduce((s, x) => s + num(testo(x, 'ImponibileImporto')), 0);
      const imposta = tutti(corpo, 'DatiRiepilogo').reduce((s, x) => s + num(testo(x, 'Imposta')), 0);
      let totale = num(testo(dg, 'ImportoTotaleDocumento'));
      if (!totale) totale = imponibile + imposta;
      return {
        id: M.uid('ft'), origine: 'xml', nomeFile: nomeFile || '', parte: corpi.length > 1 ? k + 1 : null,
        fornitoreNome: nomeForn, piva, tipoDoc: testo(dg, 'TipoDocumento') || 'TD01', numero: testo(dg, 'Numero'), data: testo(dg, 'Data'),
        totale, imponibile, imposta, scadenze, righe, stato: 'da_abbinare', creata: M.oggi()
      };
    });
  };

  const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  M.trovaFornitore = function (f) {
    if (f.piva) { const x = S.fornitori.find(z => z.piva && z.piva === f.piva); if (x) return x; }
    const n = norm(f.fornitoreNome);
    const senzaForma = (x) => norm(x).replace(/\b(s ?r ?l|s ?p ?a|s ?n ?c|s ?a ?s|srls|unipersonale|societa|soc|coop)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const ns = senzaForma(f.fornitoreNome);
    return S.fornitori.find(z => norm(z.nome) === n) || S.fornitori.find(z => senzaForma(z.nome) === ns)
      || S.fornitori.find(z => n && (n.startsWith(norm(z.nome) + ' ') || norm(z.nome).startsWith(n + ' ')))
      || S.fornitori.find(z => { const c = senzaForma(z.nome); return c.length >= 4 && (' ' + ns + ' ').includes(' ' + c + ' '); }) || null;
  };
  M.abbinaAutomatico = function (f) {
    const forn = M.trovaFornitore(f);
    f.fornitoreId = forn ? forn.id : null;
    f.righe.forEach(rg => {
      if (rg.prodottoId || rg.ignora) return;
      const ign = (S.ignorati || []).find(x => x.fornitoreId === f.fornitoreId && ((rg.codice && x.codice === rg.codice) || norm(x.descrizione) === norm(rg.descrizione)));
      if (ign) { rg.ignora = true; return; }
      for (const p of S.prodotti) {
        const a = (p.articoli || []).find(a => (!a.fornitoreId || a.fornitoreId === f.fornitoreId) && ((rg.codice && a.codice && a.codice === rg.codice) || norm(a.descrizione) === norm(rg.descrizione)));
        if (a) {
          rg.prodottoId = p.id; rg.automatico = true;
          // un omaggio scritto a bottiglie (BT) accanto a righe a cartoni: niente moltiplicatore
          const umPezzo = /^(BT|PZ|NR|N|BOT|BOTT)$/i.test(rg.um || '');
          rg.confezioniPerUnita = umPezzo && a.confezioniPerUnita > 1 && rg.totale === 0 ? 1 : (a.confezioniPerUnita || 1);
          break;
        }
      }
    });
    return f;
  };
  M.daAbbinare = (f) => f.righe.filter(r => !r.prodottoId && !r.ignora).length;

  // Analisi della fattura: nuovi prezzi per prodotto e avvisi
  M.analizzaFattura = function (f) {
    const per = {};
    const avvisi = [];
    f.righe.forEach(rg => {
      const atteso = rg.quantita * rg.prezzoUnitario * (1 - (rg.sconto || 0) / 100) - (rg.scontoImporto || 0);
      if (rg.totale && Math.abs(atteso - rg.totale) > 0.05) avvisi.push({ tipo: 'attenzione', testo: `Riga ${rg.n} «${rg.descrizione}»: il totale scritto (${rg.totale.toFixed(2)} €) non torna con quantità, prezzo e sconto (${atteso.toFixed(2)} €).` });
      if (!rg.prodottoId || rg.ignora) return;
      const p = M.prodotto(rg.prodottoId); if (!p) return;
      const conf = rg.quantita * (Number(rg.confezioniPerUnita) || 1);
      const x = per[p.id] || (per[p.id] = { prodottoId: p.id, confezioni: 0, spesa: 0, confPagate: 0, spesaPagata: 0, omaggio: 0, sconto: 0, righe: [] });
      x.confezioni += conf; x.spesa += rg.totale; x.righe.push(rg);
      if (rg.totale > 0) { x.confPagate += conf; x.spesaPagata += rg.totale; x.sconto = Math.max(x.sconto, rg.sconto || 0); } else x.omaggio += conf;
    });
    const nota = f.tipoDoc === 'TD04';
    if (nota) avvisi.push({ tipo: 'info', testo: 'È una nota di credito: scala la merce resa dal magazzino e non cambia i prezzi.' });
    const soglia = S.impostazioni.sogliaAumento || 3;
    const prodotti = Object.values(per).map(x => {
      const p = M.prodotto(x.prodottoId);
      const nuovo = x.confezioni > 0 && x.spesa > 0 ? x.spesa / x.confezioni : null;
      const listino = x.confPagate > 0 ? x.spesaPagata / x.confPagate : null;
      const prec = (p.prezzi || []).filter(e => e.fatturaId !== f.id).slice().sort((a, b) => a.data < b.data ? -1 : 1);
      const ultimo = prec.length ? prec[prec.length - 1] : null;
      const variazione = nuovo != null && ultimo && ultimo.prezzo ? (nuovo / ultimo.prezzo - 1) * 100 : null;
      if (!nota && variazione != null && Math.abs(variazione) >= soglia) avvisi.push({ tipo: variazione > 0 ? 'aumento' : 'calo', testo: `${p.nomeBreve}: ${variazione > 0 ? 'aumentato' : 'sceso'} del ${Math.abs(variazione).toFixed(1).replace('.', ',')}%` + (x.omaggio ? ' (contando l\'omaggio)' : '') });
      if (x.omaggio) avvisi.push({ tipo: 'info', testo: `${p.nomeBreve}: ${x.omaggio} in omaggio. Il costo vero scende da ${listino.toFixed(2).replace('.', ',')} € a ${nuovo.toFixed(2).replace('.', ',')} € a confezione.` });
      const precFatt = prec.filter(e => e.fatturaId);
      const ultimoFatt = precFatt[precFatt.length - 1];
      if (!nota && ultimoFatt && ultimoFatt.sconto > 0 && !x.sconto && ultimoFatt.fornitoreId === f.fornitoreId) avvisi.push({ tipo: 'attenzione', testo: `${p.nomeBreve}: l'ultima volta c'era uno sconto del ${ultimoFatt.sconto}%, in questa fattura no.` });
      const qPrec = precFatt.map(e => e.confezioni).filter(Boolean);
      if (qPrec.length) { const media = qPrec.reduce((a, b) => a + b, 0) / qPrec.length; if (x.confezioni > media * 3) avvisi.push({ tipo: 'attenzione', testo: `${p.nomeBreve}: quantità insolita (${x.confezioni} contro una media di ${media.toFixed(1)}).` }); }
      return Object.assign(x, { nuovo, listino, ultimo: ultimo ? ultimo.prezzo : null, variazione });
    });
    return { prodotti, avvisi, nota };
  };

  // Registra la fattura: prezzi, magazzino, articoli collegati, resoconto delle ricette cambiate
  M.assicuraFornitore = function (f) {
    if (!f.fornitoreId) {
      const nuovo = { id: M.uid('f'), nome: f.fornitoreNome.replace(/\s*\(ESEMPIO\)\s*/i, '').trim() || 'Fornitore', piva: f.piva || '', telefono: '', email: '', referente: '', giorniConsegna: '', note: '' };
      S.fornitori.push(nuovo); f.fornitoreId = nuovo.id;
    }
    return M.fornitore(f.fornitoreId);
  };

  // ---------- Prodotti creati in automatico dalle fatture ----------
  const NON_MERCE = /trasport|spedizion|\bspese\b|cauzion|contribut|\bbollo\b|imball|facchinagg|arrotond|rimborso|noleggio|canone|\bsconto\b|commission|diritt[io]|accisa/i;
  M.nonMerce = (rg) => NON_MERCE.test(rg.descrizione) || (!rg.totale && rg.prezzoUnitario < 0.01);
  const CATEGORIE = [
    [/\bbirr|\bfus(to|ti)?\b|lager|weiss|blanche|ipa\b|stout|guinness/i, 'Birra e fusti'], [/\bgin\b/i, 'Gin'], [/vodka/i, 'Vodka'], [/\brum\b|cacha/i, 'Rum e cachaça'],
    [/tequila|mezcal|espadin|whisk|bourbon|grappa|cognac/i, 'Distillati'], [/vermouth|bitter|aperol|campari|chinato/i, 'Bitter e vermouth'], [/amaro|liquor|limoncello|sambuca|moscato giallo/i, 'Amari e liquori'],
    [/\bvin[oi]\b|rosato|prosecco|spumant|sangiovese|chianti|lambrusco|bianco|rosso/i, 'Vino'], [/coca|cola|tonic|soda|succo|ginger|acqua|lemon|aranciat|premix|sciropp/i, 'Sode e succhi'],
    [/\bpane\b|panin|\broll\b|\bbun\b|focacc|piadin/i, 'Pane'], [/hamburger|bovin|manzo|suin|pollo|salsicc|bacon|pancett|guancial|wurst|carne/i, 'Carne'],
    [/formagg|cheddar|mozzarel|scamorz|halloumi|grana|parmig/i, 'Formaggi'], [/patat|surgel|frozen/i, 'Surgelati'], [/insalat|pomodor|cipoll|lime|limon|frutta|verdur|kiwi|lampon/i, 'Frutta e verdura'],
    [/salsa|maionese|ketchup|senape|mayo/i, 'Salse'], [/sacch|bicchier|tovagl|busta|vaschett|carta|cannucc|guant|detersiv|sottobicch|sottocopp/i, 'Non alimentare'], [/ghiaccio/i, 'Ghiaccio']
  ];
  const titolo = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  M.indovinaProdotto = function (rg) {
    const d = rg.descrizione || '', um = String(rg.um || '').toUpperCase().replace(/\./g, '');
    let unita = 'pz', contenuto = 1, confezione = 'pezzo', perUnita = 1;
    let misura = d.match(/(\d+(?:[.,]\d+)?)\s*(CL|ML|LT|LITRI|L|KG|GR|G)\b/i);
    let qtaMis = misura ? parseFloat(misura[1].replace(',', '.')) : null;
    let tipoMis = misura ? misura[2].toUpperCase() : '';
    const inverso = d.match(/\b(CL|ML|LT|KG|GR)\.?\s*(\d+(?:[.,]\d+)?)\b/i); // es. «CL 70»
    if (inverso && (!misura || inverso.index < misura.index)) { misura = inverso; qtaMis = parseFloat(inverso[2].replace(',', '.')); tipoMis = inverso[1].toUpperCase(); }
    const pezziCt = d.match(/\b(?:CT|CF|CONF|X)\s*(\d{1,3})\b/i) || d.match(/\b(\d{1,3})\s*X\b/i);
    if (/^(KG|KGM|KGS)$/.test(um)) { unita = 'g'; contenuto = 1000; confezione = 'kg'; }
    else if (/^(LT|L|LTR|LITRI)$/.test(um)) { unita = 'ml'; contenuto = 1000; confezione = 'litro'; }
    else if (misura && /^(CL|ML|LT|LITRI|L)$/.test(tipoMis)) {
      unita = 'ml'; contenuto = tipoMis === 'CL' ? qtaMis * 10 : tipoMis === 'ML' ? qtaMis : qtaMis * 1000;
      confezione = /FUS/i.test(um + ' ' + d) ? 'fusto' : contenuto >= 5000 ? 'tanica' : 'bottiglia';
      if (/^(CT|CF|CONF|CRT)$/.test(um) && pezziCt) perUnita = +pezziCt[1];
    }
    else if (misura && /^(KG|GR|G)$/.test(tipoMis) && !/^(PZ|PEZ|NR|N|PZZ|BT)$/.test(um)) {
      unita = 'g'; contenuto = tipoMis === 'KG' ? qtaMis * 1000 : qtaMis; confezione = 'confezione';
    }
    else if (/^(CT|CF|CONF|CRT)$/.test(um) && pezziCt) { perUnita = +pezziCt[1]; }
    else if (/^(BT|BOT|BOTT)$/.test(um) && /\bvin[oi]\b|rosato|prosecco|spumant|sangiovese|chianti/i.test(d)) { unita = 'ml'; contenuto = 750; confezione = 'bottiglia'; }
    const parole = d.replace(/\/\/.*$/, '').replace(/\([^)]*\d[^)]*\)?/g, ' ').split(/\s+/).filter(w => w.length > 1 && !/\d/.test(w) && !/^(CL|ML|LT|KG|GR|CT|CF|FUS|PZ|X|CONF)$/i.test(w) && !/[%°]/.test(w));
    const nomeBreve = titolo(parole.slice(0, 3).join(' ') || d.slice(0, 30));
    const cat = (CATEGORIE.find(([re]) => re.test(d)) || [null, 'Da classificare'])[1];
    return { nomeBreve, unita, contenuto, confezione, perUnita, categoria: cat };
  };
  // fornitori che non vendono merce: bollette, banche, pagamenti, assicurazioni, SIAE...
  const SERVIZI = /\benel\b|\beni\b|enimoov|plenitude|hera\b|a2a\b|edison|nova aeg|iren\b|acea\b|sorgenia|\btim\b|telecom|vodafone|fastweb|wind ?tre|iliad|nexi|sumup|satispay|paypal|s\.?i\.?a\.?e|assicura|generali|unipol|allianz|reale mutua|leasing|banca|banco|poste italiane|amazon web|google|microsoft|apple|aruba|register|sistemi s\.?p\.?a|studio|commercialist|consulen|noleggio|autostrad|telepass/i;
  M.pareServizi = (nome) => SERVIZI.test(nome || '');
  M.creaProdottiDaFattura = function (f) {
    if (f.stato === 'registrata') return [];
    const forn = M.assicuraFornitore(f);
    if (forn.servizi === undefined && M.pareServizi(forn.nome)) forn.servizi = true;
    if (forn.servizi) { f.righe.forEach(rg => { if (!rg.prodottoId) { rg.ignora = true; rg.automatico = true; } }); f.servizi = true; return []; }
    const creati = [];
    f.righe.forEach(rg => {
      if (rg.prodottoId || rg.ignora) return;
      if (M.nonMerce(rg)) { rg.ignora = true; rg.automatico = true; return; }
      // stessa descrizione già creata in questa fattura (es. riga omaggio): stesso prodotto
      const gemella = f.righe.find(x => x !== rg && x.prodottoId && norm(x.descrizione).replace(/ omaggio$/, '') === norm(rg.descrizione).replace(/ omaggio$/, ''));
      if (gemella) { rg.prodottoId = gemella.prodottoId; rg.confezioniPerUnita = gemella.confezioniPerUnita; rg.automatico = true; return; }
      const g = M.indovinaProdotto(rg);
      const p = { id: M.uid('p'), nomeBreve: g.nomeBreve, nomeCompleto: rg.descrizione, categoria: g.categoria, unita: g.unita, contenuto: g.contenuto, confezione: g.confezione,
        iva: rg.aliquota || 22, giacenza: 0, scortaMinima: 0, resa: 100, allergeni: [], venditaDiretta: null, fornitoreId: f.fornitoreId, articoli: [], prezzi: [], note: '',
        daCompletare: true, creatoDa: f.id };
      // ricordo subito come compare in fattura, così le fatture successive lo riconoscono
      p.articoli.push({ fornitoreId: f.fornitoreId, codice: rg.codice, descrizione: rg.descrizione, confezioniPerUnita: g.perUnita });
      S.prodotti.push(p); creati.push(p.id);
      rg.prodottoId = p.id; rg.confezioniPerUnita = g.perUnita; rg.creato = true;
    });
    M.svuota();
    return creati;
  };

  // Segna un fornitore come «servizi»: le sue fatture restano (per le scadenze) ma senza prodotti
  M.segnaServizi = function (fornitoreId, valore) {
    const forn = M.fornitore(fornitoreId); if (!forn) return 0;
    forn.servizi = valore !== false;
    if (!forn.servizi) return 0;
    const sue = S.fatture.filter(x => x.fornitoreId === fornitoreId);
    const ids = new Set(sue.map(x => x.id));
    let tolti = 0;
    sue.forEach(f => {
      const eraReg = f.stato === 'registrata';
      if (eraReg) M.annullaFattura(f);
      f.righe.forEach(rg => { rg.prodottoId = null; rg.ignora = true; rg.automatico = true; });
      f.servizi = true;
      M.registraFattura(f);
    });
    // via i prodotti creati in automatico da queste fatture e mai usati
    S.prodotti = S.prodotti.filter(p => {
      const via = p.daCompletare && p.creatoDa && ids.has(p.creatoDa) && !M.usatoIn('p:' + p.id).dirette.length;
      if (via) tolti++;
      return !via;
    });
    M.svuota();
    return tolti;
  };

  // Il contrario: il fornitore vende merce, quindi le sue fatture creano i prodotti
  M.togliServizi = function (fornitoreId) {
    const forn = M.fornitore(fornitoreId); if (!forn) return 0;
    forn.servizi = false;
    let creati = 0;
    S.fatture.filter(x => x.fornitoreId === fornitoreId).forEach(f => {
      if (f.stato === 'registrata') M.annullaFattura(f);
      f.servizi = false;
      f.righe.forEach(rg => { if (!rg.prodottoId) { rg.ignora = false; rg.automatico = false; } });
      S.ignorati = (S.ignorati || []).filter(x => x.fornitoreId !== fornitoreId);
      M.abbinaAutomatico(f);
      creati += M.creaProdottiDaFattura(f).length;
      if (!M.daAbbinare(f)) M.registraFattura(f);
    });
    M.svuota();
    return creati;
  };

  // ---------- Pulizia dell'archivio ----------
  // Toglie un prodotto creato per sbaglio (pezzo di ricambio, lavoro...) e ricorda di saltare quella riga in futuro
  M.togliProdotto = function (pId) {
    S.fatture.forEach(f => f.righe.forEach(rg => {
      if (rg.prodottoId !== pId) return;
      rg.prodottoId = null; rg.ignora = true; rg.automatico = true;
      S.ignorati = S.ignorati || [];
      if (!S.ignorati.some(x => x.fornitoreId === f.fornitoreId && x.descrizione === rg.descrizione)) S.ignorati.push({ fornitoreId: f.fornitoreId, codice: rg.codice, descrizione: rg.descrizione });
    }));
    S.ricette.forEach(r => { r.righe = (r.righe || []).filter(rg => rg.rif !== 'p:' + pId); r.asporto = (r.asporto || []).filter(a => a.rif !== 'p:' + pId); });
    S.prodotti = S.prodotti.filter(p => p.id !== pId);
    M.svuota();
  };
  // Unisce un doppione nel prodotto giusto: prezzi, magazzino, righe delle fatture e ricette passano al prodotto giusto
  M.unisciProdotti = function (daId, aId) {
    const da = M.prodotto(daId), a = M.prodotto(aId);
    if (!da || !a || da === a) return 'Scegli un prodotto diverso.';
    if (da.unita !== a.unita) return `Non posso unirli: uno è in ${da.unita}, l'altro in ${a.unita}.`;
    const k = (da.contenuto || 1) / (a.contenuto || 1); // 1 confezione del doppione = k confezioni del prodotto giusto
    (da.prezzi || []).forEach(e => a.prezzi.push(Object.assign({}, e, { prezzo: e.prezzo / k, listino: e.listino != null ? e.listino / k : e.listino, confezioni: e.confezioni != null ? e.confezioni * k : e.confezioni })));
    (da.articoli || []).forEach(ar => { if (!(a.articoli || []).some(x => x.fornitoreId === ar.fornitoreId && x.descrizione === ar.descrizione)) (a.articoli = a.articoli || []).push(Object.assign({}, ar, { confezioniPerUnita: (ar.confezioniPerUnita || 1) * k })); });
    a.giacenza = Math.round(((Number(a.giacenza) || 0) + (Number(da.giacenza) || 0) * k) * 1000) / 1000;
    (da.allergeni || []).forEach(x => { if (!(a.allergeni || []).includes(x)) (a.allergeni = a.allergeni || []).push(x); });
    S.fatture.forEach(f => f.righe.forEach(rg => { if (rg.prodottoId === daId) { rg.prodottoId = aId; rg.confezioniPerUnita = (Number(rg.confezioniPerUnita) || 1) * k; } }));
    S.ricette.forEach(r => { (r.righe || []).forEach(rg => { if (rg.rif === 'p:' + daId) rg.rif = 'p:' + aId; }); (r.asporto || []).forEach(x => { if (x.rif === 'p:' + daId) x.rif = 'p:' + aId; }); });
    S.prodotti = S.prodotti.filter(p => p.id !== daId);
    M.svuota();
    return null;
  };
  // Unisce due fornitori (es. «Doreca» e «Emilia Romagna Doreca S.r.l.»)
  M.unisciFornitori = function (daId, aId) {
    const da = M.fornitore(daId), a = M.fornitore(aId);
    if (!da || !a || da === a) return;
    ['piva', 'telefono', 'email', 'referente', 'giorniConsegna'].forEach(k => { if (!a[k] && da[k]) a[k] = da[k]; });
    S.prodotti.forEach(p => {
      if (p.fornitoreId === daId) p.fornitoreId = aId;
      (p.prezzi || []).forEach(e => { if (e.fornitoreId === daId) e.fornitoreId = aId; });
      (p.articoli || []).forEach(x => { if (x.fornitoreId === daId) x.fornitoreId = aId; });
    });
    S.fatture.forEach(f => { if (f.fornitoreId === daId) f.fornitoreId = aId; });
    (S.ignorati || []).forEach(x => { if (x.fornitoreId === daId) x.fornitoreId = aId; });
    S.fornitori = S.fornitori.filter(f => f.id !== daId);
    M.svuota();
  };

  M.registraFattura = function (f) {
    M.assicuraFornitore(f);
    const forn = M.fornitore(f.fornitoreId);
    if (forn && f.piva && !forn.piva) forn.piva = f.piva;
    const an = M.analizzaFattura(f);
    const prima = {}; S.ricette.forEach(r => { prima[r.id] = M.costo(r); });
    const prezziPrima = {}; an.prodotti.forEach(x => { prezziPrima[x.prodottoId] = M.prezzo(M.prodotto(x.prodottoId)); });
    an.prodotti.forEach(x => {
      const p = M.prodotto(x.prodottoId);
      if (!an.nota && x.nuovo != null) p.prezzi.push({ data: f.data, fornitoreId: f.fornitoreId, prezzo: x.nuovo, listino: x.listino, sconto: x.sconto, confezioni: x.confezioni, fatturaId: f.id, origine: 'Fattura ' + f.numero });
      p.giacenza = Math.round(((Number(p.giacenza) || 0) + (an.nota ? -1 : 1) * x.confezioni) * 1000) / 1000;
      if (!p.fornitoreId) p.fornitoreId = f.fornitoreId;
    });
    // ricorda i collegamenti per le prossime fatture
    f.righe.forEach(rg => {
      if (rg.ignora) {
        if (!(S.ignorati || (S.ignorati = [])).some(x => x.fornitoreId === f.fornitoreId && x.descrizione === rg.descrizione)) S.ignorati.push({ fornitoreId: f.fornitoreId, codice: rg.codice, descrizione: rg.descrizione });
        return;
      }
      const p = M.prodotto(rg.prodottoId); if (!p || rg.totale === 0) return;
      p.articoli = p.articoli || [];
      const ex = p.articoli.find(a => a.fornitoreId === f.fornitoreId && ((rg.codice && a.codice === rg.codice) || norm(a.descrizione) === norm(rg.descrizione)));
      if (ex) { ex.confezioniPerUnita = Number(rg.confezioniPerUnita) || 1; if (!ex.codice) ex.codice = rg.codice; }
      else p.articoli.push({ fornitoreId: f.fornitoreId, codice: rg.codice, descrizione: rg.descrizione, confezioniPerUnita: Number(rg.confezioniPerUnita) || 1 });
    });
    M.svuota();
    const ricette = S.ricette.map(r => {
      const dopo = M.costo(r);
      const ind = M.indicatori(r);
      return { ricettaId: r.id, prima: prima[r.id], dopo, molt: ind.molt, sotto: ind.sotto };
    }).filter(x => x.prima != null && x.dopo != null && Math.abs(x.dopo - x.prima) > 0.0005);
    f.resoconto = {
      data: M.oggi(),
      prodotti: an.prodotti.map(x => ({ prodottoId: x.prodottoId, prima: prezziPrima[x.prodottoId], dopo: x.nuovo, confezioni: x.confezioni })),
      ricette
    };
    f.avvisi = an.avvisi;
    f.stato = 'registrata';
    return f.resoconto;
  };
  M.annullaFattura = function (f) {
    if (f.stato !== 'registrata') return;
    const an = M.analizzaFattura(f);
    S.prodotti.forEach(p => { p.prezzi = (p.prezzi || []).filter(e => e.fatturaId !== f.id); });
    an.prodotti.forEach(x => { const p = M.prodotto(x.prodottoId); if (p) p.giacenza = Math.round(((Number(p.giacenza) || 0) - (an.nota ? -1 : 1) * x.confezioni) * 1000) / 1000; });
    f.stato = 'da_abbinare'; f.resoconto = null;
    M.svuota();
  };

  // ---------- Lettura delle foto con Claude ----------
  M.leggiFotoConClaude = async function (base64, tipoMime) {
    const chiave = S.impostazioni.chiaveClaude;
    if (!chiave) throw new Error('Per leggere le foto serve la chiave di Claude: la trovi in Impostazioni.');
    const istruzioni = 'Sei un lettore di fatture e documenti di trasporto italiani. Leggi il documento nella foto e rispondi SOLO con un oggetto JSON, senza altro testo, con questa forma: ' +
      '{"fornitore":"","partitaIva":"","numero":"","data":"AAAA-MM-GG","tipo":"fattura|nota di credito|ddt","totale":0,"imponibile":0,"scadenze":[{"data":"AAAA-MM-GG","importo":0}],' +
      '"righe":[{"codice":"","descrizione":"","quantita":0,"unitaMisura":"","prezzoUnitario":0,"scontoPercentuale":0,"totale":0,"aliquotaIva":0}]}. ' +
      'Importi senza IVA per le righe, numeri con il punto decimale. Se un dato non si legge lascia la stringa vuota o 0. Gli omaggi hanno prezzo 0.';
    const corpo = {
      model: S.impostazioni.modelloClaude || 'claude-sonnet-5-5', max_tokens: 4000,
      messages: [{ role: 'user', content: [
        tipoMime === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
          : { type: 'image', source: { type: 'base64', media_type: tipoMime, data: base64 } },
        { type: 'text', text: istruzioni }
      ] }]
    };
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': chiave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(corpo)
    });
    const j = await r.json();
    if (!r.ok) throw new Error('Claude non ha risposto: ' + ((j.error && j.error.message) || r.status));
    const t = (j.content || []).map(c => c.text || '').join('');
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Non sono riuscito a leggere la fattura dalla foto.');
    const d = JSON.parse(m[0]);
    return {
      id: M.uid('ft'), origine: 'foto', nomeFile: '', fornitoreNome: d.fornitore || 'Fornitore sconosciuto', piva: (d.partitaIva || '').replace(/^IT/i, ''),
      tipoDoc: /credito/i.test(d.tipo || '') ? 'TD04' : 'TD01', numero: d.numero || '', data: d.data || M.oggi(),
      totale: num(d.totale), imponibile: num(d.imponibile), imposta: 0,
      scadenze: (d.scadenze || []).map(s => ({ data: s.data, importo: num(s.importo), pagata: false })),
      righe: (d.righe || []).map((x, i) => ({ n: i + 1, descrizione: x.descrizione || '', codice: x.codice || '', quantita: num(x.quantita) || 1, um: x.unitaMisura || '', prezzoUnitario: num(x.prezzoUnitario), sconto: num(x.scontoPercentuale), scontoImporto: 0, totale: num(x.totale), aliquota: num(x.aliquotaIva), prodottoId: null, confezioniPerUnita: 1, ignora: false })),
      stato: 'da_abbinare', creata: M.oggi(), daVerificare: true
    };
  };

  G.Motore = M;
})(typeof window !== 'undefined' ? window : globalThis);
