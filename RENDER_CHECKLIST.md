# Checklist for Render Deployment

## 1. Project Configuration
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Node Version**: Ensure you're using Node.js 18 or 20 (standard on Render).

## 2. Environment Variables (Required)
- `MONGODB_URI`: Your MongoDB Atlas connection string.
- `SESSION_SECRET`: A secure random string for managing user sessions.
- `NODE_ENV`: Set to `production`.

## 3. Build & Bundling
- The project is configured to bundle `mongoose` into the production build (`dist/index.cjs`).
- The client-side assets are built into `dist/public`.

## 4. Final Steps
- Ensure your MongoDB IP Access List includes Render's IPs or is set to `0.0.0.0/0`.
- Verify the build logs on Render to ensure `vite` and `esbuild` complete successfully.
