const request = require("supertest");
const { app } = require("../server");

describe("Teste de Integração", () => {
  test("TI-001: deve responder na rota do chat", async () => {

    const resposta = await request(app)
      .post("/chat")
      .send({
        message: "Olá agente"
      });

    expect(resposta.statusCode).toBe(200);
  });
});

test("TNF-001: resposta deve ocorrer em menos de 5 segundos", async () => {

  const inicio = Date.now();

  const resposta = await request(app)
    .post("/chat")
    .send({
      message: "Olá"
    });

  const tempo = Date.now() - inicio;

  expect(resposta.statusCode).toBe(200);
  expect(tempo).toBeLessThan(5000);
});