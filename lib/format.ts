/** Money, in one place. Two implementations of this drift by a decimal point. */
export function money(amount: number, currency: string, cents = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents ? 2 : 0,
  }).format(amount / 100);
}
