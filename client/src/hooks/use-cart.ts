import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@shared/schema';
import { trackPixelEvent } from '@/lib/pixels';

// ─── Server sync (debounced) for abandoned-cart tracking ────────────────────
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem('rf_session_id');
  if (!sid) {
    sid = 'sid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('rf_session_id', sid);
  }
  return sid;
}
let syncTimer: any = null;
function scheduleCartSync(items: CartItem[], total: number) {
  if (typeof window === 'undefined') return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch('/api/cart/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        sessionId: getOrCreateSessionId(),
        items: items.map(i => ({
          productId: i.productId,
          variantSku: i.variantSku,
          title: i.title,
          image: i.image,
          price: i.price,
          quantity: i.quantity,
        })),
        total,
      }),
    }).catch(() => {}); // Silent failure — UX shouldn't break on sync errors
  }, 1500);
}

// Cart specific types
export interface CartItem {
  productId: string;
  variantSku: string;
  quantity: number;
  price: number;
  cost: number;
  title: string;
  image: string;
  color?: string;
  size?: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, variant: any, quantity: number) => void;
  removeItem: (productId: string, variantSku: string) => void;
  updateQuantity: (productId: string, variantSku: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
  loadFromServer: () => Promise<void>;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, variant, quantity) => {
        const items = get().items;
        const existingItem = items.find(
          item => item.productId === product.id && item.variantSku === variant.sku
        );

        if (existingItem) {
          set({
            items: items.map(item =>
              item.productId === product.id && item.variantSku === variant.sku
                ? { ...item, quantity: item.quantity + quantity, image: variant.image || item.image }
                : item
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                productId: product.id,
                variantSku: variant.sku,
                quantity,
                price: Number(variant?.price) > 0 ? Number(variant.price) : Number(product.price),
                cost: Number(variant?.cost) > 0 ? Number(variant.cost) : Number(product.cost) || 0,
                title: product.name,
                image: variant.image || product.images[0] || "",
                color: variant.color,
                size: variant.size,
              },
            ],
          });
        }
        const s = get();
        scheduleCartSync(s.items, s.total());
        try {
          trackPixelEvent("AddToCart", {
            contentId: product.id,
            contentName: product.name,
            value: Number(variant?.price) > 0 ? Number(variant.price) : Number(product.price),
            currency: "SAR",
            numItems: quantity,
          });
        } catch {}
      },
      removeItem: (productId, variantSku) => {
        set({
          items: get().items.filter(
            item => !(item.productId === productId && item.variantSku === variantSku)
          ),
        });
        const s = get();
        scheduleCartSync(s.items, s.total());
      },
      updateQuantity: (productId, variantSku, quantity) => {
        set({
          items: get().items.map(item =>
            item.productId === productId && item.variantSku === variantSku
              ? { ...item, quantity }
              : item
          ),
        });
        const s = get();
        scheduleCartSync(s.items, s.total());
      },
      clearCart: () => {
        set({ items: [] });
        scheduleCartSync([], 0);
      },
      total: () => get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
      loadFromServer: async () => {
        try {
          const res = await fetch('/api/cart', { credentials: 'include' });
          if (!res.ok) return;
          const data = await res.json();
          const serverItems: CartItem[] = (data.items || []).map((i: any) => ({
            productId: String(i.productId || ''),
            variantSku: String(i.variantSku || ''),
            quantity: Number(i.quantity) || 1,
            price: Number(i.price) || 0,
            title: String(i.title || ''),
            image: String(i.image || ''),
            color: i.color,
            size: i.size,
          })).filter((i: CartItem) => i.productId && i.variantSku);
          if (serverItems.length === 0) return;
          const local = get().items;
          const merged = [...serverItems];
          local.forEach(li => {
            const exists = merged.find(m => m.productId === li.productId && m.variantSku === li.variantSku);
            if (!exists) merged.push(li);
          });
          set({ items: merged });
        } catch {
          // silent
        }
      },
    }),

    {
      name: 'cart-storage',
    }
  )
);
