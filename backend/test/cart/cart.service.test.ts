import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Alibaba1688Port, ProductDetail } from '../../src/integrations/alibaba1688/alibaba1688.port.js';
import { addCartItem, CART_TTL_MS, clearCart, getCart, removeCartItem, revalidateCartForSubmission, updateCartItemQuantity } from '../../src/modules/cart/cart.service.js';
const product: ProductDetail = { offerId: '997588458127', titleZh: '商品', imageUrls: [], moq: 2, skus: [{ skuId: 's', attributes: [], priceCny: '18.50', stock: 5 }], priceTiers: [], seller: { sellerOpenId: 'seller' } };
const api = (p = product) => ({ queryProductDetail: vi.fn().mockResolvedValue(p) } as unknown as Alibaba1688Port);
describe('cart service', () => {
  it('uses five days and expires at boundary', async () => { expect(CART_TTL_MS).toBe(432000000); const now = new Date(); const db = { cart: { findUnique: vi.fn().mockResolvedValue({ expires_at: now, items: [] }) } } as unknown as PrismaClient; await expect(getCart(db, 'c', now)).resolves.toBeNull(); });
  it('validates MOQ and stock before DB writes', async () => { const db = { $transaction: vi.fn() } as unknown as PrismaClient; await expect(addCartItem(db, api(), 'c', { offerId: product.offerId, skuId: 's', qty: 1 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' }); await expect(addCartItem(db, api(), 'c', { offerId: product.offerId, skuId: 's', qty: 6 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' }); expect(db.$transaction).not.toHaveBeenCalled(); });
  it('clears expired items and stores current price', async () => { const now = new Date(); const del = vi.fn(); const upsert = vi.fn(); const tx = { cart: { findUnique: vi.fn().mockResolvedValue({ id: 'x', expires_at: new Date(now.getTime()-1) }), upsert: vi.fn().mockResolvedValue({ id: 'x' }), findUniqueOrThrow: vi.fn().mockResolvedValue({ expires_at: new Date(now.getTime()+CART_TTL_MS), items: [] }) }, cartItem: { deleteMany: del, upsert } }; const db = { $transaction: vi.fn((cb) => cb(tx)) } as unknown as PrismaClient; await addCartItem(db, api({ ...product, skus: [{ ...product.skus[0]!, priceCny: '21.00' }] }), 'c', { offerId: product.offerId, skuId: 's', qty: 2 }, now); expect(del).toHaveBeenCalled(); expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ cny_unit_price: '21.00' }) })); });
  it('refreshes price and stock on quantity change', async () => { const update = vi.fn(); const tx = { cart: { update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue({ expires_at: new Date(), items: [] }) }, cartItem: { update } }; const db = { cartItem: { findFirst: vi.fn().mockResolvedValue({ cart_id: 'x', offer_id: product.offerId, sku_id: 's' }) }, $transaction: vi.fn((cb) => cb(tx)) } as unknown as PrismaClient; await updateCartItemQuantity(db, api({ ...product, skus: [{ ...product.skus[0]!, priceCny: '22.00', stock: 4 }] }), 'c', '00000000-0000-0000-0000-000000000001', 3); expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ cny_unit_price: '22.00', stock_snapshot: 4 }) })); });
  it('does not retry or write on upstream failure', async () => { const lookup = vi.fn().mockRejectedValue(new Error('upstream')); const db = { $transaction: vi.fn() } as unknown as PrismaClient; await expect(addCartItem(db, { queryProductDetail: lookup } as unknown as Alibaba1688Port, 'c', { offerId: product.offerId, skuId: 's', qty: 2 })).rejects.toThrow('upstream'); expect(lookup).toHaveBeenCalledTimes(1); expect(db.$transaction).not.toHaveBeenCalled(); });
  it('rejects removing an item from an expired cart as not-found', async () => { const db = { cartItem: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient; await expect(removeCartItem(db, 'c', 'item-1')).rejects.toMatchObject({ code: 'NOT_FOUND' }); expect((db.cartItem.findFirst as any).mock.calls[0][0].where.cart.expires_at).toEqual({ gt: expect.any(Date) }); });
  it('treats clearCart on an expired cart as already empty, without reviving it', async () => { const now = new Date(); const update = vi.fn(); const db = { cart: { findUnique: vi.fn().mockResolvedValue({ id: 'x', expires_at: new Date(now.getTime() - 1) }), update }, $transaction: vi.fn() } as unknown as PrismaClient; await expect(clearCart(db, 'c', now)).resolves.toBeNull(); expect(update).not.toHaveBeenCalled(); expect(db.$transaction).not.toHaveBeenCalled(); });
  it('blocks submission with every failing item when the cart is non-empty but a SKU is now invalid', async () => {
    const now = new Date();
    const db = { cart: { findUnique: vi.fn().mockResolvedValue({ expires_at: new Date(now.getTime() + CART_TTL_MS), items: [
      { id: 'i1', offer_id: product.offerId, sku_id: 's', qty: 2 },
      { id: 'i2', offer_id: 'o2', sku_id: 'missing', qty: 1 },
    ] }) } } as unknown as PrismaClient;
    const alibaba1688 = { queryProductDetail: vi.fn(async ({ offerId }: { offerId: string }) =>
      offerId === product.offerId ? product : { ...product, offerId: 'o2', skus: [] }) } as unknown as Alibaba1688Port;
    const result = await revalidateCartForSubmission(db, alibaba1688, 'c', now);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([expect.objectContaining({ itemId: 'i2', offerId: 'o2', skuId: 'missing' })]);
    expect(result.verifiedItems).toBeUndefined();
  });
  it('returns server-verified values for every item when the whole cart is still valid', async () => {
    const now = new Date();
    const db = { cart: { findUnique: vi.fn().mockResolvedValue({ expires_at: new Date(now.getTime() + CART_TTL_MS), items: [
      { id: 'i1', offer_id: product.offerId, sku_id: 's', qty: 2 },
    ] }) } } as unknown as PrismaClient;
    const result = await revalidateCartForSubmission(db, api({ ...product, skus: [{ ...product.skus[0]!, priceCny: '19.99' }] }), 'c', now);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.verifiedItems).toEqual([expect.objectContaining({ itemId: 'i1', sellerId: 'seller', cnyUnitPrice: '19.99', qty: 2 })]);
  });
  it('reports an empty or expired cart as a submission block rather than an empty success', async () => {
    const db = { cart: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
    const result = await revalidateCartForSubmission(db, api(), 'c');
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
