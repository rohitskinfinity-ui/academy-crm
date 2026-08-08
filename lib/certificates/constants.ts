export const CERT_MIN_PROGRESS_PCT = 90;
export const CERT_FINAL_QUIZ_PASS_PERCENT = 75;
export const CERT_INSTRUCTOR_NAME = "Skinfinity Academy Faculty";

export function gradeFromPercent(percent: number): string {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  return "B+";
}

export function awardTitleFromCourse(title: string | null | undefined): string {
  const t = (title ?? "").trim();
  if (!t) return "Certificate of Completion";
  if (/^certificate\b/i.test(t)) return t;
  return `Certificate of ${t}`;
}

export function formatDurationPhrase(label: string | null | undefined): string {
  const raw = (label ?? "").trim();
  if (!raw) return "required";
  return raw.replace(/\s+/g, "-").toLowerCase();
}

export function formatCertDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
