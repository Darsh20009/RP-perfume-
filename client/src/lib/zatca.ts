/**
 * ZATCA (Zakat, Tax and Customs Authority) Phase 1 simplified e-invoice
 * TLV (Tag-Length-Value) base64 QR generator.
 *
 * Spec tags:
 *   1 - Seller name (UTF-8)
 *   2 - VAT registration number (UTF-8)
 *   3 - Invoice timestamp (ISO 8601 with timezone)
 *   4 - Invoice total with VAT (string, 2 decimals)
 *   5 - VAT amount (string, 2 decimals)
 */

export interface ZatcaInvoiceData {
  sellerName: string;
  vatNumber: string;
  timestamp: string | Date;
  totalWithVat: number | string;
  vatAmount: number | string;
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function tlv(tag: number, value: string): Uint8Array {
  const valueBytes = utf8Bytes(value);
  const out = new Uint8Array(2 + valueBytes.length);
  out[0] = tag;
  out[1] = valueBytes.length;
  out.set(valueBytes, 2);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  if (typeof btoa === "function") return btoa(bin);
  // node fallback
  return Buffer.from(bin, "binary").toString("base64");
}

function fmtAmount(v: number | string): string {
  const n = typeof v === "number" ? v : parseFloat(v) || 0;
  return n.toFixed(2);
}

export function buildZatcaQrPayload(d: ZatcaInvoiceData): string {
  const ts = d.timestamp instanceof Date ? d.timestamp.toISOString() : d.timestamp;
  const parts = [
    tlv(1, d.sellerName),
    tlv(2, d.vatNumber),
    tlv(3, ts),
    tlv(4, fmtAmount(d.totalWithVat)),
    tlv(5, fmtAmount(d.vatAmount)),
  ];
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { merged.set(p, off); off += p.length; }
  return bytesToBase64(merged);
}
