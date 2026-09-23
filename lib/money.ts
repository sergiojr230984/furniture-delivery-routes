export function formatMoney(amount: number | string, currency = "USD"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);
}

export function formatMiles(mi: number): string {
  return `${mi.toFixed(1)} mi`;
}

export function formatLbs(lbs: number): string {
  return `${lbs.toLocaleString("en-US")} lbs`;
}

export function formatInches(inches: number): string {
  return `${inches}"`;
}
