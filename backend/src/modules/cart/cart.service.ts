import type { Prisma, PrismaClient } from '@prisma/client';
import type { Alibaba1688Port, ProductDetail, SkuInfo } from '../../integrations/alibaba1688/alibaba1688.port.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import type { CartWithItems } from './cart.dto.js';

export const CART_TTL_MS = 5 * 24 * 60 * 60 * 1000;

function expiresAt(now: Date) {
  return new Date(now.getTime() + CART_TTL_MS);
}

function findSkuOrThrow(product: ProductDetail, skuId: string): SkuInfo {
  const sku = product.skus.find((candidate) => candidate.skuId === skuId);
  if (!sku) throw new ValidationError('선택한 SKU를 현재 상품에서 찾을 수 없습니다.');
  return sku;
}

function validateQuantity(product: ProductDetail, sku: SkuInfo, qty: number) {
  if (product.moq !== undefined && qty < product.moq) {
    throw new ValidationError(`최소 주문수량은 ${product.moq}개입니다.`);
  }
  if (sku.stock !== undefined && qty > sku.stock) {
    throw new ValidationError(`현재 선택 가능한 재고는 ${sku.stock}개입니다.`);
  }
  if (sku.stock === 0) throw new ValidationError('품절된 SKU는 장바구니에 담을 수 없습니다.');
}

async function fetchSnapshot(alibaba1688: Alibaba1688Port, offerId: string, skuId: string, qty: number) {
  const product = await alibaba1688.queryProductDetail({ offerId, country: 'ko' });
  const sku = findSkuOrThrow(product, skuId);
  validateQuantity(product, sku, qty);
  if (!product.seller?.sellerOpenId) {
    throw new ValidationError('판매자 식별정보를 확인할 수 없어 장바구니에 담을 수 없습니다.');
  }
  return { product, sku };
}

const includeItems = { items: { orderBy: { created_at: 'asc' as const } } };

export async function getCart(prisma: PrismaClient, customerId: string, now = new Date()): Promise<CartWithItems | null> {
  const cart = await prisma.cart.findUnique({ where: { customer_id: customerId }, include: includeItems });
  if (!cart || cart.expires_at <= now) return null;
  return cart;
}

export async function addCartItem(
  prisma: PrismaClient,
  alibaba1688: Alibaba1688Port,
  customerId: string,
  input: { offerId: string; skuId: string; qty: number },
  now = new Date(),
): Promise<CartWithItems> {
  const { product, sku } = await fetchSnapshot(alibaba1688, input.offerId, input.skuId, input.qty);
  const imageUrl = sku.attributes.find((attribute) => attribute.imageUrl)?.imageUrl ?? product.imageUrls[0];

  return prisma.$transaction(async (tx) => {
    const existingCart = await tx.cart.findUnique({ where: { customer_id: customerId } });
    const cart = await tx.cart.upsert({
      where: { customer_id: customerId },
      create: { customer_id: customerId, expires_at: expiresAt(now) },
      update: { expires_at: expiresAt(now) },
    });
    // A cart that had already expired keeps its row (customer_id is unique),
    // so upsert above just extends it — but its old items must not survive
    // into the new cart. Wipe them before adding the new item so an expired
    // cart never comes back with stale contents attached.
    if (existingCart && existingCart.expires_at <= now) {
      await tx.cartItem.deleteMany({ where: { cart_id: cart.id } });
    }
    await tx.cartItem.upsert({
      where: { cart_id_offer_id_sku_id: { cart_id: cart.id, offer_id: input.offerId, sku_id: input.skuId } },
      create: {
        cart_id: cart.id,
        offer_id: product.offerId,
        sku_id: sku.skuId,
        seller_id: product.seller!.sellerOpenId!,
        title_zh: product.titleZh,
        title_ko: product.titleTrans,
        image_url: imageUrl,
        product_url: product.sourceUrl,
        video_url: product.videoUrl,
        option_snapshot: sku.attributes as unknown as Prisma.InputJsonValue,
        qty: input.qty,
        cny_unit_price: sku.priceCny,
        stock_snapshot: sku.stock,
        product_snapshot_version: now,
      },
      update: {
        seller_id: product.seller!.sellerOpenId!,
        title_zh: product.titleZh,
        title_ko: product.titleTrans,
        image_url: imageUrl,
        product_url: product.sourceUrl,
        video_url: product.videoUrl,
        option_snapshot: sku.attributes as unknown as Prisma.InputJsonValue,
        qty: input.qty,
        cny_unit_price: sku.priceCny,
        stock_snapshot: sku.stock,
        product_snapshot_version: now,
      },
    });
    return tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: includeItems });
  });
}

export async function updateCartItemQuantity(
  prisma: PrismaClient,
  alibaba1688: Alibaba1688Port,
  customerId: string,
  itemId: string,
  qty: number,
  now = new Date(),
): Promise<CartWithItems> {
  const existing = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { customer_id: customerId, expires_at: { gt: now } } },
  });
  if (!existing) throw new NotFoundError('장바구니 상품을 찾을 수 없습니다.');
  const { product, sku } = await fetchSnapshot(alibaba1688, existing.offer_id, existing.sku_id, qty);
  return prisma.$transaction(async (tx) => {
    await tx.cart.update({ where: { id: existing.cart_id }, data: { expires_at: expiresAt(now) } });
    await tx.cartItem.update({
      where: { id: itemId },
      data: {
        qty,
        cny_unit_price: sku.priceCny,
        stock_snapshot: sku.stock,
        option_snapshot: sku.attributes as unknown as Prisma.InputJsonValue,
        product_snapshot_version: now,
        title_zh: product.titleZh,
        title_ko: product.titleTrans,
      },
    });
    return tx.cart.findUniqueOrThrow({ where: { id: existing.cart_id }, include: includeItems });
  });
}

// An expired cart's row and items are still physically present (customer_id
// is unique, so it is never deleted outright) — but per the 5-day-expiry
// rule a customer must never be able to read or mutate its stale items.
// removeCartItem/clearCart below require expires_at > now for exactly the
// same reason getCart/updateCartItemQuantity already did: a deletion against
// an expired cart must look like there was nothing to delete (404/empty),
// never silently resurrect the cart by touching expires_at.
export async function removeCartItem(prisma: PrismaClient, customerId: string, itemId: string, now = new Date()) {
  const existing = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { customer_id: customerId, expires_at: { gt: now } } },
  });
  if (!existing) throw new NotFoundError('장바구니 상품을 찾을 수 없습니다.');
  return prisma.$transaction(async (tx) => {
    await tx.cartItem.delete({ where: { id: itemId } });
    await tx.cart.update({ where: { id: existing.cart_id }, data: { expires_at: expiresAt(now) } });
    return tx.cart.findUniqueOrThrow({ where: { id: existing.cart_id }, include: includeItems });
  });
}

export async function clearCart(prisma: PrismaClient, customerId: string, now = new Date()) {
  const cart = await prisma.cart.findUnique({ where: { customer_id: customerId } });
  if (!cart || cart.expires_at <= now) return null;
  return prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { cart_id: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { expires_at: expiresAt(now) } });
    return tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: includeItems });
  });
}

export interface CartRevalidationIssue {
  itemId: string;
  offerId: string;
  skuId: string;
  reason: string;
}

export interface CartRevalidationResult {
  ok: boolean;
  issues: CartRevalidationIssue[];
  /** Present only when ok is true — the server-verified values to submit an order with. */
  verifiedItems?: Array<{
    itemId: string;
    offerId: string;
    skuId: string;
    /** 1688's createCrossOrder cargoParamList[].specId — distinct from skuId. May be absent if 1688's product response omitted it; callers that need to place a real 1688 order must check for this before calling createCrossOrder. */
    specId?: string;
    sellerId: string;
    titleZh: string;
    titleKo: string | null;
    imageUrl: string | null;
    productUrl: string | null;
    videoUrl: string | null;
    optionSnapshot: unknown;
    qty: number;
    cnyUnitPrice: string;
  }>;
}

/**
 * Re-validates every item in a non-expired cart against the live 1688 product
 * detail in one pass, for the "submit for order" step order.service.ts does
 * not yet call. Unlike addCartItem/updateCartItemQuantity (which revalidate
 * and persist one item at a time), this never writes to the cart — it is a
 * read-only, all-or-nothing check: if ANY item fails (SKU gone, MOQ no longer
 * met, stock short, price/seller unavailable), submission must be blocked
 * entirely and the customer shown every failing item, not just the first.
 * Nothing here retries automatically; a 1688 lookup failure for one item is
 * recorded as that item's issue and does not stop checking the rest.
 */
export async function revalidateCartForSubmission(
  prisma: PrismaClient,
  alibaba1688: Alibaba1688Port,
  customerId: string,
  now = new Date(),
): Promise<CartRevalidationResult> {
  const cart = await getCart(prisma, customerId, now);
  if (!cart || cart.items.length === 0) {
    return { ok: false, issues: [{ itemId: '', offerId: '', skuId: '', reason: '장바구니가 비어 있습니다.' }] };
  }

  const issues: CartRevalidationIssue[] = [];
  const verifiedItems: NonNullable<CartRevalidationResult['verifiedItems']> = [];

  for (const item of cart.items) {
    try {
      const { product, sku } = await fetchSnapshot(alibaba1688, item.offer_id, item.sku_id, item.qty);
      const imageUrl = sku.attributes.find((attribute) => attribute.imageUrl)?.imageUrl ?? product.imageUrls[0] ?? null;
      verifiedItems.push({
        itemId: item.id,
        offerId: product.offerId,
        skuId: sku.skuId,
        specId: sku.specId,
        sellerId: product.seller!.sellerOpenId!,
        titleZh: product.titleZh,
        titleKo: product.titleTrans ?? null,
        imageUrl,
        productUrl: product.sourceUrl ?? null,
        videoUrl: product.videoUrl ?? null,
        optionSnapshot: sku.attributes,
        qty: item.qty,
        cnyUnitPrice: sku.priceCny,
      });
    } catch (error) {
      issues.push({
        itemId: item.id,
        offerId: item.offer_id,
        skuId: item.sku_id,
        reason: error instanceof ValidationError ? error.message : '상품 정보를 확인하지 못했습니다.',
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, issues: [], verifiedItems };
}
