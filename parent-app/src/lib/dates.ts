import type { DateRange } from '../api/types';

/**
 * Validates that a string is a strictly well-formed YYYY-MM-DD calendar date.
 *
 * Checks:
 * - Format matches exactly /^\d{4}-\d{2}-\d{2}$/
 * - Month is between 01 and 12
 * - Day is valid for the given month and year (accounts for leap years)
 *
 * Requirements: 4.4
 */
export function isValidDateFormat(value: string): boolean {
  // Strict format check: exactly YYYY-MM-DD with numeric segments
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(value)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Month must be 1–12
  if (month < 1 || month > 12) {
    return false;
  }

  // Day must be 1 to max days in that month
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) {
    return false;
  }

  return true;
}

/**
 * Validates that a DateRange has both dates in valid YYYY-MM-DD format
 * and that end_date >= start_date.
 *
 * Requirements: 4.6, 7.2
 */
export function isValidRange(range: DateRange): boolean {
  if (!isValidDateFormat(range.start_date) || !isValidDateFormat(range.end_date)) {
    return false;
  }

  // Lexicographic comparison works for YYYY-MM-DD format
  return range.end_date >= range.start_date;
}

/**
 * Returns the number of days in a given month of a given year.
 * Accounts for leap years.
 */
function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12:
      return 31;
    case 4: case 6: case 9: case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Determines whether a year is a leap year.
 * A year is a leap year if divisible by 4, except centuries unless also divisible by 400.
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
