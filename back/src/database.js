const mysql = require("mysql2/promise");
const { v4: uuidv4 } = require("uuid");
const { DB_NAME, DEFAULT_CHAT_TITLE, dbConfig } = require("./config");
const { normalizeTitle } = require("./helpers");

let db;
const isTest = process.env.NODE_ENV === "test";
const memory = {
  users: [],
  conversations: [],
  messages: [],
};

function now() {
  return new Date();
}

async function initMemoryDatabase() {
  memory.users = [];
  memory.conversations = [];
  memory.messages = [];
}

async function createMemoryUser({ name, email, passwordHash }) {
  if (memory.users.some((user) => user.email === email)) {
    const error = new Error("Duplicate entry");
    error.code = "ER_DUP_ENTRY";
    throw error;
  }

  const user = {
    id: uuidv4(),
    name,
    email,
    password_hash: passwordHash,
    created_at: now(),
  };

  memory.users.push(user);
  return { id: user.id, name: user.name, email: user.email };
}

async function findMemoryUserByEmail(email) {
  return memory.users.find((user) => user.email === email) || null;
}

async function findMemoryUserById(id) {
  const user = memory.users.find((item) => item.id === id);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

function matchesConversationOwner(conversation, userId) {
  return userId ? conversation.user_id === userId : conversation.user_id === null;
}

async function getMemoryConversation(userId, conversationId) {
  return (
    memory.conversations.find(
      (conversation) =>
        conversation.id === conversationId && matchesConversationOwner(conversation, userId),
    ) || null
  );
}

async function createMemoryConversation(userId = null, title = DEFAULT_CHAT_TITLE) {
  const timestamp = now();
  const conversation = {
    id: uuidv4(),
    user_id: userId || null,
    title: normalizeTitle(title),
    created_at: timestamp,
    updated_at: timestamp,
  };

  memory.conversations.push(conversation);
  return conversation;
}

async function listMemoryConversations(userId) {
  return memory.conversations
    .filter((conversation) => conversation.user_id === userId)
    .sort((a, b) => b.updated_at - a.updated_at);
}

async function updateMemoryConversationTitle(userId, conversationId, title) {
  const conversation = await getMemoryConversation(userId, conversationId);

  if (conversation) {
    conversation.title = normalizeTitle(title);
    conversation.updated_at = now();
  }

  return conversation;
}

async function deleteMemoryConversation(userId, conversationId) {
  const index = memory.conversations.findIndex(
    (conversation) =>
      conversation.id === conversationId && matchesConversationOwner(conversation, userId),
  );

  if (index === -1) {
    return false;
  }

  memory.conversations.splice(index, 1);
  memory.messages = memory.messages.filter((message) => message.conversation_id !== conversationId);
  return true;
}

async function touchMemoryConversation(conversationId) {
  const conversation = memory.conversations.find((item) => item.id === conversationId);

  if (conversation) {
    conversation.updated_at = now();
  }
}

async function createMemoryMessage({ conversationId, role, content }) {
  memory.messages.push({
    id: uuidv4(),
    conversation_id: conversationId,
    role,
    content,
    created_at: now(),
  });
}

async function listMemoryMessages(conversationId) {
  return memory.messages
    .filter((message) => message.conversation_id === conversationId)
    .sort((a, b) => a.created_at - b.created_at);
}

async function listMemoryMessagesByConversationIds(conversationIds) {
  return memory.messages
    .filter((message) => conversationIds.includes(message.conversation_id))
    .sort((a, b) => a.created_at - b.created_at);
}

if (isTest) {
  module.exports = {
    createConversation: createMemoryConversation,
    createMessage: createMemoryMessage,
    createUser: createMemoryUser,
    deleteConversation: deleteMemoryConversation,
    findUserByEmail: findMemoryUserByEmail,
    findUserById: findMemoryUserById,
    getConversation: getMemoryConversation,
    initDatabase: initMemoryDatabase,
    listConversations: listMemoryConversations,
    listMessages: listMemoryMessages,
    listMessagesByConversationIds: listMemoryMessagesByConversationIds,
    touchConversation: touchMemoryConversation,
    updateConversationTitle: updateMemoryConversationTitle,
  };
}

function ensureValidDatabaseName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("DB_NAME deve conter apenas letras, numeros e underline.");
  }
}

function getDb() {
  if (!db) {
    throw new Error("Banco de dados ainda nao foi inicializado.");
  }

  return db;
}

async function initDatabase() {
  ensureValidDatabaseName(DB_NAME);

  const admin = await mysql.createPool(dbConfig);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await admin.end();

  db = await mysql.createPool({
    ...dbConfig,
    database: DB_NAME,
  });

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(180) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NULL,
      title VARCHAR(120) NOT NULL DEFAULT '${DEFAULT_CHAT_TITLE}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_conversations_user (user_id),
      CONSTRAINT fk_conversations_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id CHAR(36) PRIMARY KEY,
      conversation_id CHAR(36) NOT NULL,
      role ENUM('user', 'agent') NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        ON DELETE CASCADE
    )
  `);
}

async function createUser({ name, email, passwordHash }) {
  const id = uuidv4();

  await getDb().query("INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)", [
    id,
    name,
    email,
    passwordHash,
  ]);

  return { id, name, email };
}

async function findUserByEmail(email) {
  const [rows] = await getDb().query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await getDb().query("SELECT id, name, email FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

async function getConversation(userId, conversationId) {
  const query = userId
    ? "SELECT * FROM conversations WHERE id = ? AND user_id = ?"
    : "SELECT * FROM conversations WHERE id = ? AND user_id IS NULL";
  const params = userId ? [conversationId, userId] : [conversationId];
  const [rows] = await getDb().query(query, params);

  return rows[0] || null;
}

async function createConversation(userId = null, title = DEFAULT_CHAT_TITLE) {
  const id = uuidv4();

  await getDb().query("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)", [
    id,
    userId || null,
    normalizeTitle(title),
  ]);

  return getConversation(userId, id);
}

async function listConversations(userId) {
  const [rows] = await getDb().query(
    "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
    [userId],
  );

  return rows;
}

async function updateConversationTitle(userId, conversationId, title) {
  const query = userId
    ? "UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?"
    : "UPDATE conversations SET title = ? WHERE id = ? AND user_id IS NULL";
  const params = userId
    ? [normalizeTitle(title), conversationId, userId]
    : [normalizeTitle(title), conversationId];

  await getDb().query(query, params);
  return getConversation(userId, conversationId);
}

async function deleteConversation(userId, conversationId) {
  const query = userId
    ? "DELETE FROM conversations WHERE id = ? AND user_id = ?"
    : "DELETE FROM conversations WHERE id = ? AND user_id IS NULL";
  const params = userId ? [conversationId, userId] : [conversationId];
  const [result] = await getDb().query(query, params);

  return result.affectedRows > 0;
}

async function touchConversation(conversationId) {
  await getDb().query("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
    conversationId,
  ]);
}

async function createMessage({ conversationId, role, content }) {
  await getDb().query("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)", [
    uuidv4(),
    conversationId,
    role,
    content,
  ]);
}

async function listMessages(conversationId) {
  const [rows] = await getDb().query(
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    [conversationId],
  );

  return rows;
}

async function listMessagesByConversationIds(conversationIds) {
  if (!conversationIds.length) {
    return [];
  }

  const [rows] = await getDb().query(
    "SELECT * FROM messages WHERE conversation_id IN (?) ORDER BY created_at ASC",
    [conversationIds],
  );

  return rows;
}

if (!isTest) {
  module.exports = {
    createConversation,
    createMessage,
    createUser,
    deleteConversation,
    findUserByEmail,
    findUserById,
    getConversation,
    initDatabase,
    listConversations,
    listMessages,
    listMessagesByConversationIds,
    touchConversation,
    updateConversationTitle,
  };
}
