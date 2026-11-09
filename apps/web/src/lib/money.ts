import { formatCents } from '@shop/shared';

/** Converts a user-entered dollar amount like "12.34" to integer cents. Returns null if invalid. */
export function dollarsToCents(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Formats cents in a currency given in either case ("usd" from orders, "USD" from the shop). */
export function formatMoney(cents: number, currency: string): string {
  return formatCents(cents, currency.toUpperCase());
}
