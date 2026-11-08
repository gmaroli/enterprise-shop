import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@shop/db';
import type { ProductInput, ProductQuery } from '@shop/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return { items, total, page: query.page, pageSize: query.pageSize };
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

  async get(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.active) throw new NotFoundException('Product not found');
    return product;
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
