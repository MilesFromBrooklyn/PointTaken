/**
 * Returns the period key string for a benefit based on its cadence.
 * @param {'monthly'|'semi-annual'|'quarterly'|'annual'} cadence
 * @param {Date} today
 * @param {number} anniversaryMonth  1–12 (only used for 'annual')
 * @param {number} anniversaryDay    1–28 (only used for 'annual')
 * @returns {string}  e.g. '2026-04', '2026-H1', '2026-Q2', '2026'
 */
export function getCurrentPeriodKey(cadence, today = new Date(), anniversaryMonth = 1, anniversaryDay = 1) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-based

  // Clamp anniversaryDay to 1–28 to prevent month overflow in Date constructor
  if (cadence === 'annual') {
    anniversaryDay = Math.min(28, Math.max(1, anniversaryDay));
  }

  if (cadence === 'monthly') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  if (cadence === 'semi-annual') {
    return month <= 6 ? `${year}-H1` : `${year}-H2`;
  }

  if (cadence === 'quarterly') {
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  }

  if (cadence === 'annual') {
    const thisYearAnniversary = new Date(year, anniversaryMonth - 1, anniversaryDay);
    return today < thisYearAnniversary ? `${year - 1}` : `${year}`;
  }

  throw new Error(`Unknown cadence: ${cadence}`);
}

/**
 * Returns the last Date of the current period.
 * @param {'monthly'|'semi-annual'|'quarterly'|'annual'} cadence
 * @param {Date} today
 * @param {number} anniversaryMonth
 * @param {number} anniversaryDay    1–28 (clamped)
 * @returns {Date}
 */
export function getPeriodEndDate(cadence, today = new Date(), anniversaryMonth = 1, anniversaryDay = 1) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  // Clamp anniversaryDay to 1–28 to prevent month overflow in Date constructor
  if (cadence === 'annual') {
    anniversaryDay = Math.min(28, Math.max(1, anniversaryDay));
  }

  if (cadence === 'monthly') {
    return new Date(year, month, 0); // day 0 of next month = last day of current month
  }

  if (cadence === 'semi-annual') {
    return month <= 6
      ? new Date(year, 5, 30)   // June 30
      : new Date(year, 11, 31); // Dec 31
  }

  if (cadence === 'quarterly') {
    // Q1=Mar31, Q2=Jun30, Q3=Sep30, Q4=Dec31
    const quarterEndMonth = Math.ceil(month / 3) * 3; // 3, 6, 9, or 12
    return new Date(year, quarterEndMonth, 0); // day 0 of month after quarter end
  }

  if (cadence === 'annual') {
    const thisYearAnniversary = new Date(year, anniversaryMonth - 1, anniversaryDay);
    if (today < thisYearAnniversary) {
      return new Date(year, anniversaryMonth - 1, anniversaryDay - 1);
    }
    return new Date(year + 1, anniversaryMonth - 1, anniversaryDay - 1);
  }

  throw new Error(`Unknown cadence: ${cadence}`);
}

/**
 * Returns whole days remaining until the current period ends.
 * When today is the last day, returns 1. When future days remain, returns count of future days.
 */
export function getDaysUntilPeriodEnd(cadence, today = new Date(), anniversaryMonth = 1, anniversaryDay = 1) {
  const endDate = getPeriodEndDate(cadence, today, anniversaryMonth, anniversaryDay);

  // Normalize both dates to start of day for fair comparison
  const todayStartOfDay = new Date(today);
  todayStartOfDay.setHours(0, 0, 0, 0);

  const endStartOfDay = new Date(endDate);
  endStartOfDay.setHours(0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysDiff = (endStartOfDay - todayStartOfDay) / msPerDay;

  // If same day or very close, return 1 (last day remaining)
  // Otherwise return the full difference rounded
  return Math.max(1, Math.round(daysDiff));
}

/**
 * Returns true if the current period ends within thresholdDays.
 */
export function isExpiringSoon(cadence, today = new Date(), anniversaryMonth = 1, anniversaryDay = 1, thresholdDays = 7) {
  return getDaysUntilPeriodEnd(cadence, today, anniversaryMonth, anniversaryDay) <= thresholdDays;
}
