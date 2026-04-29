/**
 * Payment Gateway Simulator — RF Perfume
 * 100% realistic simulation with test cards, OTP flows, and transaction management
 */

import crypto from "crypto";

export type CardBrand = "mada" | "visa" | "mastercard" | "amex" | "unknown";
export type PaymentStatus = "pending" | "processing" | "requires_3ds" | "approved" | "declined" | "refunded" | "expired";
export type DeclineReason = "insufficient_funds" | "card_declined" | "expired_card" | "invalid_cvv" | "do_not_honor" | "processing_error" | "stolen_card" | "3ds_failed";

export interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: "card" | "stc_pay" | "apple_pay" | "tamara" | "tabby";
  status: PaymentStatus;
  cardBrand?: CardBrand;
  cardLast4?: string;
  requires3DS?: boolean;
  otpToken?: string;
  stcPhone?: string;
  stcOtp?: string;
  declineReason?: DeclineReason;
  createdAt: Date;
  updatedAt: Date;
  receipt?: TransactionReceipt;
}

export interface TransactionReceipt {
  transactionId: string;
  authCode: string;
  rrn: string;
  terminalId: string;
  merchantId: string;
  timestamp: string;
  amount: number;
  currency: string;
  cardBrand?: string;
  cardLast4?: string;
  method: string;
  status: "approved" | "declined";
}

// ──────────────────────────────────────────────
// TEST CARD DATABASE
// ──────────────────────────────────────────────

interface TestCard {
  prefix: string;
  brand: CardBrand;
  outcome: "success" | "decline";
  requires3DS: boolean;
  declineReason?: DeclineReason;
  label: string;
}

const TEST_CARDS: TestCard[] = [
  // MADA (Saudi domestic)
  { prefix: "4988458812345670", brand: "mada", outcome: "success", requires3DS: false, label: "Mada Success (no 3DS)" },
  { prefix: "9999888877776666", brand: "mada", outcome: "success", requires3DS: true, label: "Mada Success (with 3DS)" },
  { prefix: "9999111122223333", brand: "mada", outcome: "decline", requires3DS: false, declineReason: "insufficient_funds", label: "Mada Insufficient Funds" },

  // VISA
  { prefix: "4111111111111111", brand: "visa", outcome: "success", requires3DS: true, label: "Visa Success (3DS)" },
  { prefix: "4532015112830366", brand: "visa", outcome: "success", requires3DS: false, label: "Visa Success (no 3DS)" },
  { prefix: "4000000000000002", brand: "visa", outcome: "decline", requires3DS: false, declineReason: "card_declined", label: "Visa Declined" },
  { prefix: "4000000000009995", brand: "visa", outcome: "decline", requires3DS: false, declineReason: "insufficient_funds", label: "Visa Insufficient Funds" },
  { prefix: "4000000000000069", brand: "visa", outcome: "decline", requires3DS: false, declineReason: "expired_card", label: "Visa Expired" },
  { prefix: "4000000000000119", brand: "visa", outcome: "decline", requires3DS: false, declineReason: "processing_error", label: "Visa Processing Error" },
  { prefix: "4000000000000259", brand: "visa", outcome: "decline", requires3DS: false, declineReason: "do_not_honor", label: "Visa Do Not Honor" },

  // MASTERCARD
  { prefix: "5200828282828210", brand: "mastercard", outcome: "success", requires3DS: true, label: "Mastercard Success (3DS)" },
  { prefix: "5105105105105100", brand: "mastercard", outcome: "success", requires3DS: false, label: "Mastercard Success (no 3DS)" },
  { prefix: "5200000000000007", brand: "mastercard", outcome: "decline", requires3DS: false, declineReason: "card_declined", label: "Mastercard Declined" },
  { prefix: "5200000000000023", brand: "mastercard", outcome: "decline", requires3DS: false, declineReason: "invalid_cvv", label: "Mastercard Invalid CVV" },
];

const TEST_3DS_OTP = "123456";
const TEST_STC_OTP = "1234";

// In-memory transaction store
const transactions = new Map<string, Transaction>();
const stcOtpSessions = new Map<string, { phone: string; otp: string; orderId: string; amount: number; expires: number }>();

// ──────────────────────────────────────────────
// UTILITY FUNCTIONS
// ──────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function generateAuthCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function generateRRN(): string {
  return Date.now().toString().slice(-12);
}

/** Luhn algorithm validation */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/** Detect card brand from number */
export function detectCardBrand(cardNumber: string): CardBrand {
  const num = cardNumber.replace(/\D/g, "");

  // Mada BINs (Saudi domestic)
  const madaBins = ["4002", "4007", "4009", "4010", "4014", "4019", "4024", "4033", "4040",
    "4988", "9999", "5078", "5580", "5589", "5590", "5591", "5592", "5593",
    "5594", "5095", "5096", "5097", "5098", "5099"];
  if (madaBins.some(b => num.startsWith(b))) return "mada";

  if (/^4/.test(num)) return "visa";
  if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return "mastercard";
  if (/^3[47]/.test(num)) return "amex";

  return "unknown";
}

/** Find test card by exact number */
function findTestCard(cardNumber: string): TestCard | null {
  const num = cardNumber.replace(/\D/g, "");
  return TEST_CARDS.find(tc => tc.prefix.replace(/\D/g, "") === num) || null;
}

/** Determine outcome for any card (test or generic) */
function resolveCardOutcome(cardNumber: string, cvv: string, expiryMonth: string, expiryYear: string): {
  outcome: "success" | "decline";
  requires3DS: boolean;
  brand: CardBrand;
  declineReason?: DeclineReason;
} {
  const num = cardNumber.replace(/\D/g, "");
  const brand = detectCardBrand(num);

  // Check if expired
  const now = new Date();
  const expYear = parseInt("20" + expiryYear, 10);
  const expMonth = parseInt(expiryMonth, 10);
  if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
    return { outcome: "decline", requires3DS: false, brand, declineReason: "expired_card" };
  }

  // Check CVV length
  if (brand === "amex" && cvv.length !== 4) {
    return { outcome: "decline", requires3DS: false, brand, declineReason: "invalid_cvv" };
  }
  if (brand !== "amex" && cvv.length !== 3) {
    return { outcome: "decline", requires3DS: false, brand, declineReason: "invalid_cvv" };
  }

  // Match test card
  const testCard = findTestCard(num);
  if (testCard) {
    return { outcome: testCard.outcome, requires3DS: testCard.requires3DS, brand: testCard.brand, declineReason: testCard.declineReason };
  }

  // Generic: all valid cards succeed with 3DS for Visa/Mastercard
  if (!luhnCheck(num)) {
    return { outcome: "decline", requires3DS: false, brand, declineReason: "card_declined" };
  }

  return {
    outcome: "success",
    requires3DS: brand === "visa" || brand === "mastercard",
    brand
  };
}

function buildReceipt(tx: Transaction): TransactionReceipt {
  return {
    transactionId: tx.id,
    authCode: tx.status === "approved" ? generateAuthCode() : "",
    rrn: generateRRN(),
    terminalId: "TID-QRX-001",
    merchantId: "RF-PERFUME-SA",
    timestamp: new Date().toISOString(),
    amount: tx.amount,
    currency: tx.currency,
    cardBrand: tx.cardBrand,
    cardLast4: tx.cardLast4,
    method: tx.method,
    status: tx.status === "approved" ? "approved" : "declined",
  };
}

// ──────────────────────────────────────────────
// CARD PAYMENT FLOW
// ──────────────────────────────────────────────

export async function initiateCardPayment(params: {
  orderId: string;
  amount: number;
  cardNumber: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  currency?: string;
}): Promise<{ success: boolean; transactionId?: string; requires3DS?: boolean; error?: string; declineReason?: string }> {

  const num = params.cardNumber.replace(/\D/g, "");

  if (!luhnCheck(num)) {
    return { success: false, error: "رقم البطاقة غير صالح" };
  }

  const resolution = resolveCardOutcome(num, params.cvv, params.expiryMonth, params.expiryYear);

  if (resolution.declineReason === "expired_card") {
    return { success: false, error: "البطاقة منتهية الصلاحية", declineReason: "expired_card" };
  }
  if (resolution.declineReason === "invalid_cvv") {
    return { success: false, error: "رمز CVV غير صحيح", declineReason: "invalid_cvv" };
  }

  const txId = generateId("TXN");
  const otpToken = resolution.requires3DS ? crypto.randomBytes(16).toString("hex") : undefined;

  const tx: Transaction = {
    id: txId,
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency || "SAR",
    method: "card",
    status: resolution.requires3DS ? "requires_3ds" : (resolution.outcome === "success" ? "approved" : "declined"),
    cardBrand: resolution.brand,
    cardLast4: num.slice(-4),
    requires3DS: resolution.requires3DS,
    otpToken,
    declineReason: resolution.declineReason,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (tx.status === "approved" || tx.status === "declined") {
    tx.receipt = buildReceipt(tx);
  }

  transactions.set(txId, tx);

  if (resolution.requires3DS) {
    return { success: true, transactionId: txId, requires3DS: true };
  }

  return {
    success: resolution.outcome === "success",
    transactionId: txId,
    requires3DS: false,
    error: resolution.outcome === "decline" ? getDeclineMessage(resolution.declineReason) : undefined,
    declineReason: resolution.declineReason,
  };
}

export async function verify3DS(transactionId: string, otp: string): Promise<{
  success: boolean;
  transactionId: string;
  error?: string;
  receipt?: TransactionReceipt;
}> {
  const tx = transactions.get(transactionId);
  if (!tx) return { success: false, transactionId, error: "جلسة الدفع منتهية أو غير موجودة" };
  if (tx.status !== "requires_3ds") return { success: false, transactionId, error: "حالة الدفع غير صحيحة" };

  if (otp !== TEST_3DS_OTP) {
    tx.status = "declined";
    tx.declineReason = "3ds_failed";
    tx.updatedAt = new Date();
    tx.receipt = buildReceipt(tx);
    return { success: false, transactionId, error: "رمز التحقق غير صحيح" };
  }

  tx.status = "approved";
  tx.updatedAt = new Date();
  tx.receipt = buildReceipt(tx);

  return { success: true, transactionId, receipt: tx.receipt };
}

// ──────────────────────────────────────────────
// STC PAY FLOW
// ──────────────────────────────────────────────

export async function initiateSTPay(params: {
  orderId: string;
  amount: number;
  phone: string;
}): Promise<{ success: boolean; sessionToken?: string; error?: string }> {

  const phone = params.phone.replace(/\D/g, "");
  if (phone.length < 9) {
    return { success: false, error: "رقم الجوال غير صحيح" };
  }

  // Simulate declined number
  if (phone === "0500000000" || phone === "500000000") {
    return { success: false, error: "لا يمكن معالجة هذا الرقم حالياً" };
  }

  const sessionToken = generateId("STC");
  stcOtpSessions.set(sessionToken, {
    phone,
    otp: TEST_STC_OTP,
    orderId: params.orderId,
    amount: params.amount,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  return { success: true, sessionToken };
}

export async function verifySTCPay(params: {
  sessionToken: string;
  otp: string;
}): Promise<{ success: boolean; transactionId?: string; error?: string; receipt?: TransactionReceipt }> {

  const session = stcOtpSessions.get(params.sessionToken);
  if (!session) return { success: false, error: "جلسة STC Pay منتهية، أعد المحاولة" };
  if (Date.now() > session.expires) {
    stcOtpSessions.delete(params.sessionToken);
    return { success: false, error: "انتهت صلاحية رمز التحقق" };
  }

  if (params.otp !== session.otp) {
    return { success: false, error: "رمز OTP غير صحيح، تحقق من رسالتك" };
  }

  stcOtpSessions.delete(params.sessionToken);

  const txId = generateId("STC-TXN");
  const tx: Transaction = {
    id: txId,
    orderId: session.orderId,
    amount: session.amount,
    currency: "SAR",
    method: "stc_pay",
    status: "approved",
    stcPhone: session.phone,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  tx.receipt = buildReceipt(tx);
  transactions.set(txId, tx);

  return { success: true, transactionId: txId, receipt: tx.receipt };
}

// ──────────────────────────────────────────────
// APPLE PAY FLOW
// ──────────────────────────────────────────────

export async function processApplePay(params: {
  orderId: string;
  amount: number;
}): Promise<{ success: boolean; transactionId?: string; error?: string; receipt?: TransactionReceipt }> {

  // Simulate Apple Pay — always succeeds in simulation (user "approved" it with Face ID)
  await new Promise(r => setTimeout(r, 1500));

  const txId = generateId("APPLE-TXN");
  const tx: Transaction = {
    id: txId,
    orderId: params.orderId,
    amount: params.amount,
    currency: "SAR",
    method: "apple_pay",
    status: "approved",
    cardBrand: "visa",
    cardLast4: "0010",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  tx.receipt = buildReceipt(tx);
  transactions.set(txId, tx);

  return { success: true, transactionId: txId, receipt: tx.receipt };
}

// ──────────────────────────────────────────────
// TAMARA BNPL FLOW
// ──────────────────────────────────────────────

export async function createTamaraCheckout(params: {
  orderId: string;
  amount: number;
  customer: { name: string; phone: string; email: string };
  installments: 3 | 4 | 6;
}): Promise<{ success: boolean; checkoutUrl?: string; sessionId?: string; installmentAmount?: number; error?: string }> {

  const installmentAmount = parseFloat((params.amount / params.installments).toFixed(2));
  const sessionId = generateId("TMR");

  const txId = generateId("TMR-TXN");
  const tx: Transaction = {
    id: txId,
    orderId: params.orderId,
    amount: params.amount,
    currency: "SAR",
    method: "tamara",
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  transactions.set(sessionId, tx);

  return {
    success: true,
    checkoutUrl: `/payment/tamara-checkout?session=${sessionId}&amount=${params.amount}&installments=${params.installments}`,
    sessionId,
    installmentAmount,
  };
}

export async function confirmTamaraCheckout(sessionId: string): Promise<{
  success: boolean; transactionId?: string; orderId?: string; amount?: number; error?: string; receipt?: TransactionReceipt;
}> {
  const tx = transactions.get(sessionId);
  if (!tx) return { success: false, error: "جلسة تمارة منتهية" };

  tx.status = "approved";
  tx.updatedAt = new Date();
  tx.receipt = buildReceipt(tx);

  return { success: true, transactionId: tx.id, orderId: tx.orderId, amount: tx.amount, receipt: tx.receipt };
}

// ──────────────────────────────────────────────
// TABBY BNPL FLOW
// ──────────────────────────────────────────────

export async function createTabbyCheckout(params: {
  orderId: string;
  amount: number;
  customer: { name: string; phone: string; email: string };
}): Promise<{ success: boolean; checkoutUrl?: string; sessionId?: string; installmentAmount?: number; error?: string }> {

  const installmentAmount = parseFloat((params.amount / 4).toFixed(2));
  const sessionId = generateId("TBY");

  const txId = generateId("TBY-TXN");
  const tx: Transaction = {
    id: txId,
    orderId: params.orderId,
    amount: params.amount,
    currency: "SAR",
    method: "tabby",
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  transactions.set(sessionId, tx);

  return {
    success: true,
    checkoutUrl: `/payment/tabby-checkout?session=${sessionId}&amount=${params.amount}`,
    sessionId,
    installmentAmount,
  };
}

export async function confirmTabbyCheckout(sessionId: string): Promise<{
  success: boolean; transactionId?: string; error?: string; receipt?: TransactionReceipt;
}> {
  const tx = transactions.get(sessionId);
  if (!tx) return { success: false, error: "جلسة تابي منتهية" };

  tx.status = "approved";
  tx.updatedAt = new Date();
  tx.receipt = buildReceipt(tx);

  return { success: true, transactionId: tx.id, receipt: tx.receipt };
}

// ──────────────────────────────────────────────
// TRANSACTION RETRIEVAL
// ──────────────────────────────────────────────

export function getTransaction(id: string): Transaction | undefined {
  return transactions.get(id);
}

export function getDeclineMessage(reason?: DeclineReason): string {
  const messages: Record<DeclineReason, string> = {
    insufficient_funds: "رصيد غير كافٍ في البطاقة",
    card_declined: "تم رفض البطاقة من قِبل البنك",
    expired_card: "البطاقة منتهية الصلاحية",
    invalid_cvv: "رمز CVV غير صحيح",
    do_not_honor: "تم رفض العملية من قِبل البنك",
    processing_error: "خطأ في معالجة الدفع، حاول مجدداً",
    stolen_card: "تم رفض البطاقة",
    "3ds_failed": "فشل التحقق من الهوية 3DS",
  };
  return reason ? messages[reason] : "تم رفض البطاقة";
}

export const TEST_CARD_GUIDE = [
  { number: "4988 4588 1234 5670", brand: "Mada", result: "✅ نجاح بدون 3DS" },
  { number: "4111 1111 1111 1111", brand: "Visa", result: "✅ نجاح + 3DS (OTP: 123456)" },
  { number: "5200 8282 8282 8210", brand: "Mastercard", result: "✅ نجاح + 3DS (OTP: 123456)" },
  { number: "4000 0000 0000 0002", brand: "Visa", result: "❌ مرفوضة" },
  { number: "4000 0000 0000 9995", brand: "Visa", result: "❌ رصيد غير كافٍ" },
  { number: "4000 0000 0000 0069", brand: "Visa", result: "❌ منتهية الصلاحية" },
];
