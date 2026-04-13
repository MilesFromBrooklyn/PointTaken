import { describe, it, expect } from 'vitest';
import { CARDS } from './cards.js';

const VALID_CADENCES = ['monthly', 'semi-annual', 'annual', 'quarterly', 'excluded'];

describe('CARDS data integrity', () => {
  it('every card has an id, name, and issuer', () => {
    for (const card of CARDS) {
      expect(card.id, `card missing id`).toBeTruthy();
      expect(card.name, `${card.id} missing name`).toBeTruthy();
      expect(card.issuer, `${card.id} missing issuer`).toBeTruthy();
    }
  });

  it('every benefit has a valid cadence field', () => {
    for (const card of CARDS) {
      for (const benefit of card.credits) {
        expect(
          VALID_CADENCES,
          `${card.id} → "${benefit.name}" has invalid cadence: "${benefit.cadence}"`
        ).toContain(benefit.cadence);
      }
    }
  });

  it('every benefit has a name and numeric value', () => {
    for (const card of CARDS) {
      for (const benefit of card.credits) {
        expect(benefit.name, `${card.id} benefit missing name`).toBeTruthy();
        expect(typeof benefit.value, `${card.id} → "${benefit.name}" value must be number`).toBe('number');
      }
    }
  });
});
