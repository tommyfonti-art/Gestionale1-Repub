/**
 * Casella delle fatture del Repub → Gestionale Repub
 *
 * Gira nell'account Gmail creato solo per le fatture. Il gestionale lo interroga
 * e si prende gli allegati: fatture elettroniche (.xml, .xml.p7m, anche dentro
 * uno .zip), foto e PDF. Funziona anche con le mail mandate dall'iPhone, dove
 * gli allegati arrivano «dentro» il messaggio.
 *
 * Dopo aver cambiato il codice: Esegui il deployment › Gestisci deployment ›
 * matita › Versione: Nuova versione › Esegui il deployment (l'indirizzo resta lo stesso).
 */
const PAROLA_SEGRETA = 'repub-fatture-K7q4';
const GIORNI_INDIETRO = 60;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.chiave !== PAROLA_SEGRETA) return risposta({ errore: 'Parola segreta sbagliata.' });
  const dal = p.dal ? new Date(p.dal) : new Date(Date.now() - GIORNI_INDIETRO * 864e5);
  return risposta({ allegati: cercaAllegati(dal), controllo: new Date().toISOString() });
}

function cercaAllegati(dal) {
  const giorno = Utilities.formatDate(new Date(dal.getTime() - 864e5), 'Europe/Rome', 'yyyy/MM/dd');
  // niente «has:attachment»: le mail dall'iPhone spesso non lo hanno
  const discussioni = GmailApp.search('after:' + giorno, 0, 100);
  const allegati = [];
  discussioni.forEach(function (t) {
    t.getMessages().forEach(function (m) {
      if (m.getDate() < dal) return;
      leggiMessaggio(m).forEach(function (a) { allegati.push(a); });
    });
  });
  return allegati;
}

function leggiMessaggio(m) {
  const lista = [];
  m.getAttachments({ includeInlineImages: true, includeAttachments: true }).forEach(function (a) {
    const nome = a.getName() || 'allegato';
    const b = a.copyBlob().setName(nome);
    if (/\.zip$/i.test(nome) || a.getContentType() === 'application/zip') {
      try { Utilities.unzip(b.setContentType('application/zip')).forEach(function (z) { lista.push(z); }); } catch (err) { /* zip illeggibile */ }
    } else lista.push(b);
  });
  // fatture elettroniche che Gmail non mostra come allegato: le cerco nel messaggio grezzo
  if (!lista.some(function (b) { return /\.(xml|p7m)$/i.test(b.getName() || ''); })) {
    try { partiXml(m.getRawContent()).forEach(function (b) { lista.push(b); }); } catch (err) { /* messaggio illeggibile */ }
  }
  const haXml = lista.some(function (b) { return /\.(xml|p7m)$/i.test(b.getName() || ''); });
  const fuori = [];
  lista.forEach(function (b) {
    const nome = b.getName() || 'allegato';
    const tipo = b.getContentType() || '';
    const xml = /\.(xml|p7m)$/i.test(nome);
    const pdf = tipo === 'application/pdf' || /\.pdf$/i.test(nome);
    const foto = /^image\//.test(tipo);
    if (!xml && !pdf && !foto) return;
    if ((foto || pdf) && haXml) return; // la copia di cortesia accanto alla fattura elettronica non serve
    const byte = b.getBytes();
    if (foto && byte.length < 30 * 1024) return; // loghi e firme delle mail
    if (byte.length > 8 * 1024 * 1024) return;
    fuori.push({
      id: m.getId() + '|' + nome, nome: nome, tipo: xml ? 'xml' : (pdf ? 'application/pdf' : tipo),
      data: m.getDate().toISOString(), mittente: m.getFrom(), oggetto: m.getSubject(),
      base64: Utilities.base64Encode(byte)
    });
  });
  return fuori;
}

// Estrae dal messaggio grezzo le parti con un nome che finisce in .xml o .p7m
function partiXml(raw) {
  const fuori = [];
  const confini = [];
  raw.replace(/boundary="?([^";\r\n]+)"?/gi, function (x, b) { confini.push(b); return x; });
  confini.forEach(function (confine) {
    raw.split('--' + confine).forEach(function (pezzo) {
      const i = pezzo.search(/\r?\n\r?\n/);
      if (i < 0) return;
      const testa = pezzo.slice(0, i).replace(/\r?\n[ \t]+/g, ' ');
      let corpo = pezzo.slice(i).replace(/^\s+/, '');
      const n = testa.match(/(?:file)?name\*?=(?:"([^"]+)"|([^;\s]+))/i);
      if (!n) return;
      const nome = (n[1] || n[2]).replace(/^utf-8''/i, '');
      if (!/\.(xml|p7m)$/i.test(decodeURIComponent(nome))) return;
      corpo = corpo.replace(/\r?\n--\s*$/, '');
      let byte;
      if (/content-transfer-encoding:\s*base64/i.test(testa)) byte = Utilities.base64Decode(corpo.replace(/\s/g, ''));
      else {
        if (/content-transfer-encoding:\s*quoted-printable/i.test(testa)) corpo = corpo.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, function (x, h) { return String.fromCharCode(parseInt(h, 16)); });
        byte = [];
        for (let k = 0; k < corpo.length; k++) { const c = corpo.charCodeAt(k) & 255; byte.push(c > 127 ? c - 256 : c); }
      }
      fuori.push(Utilities.newBlob(byte, 'application/xml', decodeURIComponent(nome)));
    });
  });
  return fuori;
}

function risposta(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Da eseguire una volta per dare i permessi di lettura della posta
function autorizza() {
  GmailApp.getInboxThreads(0, 1);
  Logger.log('Permessi a posto.');
}

// Mostra nel registro cosa il gestionale riceverebbe
function prova() {
  const a = cercaAllegati(new Date(Date.now() - GIORNI_INDIETRO * 864e5));
  Logger.log('Allegati utili trovati: ' + a.length);
  a.forEach(function (x) { Logger.log(x.oggetto + ' | ' + x.nome + ' | ' + x.tipo); });
}
