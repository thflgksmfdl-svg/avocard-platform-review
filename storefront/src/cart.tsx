import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import type { CartDto, CartItem } from './types';

export interface CartStore {
  items: CartItem[];
  expiresAt: string | null;
  loading: boolean;
  error: string;
  reload(): Promise<void>;
  add(item: { offerId: string; skuId: string; qty: number }): Promise<void>;
  setQty(key: string, qty: number): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

const CartContext = createContext<CartStore | null>(null);

function toCartItems(dto: CartDto): CartItem[] {
  return dto.items.map((item) => ({ ...item, key: item.id }));
}

export function CartProvider({ children }: { customerId: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    try {
      const cart = await api.cart();
      setItems(toCartItems(cart));
      setExpiresAt(cart.expiresAt);
      setError('');
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401 ? '로그인 세션이 만료되었습니다.' : '장바구니를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  const value = useMemo<CartStore>(() => ({
    items, expiresAt, loading, error, reload,
    async add(input) {
      setLoading(true);
      setError('');
      try {
        const cart = await api.addCartItem(input);
        setItems(toCartItems(cart));
        setExpiresAt(cart.expiresAt);
      } catch (cause) {
        const message = cause instanceof ApiError
          ? (cause.status === 401 ? '로그인 세션이 만료되었습니다.' : cause.message)
          : '장바구니에 담지 못했습니다.';
        setError(message);
        throw cause;
      } finally { setLoading(false); }
    },
    async setQty(key, requestedQty) {
      setError('');
      const qty = Math.max(1, Math.floor(requestedQty));
      try {
        const cart = await api.updateCartItem(key, qty);
        setItems(toCartItems(cart));
        setExpiresAt(cart.expiresAt);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : '장바구니 수량을 저장하지 못했습니다.');
      }
    },
    async remove(key) {
      setError('');
      try {
        const cart = await api.removeCartItem(key);
        setItems(toCartItems(cart));
        setExpiresAt(cart.expiresAt);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : '장바구니 상품을 삭제하지 못했습니다.');
      }
    },
    async clear() {
      setError('');
      try {
        for (const item of items) await api.removeCartItem(item.key);
        setItems([]);
        setExpiresAt(null);
      } catch { setError('장바구니를 비우지 못했습니다.'); }
    },
  }), [items, expiresAt, loading, error]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('CartProvider is missing');
  return value;
}

export function cnyTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + Number(item.cnyUnitPrice) * item.qty, 0);
}
