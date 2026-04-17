# Luxury Fashion E-Commerce Design Guidelines

## Design Approach
**Reference-Based:** Zara and Everlane's minimalist luxury aesthetics. High-end fashion demands restraint—images lead, UI recedes. Every element serves product photography.

## Typography System

**Fonts:**
- Arabic: "Cairo" (Google Fonts) - Modern, geometric sans-serif
- English Primary: "Manrope" (Google Fonts) - Clean sans-serif  
- Accent: "Cormorant Garamond" (Google Fonts) - Elegant serif for statements

**Scale (Mobile-First):**
- Hero: text-4xl / lg:text-6xl (36px/60px)
- H2: text-3xl / lg:text-5xl (30px/48px)
- H3: text-xl / lg:text-3xl (20px/30px)
- Body: text-sm / lg:text-base (14px/16px)
- Small/UI: text-xs / lg:text-sm (12px/14px)
- Buttons: text-xs / lg:text-sm uppercase tracking-widest

**RTL Implementation:** `dir="rtl"` and `lang="ar"` on root, mirror all layouts/spacing

## Layout System

**Spacing Primitives:** Tailwind 2, 4, 6, 8, 12, 16, 24, 32 (tight luxury spacing)

**Container System:**
- Global: max-w-7xl mx-auto px-4 lg:px-8
- Content sections: max-w-6xl
- Product grids: gap-3 lg:gap-6

**Breakpoints:** 640px (md), 1024px (lg), 1280px (xl)

## Homepage Structure

### 1. Navigation Bar (Sticky)
Transparent initially, solid on scroll with subtle shadow:
- **Layout:** Flexbox justify-between items-center h-16 lg:h-20 px-4 lg:px-8
- **Left:** Logo (SVG, 120px width desktop, 80px mobile)
- **Center (Desktop):** Menu links (Shop, Collections, About) with letter-spacing
- **Right:** Search icon, Wishlist count badge, Bag icon, Language toggle (ع | EN)
- **Mobile:** Hamburger → Full-screen overlay (slide from right for Arabic)

### 2. Hero Section - Full Viewport Statement
**YES - Large Hero Image:** Full-bleed lifestyle photography
- Dimensions: h-screen (100vh) both mobile/desktop
- Image: Model wearing signature piece, architectural minimalist setting
- **Mobile:** Portrait crop (9:16), model centered
- **Desktop:** Landscape (16:9), model positioned in left/right third
- **Overlay Elements:**
  - Subtle gradient vignette from bottom (opacity-30)
  - Text block positioned bottom-left with p-8 lg:p-16
  - Headline: "TIMELESS ESSENTIALS" (Cormorant, text-5xl lg:text-7xl)
  - Subheadline: "Crafted for the Modern Saudi Wardrobe"
  - CTA: Glass-morphism button (backdrop-blur-lg bg-white/10 border border-white/30) "EXPLORE COLLECTION"

### 3. Featured Collections Grid
**Images:** 3 collection categories
- **Desktop:** 3 columns (grid-cols-3 gap-6)
- **Mobile:** 2 columns (grid-cols-2 gap-3)
- Each card: Square images (1:1), text overlay on bottom with category name + item count
- Hover: Subtle zoom scale-105 duration-500

### 4. Product Showcase - Masonry Grid
**Images:** 8-12 product shots showing variety
- **Desktop:** 4 columns with varied heights (grid-cols-4 gap-4)
- **Mobile:** 2 columns (grid-cols-2 gap-2)
- Mix of product-only and lifestyle shots
- Quick-view overlay on hover (desktop): product name + price + heart icon
- All images: Lazy-loaded WebP with JPEG fallback

### 5. Editorial Split Section
**Image:** Lifestyle editorial shot
- **Desktop:** 50/50 split (grid-cols-2)
- **Mobile:** Stacked, image first
- **Content Side:** Vertical centered p-12 lg:p-24
  - Eyebrow: "SIGNATURE COLLECTION" (text-xs tracking-widest)
  - Headline: (Cormorant text-4xl lg:text-5xl)
  - Body paragraph: max-w-prose
  - CTA Button: Solid primary button "DISCOVER MORE"

### 6. Highlighted Product Feature
**Image:** Hero product in studio setting
- Large centered product image (max-w-2xl mx-auto)
- Below image: Product details grid (2 columns)
  - Name, Price, Size selector (minimal pill buttons)
  - Material/care information
  - ADD TO BAG button (full-width mobile, auto desktop)

### 7. Social Proof Gallery
**Images:** 6-8 user-generated content or campaign shots
- Instagram-style grid (grid-cols-3 lg:grid-cols-4 gap-1)
- Square crops (1:1)
- Heading above: "JOIN OUR COMMUNITY" with Instagram handle
- Each image clickable to lightbox

### 8. Newsletter Block - Full Width
No image, typography-focused:
- Centered content max-w-2xl mx-auto py-16 lg:py-24
- Headline (Cormorant text-3xl lg:text-4xl)
- Email input + Submit button (inline flex on desktop)
- Privacy text below

### 9. Footer - Comprehensive
Multi-column layout:
- **Desktop:** 4 columns (Shop, About, Support, Connect)
- **Mobile:** Accordion sections
- Bottom bar: Payment icons, Language/currency switchers, Copyright
- Social media icons (Instagram, Twitter, TikTok)

## Component Library

**Buttons:**
- Primary: px-8 py-3, no border-radius, tracking-wide, min-w-[160px]
- Ghost: border variant
- Icon-only: 44x44px touch target

**Product Cards:**
- Image (1:1 aspect)
- Name (text-sm)
- Price (text-base font-medium)
- Wishlist heart (absolute top-2 right-2)
- No borders, minimal padding

**Input Fields:**
- Border-bottom only (border-b-2)
- Labels: floating or minimal above
- Focus state: subtle underline animation

**Mobile Menu Overlay:**
- Full-screen takeover
- Large navigation links (text-2xl spacing)
- Close X button (top-right for English, top-left for Arabic)
- Slide transition

**Size Selector:**
- Horizontal pills (flex gap-2)
- Border-2 unselected, filled when selected
- 40x40px minimum

## RTL-Specific Adjustments
- Flip all padding/margin: pl ↔ pr, ml ↔ mr
- Text alignment: text-left ↔ text-right
- Flex direction: justify-start ↔ justify-end
- Icon positions: Mirror all absolute positioning
- Animations: Slide directions reversed

## Mobile-First Enhancements
- Sticky "Add to Bag" bar on product pages (bottom-0 fixed)
- Swipeable product image galleries
- Bottom navigation option: Home, Search, Wishlist, Bag (50px height)
- Touch targets: minimum 44x44px
- No hover states (use active/tap states)

## Micro-Interactions
- Button press: scale-95 active state
- Image zoom: scale-105 on hover (duration-500)
- Navigation: opacity transitions (duration-200)
- Bag icon: bounce animation on item add
- Smooth scroll behavior on anchor links
- Page transitions: fade opacity

## Images Required

1. **Hero:** Full-bleed luxury lifestyle shot - Model in signature piece, minimalist architectural background, dramatic natural lighting (16:9 desktop / 9:16 mobile)

2. **Collections Grid (3):** Category hero images - Outerwear, Essentials, Accessories - each square (1:1), clean studio or lifestyle settings

3. **Product Masonry (8-12):** Mix of flat-lay product shots on neutral backgrounds and lifestyle/on-model shots, varied aspect ratios

4. **Editorial Split:** Editorial campaign image - Model in full outfit, urban Saudi landscape or modern interior (3:4 aspect)

5. **Featured Product:** Single hero product, 360° studio view on seamless white, high-resolution detail (4:5 aspect)

6. **Social Gallery (6-8):** User-generated or campaign content, square Instagram-style crops (1:1), authentic lifestyle moments