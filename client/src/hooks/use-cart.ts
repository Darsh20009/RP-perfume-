import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@shared/schema';

// Cart specific types
export interface CartItem {
  productId: string;
  variantSku: string;
  quantity: number;
  price: number;
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
                price: Number(product.price),
                title: product.name,
                image: variant.image || product.images[0] || "",
                color: variant.color,
                size: variant.size,
              },
            ],
          });
        }
      },
      removeItem: (productId, variantSku) => {
        set({
          items: get().items.filter(
            item => !(item.productId === productId && item.variantSku === variantSku)
          ),
        });
      },
      updateQuantity: (productId, variantSku, quantity) => {
        set({
          items: get().items.map(item =>
            item.productId === productId && item.variantSku === variantSku
              ? { ...item, quantity }
              : item
          ),
        });
      },
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    }),
    {
      name: 'cart-storage',
    }
  )
);
