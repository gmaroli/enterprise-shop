import { describe, expect, it } from 'vitest';
import { canManageProducts, canViewOrder } from './roles';

describe('permissions', () => {
  it('only admins manage products', () => {
    expect(canManageProducts('ADMIN')).toBe(true);
    expect(canManageProducts('CUSTOMER')).toBe(false);
    expect(canManageProducts(undefined)).toBe(false);
  });

  it('lets owners and admins view an order', () => {
    const order = { userId: 'u1' };
    expect(canViewOrder({ id: 'u1', role: 'CUSTOMER' }, order)).toBe(true);
    expect(canViewOrder({ id: 'u2', role: 'CUSTOMER' }, order)).toBe(false);
    expect(canViewOrder({ id: 'u2', role: 'ADMIN' }, order)).toBe(true);
  });
});
