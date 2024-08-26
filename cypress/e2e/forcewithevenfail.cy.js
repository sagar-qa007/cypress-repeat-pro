/// <reference types="cypress" />

describe('cypress-repeat-pro passing', () => {
  let count = 0;

  it('first', () => {
    count += 1;

    if (count === 1) {
      expect(1).to.equal(0);
    } else {
      expect(1).to.equal(1);
    }

    cy.wait(100);
  });
});