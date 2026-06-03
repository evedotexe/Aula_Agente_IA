import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

const API_URL = "http://localhost:3001";
const STORAGE_KEY = "agente-ia-conversations";

type ChatRole = "user" | "agent";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  sessionId: string | null;
  messages: ChatMessage[];
  updatedAt: number;
};

type ChatResponse = {
  sessionId: string;
  reply: string;
  conversation?: Conversation;
};

type IconName = "check" | "edit" | "plus" | "trash";

function Icon({ name }: { name: IconName }) {
  const paths = {
    check: (
      <path d="M20 6 9 17l-5-5" />
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m19 6-1 14H6L5 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function createConversation(): Conversation {
  const now = Date.now();

  return {
    id: createId(),
    title: "Nova conversa",
    sessionId: null,
    messages: [],
    updatedAt: now,
  };
}

function loadConversations() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return [createConversation()];
  }

  try {
    const conversations = JSON.parse(stored) as Conversation[];
    return conversations.length ? conversations : [createConversation()];
  } catch {
    return [createConversation()];
  }
}

function getConversationTitle(text: string) {
  const cleanText = text.trim();
  return cleanText.length > 34 ? `${cleanText.slice(0, 34)}...` : cleanText;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(timestamp);
}

function App() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConversationId, setActiveConversationId] = useState(conversations[0].id);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );

  const filteredConversations = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return conversations
      .filter((conversation) => {
        const preview = conversation.messages.at(-1)?.text ?? "";
        return `${conversation.title} ${preview}`.toLowerCase().includes(searchText);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [conversations, search]);

  const isLoading = loadingConversationId === activeConversationId;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length, isLoading]);

  const createNewConversation = () => {
    const newConversation = createConversation();

    setConversations((current) => [newConversation, ...current]);
    setActiveConversationId(newConversation.id);
    setEditingConversationId(null);
    setMessage("");
  };

  const startEditingConversation = (conversation: Conversation) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const saveConversationTitle = async (conversationId: string) => {
    const title = editingTitle.trim() || "Nova conversa";
    const conversation = conversations.find((item) => item.id === conversationId);

    setConversations((current) =>
      current.map((item) => (item.id === conversationId ? { ...item, title } : item)),
    );
    setEditingConversationId(null);
    setEditingTitle("");

    if (!conversation?.sessionId) return;

    try {
      const res = await fetch(`${API_URL}/conversations/${conversation.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        throw new Error("Erro ao editar titulo");
      }
    } catch {
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId
            ? { ...item, title: conversation.title }
            : item,
        ),
      );
    }
  };

  const deleteConversation = async (conversationId: string) => {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    const confirmed = window.confirm(`Excluir "${conversation.title}"?`);
    if (!confirmed) return;

    const nextConversations = conversations.filter((item) => item.id !== conversationId);
    const fallbackConversation = nextConversations[0] ?? createConversation();

    setConversations(nextConversations.length ? nextConversations : [fallbackConversation]);
    setActiveConversationId((current) =>
      current === conversationId ? fallbackConversation.id : current,
    );
    setEditingConversationId(null);

    if (!conversation.sessionId) return;

    try {
      const res = await fetch(`${API_URL}/conversations/${conversation.sessionId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Erro ao excluir conversa");
      }
    } catch {
      setConversations((current) =>
        current.some((item) => item.id === conversationId)
          ? current
          : [conversation, ...current],
      );
      setActiveConversationId(conversationId);
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = message.trim();
    if (!text || !activeConversation || isLoading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      text,
      createdAt: Date.now(),
    };

    const conversationId = activeConversation.id;
    const sessionId = activeConversation.sessionId;

    setMessage("");
    setLoadingConversationId(conversationId);
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              title:
                conversation.messages.length === 0
                  ? getConversationTitle(text)
                  : conversation.title,
              messages: [...conversation.messages, userMessage],
              updatedAt: userMessage.createdAt,
            }
          : conversation,
      ),
    );

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (!res.ok) {
        throw new Error("Erro ao enviar mensagem");
      }

      const data = (await res.json()) as ChatResponse;
      const agentMessage: ChatMessage = {
        id: createId(),
        role: "agent",
        text: data.reply,
        createdAt: Date.now(),
      };

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                title: data.conversation?.title ?? conversation.title,
                sessionId: data.sessionId,
                messages: [...conversation.messages, agentMessage],
                updatedAt: agentMessage.createdAt,
              }
            : conversation,
        ),
      );
    } catch {
      const errorMessage: ChatMessage = {
        id: createId(),
        role: "agent",
        text: "Nao consegui responder agora. Verifique se o backend esta rodando.",
        createdAt: Date.now(),
      };

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [...conversation.messages, errorMessage],
                updatedAt: errorMessage.createdAt,
              }
            : conversation,
        ),
      );
    } finally {
      setLoadingConversationId(null);
    }
  };

  return (
    <main className="app-shell">
      <aside className="conversation-sidebar">
        <div className="sidebar-header">
          <div>
            <span className="eyebrow">Agente IA</span>
            <h1>Conversas</h1>
          </div>
          <button
            aria-label="Nova conversa"
            className="new-chat-button"
            title="Nova conversa"
            type="button"
            onClick={createNewConversation}
          >
            <Icon name="plus" />
            <span>Nova conversa</span>
          </button>
        </div>

        <label className="search-field">
          <span>Buscar</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar conversas"
          />
        </label>

        <div className="conversation-list">
          {filteredConversations.map((conversation) => {
            const lastMessage = conversation.messages.at(-1);
            const isActive = conversation.id === activeConversationId;

            return (
              <div
                className={`conversation-item ${isActive ? "active" : ""}`}
                key={conversation.id}
              >
                {editingConversationId === conversation.id ? (
                  <form
                    className="conversation-title-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveConversationTitle(conversation.id);
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="Titulo da conversa"
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setEditingConversationId(null);
                          setEditingTitle("");
                        }
                      }}
                    />
                    <button aria-label="Salvar titulo" title="Salvar titulo" type="submit">
                      <Icon name="check" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className="conversation-select"
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                    >
                      <span className="avatar">
                        {conversation.title.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="conversation-summary">
                        <span className="conversation-title">{conversation.title}</span>
                        <span className="conversation-preview">
                          {lastMessage?.text ?? "Comece uma conversa"}
                        </span>
                      </span>
                      <span className="conversation-time">
                        {formatTime(conversation.updatedAt)}
                      </span>
                    </button>
                    <span className="conversation-actions">
                      <button
                        aria-label="Editar titulo"
                        className="conversation-action"
                        title="Editar titulo"
                        type="button"
                        onClick={() => startEditingConversation(conversation)}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        aria-label="Excluir conversa"
                        className="conversation-action danger"
                        title="Excluir conversa"
                        type="button"
                        onClick={() => void deleteConversation(conversation.id)}
                      >
                        <Icon name="trash" />
                      </button>
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <div>
            <span className="eyebrow">Historico</span>
            <h2>{activeConversation?.title ?? "Nova conversa"}</h2>
          </div>
          <span className="status-pill">Online</span>
        </header>

        <div className="messages-area">
          <div className="date-divider">
            {formatDate(activeConversation?.updatedAt ?? Date.now())}
          </div>

          {activeConversation?.messages.length ? (
            activeConversation.messages.map((chatMessage) => (
              <div
                className={`message-row ${chatMessage.role === "user" ? "sent" : "received"}`}
                key={chatMessage.id}
              >
                <div className="message-bubble">
                  <p>{chatMessage.text}</p>
                  <time>{formatTime(chatMessage.createdAt)}</time>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-chat">
              <h3>Comece uma nova conversa</h3>
              <p>Seu historico vai aparecer aqui com mensagens em azul e cinza.</p>
            </div>
          )}

          {isLoading && (
            <div className="message-row received">
              <div className="message-bubble typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Digite sua mensagem..."
          />
          <button type="submit" disabled={!message.trim() || isLoading}>
            Enviar
          </button>
        </form>
      </section>
    </main>
  );
}

export default App;
