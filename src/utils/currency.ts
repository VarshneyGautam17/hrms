// Money is always stored and computed as integer paise. These helpers are the
// only place rupee/paise conversion should happen.

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatPaiseAsINR(paise: number): string {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function parseRupeeInputToPaise(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  const value = parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return rupeesToPaise(value);
}
