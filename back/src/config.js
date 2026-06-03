require("dotenv").config();

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "troque-este-segredo";
const DB_NAME = process.env.DB_NAME || "agente_ia";
const DEFAULT_CHAT_TITLE = "Nova conversa";

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
};

module.exports = {
  PORT,
  JWT_SECRET,
  DB_NAME,
  DEFAULT_CHAT_TITLE,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  dbConfig,
};
