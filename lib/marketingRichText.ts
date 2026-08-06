/** Helpers for programme marketing rich-text fields (HTML in / plain lists out). */

export function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Load a list field into TipTap HTML (supports legacy string[] and HTML string). */
export function listFieldToEditorHtml(
  value: string | string[] | null | undefined,
): string {
  if (value == null) return "";
  if (typeof value === "string") {
    if (!value.trim()) return "";
    return looksLikeHtml(value) ? value : linesToListHtml(value);
  }
  if (!value.length) return "";
  if (value.length === 1 && looksLikeHtml(value[0])) return value[0];
  return `<ul>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function linesToListHtml(text: string) {
  const lines = text
    .split("\n")
    .map((s) => s.trim().replace(/^[-•✔]\s*/, ""))
    .filter(Boolean);
  if (!lines.length) return "";
  if (lines.length === 1 && !looksLikeHtml(lines[0])) {
    return `<p>${escapeHtml(lines[0])}</p>`;
  }
  return `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
}

export function introToEditorHtml(value: string | null | undefined) {
  if (!value?.trim()) return "";
  if (looksLikeHtml(value)) return value;
  return value
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Convert training groups into editor HTML (legacy structured → HTML). */
export function trainingGroupsToEditorHtml(
  groups: Array<{ title: string; items: string[] }> | null | undefined,
  html?: string | null,
) {
  if (html?.trim()) return html;
  if (!groups?.length) return "";
  return groups
    .map((g) => {
      const title = escapeHtml(g.title);
      const items = (g.items ?? [])
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      return `<h3>${title}</h3>${items ? `<ul>${items}</ul>` : ""}`;
    })
    .join("");
}

export function isEmptyRichText(html: string | null | undefined) {
  if (!html?.trim()) return true;
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}
