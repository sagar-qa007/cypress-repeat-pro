/// <reference types="cypress" />

describe('cypress-repeat', () => {
  it('first', () => {
    cy.wait(100)
  })

  it('second', () => {
    cy.wait(100)
  })



  it('has injected environment variables', () => {
    const n = Cypress.env('cypress_repeat_n') // total repeat attempts
    const k = Cypress.env('cypress_repeat_k') // current attempt, starts with 1

    expect(n, 'n').to.be.a('number').and.be.gt(0)
    expect(k, 'k').to.be.a('number').and.be.gt(0)
    expect(k, 'k <= n').to.be.lte(n)
  })
})
