import fs from "fs";
import path from "path";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
  degrees,
} from "pdf-lib";
import {
  awardTitleFromCourse,
  formatCertDate,
  formatDurationPhrase,
} from "./constants";

const TEAL = rgb(0x2a / 255, 0x7e / 255, 0x88 / 255);
const GOLD = rgb(0xd4 / 255, 0xaf / 255, 0x37 / 255);
const RED = rgb(0.86, 0.1, 0.12);
const RED_INNER = rgb(0.92, 0.16, 0.14);
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.25, 0.25, 0.25);
const IEB_BLUE = rgb(0.1, 0.22, 0.55);
const IEB_GOLD = rgb(0.78, 0.62, 0.18);

export type CertificatePdfInput = {
  recipientName: string;
  courseTitle: string;
  durationLabel?: string | null;
  issuedAt: Date | string;
  certificateCode?: string | null;
  watermark?: string | null;
};

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
) {
  const width = page.getWidth();
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (width - tw) / 2,
    y,
    size,
    font,
    color,
  });
  return tw;
}

function drawCornerStripes(page: PDFPage) {
  const w = page.getWidth();
  const h = page.getHeight();
  const s = 168;

  page.drawSvgPath(`M 0 ${h} L ${s} ${h} L 0 ${h - s} Z`, { color: TEAL });
  page.drawSvgPath(
    `M 0 ${h - s * 0.48} L ${s * 0.48} ${h} L ${s * 0.62} ${h} L 0 ${h - s * 0.62} Z`,
    { color: GOLD },
  );
  page.drawSvgPath(
    `M 0 ${h - s * 0.62} L ${s * 0.62} ${h} L ${s * 0.74} ${h} L 0 ${h - s * 0.74} Z`,
    { color: TEAL },
  );

  page.drawSvgPath(`M ${w} 0 L ${w - s} 0 L ${w} ${s} Z`, { color: TEAL });
  page.drawSvgPath(
    `M ${w} ${s * 0.48} L ${w - s * 0.48} 0 L ${w - s * 0.62} 0 L ${w} ${s * 0.62} Z`,
    { color: GOLD },
  );
  page.drawSvgPath(
    `M ${w} ${s * 0.62} L ${w - s * 0.62} 0 L ${w - s * 0.74} 0 L ${w} ${s * 0.74} Z`,
    { color: TEAL },
  );
}

function drawWaxSeal(page: PDFPage, cx: number, cy: number, r: number) {
  const spikes = 44;
  let d = "";
  for (let i = 0; i < spikes; i++) {
    const angle = (i / spikes) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.78;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    d += `${i === 0 ? "M" : " L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  d += " Z";
  page.drawSvgPath(d, { color: RED });
  page.drawCircle({ x: cx, y: cy, size: r * 0.52, color: RED_INNER });
}

function drawIebLogo(page: PDFPage, font: PDFFont, bold: PDFFont, cx: number, cy: number) {
  page.drawCircle({ x: cx, y: cy, size: 28, color: IEB_BLUE });
  page.drawCircle({ x: cx, y: cy, size: 24, color: rgb(1, 1, 1) });
  page.drawCircle({ x: cx, y: cy, size: 22, borderColor: IEB_GOLD, borderWidth: 1.5 });
  const ieb = "IEB";
  const size = 11;
  page.drawText(ieb, {
    x: cx - bold.widthOfTextAtSize(ieb, size) / 2,
    y: cy - 4,
    size,
    font: bold,
    color: IEB_BLUE,
  });
  const caption = "International Education Board";
  page.drawText(caption, {
    x: cx + 34,
    y: cy + 4,
    size: 7,
    font,
    color: MUTED,
  });
}

function drawDmhca(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, y: number) {
  page.drawRectangle({
    x,
    y: y - 2,
    width: 12,
    height: 12,
    color: RED,
  });
  page.drawRectangle({
    x: x + 4,
    y: y - 6,
    width: 4,
    height: 20,
    color: RED,
  });
  page.drawText("DMHCA", {
    x: x + 18,
    y: y + 4,
    size: 11,
    font: bold,
    color: IEB_BLUE,
  });
  page.drawText("Unit of New Delhi Medical Healthcare Pvt Ltd", {
    x: x + 18,
    y: y - 8,
    size: 6.5,
    font,
    color: MUTED,
  });
}

async function embedAcademyLogo(doc: PDFDocument) {
  const logoPath = path.join(process.cwd(), "public", "academy-logo.png");
  if (!fs.existsSync(logoPath)) return null;
  const bytes = fs.readFileSync(logoPath);
  try {
    return await doc.embedPng(bytes);
  } catch {
    try {
      return await doc.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

export async function renderCertificatePdf(
  input: CertificatePdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const w = page.getWidth();
  const h = page.getHeight();

  page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(1, 1, 1) });
  drawCornerStripes(page);

  const logo = await embedAcademyLogo(doc);
  if (logo) {
    const logoW = 118;
    const logoH = (logo.height / logo.width) * logoW;
    page.drawImage(logo, {
      x: (w - logoW) / 2,
      y: h - 196,
      width: logoW,
      height: logoH,
    });
  } else {
    page.drawCircle({
      x: w / 2,
      y: h - 145,
      size: 48,
      borderColor: TEAL,
      borderWidth: 2,
    });
    drawCentered(page, "SKINFINITY ACADEMY", h - 150, bold, 9, TEAL);
  }

  drawCentered(page, "The Certificate is Presented to", h - 250, font, 13, INK);

  const name = (input.recipientName || "Student").trim();
  const nameSize = name.length > 28 ? 20 : 24;
  const nameWidth = drawCentered(page, name, h - 292, bold, nameSize, INK);
  page.drawLine({
    start: { x: (w - Math.max(nameWidth, 220)) / 2, y: h - 300 },
    end: { x: (w + Math.max(nameWidth, 220)) / 2, y: h - 300 },
    thickness: 0.8,
    color: INK,
  });

  const duration = formatDurationPhrase(input.durationLabel);
  const body =
    `having successfully completed the necessary ${duration} course of study and clinical workshop, is hereby awarded the`;
  const bodyLines = wrapText(body, font, 11.5, 420);
  let bodyY = h - 340;
  for (const line of bodyLines) {
    drawCentered(page, line, bodyY, font, 11.5, MUTED);
    bodyY -= 16;
  }

  const award = awardTitleFromCourse(input.courseTitle);
  const awardLines = wrapText(award, bold, 15, 440);
  let awardY = bodyY - 18;
  for (const line of awardLines) {
    drawCentered(page, line, awardY, bold, 15, INK);
    awardY -= 20;
  }

  if (input.certificateCode) {
    drawCentered(
      page,
      `Certificate ID: ${input.certificateCode}`,
      awardY - 8,
      font,
      9,
      TEAL,
    );
  }

  const footerY = 118;
  const dateLabel = `Date: ${formatCertDate(input.issuedAt)}`;
  page.drawText(dateLabel, {
    x: 56,
    y: footerY + 78,
    size: 11,
    font: bold,
    color: INK,
  });

  drawIebLogo(page, font, bold, 78, footerY + 36);
  drawDmhca(page, font, bold, 56, footerY - 8);

  drawWaxSeal(page, w / 2, footerY + 28, 34);

  const sigX = w - 210;
  page.drawLine({
    start: { x: sigX, y: footerY + 42 },
    end: { x: w - 56, y: footerY + 42 },
    thickness: 0.8,
    color: INK,
  });
  page.drawText("Authorised Signatory", {
    x: sigX + 18,
    y: footerY + 26,
    size: 9,
    font: italic,
    color: INK,
  });
  page.drawText("Skinfinity Academy of Cosmetology", {
    x: sigX,
    y: footerY + 12,
    size: 8.5,
    font,
    color: MUTED,
  });

  if (input.watermark) {
    page.drawText(input.watermark, {
      x: 90,
      y: h / 2 - 20,
      size: 36,
      font: bold,
      color: rgb(0.75, 0.75, 0.75),
      rotate: degrees(32),
      opacity: 0.28,
    });
  }

  return doc.save();
}
