/** Quotes a CSV field when it contains the separator, quotes or line breaks. */
export function csvField(value: string, separator = ';'): string {
  if (value.includes(separator) || /["\r\n]/.test(value) || /^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][], separator = ';'): string {
  return rows.map((row) => row.map((field) => csvField(field, separator)).join(separator)).join('\r\n');
}

/** Removes characters that are invalid in file names on Windows/macOS/Linux. */
export function safeFileName(name: string, fallback = 'run'): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 120) || fallback;
}
