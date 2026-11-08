import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const productInputSchema = z.object({
  sku: z.string().trim().min(2).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  priceCents: z.number().int().positive().max(10_000_000),
  stock: z.number().int().min(0).max(100_000),
  category: z.string().trim().min(1).max(60),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().default(true),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const productQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export const shippingAddressSchema = z.object({
  name: z.string().trim().min(1).max(100),
  line1: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(3).max(12),
  country: z.string().trim().length(2).toUpperCase(),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
  couponCode: z.string().trim().max(40).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const ORDER_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
