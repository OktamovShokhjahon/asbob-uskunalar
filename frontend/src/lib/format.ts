/** 30000 -> "30 000" */
export function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 30000 -> "30 000 soʻm" */
export function formatSom(n: number): string {
  return `${groupDigits(n)} soʻm`;
}
