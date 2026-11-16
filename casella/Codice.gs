/**
 * Casella delle fatture del Repub → Gestionale Repub
 *
 * Questo programmino gira nell'account Gmail creato solo per le fatture.
 * Il gestionale lo interroga e si prende gli allegati delle email:
 * fatture elettroniche (.xml, .xml.p7m, anche dentro uno .zip), foto e PDF.
 *
 * 1. Cambia la parola segreta qui sotto (la stessa va scritta nel gestionale).
 * 2. Esegui una volta la funzione «autorizza» e dai i permessi.
 * 3. Distribuisci → Nuova distribuzione → App web → Esegui come: Me → Accesso: Chiunque.
 * 4. Copia l'indirizzo dell'app web nel gestionale (Altro › Impostazioni › Casella delle fatture).
 */
const PAROLA_SEGRETA = 'cambiami-repub';
const GIORNI_INDIETRO = 60;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.chiave !== PAROLA_SEGRETA) return risposta({ errore: 'Parola segreta sbagliata.' });
  const dal = p.dal ? new Date(p.dal) : new Date(Date.now() - GIORNI_INDIETRO * 864e5);
  const giorno = Utilities.formatDate(new Date(dal.getTime() - 864e5), 'Europe/Rome', 'yyyy/MM/dd');
  const discussioni = GmailApp.search('has:attachment after:' + giorno, 0, 100);
  const allegati = [];
  discussioni.forEach(function (t) {
    t.getMessages().forEach(function (m) {
      if (m.getDate() < dal) return;
      const lista = [];
      m.getAttachments({ includeInlineImages: false }).forEach(function (a) {
        if (/\.zip$/i.test(a.getName()) || a.getContentType() === 'application/zip') {
          try { Utilities.unzip(a.copyBlob().setContentType('application/zip')).forEach(function (b) { lista.push(b); }); } catch (err) { /* zip illeggibile */ }
        } else lista.push(a.copyBlob());
      });
      const haXml = lista.some(function (b) { return /\.(xml|p7m)$/i.test(b.getName()); });
      lista.forEach(function (b) {
        const nome = b.getName() || 'allegato';
        const tipo = b.getContentType() || '';
        const xml = /\.(xml|p7m)$/i.test(nome);
        const foto = /^image\//.test(tipo) || tipo === 'application/pdf' || /\.pdf$/i.test(nome);
        if (!xml && !foto) return;
        if (foto && haXml) return; // il PDF di cortesia accanto alla fattura elettronica non serve
        const byte = b.getBytes();
        if (byte.length > 8 * 1024 * 1024) return;
        allegati.push({
          id: m.getId() + '|' + nome, nome: nome, tipo: xml ? 'xml' : (tipo === 'application/pdf' || /\.pdf$/i.test(nome) ? 'application/pdf' : tipo),
          data: m.getDate().toISOString(), mittente: m.getFrom(), oggetto: m.getSubject(),
          base64: Utilities.base64Encode(byte)
        });
      });
    });
  });
  return risposta({ allegati: allegati, controllo: new Date().toISOString() });
}

function risposta(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Da eseguire una volta per dare i permessi di lettura della posta
function autorizza() {
  GmailApp.getInboxThreads(0, 1);
  Logger.log('Permessi a posto.');
}
