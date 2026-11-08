import { describe, expect, it } from 'vitest';
import { cartItemSchema, productQuerySchema, registerSchema } from './schemas';

describe('schemas', () => {
  it('normalizes email on register', () => {
    const parsed = registerSchema.parse({ email: ' A@B.COM ', password: 'longenough', name: 'A' });
    expect(parsed.email).toBe('a@b.com');
  });

  it('rejects short passwords', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short', name: 'A' }).success).toBe(false);
  });

  it('limits cart quantity', () => {
    expect(cartItemSchema.safeParse({ productId: 'p1', quantity: 0 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ productId: 'p1', quantity: 100 }).success).toBe(false);
    expect(cartItemSchema.safeParse({ productId: 'p1', quantity: 3 }).success).toBe(true);
  });

  it('applies query defaults', () => {
    expect(productQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
  });
});
