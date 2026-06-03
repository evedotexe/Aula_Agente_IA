describe("E2E - Chat IA", () => {

  it("E2E-001: usuário envia mensagem e recebe resposta", () => {

    cy.visit("http://localhost:5173");

    cy.get("input").eq(1).type("Olá agente");

    cy.contains("Enviar")
      .click();

    cy.contains("Olá agente");

    cy.get("body")
      .should("contain.text", "Olá agente");

  });

});