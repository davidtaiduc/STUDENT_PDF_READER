/** Conservative cleanup: preserve paragraph breaks and in-word hyphens. */
export function normalizePdfSelection(text: string): string {
  return text.normalize("NFC")
    .replace(/\r\n?/g, "\n")
    // PDF extraction can emit these controls; tabs and newlines remain meaningful.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\uFEFF]/g, "")
    .replace(/\u00AD\s*\n\s*/g, "")
    .replace(/\u00AD/g, "")
    .replace(/(\p{L})-[\t ]*\n[\t ]*(?=\p{Ll})/gu, "$1")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([^\n])\n(?=[^\n])/g, "$1 ")
    .trim();
}
