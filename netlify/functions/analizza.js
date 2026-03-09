const pdf = require("pdf-parse");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "c2group-analizzatore-secret-2026";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-5";

// Identici al prompt Python
const SYSTEM_PROMPT = `Sei un esperto analista di appalti pubblici italiani.
Analizza il Disciplinare di Gara fornito ed estrai esattamente i seguenti 23 campi in formato JSON.
Per ogni campo non trovato nel documento, usa esattamente la stringa "Non specificato nel documento".
Rispondi SOLO con il JSON, senza testo aggiuntivo, senza markdown, senza backtick.

Campi richiesti:
{
  "nome_scuola_meccanografico": "Nome completo dell'ente + codice meccanografico (es. ITC Marconi — PETD03000D) o codice fiscale per altri enti",
  "stazione_appaltante": "Nome della stazione appaltante se diversa dall'ente",
  "oggetto_gara": "Descrizione sintetica dell'oggetto della gara",
  "cup_codice_progetto": "Codice CUP o codice progetto PNRR/PNC (es. B67H23000420006)",
  "numero_lotti": "Numero di lotti in cui è suddivisa la gara (es. 1, 3, 'Lotto unico')",
  "importo_totale": "Importo totale a base d'asta in euro (es. 150.000,00 €)",
  "importo_per_lotto": "Importo per singolo lotto se suddivisa (es. Lotto 1: 50.000 €, Lotto 2: 100.000 €)",
  "procedura": "Tipo di procedura (es. RDO MePA, Procedura aperta, Affidamento diretto)",
  "criterio_aggiudicazione": "Criterio di aggiudicazione (es. Minor prezzo, OEPV)",
  "inizio_procedura": "Data di pubblicazione o avvio procedura (gg/mm/aaaa)",
  "scadenza_offerta": "Data e ora limite per presentazione offerta (es. 15/03/2026 ore 12:00)",
  "sopralluogo": "Sopralluogo obbligatorio: sì/no, e data se disponibile",
  "garanzia_minima_obbligatoria": "Garanzia provvisoria minima obbligatoria richiesta (importo o percentuale)",
  "garanzia_criterio_premiale": "Garanzia come criterio premiale/punteggio aggiuntivo se previsto",
  "fatturato_minimo": "Fatturato minimo richiesto (es. 200.000 € negli ultimi 3 anni)",
  "esperienze_pregresse": "Esperienze o forniture pregresse richieste come requisito",
  "certificazioni": "Certificazioni richieste (es. ISO 9001, CAM, altro)",
  "categorie_prodotti": "Categorie merceologiche o CPV dei prodotti/servizi richiesti",
  "marche_specifiche": "Marche o modelli specifici citati (es. Google Workspace, Lenovo, Apple)",
  "subappalto": "Subappalto ammesso: sì/no e condizioni",
  "varianti": "Varianti ammesse: sì/no",
  "penali": "Penali previste per inadempimento (importo o percentuale)",
  "note_aggiuntive": "Altre informazioni rilevanti non coperte dai campi precedenti"
}`;

const CHUNK_SIZE = 35_000;
const NOT_FOUND = "Non specificato nel documento";

function verificaToken(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const parts = auth.slice(7).split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    // Verifica scadenza
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Verifica firma HMAC-SHA256
    const signInput = parts[0] + "." + parts[1];
    const expected = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(signInput)
      .digest("base64url");
    if (expected !== parts[2]) return null;

    return payload;
  } catch {
    return null;
  }
}

async function chiamaApi(testo, blocco, totale) {
  const contesto = totale > 1
    ? `[Blocco ${blocco}/${totale} del documento. Estrai solo le info presenti in questo blocco.]\n\n`
    : "";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Analizza il seguente Disciplinare di Gara:\n\n${contesto}${testo}` }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API Claude errore ${response.status}: ${errBody}`);
  }

  const result = await response.json();
  let raw = result.content[0].text.trim();
  raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(raw);
}

function unisciRisultati(lista) {
  const campi = [
    "nome_scuola_meccanografico", "stazione_appaltante", "oggetto_gara",
    "cup_codice_progetto", "numero_lotti", "importo_totale", "importo_per_lotto",
    "procedura", "criterio_aggiudicazione", "inizio_procedura", "scadenza_offerta",
    "sopralluogo", "garanzia_minima_obbligatoria", "garanzia_criterio_premiale",
    "fatturato_minimo", "esperienze_pregresse", "certificazioni", "categorie_prodotti",
    "marche_specifiche", "subappalto", "varianti", "penali", "note_aggiuntive"
  ];
  const risultato = {};
  for (const key of campi) {
    for (const dati of lista) {
      const val = dati[key];
      if (val && val !== NOT_FOUND) { risultato[key] = val; break; }
    }
    if (!risultato[key]) risultato[key] = NOT_FOUND;
  }
  return risultato;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Verifica autenticazione
  const utente = verificaToken(event);
  if (!utente) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Non autorizzato" }),
    };
  }

  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API key non configurata" }),
    };
  }

  try {
    // Il frontend invia il PDF come base64
    const body = JSON.parse(event.body);
    const pdfBuffer = Buffer.from(body.pdf_base64, "base64");

    // Estrai testo dal PDF
    const pdfData = await pdf(pdfBuffer);
    const testo = pdfData.text;

    if (!testo || testo.trim().length < 200) {
      return {
        statusCode: 422,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "PDF non leggibile o testo troppo breve. Verificare che non sia scansionato." }),
      };
    }

    // Suddividi in blocchi se necessario
    let blocchi = [];
    if (testo.length <= CHUNK_SIZE) {
      blocchi = [testo];
    } else {
      let inizio = 0;
      while (inizio < testo.length) {
        let fine = inizio + CHUNK_SIZE;
        if (fine < testo.length) {
          const finePara = testo.lastIndexOf("\n", fine);
          if (finePara > inizio + CHUNK_SIZE / 2) fine = finePara;
        }
        blocchi.push(testo.slice(inizio, fine));
        inizio = fine;
      }
    }

    // Analizza ogni blocco (con pausa tra blocchi multipli)
    const risultati = [];
    for (let i = 0; i < blocchi.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 70000));
      const dati = await chiamaApi(blocchi[i], i + 1, blocchi.length);
      risultati.push(dati);
    }

    const datiFinal = blocchi.length > 1 ? unisciRisultati(risultati) : risultati[0];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dati: datiFinal,
        pagine: pdfData.numpages,
        caratteri: testo.length,
        blocchi: blocchi.length,
      }),
    };
  } catch (e) {
    console.error("Errore analisi:", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Errore durante l'analisi: ${e.message}` }),
    };
  }
};
