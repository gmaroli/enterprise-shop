export const ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export function isAdmin(role: Role | undefined | null): boolean {
  return role === 'ADMIN';
}

export function canManageProducts(role: Role | undefined | null): boolean {
  return isAdmin(role);
}

export function canViewOrder(
  user: { id: string; role: Role },
  order: { userId: string },
): boolean {
  return isAdmin(user.role) || user.id === order.userId;
}
