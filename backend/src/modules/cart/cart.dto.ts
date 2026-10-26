import type { Cart, CartItem } from '@prisma/client';
import type { CartItemProjection } from './cart-projection.service.js';

export type CartWithItems = Cart & { items: CartItem[] };

export function toCartCustomerDto(cart: CartWithItems | null, projections?: Map<string, CartItemProjection>) {
  if (!cart) return { expiresAt: null, items: [] };
  return {
    expiresAt: cart.expires_at.toISOString(),
    items: cart.items.map((item) => {
      const projection = projections?.get(item.id);
      return {
        id: item.id,
        offerId: item.offer_id,
        skuId: item.sku_id,
        titleZh: item.title_zh,
        titleKo: item.title_ko,
        imageUrl: item.image_url,
        productUrl: item.product_url,
        videoUrl: item.video_url,
        optionSnapshot: item.option_snapshot,
        qty: item.qty,
        cnyUnitPrice: item.cny_unit_price.toString(),
        stockSnapshot: item.stock_snapshot,
        productSnapshotVersion: item.product_snapshot_version.toISOString(),
        submissionStatus: projection?.status ?? 'NORMAL',
        submissionRequestId: projection?.submissionRequestId ?? null,
        failureReason: projection?.failureReason ?? null,
        locked: projection?.locked ?? false,
      };
    }),
  };
}
