const { DEFAULT_CHAT_TITLE } = require("./config");

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.publicMessage = message;
  return error;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.publicMessage || (statusCode >= 500 ? "Erro interno do servidor" : err.message);

  console.error(err.response?.data || err.message);
  return res.status(statusCode).json({ error: message });
}

function normalizeTitle(title) {
  const cleanTitle = String(title || "").trim();
  return cleanTitle.slice(0, 120) || DEFAULT_CHAT_TITLE;
}

function getConversationTitle(text) {
  const cleanText = String(text || "").trim();
  return cleanText.length > 34 ? `${cleanText.slice(0, 34)}...` : cleanText || DEFAULT_CHAT_TITLE;
}

function toTimestamp(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function mapMessage(row) {
  return {
    id: row.id,
    role: row.role,
    text: row.content,
    createdAt: toTimestamp(row.created_at),
  };
}

function mapConversation(row, messages = []) {
  return {
    id: row.id,
    title: row.title,
    sessionId: row.id,
    messages,
    updatedAt: toTimestamp(row.updated_at),
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

module.exports = {
  asyncHandler,
  createHttpError,
  errorHandler,
  getConversationTitle,
  mapConversation,
  mapMessage,
  normalizeTitle,
  publicUser,
};
