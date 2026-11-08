import { describe, expect, it } from 'vitest';
import { statusForStripeEvent } from './stripe-events';

describe('statusForStripeEvent', () => {
  it('maps successful payments to PAID', () => {
    expect(statusForStripeEvent('checkout.session.completed')).toBe('PAID');
    expect(statusForStripeEvent('checkout.session.async_payment_succeeded')).toBe('PAID');
  });

  it('maps failures and expiry', () => {
    expect(statusForStripeEvent('checkout.session.async_payment_failed')).toBe('FAILED');
    expect(statusForStripeEvent('checkout.session.expired')).toBe('CANCELLED');
  });

  it('ignores unrelated events', () => {
    expect(statusForStripeEvent('customer.created')).toBeNull();
  });
});
