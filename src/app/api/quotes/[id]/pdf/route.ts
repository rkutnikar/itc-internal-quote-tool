import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getQuote } from "@/lib/quotes";
import { renderQuotePdf } from "@/lib/pdf";
import { loadSettings } from "@/lib/settings";
import { getList, uploadFile } from "@/lib/frappe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  const { id } = await params;
  const quote = await getQuote(id);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const settings = await loadSettings();
  const pdf = await renderQuotePdf(quote, settings);
  const fileName = `${quote.id}.pdf`;

  // Best-effort: attach to the Frappe record on first download so the PDF
  // lives with the quote in Frappe too. Never blocks the download.
  if (quote.storage === "frappe") {
    attachIfMissing(fileName, pdf, quote.id).catch((err) => {
      console.warn(
        `Could not attach ${fileName} to Frappe quote ${quote.id}:`,
        err instanceof Error ? err.message : err
      );
    });
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function attachIfMissing(
  fileName: string,
  pdf: Uint8Array,
  quoteId: string
): Promise<void> {
  const existing = await getList("File", {
    fields: ["name"],
    filters: [
      ["attached_to_doctype", "=", "Consultant Quote"],
      ["attached_to_name", "=", quoteId],
      ["file_name", "=", fileName],
    ],
    limit: 1,
  });
  if (existing.length > 0) return;
  await uploadFile({
    fileName,
    content: pdf,
    mimeType: "application/pdf",
    doctype: "Consultant Quote",
    docname: quoteId,
  });
}
