const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "c2group-analizzatore-secret-2026";

// Utenti hardcoded (lato server — non esposti al frontend)
const USERS = [
  { email: "nicola.roli@c2group.it", password: "AnalisiBandi", nome: "Nicola Roli" },
];

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

    const token = jwt.sign(
      { email: user.email, nome: user.nome },
      JWT_SECRET,
      { expiresIn: "8h" }
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
