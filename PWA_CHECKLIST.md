# Checklist for Progressive Web App (PWA) Features

## 1. Core PWA Implementation
- [x] **Web Manifest**: Created `client/public/manifest.json` with app name, theme color, and logo configuration.
- [x] **Service Worker**: Created `client/public/sw.js` for offline caching and installation support.
- [x] **Service Worker Registration**: Added registration logic in `client/src/main.tsx`.
- [x] **Meta Tags**: Updated `client/index.html` with iOS compatibility tags and manifest link.

## 2. Visual Assets
- [x] **App Logo**: Copied the high-quality logo to `client/public/icons/logo.png`.
- [x] **Icons**: Configured manifest to use the logo as the main app icon (192x192, 512x512).
- [x] **Splash Screen Support**: Added `apple-touch-icon` for iOS home screen appearance.

## 3. User Experience (UI/UX)
- [x] **Smart Install Button**: Added a "Install/Download" button in `client/src/components/Layout.tsx`.
- [x] **Responsive Behavior**: The button only appears when the browser confirms the app can be installed.
- [x] **Platform Support**:
    - **Android/Windows/Mac**: Uses standard `beforeinstallprompt` event.
    - **iOS**: Manifest and meta tags prepare it for "Add to Home Screen" via Safari Share menu.

## 4. How to Verify
1. Open the site in Chrome (Desktop or Android).
2. Look for the "Download/Install" button in the header or sidebar.
3. On iPhone: Open in Safari, tap "Share", then "Add to Home Screen".
