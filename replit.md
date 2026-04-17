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
- **Banners:** 8 professional banners at `/images/banners/banner-1.png` through `banner-8.png` — these contain embedded text, logos, and CTAs (displayed full-bleed, no overlay text)
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

## Key Directories
- `client/src/` — React frontend source
- `client/public/` — Static assets (images, logos, banners, videos)
- `server/` — Express backend (API, auth, email, seed data)
- `shared/` — Shared types between client/server
