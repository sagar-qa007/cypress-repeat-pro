/// <reference types="cypress" />

describe('cypress-repeat-pro passing', () => {
  let count = 0;

  before(() => {
    cy.log('Test suite started');
  });

  it('first', () => {
    count += 1;
    cy.log(`Running first test, count: ${count}`);
    if (count === 1) {
      expect(1).to.equal(0);
    } else {
      expect(1).to.equal(1);
    }
  });

  it('second', () => {
    cy.log('Running second test');
  });
});