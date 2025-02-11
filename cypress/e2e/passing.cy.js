/// <reference types="cypress" />

// this spec is always passing
describe('cypress-repeat-pro passing', () => {
  it(`first`+ Cypress.config("baseUrl"), { tags: ['@passing'] }, () => {
    console.log("Url :::", Cypress.config("baseUrl"));
    cy.wait(100)
  })
})