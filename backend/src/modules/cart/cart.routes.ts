import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getOrCreateOwnProfile } from '../identity/customer-profile.service.js';
import { toCartCustomerDto } from './cart.dto.js';
import { addCartItem, clearCart, getCart, removeCartItem, revalidateCartForSubmission, updateCartItemQuantity } from './cart.service.js';
import { getCartItemProjection, getCartProjections } from './cart-projection.service.js';
import { ValidationError } from '../../shared/errors.js';

export const addCartItemSchema = z.object({
  offerId: z.string().trim().regex(/^\d{5,15}$/),
  skuId: z.string().trim().min(1).max(100),
  qty: z.number().int().positive(),
});
export const updateCartItemSchema = z.object({ qty: z.number().int().positive() });
const itemParamsSchema = z.object({ itemId: z.string().uuid() });

export const cartRoutes: FastifyPluginAsync = async (fastify) => {
  async function customerId(shopifyCustomerId: string) {
    return (await getOrCreateOwnProfile(fastify.prisma, shopifyCustomerId)).id;
  }

  function staleSeconds() {
    return fastify.config.orderSubmission.integrationAttemptStaleSeconds;
  }

  async function assertNotLocked(itemId: string) {
    const projection = await getCartItemProjection(fastify.prisma, itemId, staleSeconds());
    if (projection.locked) {
      throw new ValidationError('이 상품은 주문 생성이 진행 중이라 지금은 수정하거나 삭제할 수 없습니다.');
    }
  }

  fastify.get('/api/v1/me/cart', { preHandler: fastify.verifyShopifyCustomer }, async (request, reply) => {
    const cart = await getCart(fastify.prisma, await customerId(request.shopifyCustomerId!));
    const projections = cart ? await getCartProjections(fastify.prisma, cart.items.map((item) => item.id), staleSeconds()) : undefined;
    reply.send(toCartCustomerDto(cart, projections));
  });

  fastify.post('/api/v1/me/cart/items', { preHandler: fastify.verifyShopifyCustomer }, async (request, reply) => {
    const input = addCartItemSchema.parse(request.body);
    const cart = await addCartItem(
      fastify.prisma,
      fastify.adapters.alibaba1688,
      await customerId(request.shopifyCustomerId!),
      input,
    );
    const projections = await getCartProjections(fastify.prisma, cart.items.map((item) => item.id), staleSeconds());
    reply.status(201).send(toCartCustomerDto(cart, projections));
  });

  fastify.patch('/api/v1/me/cart/items/:itemId', { preHandler: fastify.verifyShopifyCustomer }, async (request, reply) => {
    const { itemId } = itemParamsSchema.parse(request.params);
    const { qty } = updateCartItemSchema.parse(request.body);
    await assertNotLocked(itemId);
    const cart = await updateCartItemQuantity(
      fastify.prisma,
      fastify.adapters.alibaba1688,
      await customerId(request.shopifyCustomerId!),
      itemId,
      qty,
    );
    const projections = await getCartProjections(fastify.prisma, cart.items.map((item) => item.id), staleSeconds());
    reply.send(toCartCustomerDto(cart, projections));
  });

  fastify.delete('/api/v1/me/cart/items/:itemId', { preHandler: fastify.verifyShopifyCustomer }, async (request, reply) => {
    const { itemId } = itemParamsSchema.parse(request.params);
    await assertNotLocked(itemId);
    const cart = await removeCartItem(
      fastify.prisma,
      await customerId(request.shopifyCustomerId!),
      itemId,
    );
    const projections = cart ? await getCartProjections(fastify.prisma, cart.items.map((item) => item.id), staleSeconds()) : undefined;
    reply.send(toCartCustomerDto(cart, projections));
  });

  fastify.delete('/api/v1/me/cart', { preHandler: fastify.verifyShopifyCustomer }, async (request, reply) => {
    reply.send(toCartCustomerDto(await clearCart(fastify.prisma, await customerId(request.shopifyCustomerId!))));
  });

  // Read-only pre-checkout check: re-verifies every cart item against live
  // 1688 data without creating an order or mutating the cart. CheckoutPage.tsx
  // calls this immediately before POST /api/v1/me/orders; submission itself
  // re-runs the same revalidation server-side via buildSubmitOrderInputFromCart,
  // so this endpoint is a UX pre-check, not the source of truth.
  fastify.post('/api/v1/me/cart/revalidate-for-submission', { preHandler: fastify.verifyShopifyCustomer }, async (request, reply) => {
    const result = await revalidateCartForSubmission(
      fastify.prisma,
      fastify.adapters.alibaba1688,
      await customerId(request.shopifyCustomerId!),
    );
    reply.send({
      ok: result.ok,
      issues: result.issues.map((issue) => ({ itemId: issue.itemId, offerId: issue.offerId, skuId: issue.skuId, reason: issue.reason })),
    });
  });
};
