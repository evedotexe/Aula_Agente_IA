const axios = require("axios");
const { GROQ_API_KEY } = require("./config");
const { createHttpError } = require("./helpers");

const MODEL = "llama-3.1-8b-instant";

const SYSTEM_PROMPT = `
Voce e um Agente de IA inteligente.

Voce pode:
- Conversar naturalmente
- Usar ferramentas quando necessario

TOOLS DISPONIVEIS:
1. getTime -> retorna horario atual
2. calculate(expression) -> faz calculos

Quando precisar usar uma ferramenta, responda no formato:
TOOL: nome_da_tool | argumento

Exemplo:
TOOL: calculate | 2+2

Caso contrario, responda normalmente.
`;

const tools = {
  getTime: () => new Date().toLocaleString("pt-BR"),

  calculate: (expression = "") => {
    try {
      if (!/^[\d\s+\-*/().,%]+$/.test(expression)) {
        return "Expressao invalida";
      }

      return Function(`"use strict"; return (${expression.replaceAll(",", ".")})`)().toString();
    } catch {
      return "Erro ao calcular";
    }
  },
};

function resolveToolResponse(reply = "") {
  if (!reply.startsWith("TOOL:")) {
    return reply;
  }

  const [, rest] = reply.split("TOOL:");
  const [toolName, arg] = rest.split("|").map((item) => item.trim());

  return tools[toolName] ? `Resultado: ${tools[toolName](arg)}` : "Tool nao encontrada";
}

async function askGroq(messages) {
  if (process.env.NODE_ENV === "test") {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    return `Resposta de teste: ${lastUserMessage?.content || ""}`;
  }

  if (!GROQ_API_KEY) {
    throw createHttpError(500, "GROQ_API_KEY nao configurada");
  }

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: MODEL,
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  return resolveToolResponse(response.data.choices[0].message.content);
}

module.exports = {
  MODEL,
  SYSTEM_PROMPT,
  askGroq,
};
