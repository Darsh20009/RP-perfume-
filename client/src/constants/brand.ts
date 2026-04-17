/**
 * Brand Constants & Configuration
 * Centralized brand colors, typography, and messaging
 */

// ============================================
// COLORS
// ============================================

export const BRAND_COLORS = {
  // Primary
  primary: '#0D8659', // Deep Green
  primaryForeground: '#FFFFFF',
  
  // Neutral
  black: '#1A1A1A',
  white: '#FFFFFF',
  
  // Grays (Light to Dark)
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  
  // Accents
  accent: {
    amber: '#D97706',    // Warm (sales, limited offers)
    blue: '#3B82F6',     // Cool (information)
  },
  
  // Status
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const TYPOGRAPHY = {
  // Font Family
  fontFamily: {
    primary: '"Cairo", sans-serif',
    serif: '"Garamond", serif',
    mono: '"Monaco", "Courier New", monospace',
  },
  
  // Font Sizes (in rem)
  fontSize: {
    // Display sizes (heroic)
    display: {
      sm: 'clamp(2rem, 5vw, 3.5rem)',     // h1 alternative
      base: 'clamp(2.5rem, 6vw, 5rem)',   // Large display
      lg: 'clamp(3rem, 7vw, 7rem)',       // Hero display
    },
    // Heading sizes
    heading: {
      1: 'clamp(2rem, 5vw, 3.5rem)',      // h1
      2: 'clamp(1.5rem, 4vw, 2.5rem)',    // h2
      3: 'clamp(1.25rem, 3vw, 1.875rem)', // h3
      4: 'clamp(1.1rem, 2.5vw, 1.5rem)',  // h4
      5: 'clamp(1rem, 2vw, 1.25rem)',     // h5
    },
    // Body text
    body: {
      lg: '1.125rem',    // 18px
      base: '1rem',      // 16px
      sm: '0.875rem',    // 14px
      xs: '0.75rem',     // 12px
    },
  },
  
  // Font Weights
  fontWeight: {
    thin: 200,
    extralight: 300,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.1,
    snug: 1.2,
    normal: 1.5,
    relaxed: 1.6,
    loose: 1.8,
  },
  
  // Letter Spacing
  letterSpacing: {
    tighter: '-0.02em',
    tight: '-0.01em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ============================================
// SPACING SCALE
// ============================================

export const SPACING = {
  0: '0px',
  1: '4px',   // xs
  2: '8px',   // sm
  3: '12px',  // md
  4: '16px',  // lg
  6: '24px',  // xl
  8: '32px',  // 2xl
  12: '48px', // 3xl
  16: '64px', // 4xl
} as const;

// ============================================
// BORDER RADIUS
// ============================================

export const BORDER_RADIUS = {
  none: '0px',
  sm: '2px',      // Small elements
  md: '6px',      // Cards & medium
  lg: '8px',      // Large elements
  full: '50%',    // Circles
} as const;

// ============================================
// BREAKPOINTS
// ============================================

export const BREAKPOINTS = {
  xs: '0px',
  sm: '640px',   // Tablet
  md: '768px',   // Tablet+
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px',
} as const;

// ============================================
// SHADOWS
// ============================================

export const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  base: '0 4px 6px rgba(0, 0, 0, 0.1)',
  md: '0 10px 15px rgba(0, 0, 0, 0.1)',
  lg: '0 20px 25px rgba(0, 0, 0, 0.15)',
  xl: '0 25px 50px rgba(0, 0, 0, 0.25)',
} as const;

// ============================================
// BRAND VOICE & MESSAGING
// ============================================

export const BRAND_VOICE = {
  taglines: {
    primary: 'Build Systems. Stay Human.',
    secondary: 'Elegance That Speaks For You',
    tertiary: 'Premium Quality. Zero Compromise.',
  },
  
  tone: {
    // Never use these phrases
    prohibited: [
      'AI-powered',
      'AI-driven',
      'Artificial Intelligence',
      'Autopilot',
      'Auto-magical',
      'Magic',
      'Game-changer',
      'Disruptive',
      'Revolutionary',
      'Blockchain',
      'Web3',
      'Metaverse',
      'Cutting-edge technology',
      'One-click solution',
      'Zero-effort',
      'Powered by machine learning',
    ],
    
    // Always emphasize
    emphasis: [
      'Craftsmanship',
      'Quality',
      'Exclusivity',
      'Customer experience',
      'Authenticity',
      'Design innovation',
      'Cultural relevance',
    ],
    
    // By context
    byContext: {
      productDescription: 'Elegant, detailed, premium',
      cta: 'Direct, action-oriented, clear',
      error: 'Helpful, apologetic, supportive',
      success: 'Celebratory, brief, positive',
      helpText: 'Clear, supportive, guide-like',
    },
  },
} as const;

// ============================================
// COMMON COPY
// ============================================

export const COMMON_COPY = {
  navigation: {
    home: 'الرئيسية',
    shop: 'المتجر',
    about: 'معلومات',
    contact: 'اتصل بنا',
    account: 'حسابي',
  },
  
  buttons: {
    submit: 'تأكيد',
    cancel: 'إلغاء',
    next: 'التالي',
    previous: 'السابق',
    save: 'حفظ',
    delete: 'حذف',
    edit: 'تعديل',
    view: 'عرض',
    close: 'إغلاق',
    loading: 'جاري التحميل...',
  },
  
  messages: {
    success: 'تم بنجاح!',
    error: 'حدث خطأ ما',
    loading: 'جاري التحميل...',
    empty: 'لا توجد بيانات',
    notFound: 'لم يتم العثور على البيانات',
  },
  
  forms: {
    required: 'هذا الحقل مطلوب',
    invalidEmail: 'البريد الإلكتروني غير صحيح',
    passwordTooShort: 'كلمة المرور قصيرة جداً',
    passwordMismatch: 'كلمات المرور غير متطابقة',
  },
} as const;

// ============================================
// COMPONENT SPECIFICATIONS
// ============================================

export const COMPONENT_SPECS = {
  button: {
    height: {
      sm: '32px',
      md: '44px',
      lg: '52px',
    },
    padding: {
      sm: '8px 16px',
      md: '12px 24px',
      lg: '14px 32px',
    },
    fontSize: {
      sm: '12px',
      md: '14px',
      lg: '16px',
    },
    borderRadius: '4px',
    fontWeight: 700,
  },
  
  input: {
    height: '44px',
    padding: '12px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    borderWidth: '1px',
    borderColor: BRAND_COLORS.gray[300],
    focusOutlineWidth: '2px',
    focusOutlineColor: BRAND_COLORS.primary,
  },
  
  card: {
    borderRadius: '6px',
    padding: '24px',
    borderWidth: '1px',
    borderColor: BRAND_COLORS.gray[300],
    shadow: SHADOWS.sm,
  },
} as const;

// ============================================
// EXPORTS FOR CONVENIENCE
// ============================================

export const brand = {
  colors: BRAND_COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  breakpoints: BREAKPOINTS,
  shadows: SHADOWS,
  voice: BRAND_VOICE,
  copy: COMMON_COPY,
  components: COMPONENT_SPECS,
} as const;

export type BrandType = typeof brand;
