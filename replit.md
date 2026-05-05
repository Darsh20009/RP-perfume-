# رفيف العود | RF Perfume

An Arabic luxury perfume e-commerce platform offering a seamless shopping experience for high-end fragrances.

## Run & Operate

```bash
npm run dev       # Development (port 5000)
npm run build     # Production build
npm run start     # Production server
```

**Environment Variables:**

-   `MONGODB_URI`
-   `SESSION_SECRET`
-   `SMTP2GO_API_KEY`
-   `GOOGLE_CLIENT_ID`
-   `APPLE_CLIENT_ID`
-   `APPLE_REDIRECT_URI`
-   `INBOX_ENC_KEY` (for employee inbox encryption, falls back to `SESSION_SECRET`)
-   `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` (for AI integrations)
-   `STORAGE_STATION_API_KEY` — WooCommerce consumer key for storagestation.app
-   `STORAGE_STATION_API_SECRET` — WooCommerce consumer secret for storagestation.app

## Stack

-   **Frontend:** React 18 + Vite, Tailwind CSS, Radix UI, TanStack Query, Wouter
-   **Backend:** Express.js + TypeScript
-   **Database:** MongoDB Atlas (via Mongoose)
-   **ORM:** Mongoose
-   **Authentication:** Passport.js (local, Google OAuth, Apple Sign-In), express-session
-   **Validation:** _Populate as you build_
-   **Build Tool:** Vite

## Where things live

-   `client/src/` — React frontend source
-   `client/public/` — Static assets (images, logos, banners, videos)
-   `server/` — Express backend (API, auth, email, seed data)
-   `shared/` — Shared types between client/server
-   **DB Schema:** `server/models.ts`
-   **API Contracts:** Defined implicitly by routes in `server/routes.ts` and `server/adminRoutes.ts`
-   **Theme Files:** Primarily Tailwind CSS configuration and direct component styling within `client/src/`

## Architecture decisions

-   **AI Integration with Cascading Fallback:** Employs Google Gemini as primary with Groq as fallback, using a multi-key, multi-model strategy with intelligent cooldowns and smart rule-based fallback for robust AI responses even during API failures.
-   **Bilingual Content Strategy:** All user-facing and admin-facing content supports Arabic and English, with RTL default for Arabic and auto-detection of user message language for AI interactions.
-   **Atomic Operations for Critical Flows:** Stock mutations, order status updates, and worker claims utilize atomic MongoDB operations (`$inc`, `findOneAndUpdate`) to prevent race conditions and ensure data integrity.
-   **PWA First Approach:** Designed with Progressive Web App capabilities including manifest, icons, and offline support for enhanced user experience.
-   **Lazy Loading for Admin/Secondary Pages:** Utilizes `React.lazy()` for code splitting on less frequently accessed pages to optimize initial load times.

## Product

-   Luxury perfume e-commerce storefront with product browsing, cart, and checkout.
-   Customer reviews system with verified-buyer eligibility and admin management.
-   AI-powered product insights (summarizes reviews, scent notes, etc.) and inventory insights (sales velocity, restock recommendations).
-   Customizable promotional strips and CMS for dynamic content pages.
-   Admin dashboard with Role-Based Access Control (RBAC) and employee inbox.
-   Multi-language support (Arabic-first, RTL).
-   Multiple payment integrations (STC Pay, Tabby, Tamara, Apple Pay, Paymob).
-   Abandoned cart recovery system with email notifications and admin tools.
-   Order cancellation with auto-refunds and stock restoration.
-   ZATCA-compliant QR code and emailed tax invoices for paid orders.
-   Dynamic header navigation based on custom pages.
-   Video splash screen on first visit.
-   Branch management with map integration.
-   POS system.
-   AI perfume advisor and support chatbot with voice input and dynamic quick replies.
-   Storage Station (storagestation.app) 3PL fulfillment integration — orders auto-pushed after payment confirmation via WooCommerce REST API v3 using SKU mapping.

## User preferences

-   _Populate as you build_

## Gotchas

-   **AI Quota Management:** Be mindful of API quotas for Gemini and Groq. The system has built-in fallbacks and key rotation, but excessive usage might still lead to temporary limitations. Groq API keys may expire and need refreshing.
-   **Paymob Integration:** The in-app Paymob checkout relies on polling the backend for order status. Ensure backend stability for a smooth user experience during payment.
-   **Invoice Generation:** The ZATCA invoice generation is critical. Any issues here will affect customer records and compliance.
-   **Deployment run command:** Production build outputs to `dist/index.js` (ESM format). Run with `node ./dist/index.js`.
-   **Session cookies:** The auth layer auto-detects Replit environment (`REPL_ID`/`REPLIT_DEV_DOMAIN`) and sets `SameSite=None; Secure` cookies for proper cross-origin iframe behavior in the Replit preview.

## Pointers

-   **MongoDB Atlas:** [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
-   **Express.js:** [https://expressjs.com/](https://expressjs.com/)
-   **React.js:** [https://react.dev/](https://react.dev/)
-   **Tailwind CSS:** [https://tailwindcss.com/](https://tailwindcss.com/)
-   **Radix UI:** [https://www.radix-ui.com/](https://www.radix-ui.com/)
-   **TanStack Query:** [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
-   **Wouter:** [https://www.npmjs.com/package/wouter](https://www.npmjs.com/package/wouter)
-   **Passport.js:** [http://www.passportjs.org/](http://www.passportjs.org/)
-   **Mongoose:** [https://mongoosejs.com/](https://mongoosejs.com/)
-   **Vite:** [https://vitejs.dev/](https://vitejs.dev/)
-   **Google Gemini API:** Refer to Google Cloud documentation for API key and quota management.
-   **Groq API:** Refer to Groq documentation for API key and usage.