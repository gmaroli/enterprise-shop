import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calculateTotals, canViewOrder, type CheckoutInput } from '@shop/shared';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth';
import { outcomeForSession } from '../payments/stripe-events';
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

  /**
   * Asks Stripe for the current state of an order's Checkout Session and applies it.
   * Lets a customer recover a paid order when the webhook was late or never arrived.
   */
  async syncWithStripe(user: AuthUser, id: string) {
    const order = await this.get(user, id);
    if (order.status !== 'PENDING' || !order.stripeSessionId) return order;

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripeService.stripe.checkout.sessions.retrieve(order.stripeSessionId);
    } catch (error) {
      this.logger.error(`Could not retrieve Stripe session for order ${order.id}: ${String(error)}`);
      throw new BadGatewayException('Could not check the payment with Stripe. Try again shortly.');
    }
    await this.applyStripeSession(order.id, session);
    return this.get(user, id);
  }

  /**
   * Applies what Stripe says about a Checkout Session to our order. Safe to call
   * repeatedly and concurrently (webhook retries, duplicate events, success-page sync).
   */
  async applyStripeSession(orderId: string, session: Stripe.Checkout.Session, eventType?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) {
      this.logger.warn(`Stripe session ${session.id} refers to unknown order ${orderId}`);
      return;
    }

    const outcome = outcomeForSession(session, order, eventType);
    switch (outcome.kind) {
      case 'PAID':
        await this.markPaid(order, this.paymentIntentId(session));
        break;
      case 'FAILED':
      case 'CANCELLED':
        await this.prisma.order.updateMany({
          where: { id: order.id, status: 'PENDING' },
          data: { status: outcome.kind },
        });
        break;
      case 'MISMATCH':
        this.logger.error(`Order ${order.id} not marked paid: ${outcome.reason}`);
        break;
      case 'WAIT':
        break;
    }
  }

  private paymentIntentId(session: Stripe.Checkout.Session): string | null {
    const intent = session.payment_intent;
    return typeof intent === 'string' ? intent : (intent?.id ?? null);
  }

  private async markPaid(order: { id: string; userId: string; items: { productId: string; sku: string; quantity: number }[] }, paymentIntentId: string | null) {
    await this.prisma.$transaction(async (tx) => {
      // Claim the order; if a concurrent call already marked it paid, do nothing.
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: { not: 'PAID' } },
        data: { status: 'PAID', paidAt: new Date(), stripePaymentIntentId: paymentIntentId },
      });
      if (claimed.count === 0) return;

      for (const item of order.items) {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) this.logger.warn(`Oversold ${item.sku} on order ${order.id}`);
      }
      await tx.cartItem.deleteMany({ where: { cart: { userId: order.userId } } });
    });
  }
}
