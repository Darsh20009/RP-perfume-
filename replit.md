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
- **Email:** support@rfperfume.sa
- **Admin:** phone `567891011`, password `123456`

## Key Features
- **Per-variant Pricing + Bilingual Product Fields** (NEW): `productSchema` extended with `nameEn`, `descriptionEn`, `isOnSale`, `salePrice`, and `variants[].price` (per-variant price overrides base price when > 0). Both ADD and EDIT product forms in `Admin.tsx` now render side-by-side AR/EN inputs, an "on sale" toggle with conditional sale-price field, and a 12-col variant grid (color | size | price | stock | sku | image | delete) with helpful hint text.
- **Dynamic Header Nav from CustomPages** (NEW): `Layout.tsx` fetches `/api/pages?nav=true` and injects each page (with `showInNav=true`) into both desktop top-nav and mobile sidebar, linking to `/pages/:slug`.
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

## Branches & Social — Apr 2026 batch
- **Branch model** extended (`server/models.ts` + `shared/schema.ts`) with: `nameEn`, `address`/`addressEn`, `city`, `email`, `hours`, `image`, `latitude`, `longitude`, `mapUrl`, `isPickupEnabled`, `sortOrder` (Mongoose `strict: false`).
- **Store settings** extended with: `socialAccounts[]` (admin-managed dynamic list — platform/url/handle/isActive/sortOrder), `bankTransferInstructionsAr/En`, `pickupEnabled`, `pickupInstructionsAr/En`.
- **Admin > Branches**: rewritten inline form supports edit mode, bilingual fields, image upload, lat/lng inputs with `navigator.geolocation` "تحديد موقعي" auto-fill, live OpenStreetMap iframe preview, Apple/Google Maps quick-open buttons on each card.
- **Admin > Store Settings**: 3 new cards — Bank Transfer bilingual instructions (inside Payment Methods card), Branch Pickup toggle + bilingual instructions, dynamic Social Accounts manager (10 supported platforms).
- **Public `/branches`** page (`client/src/pages/Branches.tsx`): luxury navy/gold hero, grid of cards with embedded OSM map preview (when lat/lng present, else branch image), full contact info, pickup badge, and prominent "خرائط أبل" + "خرائط جوجل" buttons (`maps.apple.com/?ll=lat,lon&q=name` — no API key required, opens natively on iPhone/Mac).
- **Footer** (Layout.tsx): renders dynamic `socialAccounts` from `/api/store/settings` with the previous 4 hardcoded links as fallback when none configured. Adds "فروعنا / Our Branches" link in Help column.
- **Maps strategy**: free OpenStreetMap iframe for in-page preview; deep-link to Apple/Google Maps for navigation. MapKit JS deferred (would require Apple Developer Program $99/yr).

## 2026-04-19 — Mega-feature batch (T001–T005)
- **Backend foundations**: Added Mongoose models `PromoStripItem`, `CustomPage`, `ProductInsights`. Extended `categorySchema` (asPage, showInNav, pageHero, pageContentAr/En) and `storeSettingsSchema` (freeShippingThreshold + freeShippingEnabled, vatRate, support contacts, SEO, maintenance mode, Tabby/Tamara order limits). Storage CRUD + admin/public REST routes wired.
- **AI insights**: `GET /api/products/:id/insights` (Groq summarises reviews, 24h cache, refresh on +2 new comments) and `GET /api/admin/ai/inventory-insights` (sales velocity, restock urgency, slow movers, AI fallback heuristic).
- **Admin UI**: New tabs in Admin panel — `AdminPromoStrip`, `AdminPages`, `AdminAiInsights`. Shipping companies admin form expanded (logo, nameEn, freeShippingThreshold, trackingUrlTemplate, supportPhone, isActive switch).
- **Frontend integrations**: Home reads promo strip from API; Layout pulls dynamic nav links from CustomPages flagged `showInNav`; `/pages/:slug` route renders hero + bilingual content; ProductDetails shows `ProductInsightsCard` + review lightbox + verified-buyer review form.
- **Fly-to-cart animation**: New `lib/flyToCart.ts` helper animates the product image into the cart icon (which now carries `data-cart-target`). Honors `prefers-reduced-motion`.

## 2026-04-27 — Mobile-first home page redesign
- **Mobile logo centering** (`Layout.tsx`): Mobile navbar now uses an absolutely-centered `<Link>` for the logo so it sits in the visual center of the bar instead of being right-aligned next to the menu icon. Original right-side logo gated to `hidden md:flex` so desktop is untouched.
- **New "category mosaic" section** (`Home.tsx`): Inserted directly under the hero banner — one rounded square per top-level category (`grid-cols-2 sm:grid-cols-3`) showing a 2×2 mosaic of that category's product images (`p.images?.[0]`), with the category name + "view all" link below (RTL-aware `flex-row-reverse`). `aspect-square`, `rounded-3xl`, `bg-[#F7F3EC]`, no border/frame.
- **Home page section reorder**: Hero → **Category mosaic** → Trust strip → Newest products → Flash deals → Bundles → **Best Sellers** → **Per-category full sections** → Promo banners → … (Best Sellers and per-category sections were physically swapped in JSX so the user lands on Best Sellers before the deeper category-by-category browse).
- **Frameless category banners**: Per-category section banners changed from a fixed-height bordered cream tile to a plain `<img>` with `w-full h-auto max-h-72 sm:max-h-80 md:max-h-96 lg:max-h-[28rem] object-contain rounded-3xl mx-auto` — image keeps its natural aspect ratio (no crop on mobile), is horizontally centered, has soft 3xl corners and no border/background frame.
