function validarMensagem(msg) {
  return msg.trim().length > 0;
}

describe("Teste Unitário", () => {

  test("TU-001: mensagem vazia deve ser inválida", () => {
    expect(validarMensagem("")).toBe(false);
  });

  test("TU-002: mensagem válida deve ser aceita", () => {
    expect(validarMensagem("Olá")).toBe(true);
  });

});