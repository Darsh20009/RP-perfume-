import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed' | 'cashback';
  value: number;
  minOrderAmount?: number;
  maxCashback?: number;
  isFirstOrderOnly?: boolean;
}

interface CouponStore {
  appliedCoupon: Coupon | null;
  setCoupon: (coupon: Coupon | null) => void;
  clearCoupon: () => void;
}

export const useCoupon = create<CouponStore>()(
  persist(
    (set) => ({
      appliedCoupon: null,
      setCoupon: (coupon) => set({ appliedCoupon: coupon }),
      clearCoupon: () => set({ appliedCoupon: null }),
    }),
    {
      name: 'coupon-storage',
    }
  )
);
