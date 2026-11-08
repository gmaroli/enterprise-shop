import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calculateTotals, canViewOrder, type CheckoutInput, type OrderStatus } from '@shop/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth';
import { StripeService } from '../payments/stripe.service';

const orderInclude = { items: true } as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly config: ConfigService,
  ) {}

  async checkout(user: AuthUser, input: CheckoutInput) {
    // Fail early (before creating an order) if Stripe is not configured.
    const stripe = this.stripeService.stripe;

    const cart = await this.prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) throw new BadRequestException('Your cart is empty');

    const unavailable = cart.items.filter((i) => !i.product.active || i.product.stock < i.quantity);
    if (unavailable.length > 0) {
      throw new BadRequestException(
        `Not enough stock for: ${unavailable.map((i) => i.product.name).join(', ')}`,
      );
    }

    const totals = calculateTotals(
      cart.items.map((i) => ({ unitPriceCents: i.product.priceCents, quantity: i.quantity })),
      input.couponCode,
    );
    const address = input.shippingAddress;

    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        shippingCents: totals.shippingCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        couponCode: totals.appliedCoupon,
        shippingName: address.name,
        shippingLine1: address.line1,
        shippingCity: address.city,
        shippingPostalCode: address.postalCode,
        shippingCountry: address.country,
        items: {
          create: cart.items.map((i) => ({
            productId: i.productId,
            sku: i.product.sku,
            name: i.product.name,
            unitPriceCents: i.product.priceCents,
            quantity: i.quantity,
          })),
        },
      },
      include: orderInclude,
    });

    const webUrl = this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';

    try {
      const lineItems = order.items.map((i) => ({
        quantity: i.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: i.unitPriceCents,
          product_data: { name: i.name, metadata: { sku: i.sku } },
        },
      }));
      if (order.taxCents > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: order.taxCents,
            product_data: { name: 'Sales tax (8%)', metadata: { sku: 'TAX' } },
          },
        });
      }

      const discounts = order.discountCents > 0
        ? [{ coupon: (await stripe.coupons.create({ amount_off: order.discountCents, currency: 'usd', duration: 'once', name: order.couponCode ?? 'Discount' })).id }]
        : undefined;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        discounts,
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: { amount: order.shippingCents, currency: 'usd' },
              display_name: order.shippingCents === 0 ? 'Free shipping' : 'Standard shipping',
            },
          },
        ],
        customer_email: user.email,
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        success_url: `${webUrl}/checkout/success?order=${order.id}`,
        cancel_url: `${webUrl}/cart`,
      });

      await this.prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });
      return { orderId: order.id, checkoutUrl: session.url };
    } catch (error) {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      this.logger.error(`Stripe checkout failed for order ${order.id}: ${String(error)}`);
      throw error;
    }
  }

  list(user: AuthUser, all = false) {
    return this.prisma.order.findMany({
      where: all && user.role === 'ADMIN' ? {} : { userId: user.id },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(user: AuthUser, id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    if (!canViewOrder(user, order)) throw new ForbiddenException('Not your order');
    return order;
  }

  /** Applies a status change coming from a Stripe webhook. Idempotent. */
  async applyStripeStatus(orderId: string, status: OrderStatus, paymentIntentId?: string | null) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) {
      this.logger.warn(`Webhook for unknown order ${orderId}`);
      return;
    }

    if (status === 'PAID') {
      if (order.status === 'PAID') return;
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PAID', paidAt: new Date(), stripePaymentIntentId: paymentIntentId ?? null },
        });
        for (const item of order.items) {
          const result = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (result.count === 0) this.logger.warn(`Oversold ${item.sku} on order ${order.id}`);
        }
        await tx.cartItem.deleteMany({ where: { cart: { userId: order.userId } } });
      });
      return;
    }

    if (order.status === 'PENDING') {
      await this.prisma.order.update({ where: { id: order.id }, data: { status } });
    }
  }
}
