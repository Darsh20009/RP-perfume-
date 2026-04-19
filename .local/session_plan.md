# Mega-feature batch — Session Plan

## Status
- Per-variant pricing + bilingual product fields (nameEn/descriptionEn/isOnSale/salePrice) — DONE in models + Admin forms.
- Below: new T001-T005.

## T001 — Backend foundations
- [ ] Mongoose schemas: PromoStrip, CustomPage, ProductInsights
- [ ] Extend categorySchema (asPage, pageHero, pageContentAr/En, showInNav)
- [ ] Extend storeSettingsSchema (freeShippingThreshold, freeShippingEnabled)
- [ ] Storage methods (IStorage)
- [ ] Admin CRUD routes: /api/admin/promo-strip, /api/admin/pages
- [ ] Public read: /api/promo-strip, /api/pages, /api/pages/:slug

## T002 — AI insights
- [ ] GET /api/products/:id/insights (Groq summarizes reviews; cache + refresh)
- [ ] GET /api/admin/ai/inventory-insights (sales velocity, restock, slow movers)

## T003 — Admin UI
- [ ] AdminPromoStrip.tsx (icon, title, sub, link, color, sort, active)
- [ ] AdminPages.tsx (slug, title AR/EN, hero, content blocks AR/EN, showInNav, sort)
- [ ] AdminAiInsights.tsx (restock/velocity/anomaly dashboard)
- [ ] Wire 3 new tabs into Admin.tsx

## T004 — Frontend integrations
- [ ] Home: API-driven promo strip
- [ ] Layout/Header: dynamic nav links (showInNav pages)
- [ ] /pages/:slug page with hero + theme-aware content blocks
- [ ] PDP bottom: reviews showcase w/ lightbox + AI insights card + post-purchase review form
- [ ] Add-to-cart fly animation (logo flies to cart icon)

## T005 — Wire & polish
- [ ] Update replit.md
- [ ] Code review (architect)
