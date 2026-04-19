/**
 * ZATCA (Saudi e-invoicing) Phase 1 simplified TLV QR generator.
 * Encodes seller name, VAT number, timestamp, total, vat amount as TLV
 * then base64. Returns a base64 string and a data-URL PNG of the QR.
 */
import QRCode from "qrcode";

function tlv(tag: number, value: string): Buffer {
  const valBuf = Buffer.from(value, "utf-8");
  const lenBuf = Buffer.from([valBuf.length]);
  const tagBuf = Buffer.from([tag]);
  return Buffer.concat([tagBuf, lenBuf, valBuf]);
}

export function buildZatcaTlvBase64(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  total: number;
  vatAmount: number;
}): string {
  const buf = Buffer.concat([
    tlv(1, params.sellerName || "رفيف العود"),
    tlv(2, params.vatNumber || ""),
    tlv(3, params.timestamp.toISOString().replace(/\.\d{3}Z$/, "Z")),
    tlv(4, params.total.toFixed(2)),
    tlv(5, params.vatAmount.toFixed(2)),
  ]);
  return buf.toString("base64");
}

export async function buildZatcaQrDataUrl(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  total: number;
  vatAmount: number;
}): Promise<{ base64: string; dataUrl: string }> {
  const base64 = buildZatcaTlvBase64(params);
  const dataUrl = await QRCode.toDataURL(base64, {
    errorCorrectionLevel: "M",
    width: 256,
    margin: 1,
    color: { dark: "#1a2744", light: "#ffffff" },
  });
  return { base64, dataUrl };
}
