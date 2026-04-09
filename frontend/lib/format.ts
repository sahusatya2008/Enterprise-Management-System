const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatCrore(value: number) {
  return `₹${(value / 10_000_000).toFixed(2)} Cr`;
}

export function formatLakh(value: number) {
  return `₹${(value / 100_000).toFixed(2)} L`;
}
