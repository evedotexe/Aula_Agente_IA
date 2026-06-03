const request = require("supertest");
const { app } = require("../server");

describe("Teste Não Funcional", () => {

  test("TNF-001: health deve responder em menos de 1 segundo", async () => {

    const inicio = Date.now();

    const resposta = await request(app).get("/health");

    const tempo = Date.now() - inicio;

    expect(resposta.statusCode).toBe(200);
    expect(tempo).toBeLessThan(1000);

  });

});