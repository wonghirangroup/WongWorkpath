// Minimal from-scratch CSV builder — no library in this project handles it. Quotes any field
// containing a comma, quote, or newline (doubling embedded quotes, the standard CSV escape),
// so Thai text and free-form descriptions with commas/newlines still round-trip correctly.
function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  return lines.join('\r\n');
}

// Prefixed with a UTF-8 BOM so Excel (the most common opener) detects the encoding correctly
// instead of mangling Thai text into mojibake.
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
