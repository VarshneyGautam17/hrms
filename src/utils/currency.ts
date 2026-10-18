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

/**
 * "Rs. 10,000.00" — for PDFs. jsPDF's built-in fonts have no ₹ glyph and
 * print a garbage character in its place, so the PDF must not use
 * formatPaiseAsINR.
 */
export function formatPaiseAsRs(paise: number): string {
  const amount = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Math.abs(paiseToRupees(paise)),
  );
  return `${paise < 0 ? '-' : ''}Rs. ${amount}`;
}

export function parseRupeeInputToPaise(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  const value = parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return rupeesToPaise(value);
}
