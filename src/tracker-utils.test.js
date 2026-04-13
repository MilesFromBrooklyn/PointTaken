import { describe, it, expect } from 'vitest';
import {
  getCurrentPeriodKey,
  getPeriodEndDate,
  getDaysUntilPeriodEnd,
  isExpiringSoon,
} from './tracker-utils.js';

describe('getCurrentPeriodKey', () => {
  it('returns YYYY-MM for monthly cadence', () => {
    expect(getCurrentPeriodKey('monthly', new Date(2026, 3, 12))).toBe('2026-04');
  });

  it('zero-pads single-digit months', () => {
    expect(getCurrentPeriodKey('monthly', new Date(2026, 0, 1))).toBe('2026-01');
  });

  it('returns YYYY-H1 for semi-annual in Jan–Jun', () => {
    expect(getCurrentPeriodKey('semi-annual', new Date(2026, 3, 12))).toBe('2026-H1');
  });

  it('returns YYYY-H2 for semi-annual in Jul–Dec', () => {
    expect(getCurrentPeriodKey('semi-annual', new Date(2026, 8, 1))).toBe('2026-H2');
  });

  it('returns YYYY-Q1 for quarterly in Jan–Mar', () => {
    expect(getCurrentPeriodKey('quarterly', new Date(2026, 0, 15))).toBe('2026-Q1');
  });

  it('returns YYYY-Q2 for quarterly in Apr–Jun', () => {
    expect(getCurrentPeriodKey('quarterly', new Date(2026, 3, 12))).toBe('2026-Q2');
  });

  it('returns YYYY-Q3 for quarterly in Jul–Sep', () => {
    expect(getCurrentPeriodKey('quarterly', new Date(2026, 6, 1))).toBe('2026-Q3');
  });

  it('returns YYYY-Q4 for quarterly in Oct–Dec', () => {
    expect(getCurrentPeriodKey('quarterly', new Date(2026, 9, 1))).toBe('2026-Q4');
  });

  it('returns current year for annual when today is after anniversary', () => {
    expect(getCurrentPeriodKey('annual', new Date(2026, 3, 12), 3, 1)).toBe('2026');
  });

  it('returns previous year for annual when today is before anniversary', () => {
    expect(getCurrentPeriodKey('annual', new Date(2026, 3, 12), 6, 1)).toBe('2025');
  });

  it('returns current year when today is exactly the anniversary date', () => {
    // Today IS the anniversary — new period starts today
    expect(getCurrentPeriodKey('annual', new Date(2026, 2, 1), 3, 1)).toBe('2026');
  });

  it('throws on unknown cadence', () => {
    expect(() => getCurrentPeriodKey('biweekly', new Date())).toThrow('Unknown cadence');
  });
});

describe('getPeriodEndDate', () => {
  it('returns last day of current month for monthly', () => {
    const end = getPeriodEndDate('monthly', new Date(2026, 3, 12));
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(30);
  });

  it('returns June 30 for semi-annual H1', () => {
    const end = getPeriodEndDate('semi-annual', new Date(2026, 3, 12));
    expect(end.getMonth()).toBe(5);
    expect(end.getDate()).toBe(30);
  });

  it('returns Dec 31 for semi-annual H2', () => {
    const end = getPeriodEndDate('semi-annual', new Date(2026, 8, 1));
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });

  it('returns Mar 31 for quarterly Q1', () => {
    const end = getPeriodEndDate('quarterly', new Date(2026, 0, 15));
    expect(end.getMonth()).toBe(2);
    expect(end.getDate()).toBe(31);
  });

  it('returns Jun 30 for quarterly Q2', () => {
    const end = getPeriodEndDate('quarterly', new Date(2026, 3, 12));
    expect(end.getMonth()).toBe(5);
    expect(end.getDate()).toBe(30);
  });

  it('returns Sep 30 for quarterly Q3', () => {
    const end = getPeriodEndDate('quarterly', new Date(2026, 6, 1));
    expect(end.getMonth()).toBe(8);
    expect(end.getDate()).toBe(30);
  });

  it('returns Dec 31 for quarterly Q4', () => {
    const end = getPeriodEndDate('quarterly', new Date(2026, 9, 1));
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });

  it('returns day before next anniversary for annual', () => {
    const end = getPeriodEndDate('annual', new Date(2026, 3, 12), 3, 1);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(28);
  });
});

describe('getDaysUntilPeriodEnd', () => {
  it('returns 5 when 5 days left in month (April 25)', () => {
    expect(getDaysUntilPeriodEnd('monthly', new Date(2026, 3, 25))).toBe(5);
  });

  it('returns 1 on last day of month', () => {
    expect(getDaysUntilPeriodEnd('monthly', new Date(2026, 3, 30))).toBe(1);
  });

  it('returns correct days for annual cadence', () => {
    // Anniversary June 1, today April 12 → period ends May 31 → 49 days
    const days = getDaysUntilPeriodEnd('annual', new Date(2026, 3, 12), 6, 1);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThan(60);
  });

  it('returns 1 on exact period end date for monthly', () => {
    expect(getDaysUntilPeriodEnd('monthly', new Date(2026, 2, 31))).toBe(1); // March 31
  });
});

describe('isExpiringSoon', () => {
  it('returns true when 5 days left (within default 7-day threshold)', () => {
    expect(isExpiringSoon('monthly', new Date(2026, 3, 25))).toBe(true);
  });

  it('returns false when 15 days left', () => {
    expect(isExpiringSoon('monthly', new Date(2026, 3, 15))).toBe(false);
  });

  it('respects custom threshold', () => {
    expect(isExpiringSoon('monthly', new Date(2026, 3, 25), 1, 1, 3)).toBe(false);
    expect(isExpiringSoon('monthly', new Date(2026, 3, 28), 1, 1, 3)).toBe(true);
  });
});
