const request = require("supertest");
const { app } = require("../server");

describe("Teste de Aceitação", () => {

  test("TA-001: sistema deve estar operacional", async () => {

    const resposta = await request(app)
      .get("/health");

    expect(resposta.statusCode).toBe(200);

  });

});