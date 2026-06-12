/**
 * pdfRecipes — post-processing on existing PDF bytes (merge, watermark, protect).
 *
 * Built on `pdf-lib` for merge/watermark and `@cantoo/pdf-lib` (a drop-in fork
 * that adds AES encryption) for password protection. All recipes operate on
 * `Blob`/`Uint8Array` PDF inputs — they do not depend on jsPDF.
 *
 * Skill recipes implemented:
 *   - Merge multiple PDFs       → mergePdfs
 *   - Diagonal watermark stamp  → watermarkPdf
 *   - Password protection       → protectPdf
 */
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function bytesToBlob(bytes: Uint8Array): Blob {
  // Copy into a fresh ArrayBuffer to satisfy BlobPart typings across runtimes.
  return new Blob([bytes.slice().buffer], { type: "application/pdf" });
}

/* --------------------------------- Merge ---------------------------------- */

export async function mergePdfs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) throw new Error("No PDFs to merge");
  const out = await PDFDocument.create();
  for (const blob of blobs) {
    const src = await PDFDocument.load(await blobToBytes(blob), { ignoreEncryption: true });
    const copied = await out.copyPages(src, src.getPageIndices());
    for (const page of copied) out.addPage(page);
  }
  return bytesToBlob(await out.save());
}

/* ------------------------------- Watermark -------------------------------- */

export interface WatermarkOptions {
  text: string;
  opacity?: number; // 0..1
  angle?: number;   // degrees
  color?: { r: number; g: number; b: number };
}

export async function watermarkPdf(blob: Blob, opts: WatermarkOptions): Promise<Blob> {
  const doc = await PDFDocument.load(await blobToBytes(blob));
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = opts.color ?? { r: 0.75, g: 0.75, b: 0.75 };
  const opacity = opts.opacity ?? 0.35;
  const angle = opts.angle ?? 60;
  const text = opts.text;

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    // Size text to ~70% of page diagonal so it spans most of the page.
    const diagonal = Math.sqrt(width * width + height * height);
    let size = diagonal * 0.18;
    if (size > 240) size = 240;
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - size / 2,
      size,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity,
      rotate: degrees(angle),
    });
  }
  return bytesToBlob(await doc.save());
}

/* -------------------------------- Protect --------------------------------- */

export interface ProtectOptions {
  userPassword: string;
  ownerPassword?: string;
}

/** Encrypts a PDF with a user (and optional owner) password.
 *  Uses @cantoo/pdf-lib at runtime (loaded dynamically) to keep the bundle slim. */
export async function protectPdf(blob: Blob, opts: ProtectOptions): Promise<Blob> {
  if (!opts.userPassword) throw new Error("A user password is required");
  const cantoo = await import("@cantoo/pdf-lib");
  const doc = await cantoo.PDFDocument.load(await blobToBytes(blob));
  // The fork's encrypt API mirrors pdf-lib's save options.
  const bytes = await doc.save({
    // @ts-expect-error — the fork adds the `encrypt` save option.
    encrypt: {
      userPassword: opts.userPassword,
      ownerPassword: opts.ownerPassword ?? opts.userPassword,
      permissions: { printing: "highResolution", modifying: false, copying: true },
    },
  });
  return bytesToBlob(bytes);
}
