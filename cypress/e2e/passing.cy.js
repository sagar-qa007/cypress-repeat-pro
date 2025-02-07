/// <reference types="cypress" />

// this spec is always passing
describe('cypress-repeat-pro passing', () => {
  it('first', { tags: ['@passing'] }, () => {
    cy.wait(100)
  })
})