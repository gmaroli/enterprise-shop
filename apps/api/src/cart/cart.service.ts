import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calculateTotals, convertFromUsd, shippingRules, type Currency } from '@shop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.module';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
  ) {}

  private async ensureCart(userId: string) {
    return this.prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  }

  async get(userId: string, couponCode?: string, currency: Currency = 'USD') {
    const cart = await this.ensureCart(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });

    const rate = await this.rates.rateFor(currency);
    const lines = items.map((i) => ({
      item: i,
      unitPriceCents: convertFromUsd(i.product.priceCents, rate),
    }));
    const totals = calculateTotals(
      lines.map((l) => ({ unitPriceCents: l.unitPriceCents, quantity: l.item.quantity })),
      couponCode,
      { ratePerUsd: rate },
    );

    return {
      currency,
      shippingRules: shippingRules(rate),
      items: lines.map(({ item: i, unitPriceCents }) => ({
        productId: i.productId,
        sku: i.product.sku,
        name: i.product.name,
        unitPriceCents,
        quantity: i.quantity,
        lineTotalCents: unitPriceCents * i.quantity,
        stock: i.product.stock,
        available: i.product.active && i.product.stock >= i.quantity,
      })),
      totals,
    };
  }

  async addItem(userId: string, productId: string, quantity: number, currency: Currency = 'USD') {
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
    return this.get(userId, undefined, currency);
  }

  async setQuantity(
    userId: string,
    productId: string,
    quantity: number,
    currency: Currency = 'USD',
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) throw new NotFoundException('Product not found');
    if (quantity > product.stock) throw new BadRequestException(`Only ${product.stock} in stock`);

    const cart = await this.ensureCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    if (!existing) throw new NotFoundException('Item is not in the cart');

    await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
    return this.get(userId, undefined, currency);
  }

  async removeItem(userId: string, productId: string, currency: Currency = 'USD') {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    return this.get(userId, undefined, currency);
  }

  async clear(userId: string, currency: Currency = 'USD') {
    const cart = await this.ensureCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.get(userId, undefined, currency);
  }
}
