import { describe, expect, it } from 'vitest';
import { isHandledEvent, outcomeForSession, type SessionFacts } from './stripe-events';

const order = { totalCents: 5000, currency: 'usd' };
const paid: SessionFacts = {
  status: 'complete',
  payment_status: 'paid',
  amount_total: 5000,
  currency: 'usd',
};

describe('isHandledEvent', () => {
  it('accepts the checkout session events', () => {
    expect(isHandledEvent('checkout.session.completed')).toBe(true);
    expect(isHandledEvent('checkout.session.expired')).toBe(true);
  });

  it('ignores everything else', () => {
    expect(isHandledEvent('customer.created')).toBe(false);
  });
});

describe('outcomeForSession', () => {
  it('marks a paid session with a matching amount as PAID', () => {
    expect(outcomeForSession(paid, order, 'checkout.session.completed')).toEqual({ kind: 'PAID' });
  });

  it('waits when the session completed but is not paid yet', () => {
    const unpaid = { ...paid, payment_status: 'unpaid' };
    expect(outcomeForSession(unpaid, order, 'checkout.session.completed')).toEqual({
      kind: 'WAIT',
    });
  });

  it('treats a later async success as PAID', () => {
    expect(outcomeForSession(paid, order, 'checkout.session.async_payment_succeeded')).toEqual({
      kind: 'PAID',
    });
  });

  it('reports an amount mismatch instead of paying', () => {
    const result = outcomeForSession({ ...paid, amount_total: 4900 }, order);
    expect(result.kind).toBe('MISMATCH');
  });

  it('compares currency case-insensitively and flags differences', () => {
    expect(outcomeForSession({ ...paid, currency: 'USD' }, order)).toEqual({ kind: 'PAID' });
    expect(outcomeForSession({ ...paid, currency: 'eur' }, order).kind).toBe('MISMATCH');
  });

  it('maps async failure and expiry', () => {
    const open = { status: 'open', payment_status: 'unpaid', amount_total: 5000, currency: 'usd' };
    expect(outcomeForSession(open, order, 'checkout.session.async_payment_failed')).toEqual({
      kind: 'FAILED',
    });
    expect(
      outcomeForSession({ ...open, status: 'expired' }, order, 'checkout.session.expired'),
    ).toEqual({
      kind: 'CANCELLED',
    });
  });

  it('waits for an open, unpaid session', () => {
    const open = { status: 'open', payment_status: 'unpaid', amount_total: 5000, currency: 'usd' };
    expect(outcomeForSession(open, order)).toEqual({ kind: 'WAIT' });
  });
});
