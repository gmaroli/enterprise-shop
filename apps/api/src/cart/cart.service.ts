import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calculateTotals } from '@shop/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureCart(userId: string) {
    return this.prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  }

  async get(userId: string, couponCode?: string) {
    const cart = await this.ensureCart(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });

    const totals = calculateTotals(
      items.map((i) => ({ unitPriceCents: i.product.priceCents, quantity: i.quantity })),
      couponCode,
    );

    return {
      items: items.map((i) => ({
        productId: i.productId,
        sku: i.product.sku,
        name: i.product.name,
        unitPriceCents: i.product.priceCents,
        quantity: i.quantity,
        lineTotalCents: i.product.priceCents * i.quantity,
        stock: i.product.stock,
        available: i.product.active && i.product.stock >= i.quantity,
      })),
      totals,
    };
  }

  async addItem(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) throw new NotFoundException('Product not found');

    const cart = await this.ensureCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    const newQuantity = (existing?.quantity ?? 0) + quantity;
    if (newQuantity > product.stock) {
      throw new BadRequestException(`Only ${product.stock} in stock`);
    }

    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: newQuantity },
      create: { cartId: cart.id, productId, quantity },
    });
    return this.get(userId);
  }

  async setQuantity(userId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) throw new NotFoundException('Product not found');
    if (quantity > product.stock) throw new BadRequestException(`Only ${product.stock} in stock`);

    const cart = await this.ensureCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    if (!existing) throw new NotFoundException('Item is not in the cart');

    await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
    return this.get(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    return this.get(userId);
  }

  async clear(userId: string) {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.get(userId);
  }
}
