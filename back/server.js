const express = require("express");
const cors = require("cors");
const { DEFAULT_CHAT_TITLE } = require("./src/config");
const {
  createConversation,
  createMessage,
  deleteConversation,
  getConversation,
  initDatabase,
  listConversations,
  listMessages,
  listMessagesByConversationIds,
  touchConversation,
  updateConversationTitle,
} = require("./src/database");
const { askGroq, SYSTEM_PROMPT } = require("./src/ai");
const {
  authMiddleware,
  loginUser,
  optionalAuthMiddleware,
  registerUser,
} = require("./src/auth");
const {
  asyncHandler,
  createHttpError,
  errorHandler,
  getConversationTitle,
  mapConversation,
  mapMessage,
  publicUser,
} = require("./src/helpers");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  }),
);

app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    res.json(await loginUser(req.body));
  }),
);

app.get(
  "/me",
  asyncHandler(authMiddleware),
  (req, res) => {
    res.json({ user: publicUser(req.user) });
  },
);

app.get(
  "/conversations",
  asyncHandler(authMiddleware),
  asyncHandler(async (req, res) => {
    const conversations = await listConversations(req.user.id);
    const messages = await listMessagesByConversationIds(
      conversations.map((conversation) => conversation.id),
    );
    const messagesByConversation = messages.reduce((acc, message) => {
      acc[message.conversation_id] ||= [];
      acc[message.conversation_id].push(mapMessage(message));
      return acc;
    }, {});

    res.json({
      conversations: conversations.map((conversation) =>
        mapConversation(conversation, messagesByConversation[conversation.id] || []),
      ),
    });
  }),
);

app.post(
  "/conversations",
  asyncHandler(authMiddleware),
  asyncHandler(async (req, res) => {
    const conversation = await createConversation(req.user.id, req.body.title);
    res.status(201).json({ conversation: mapConversation(conversation) });
  }),
);

app.patch(
  "/conversations/:id",
  asyncHandler(optionalAuthMiddleware),
  asyncHandler(async (req, res) => {
    const userId = req.user?.id || null;
    const conversation = await getConversation(userId, req.params.id);

    if (!conversation) {
      throw createHttpError(404, "Conversa nao encontrada");
    }

    const updatedConversation = await updateConversationTitle(userId, req.params.id, req.body.title);
    res.json({ conversation: mapConversation(updatedConversation) });
  }),
);

app.delete(
  "/conversations/:id",
  asyncHandler(optionalAuthMiddleware),
  asyncHandler(async (req, res) => {
    const deleted = await deleteConversation(req.user?.id || null, req.params.id);

    if (!deleted) {
      throw createHttpError(404, "Conversa nao encontrada");
    }

    res.status(204).send();
  }),
);

app.post(
  "/chat",
  asyncHandler(optionalAuthMiddleware),
  asyncHandler(async (req, res) => {
    const message = String(req.body.message || "").trim();

    if (!message) {
      throw createHttpError(400, "Mensagem vazia");
    }

    const userId = req.user?.id || null;
    const requestedConversationId = req.body.conversationId || req.body.sessionId;
    let conversation = requestedConversationId
      ? await getConversation(userId, requestedConversationId)
      : null;

    if (requestedConversationId && !conversation) {
      throw createHttpError(404, "Conversa nao encontrada");
    }

    if (!conversation) {
      conversation = await createConversation(userId, getConversationTitle(message));
    }

    const previousMessages = await listMessages(conversation.id);
    const groqMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...previousMessages.map((item) => ({
        role: item.role === "agent" ? "assistant" : "user",
        content: item.content,
      })),
      { role: "user", content: message },
    ];

    await createMessage({ conversationId: conversation.id, role: "user", content: message });

    if (!previousMessages.length && conversation.title === DEFAULT_CHAT_TITLE) {
      const generatedTitle = getConversationTitle(message);
      await updateConversationTitle(userId, conversation.id, generatedTitle);
      conversation.title = generatedTitle;
    }

    const reply = await askGroq(groqMessages);

    await createMessage({ conversationId: conversation.id, role: "agent", content: reply });
    await touchConversation(conversation.id);

    const updatedMessages = await listMessages(conversation.id);
    const updatedConversation = await getConversation(userId, conversation.id);

    res.json({
      reply,
      conversationId: conversation.id,
      sessionId: conversation.id,
      conversation: mapConversation(updatedConversation, updatedMessages.map(mapMessage)),
    });
  }),
);

app.use(errorHandler);

function getDatabaseStartupMessage(err) {
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "3306";

  if (err.code === "ECONNREFUSED" || err.code === "PROTOCOL_CONNECTION_LOST") {
    return [
      `Nao consegui conectar no MySQL em ${host}:${port}.`,
      "Verifique se o MySQL esta ligado e se DB_HOST/DB_PORT no back/.env estao corretos.",
      `Codigo do erro: ${err.code || "sem codigo"}`,
      `Erro original: ${err.message || "sem mensagem do driver"}`,
    ].join("\n");
  }

  if (err.code === "ER_ACCESS_DENIED_ERROR") {
    return [
      "Usuario ou senha do MySQL invalidos.",
      "Confira DB_USER e DB_PASSWORD no back/.env.",
      `Erro original: ${err.message}`,
    ].join("\n");
  }

  return err.message;
}

if (process.env.NODE_ENV !== "test") {
  initDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
      });
    })
    .catch((err) => {
      console.error("Erro ao iniciar banco MySQL:");
      console.error(getDatabaseStartupMessage(err));
      process.exit(1);
    });
}

module.exports = { app };
