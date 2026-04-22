/**
 * Centralized site configuration — single source of truth for the public URL,
 * brand identity, and asset paths used across emails, OG metadata, and APIs.
 *
 * Override per-environment via `PUBLIC_SITE_URL` env var (e.g. for staging).
 */

const RAW_URL = process.env.PUBLIC_SITE_URL || "https://rfperfume.sa";

export const SITE = {
  /** Primary canonical URL — no trailing slash */
  URL: RAW_URL.replace(/\/+$/, ""),
  /** Bare domain, e.g. "rfperfume.sa" — used for display in footers and copy */
  DOMAIN: RAW_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
  /** Brand name (Arabic) */
  BRAND_AR: "عطور آر اف",
  /** Brand name (English) */
  BRAND_EN: "RF Perfume",
  /** Support email shown to customers */
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || "rf-purfume@outlook.com",
  /** No-reply sender used by SMTP2GO */
  NOREPLY_EMAIL: process.env.EMAIL_SENDER || "noreply@rfperfume.sa",
  /** Internal-only emails (auto-generated for phone-only signups) */
  PHONE_EMAIL_DOMAIN: "rfperfume.sa",
} as const;

export const ASSETS = {
  LOGO_SQUARE: `${SITE.URL}/icons/logo-square.png`,
  LOGO_LIGHT:  `${SITE.URL}/images/logos/logo-light.png`,
  LOGO_DARK:   `${SITE.URL}/images/logos/logo-dark.png`,
  BRAND_LOGO:  `${SITE.URL}/brand-logo.png`,
  EMAIL_BANNER:`${SITE.URL}/icons/email-banner.gif`,
  OG_COVER:    `${SITE.URL}/og-cover.png`,
} as const;

export const ROUTES = {
  HOME:     `${SITE.URL}/`,
  PRODUCTS: `${SITE.URL}/products`,
  ORDERS:   `${SITE.URL}/orders`,
  ADMIN:    `${SITE.URL}/admin`,
  LOGIN:    `${SITE.URL}/login`,
} as const;
