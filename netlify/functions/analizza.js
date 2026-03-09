const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "c2group-analizzatore-secret-2026";

// Utenti hardcoded (lato server — non esposti al frontend)
const USERS = [
  { email: "nicola.roli@c2group.it", password: "AnalisiBandi", nome: "Nicola Roli" },
];

function creaToken(payload, secret, expiresInSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, { iat: now, exp: now + expiresInSeconds });

  const h = Buffer.from(JSON.stringify(header)).toString("base64url");
  const b = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(h + "." + b)
    .digest("base64url");

  return h + "." + b + "." + signature;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { email, password } = JSON.parse(event.body);
    const user = USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!user) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Credenziali non valide" }),
      };
    }

    const token = creaToken(
      { email: user.email, nome: user.nome },
      JWT_SECRET,
      8 * 60 * 60  // 8 ore
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, nome: user.nome }),
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Richiesta non valida" }),
    };
  }
};
