import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@shop/db';
import { convertFromUsd, type Currency, type ProductInput, type ProductQuery } from '@shop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.module';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
  ) {}

  /** Adds the price in the shopper's currency; priceCents stays the USD base price. */
  private withDisplayPrice<T extends { priceCents: number }>(product: T, currency: Currency, rate: number) {
    return {
      ...product,
      displayCurrency: currency,
      displayPriceCents: convertFromUsd(product.priceCents, rate),
    };
  }

  async list(query: ProductQuery, includeInactive = false) {
    const where: Prisma.ProductWhereInput = {
      ...(includeInactive ? {} : { active: true }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    if (includeInactive) return { items, total, page: query.page, pageSize: query.pageSize };

    const rate = await this.rates.rateFor(query.currency);
    return {
      items: items.map((p) => this.withDisplayPrice(p, query.currency, rate)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async categories() {
    const rows = await this.prisma.product.findMany({
      where: { active: true },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  async get(id: string, currency: Currency = 'USD') {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.active) throw new NotFoundException('Product not found');
    return this.withDisplayPrice(product, currency, await this.rates.rateFor(currency));
  }

  async getAny(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(input: ProductInput) {
    const clash = await this.prisma.product.findUnique({ where: { sku: input.sku } });
    if (clash) throw new ConflictException('SKU already exists');
    return this.prisma.product.create({ data: input });
  }

  async update(id: string, input: ProductInput) {
    await this.getAny(id);
    const clash = await this.prisma.product.findFirst({ where: { sku: input.sku, NOT: { id } } });
    if (clash) throw new ConflictException('SKU already exists');
    return this.prisma.product.update({ where: { id }, data: input });
  }

  /** Soft delete so existing orders keep their product reference. */
  async deactivate(id: string) {
    await this.getAny(id);
    return this.prisma.product.update({ where: { id }, data: { active: false } });
  }
}
