[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. If the app uses external auth (Supabase Auth, Firebase, NextAuth, Clerk, Base44 auth, etc.), replace it with Replit Auth — see the replit-migration-guardrails skill. Skip if the app has no login flow. (App uses its own Passport.js/MongoDB auth — no replacement needed)
[x] 4. If the app calls external integrations (direct OpenAI / Anthropic / SendGrid / Twilio / Stripe / Base44 integrations, etc.), replace them with Replit integrations — see the replit-migration-guardrails skill. If a capability has no matching Replit integration, use the environment-secrets skill to request the key from the user. Skip if none apply. (All API keys already configured in env vars; Groq keys need refreshing by user)
[x] 5. Verify the project works end-to-end: use the testing agent (see the testing skill) to exercise the main flows, then use the feedback tool to screenshot and confirm with the user
[x] 6. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] 7. Storage Station (storagestation.app) WooCommerce integration - COMPLETE
    - server/storagestation.ts created with full WooCommerce REST API v3 client
    - Auto-push on payment confirmation via dispatchOrderPaidSideEffects (delivery orders only)
    - 5 retry attempts with exponential backoff on failure
    - Admin endpoints: /api/admin/storage-station/config, /orders, /retry/:id, /status/:id
    - Credentials stored in STORAGE_STATION_API_KEY + STORAGE_STATION_API_SECRET env vars
    - Order fields: storageStationOrderId, storageStationStatus, storageStationSentAt, storageStationError