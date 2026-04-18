# رفيف العود | RF Perfume — Luxury Perfume Store

## Overview
A full-stack Arabic luxury perfume e-commerce platform. Built with React + Express + MongoDB.

## Architecture
- **Frontend:** React 18 + Vite, Tailwind CSS (Tajawal + Cairo fonts), Radix UI, TanStack Query, Wouter routing
- **Backend:** Express.js + TypeScript, served on port 5000 (both API and Vite dev server)
- **Database:** MongoDB Atlas via Mongoose (`MONGODB_URI` env var — cluster: perfume.txcy7zh.mongodb.net, db: rfperfume)
- **Authentication:** Passport.js (local strategy + Google OAuth + Apple Sign-In) + express-session
- **Auth Modal:** Inline AuthModal component in Layout (no page navigation) with tabs for Login/Register + Google/Apple social buttons
- **Lazy Loading:** All secondary pages use React.lazy() for code splitting (Admin, Orders, Checkout, POS, etc.)
- **Real-time:** WebSocket server at `/ws` path

## Branding & Theme
- **Store Name:** رفيف العود | RF Perfume
- **Domain:** rfperfume.sa
- **CSS Theme:** Light-mode only (dark mode removed). White bg (#fff), navy text (#1a2744), beige accents (#c9a96e, #f9f7f4, #f5f0eb). Gold palette (HSL `38 45% 60%` primary).
- **Logos:** `/images/logos/logo-light.png` (light bg), `/images/logos/logo-dark.png` (dark bg)
- **Splash:** `/videos/splash.mp4` on white bg with logo fallback + gold shimmer line
- **Banner:** RF-branded hero banner at `/images/banners/banner-1.png` (single, full-bleed). Decorative sections elsewhere on the homepage use pure CSS gradients + the RF logo (no third-party imagery).
- **PWA Icons:** Generated from logo at `/icons/` (192x192, 512x512, 180x180 apple-touch, 32x32 favicon)
- **PWA Manifest:** background_color `#ffffff`, theme_color `#ffffff`
- **Login/Register:** White luxury theme (ivory #faf8f5 bg, gold accents, white card)
- **Admin Dashboard:** White theme (white bg, gold sidebar accents, navy text)
- **STC Checkout:** White/purple theme (ivory bg, purple gradient accents)
- **Logos:** Login/Register use `logo-light-nobg.png` (dark text, transparent bg for light pages)
- **Footer:** White bg with gray borders/text, logo-light.png, payment logos
- **Email:** rf-purfume@outlook.com
- **Admin:** phone `567891011`, password `123456`

## Key Features
- **Admin-Controlled Promo Strip** (NEW): Trust badges row on homepage fully editable from `/admin → "شريط المميّزات"`. Each badge: Lucide icon picker (14 icons), bilingual title+subtitle, color, optional link, sort, active toggle. Endpoints: `GET /api/promo-strip` (public, active only), full CRUD at `/api/admin/promo-strip` (settings.manage). Frontend: `Home.tsx → PromoStripSection` (with hardcoded fallback when DB empty). Models: `PromoStripItemModel`. Admin: `pages/admin/AdminPromoStrip.tsx`.
- **Custom Pages CMS** (NEW): Admin can create unlimited HTML pages (about, returns, marketing landings) with hero image, AR+EN content, SEO title/description, slug, `showInNav`, sort. Public route `/pages/:slug` (`CustomPage.tsx`) renders luxury-themed hero + prose article. Endpoints: `GET /api/pages`, `GET /api/pages/:slug`, full CRUD at `/api/admin/pages`. Models: `CustomPageModel`. Admin: `pages/admin/AdminPages.tsx` (with image upload, slug auto-normalization, conflict check).
- **AI Product Insights** (NEW): `GET /api/products/:id/insights` analyzes ≥2 review comments via Groq (llama-3.3-70b) → bilingual summary, scent notes, longevity, sillage, occasions, pros/cons, sentiment. Cached in `ProductInsightsModel`, refreshes after 24h or +2 new reviews. Frontend `ProductInsightsCard` (navy/gold luxury card on PDP between gallery and reviews).
- **AI Inventory Insights** (NEW): `GET /api/admin/ai/inventory-insights` (products.view) computes 30-day sales velocity per product (paid orders only), feeds into Groq → top movers, slow movers, urgent restock with suggested qty, overall health, strategic recommendations. Deterministic heuristic fallback if AI unavailable. Admin: `pages/admin/AdminAiInsights.tsx` (gradient hero + stat cards + categorized insights + numbered recommendations).
- **Verified-Buyer Review Eligibility** (NEW): `GET /api/products/:id/can-review` checks `paymentStatus="paid"` orders containing `items.productId` for current user. Used to gate review form to actual purchasers.
- **Customer Reviews System**:
  - **Customer side** (`ProductDetails.tsx`): Star rating + comment + photo attachments (up to 5 images via `/api/upload`). Image lightbox viewer. Admin replies appear inline with luxury styling.
  - **Home page carousel** (`components/CustomerTestimonials.tsx`): "ماذا يقول عملاؤنا" — auto-rotating featured testimonials with navy/gold luxury card design, avatars, star ratings, photos, and product links. Powered by `GET /api/reviews/featured` (rating ≥ 4 with comments, sorted by featured-flag).
  - **Admin panel** (`/admin` → "تقييمات العملاء" tab → `pages/admin/AdminReviews.tsx`): full management with filter (rating + reply status + search), inline reply, mark-as-featured, delete with confirmation, photo lightbox, stat cards (total / avg / unanswered / featured).
  - **Backend**: extended `productReviewSchema` (added `images`, `adminReply{text,byUserId,byName,at}`, `isHidden`, `isFeatured`, `productName`, `productImage` denormalized for fast admin/home queries). Routes: `GET /api/reviews/featured` (public), `GET/POST/PATCH/DELETE /api/admin/reviews*` (permission-gated by `orders.view`).
- **Employee Inbox** (`/admin` → "صندوق البريد"): IMAP+SMTP integration for custom-domain mailboxes (Zoho/Gmail/Outlook/Yandex/Custom). Server-side encryption (AES-256-GCM) of app passwords. Auto-sync every 2 min. Full read/reply/forward/delete UI. Per-employee accounts; admins see all.
  - Backend: `server/inbox.ts` (IMAP via `imapflow`, SMTP via `nodemailer`, parsing via `mailparser`); models `MailAccount` + `MailMessage` in `server/models.ts`; routes under `/api/admin/inbox/*`.
  - Frontend: `client/src/pages/admin/AdminInbox.tsx` (3-column layout: accounts/folders sidebar + message list + preview pane + compose dialog + account management dialog).
  - Encryption key: `INBOX_ENC_KEY` env var (falls back to `SESSION_SECRET`).
- Consumer storefront (perfumes, cart, checkout)
- Video splash screen on first visit (session-based)
- Admin dashboard with RBAC (5 employee roles: مدير, مساعد مدير, دعم فني, محاسب, مستشار قانوني)
- Vendor/branch management
- POS system
- PWA support
- Multi-language (Arabic-first, RTL default)
- Payment integrations (STC Pay, Tabby, Tamara, Apple Pay, Paymob card payments)
- Map integration (Leaflet)
- Groq AI integration (model: `llama-3.3-70b-versatile`) — UnifiedChat component with Perfume Advisor + Support tabs, admin assistant
  - **Bilingual (AR/EN)**: `detectLang()` in `server/groq.ts` auto-detects user message language (Arabic vs Latin script) and switches all system prompts (perfume advisor, support, admin, size advisor, business insights, outfit suggestions) accordingly. `generateProductDescription` always returns both AR + EN copy.
- Commercial Registration: 1010978041 | Tax Number: 312037024200003

## Running the Project
```bash
npm run dev       # Development (port 5000)
npm run build     # Production build
npm run start     # Production server
```

## Environment Variables
- `MONGODB_URI` — MongoDB connection string (Atlas)
- `SESSION_SECRET` — Express session secret
- `SMTP2GO_API_KEY` — Email service API key
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (for Sign in with Google)
- `APPLE_CLIENT_ID` — Apple Services ID (for Sign in with Apple)
- `APPLE_REDIRECT_URI` — Apple OAuth redirect URI

## Recent Major Features (April 2026)
- **Abandoned-cart system**: Client debounces cart changes (1500ms) → POSTs `/api/cart/sync` → Mongo `CartSession`. Background worker every 60s atomically claims carts idle ≥5min and emails+pushes the customer. Employee panel `/admin/abandoned-carts` lists carts and lets staff manually re-notify with optional one-time-coupon discount. Auto-marks converted on order creation.
- **Order cancellation + auto-refund**: Customer-initiated cancel from `/orders` (rules in admin-configurable `CancellationPolicy`). On cancel: atomic `$inc` stock restore, wallet refund + WalletTransaction, push+email customer. Admin policy at `/admin/cancellation-policy`.
- **ZATCA QR (Phase 1)**: TLV (tag-length-value) base64 encoder in `server/zatca.ts`. Endpoint `/api/orders/:id/zatca-qr` returns PNG data URL using the `qrcode` package. Print-invoice in Orders.tsx renders the real QR.

## Key Directories
- `client/src/` — React frontend source
- `client/public/` — Static assets (images, logos, banners, videos)
- `server/` — Express backend (API, auth, email, seed data)
- `shared/` — Shared types between client/server
