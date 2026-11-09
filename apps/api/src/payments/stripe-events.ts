const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

export function isHandledEvent(type: string): boolean {
  return HANDLED_EVENTS.has(type);
}

/** The parts of a Stripe Checkout Session that decide what happens to an order. */
export type SessionFacts = {
  status: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
};

export type OrderFacts = { totalCents: number; currency: string };

export type SessionOutcome =
  | { kind: 'PAID' | 'FAILED' | 'CANCELLED' | 'WAIT' }
  | { kind: 'MISMATCH'; reason: string };

/**
 * Decides what a Checkout Session means for an order. Used for webhook events and for
 * reconciling a session fetched directly from Stripe.
 */
export function outcomeForSession(
  session: SessionFacts,
  order: OrderFacts,
  eventType?: string,
): SessionOutcome {
  if (eventType === 'checkout.session.async_payment_failed') return { kind: 'FAILED' };

  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
    if (session.amount_total !== order.totalCents) {
      return {
        kind: 'MISMATCH',
        reason: `Stripe charged ${session.amount_total} but the order total is ${order.totalCents}`,
      };
    }
    if (session.currency?.toLowerCase() !== order.currency.toLowerCase()) {
      return {
        kind: 'MISMATCH',
        reason: `Stripe currency ${session.currency} differs from the order currency ${order.currency}`,
      };
    }
    return { kind: 'PAID' };
  }

  if (session.status === 'expired') return { kind: 'CANCELLED' };
  return { kind: 'WAIT' };
}
