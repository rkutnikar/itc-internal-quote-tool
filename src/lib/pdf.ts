import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import type { QuoteRecord } from "./quotes";
import type { Settings } from "./settings";

/**
 * Client-facing quotation PDF. Placeholder layout until the real template
 * arrives — every field the template needs is already rendered, so swapping
 * templates is a layout-only change (see renderQuotePdf's single entry point).
 *
 * NEVER printed here: CTC, monthly cost, margin %, resource type
 * (internal/external), customer priority. Those are internal-only.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const INK = rgb(0.1, 0.1, 0.09);
const MUTED = rgb(0.42, 0.4, 0.35);
const GREEN = rgb(0.12, 0.3, 0.23);
const RULE = rgb(0.78, 0.74, 0.66);

interface Fonts {
  serif: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
}

export async function renderQuotePdf(
  quote: QuoteRecord,
  settings: Settings
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Quotation ${quote.id}`);
  doc.setCreator("ITC Quote Tool");

  const fonts: Fonts = {
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
    sans: await doc.embedFont(StandardFonts.Helvetica),
    sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const page = doc.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;

  y = drawHeader(page, fonts, settings, quote, y);
  y = drawMetaRow(page, fonts, quote, y - 26);
  y = drawSection(page, fonts, "Client", y - 30);
  y = drawKeyValues(page, fonts, [["Customer", quote.draft.customer.name]], y - 6);
  y = drawSection(page, fonts, "Consultant Profile", y - 22);
  y = drawKeyValues(
    page,
    fonts,
    [
      ["Consultant", quote.draft.resource.name],
      ["Experience", `${quote.draft.requirement.yearsExperience} years`],
      [
        "Certification",
        quote.draft.requirement.certificationRequired
          ? quote.draft.requirement.certificationHeld
            ? "Required — held"
            : "Required — in progress"
          : "Not required",
      ],
      ["Skill profile", quote.draft.requirement.skillType],
    ],
    y - 6
  );
  y = drawSection(page, fonts, "Commercials", y - 22);
  y = drawCommercials(page, fonts, quote, settings, y - 6);
  const signatureTop = MARGIN + 118;
  y = drawSection(page, fonts, "Terms", y - 26);
  // Terms stop above the approvals block; overly long terms get truncated
  // with an ellipsis rather than colliding with signatures.
  drawParagraph(page, fonts.sans, settings.document.termsText, y - 8, 8.5, MUTED, signatureTop + 46);

  drawSignatures(page, fonts, signatureTop);
  drawFooter(page, fonts, settings, quote);

  return doc.save();
}

function money(n: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  // Standard-14 fonts are WinAnsi — no ₹ glyph; use the ISO code instead.
  return `${currency} ${formatted}`;
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  settings: Settings,
  quote: QuoteRecord,
  y: number
): number {
  const { width } = page.getSize();
  page.drawLine({
    start: { x: MARGIN, y: y + 8 },
    end: { x: width - MARGIN, y: y + 8 },
    thickness: 1.2,
    color: INK,
  });
  y -= 14;
  page.drawText(settings.document.companyName, {
    x: MARGIN,
    y,
    size: 17,
    font: fonts.serifBold,
    color: INK,
  });
  const label = "QUOTATION";
  const labelWidth = fonts.sansBold.widthOfTextAtSize(label, 11);
  page.drawText(label, {
    x: width - MARGIN - labelWidth,
    y: y + 3,
    size: 11,
    font: fonts.sansBold,
    color: GREEN,
  });
  const num = quote.id;
  const numWidth = fonts.sans.widthOfTextAtSize(num, 9);
  page.drawText(num, {
    x: width - MARGIN - numWidth,
    y: y - 9,
    size: 9,
    font: fonts.sans,
    color: MUTED,
  });
  y -= 13;
  if (settings.document.companyAddress) {
    y = drawParagraph(page, fonts.sans, settings.document.companyAddress, y, 8, MUTED) + 2;
  }
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 0.6,
    color: INK,
  });
  return y;
}

function drawMetaRow(page: PDFPage, fonts: Fonts, quote: QuoteRecord, y: number): number {
  const cols: [string, string][] = [
    ["Date", quote.createdAt.slice(0, 10)],
    ["Valid until", quote.validUntil],
    ["Prepared by", quote.draft.preparedBy],
  ];
  const colWidth = (A4.width - 2 * MARGIN) / cols.length;
  cols.forEach(([label, value], i) => {
    const x = MARGIN + i * colWidth;
    page.drawText(label.toUpperCase(), { x, y, size: 7, font: fonts.sansBold, color: MUTED });
    page.drawText(value, { x, y: y - 12, size: 10, font: fonts.serif, color: INK });
  });
  return y - 12;
}

function drawSection(page: PDFPage, fonts: Fonts, title: string, y: number): number {
  page.drawText(title.toUpperCase(), {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.sansBold,
    color: GREEN,
  });
  page.drawLine({
    start: { x: MARGIN, y: y - 4 },
    end: { x: A4.width - MARGIN, y: y - 4 },
    thickness: 0.5,
    color: RULE,
  });
  return y - 10;
}

function drawKeyValues(
  page: PDFPage,
  fonts: Fonts,
  rows: [string, string][],
  y: number
): number {
  for (const [label, value] of rows) {
    page.drawText(label, { x: MARGIN, y, size: 9, font: fonts.sans, color: MUTED });
    page.drawText(value, { x: MARGIN + 130, y, size: 10, font: fonts.serif, color: INK });
    y -= 16;
  }
  return y + 4;
}

function drawCommercials(
  page: PDFPage,
  fonts: Fonts,
  quote: QuoteRecord,
  settings: Settings,
  y: number
): number {
  const rows: [string, string][] = [
    ["Engagement duration", `${quote.draft.requirement.durationMonths} months`],
    ["Professional fee", `${money(quote.finalMonthlyRate, quote.currency)} per month`],
  ];
  if (settings.document.showDiscount && quote.sheet.discountPct > 0) {
    rows.push(["Preferred-client discount", `${quote.sheet.discountPct}% (applied)`]);
  }
  y = drawKeyValues(page, fonts, rows, y);

  // Total line, emphasized ledger-style
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: A4.width - MARGIN, y: y + 12 },
    thickness: 0.5,
    color: RULE,
  });
  page.drawText("Total contract value", {
    x: MARGIN,
    y: y - 4,
    size: 10,
    font: fonts.sansBold,
    color: INK,
  });
  const total = money(quote.totalContractValue, quote.currency);
  const totalWidth = fonts.serifBold.widthOfTextAtSize(total, 14);
  page.drawText(total, {
    x: A4.width - MARGIN - totalWidth,
    y: y - 6,
    size: 14,
    font: fonts.serifBold,
    color: GREEN,
  });
  page.drawLine({
    start: { x: MARGIN, y: y - 14 },
    end: { x: A4.width - MARGIN, y: y - 14 },
    thickness: 1,
    color: INK,
  });
  return y - 22;
}

/** Wrap text to the content width; returns the y after the last line. */
function drawParagraph(
  page: PDFPage,
  font: PDFFont,
  text: string,
  y: number,
  size: number,
  color: RGB,
  minY = 0
): number {
  const maxWidth = A4.width - 2 * MARGIN;
  const lineHeight = size * 1.45;
  const emit = (line: string): boolean => {
    if (y < minY) return false;
    const truncated = y - lineHeight < minY;
    page.drawText(truncated && line.length > 3 ? `${line} …` : line, {
      x: MARGIN,
      y,
      size,
      font,
      color,
    });
    y -= lineHeight;
    return !truncated;
  };
  outer: for (const para of text.split(/\n+/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        if (!emit(line)) break outer;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line && !emit(line)) break;
  }
  return y;
}

function drawSignatures(page: PDFPage, fonts: Fonts, y: number): number {
  const roles = ["Recruiter", "Finance Manager", "Director"];
  const gap = 24;
  const colWidth = (A4.width - 2 * MARGIN - gap * (roles.length - 1)) / roles.length;

  page.drawText("APPROVALS", {
    x: MARGIN,
    y: y + 34,
    size: 8,
    font: fonts.sansBold,
    color: GREEN,
  });
  page.drawLine({
    start: { x: MARGIN, y: y + 30 },
    end: { x: A4.width - MARGIN, y: y + 30 },
    thickness: 0.5,
    color: RULE,
  });

  roles.forEach((role, i) => {
    const x = MARGIN + i * (colWidth + gap);
    page.drawLine({
      start: { x, y },
      end: { x: x + colWidth, y },
      thickness: 0.7,
      color: INK,
    });
    page.drawText(role, { x, y: y - 12, size: 9, font: fonts.sansBold, color: INK });
    page.drawText("Name / Signature / Date", {
      x,
      y: y - 24,
      size: 7.5,
      font: fonts.sans,
      color: MUTED,
    });
  });
  return y - 30;
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  settings: Settings,
  quote: QuoteRecord
): void {
  const y = MARGIN - 14;
  page.drawLine({
    start: { x: MARGIN, y: y + 12 },
    end: { x: A4.width - MARGIN, y: y + 12 },
    thickness: 0.5,
    color: RULE,
  });
  const note =
    settings.document.footerNote ||
    `${quote.id} · Generated ${new Date().toISOString().slice(0, 10)} · ${settings.document.companyName}`;
  page.drawText(note, { x: MARGIN, y, size: 7, font: fonts.sans, color: MUTED });
}
