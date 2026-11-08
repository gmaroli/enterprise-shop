import type { OrderStatus } from '@shop/shared';

/** Maps a Stripe event type to the order status it should produce, or null to ignore it. */
export function statusForStripeEvent(type: string): OrderStatus | null {
  switch (type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return 'PAID';
    case 'checkout.session.async_payment_failed':
      return 'FAILED';
    case 'checkout.session.expired':
      return 'CANCELLED';
    default:
      return null;
  }
}
