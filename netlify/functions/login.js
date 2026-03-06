const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET;

const USERS = [
  { email: "nicola.roli@c2group.it", password: "AnalisiBandi", nome: "Nicola Roli" },
];

function base64url(str) {
  return Buffer.from(str).toString("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function creaToken(payload) {
  const header  = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body    = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now()/1000) + 28800 }));
  const firma   = crypto.createHmac("sha256", JWT_SECRET)
                        .update(`${header}.${body}`).digest("base64")
                        .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  return `${header}.${body}.${firma}`;
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { email, password } = JSON.parse(event.body);
    const user = USERS.find(
      u => u.email.toLowerCase() === (email||"").toLowerCase() && u.password === password
    );

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Credenziali non valide" }),
      };
    }

    const token = creaToken({ email: user.email, nome: user.nome });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token, nome: user.nome }),
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Richiesta non valida: " + e.message }),
    };
  }
};
