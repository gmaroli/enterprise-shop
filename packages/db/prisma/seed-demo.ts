/**
 * Demo order history for reporting and warehouse loads.
 * Deterministic and re-runnable: it replaces only the rows it created (ids starting with "demo_").
 */
import bcrypt from 'bcryptjs';
import { OrderStatus, PrismaClient } from '@prisma/client';
import { calculateTotals, convertFromUsd, currencyForCountry } from '@shop/shared';

const prisma = new PrismaClient();

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)]!;

const FIRST = [
  'Ava',
  'Ben',
  'Chloe',
  'Dan',
  'Eva',
  'Finn',
  'Grace',
  'Hugo',
  'Isla',
  'Jack',
  'Kara',
  'Leo',
];
const LAST = [
  'Nguyen',
  'Smith',
  'Patel',
  'Jones',
  'Garcia',
  'Kim',
  'Brown',
  'Lopez',
  'Wilson',
  'Chen',
  'Taylor',
  'Singh',
];
const PLACES = [
  { country: 'US', city: 'Austin', postal: '78701' },
  { country: 'AU', city: 'Sydney', postal: '2000' },
  { country: 'GB', city: 'Leeds', postal: 'LS1 4AP' },
  { country: 'CA', city: 'Toronto', postal: 'M5H 2N2' },
  { country: 'DE', city: 'Berlin', postal: '10115' },
];
const COUPONS = ['WELCOME10', 'FREESHIP'] as const;

async function main() {
  const products = await prisma.product.findMany({ where: { active: true, stock: { gt: 0 } } });
  if (products.length === 0) throw new Error('Run the base seed first (pnpm db:seed).');

  await prisma.orderItem.deleteMany({ where: { orderId: { startsWith: 'demo_' } } });
  await prisma.order.deleteMany({ where: { id: { startsWith: 'demo_' } } });

  const rateRows = await prisma.exchangeRate.findMany();
  const rates = Object.fromEntries(rateRows.map((r) => [r.currency, r.perUsd.toNumber()]));
  const seededAt = new Date();

  const passwordHash = await bcrypt.hash('Customer123!', 10);
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const customers = FIRST.map((first, i) => ({
    id: `demo_user_${String(i + 1).padStart(2, '0')}`,
    email: `demo.customer${String(i + 1).padStart(2, '0')}@shop.test`,
    name: `${first} ${LAST[i]}`,
    passwordHash,
    role: 'CUSTOMER' as const,
    createdAt: new Date(now - int(60, 120) * day),
  }));
  for (const c of customers) {
    await prisma.user.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, updatedAt: c.createdAt },
    });
  }

  const orders: Parameters<typeof prisma.order.createMany>[0] extends { data: infer D }
    ? D
    : never = [];
  const items: {
    id: string;
    orderId: string;
    productId: string;
    sku: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
  }[] = [];

  for (let n = 1; n <= 220; n++) {
    const id = `demo_${String(n).padStart(4, '0')}`;
    const customer = pick(customers);
    const place = pick(PLACES);
    const createdAt = new Date(now - int(0, 90 * 24 * 60) * 60 * 1000);

    const roll = rand();
    const status: OrderStatus =
      roll < 0.8 ? 'PAID' : roll < 0.88 ? 'PENDING' : roll < 0.95 ? 'CANCELLED' : 'FAILED';
    const paidAt =
      status === 'PAID' ? new Date(createdAt.getTime() + int(1, 30) * 60 * 1000) : null;
    // Rows are stamped when seeded so incremental warehouse loads pick up regenerated orders.
    const updatedAt = seededAt;

    // Orders are priced and charged in the shipping country's currency, like real checkouts.
    const currency = currencyForCountry(place.country);
    const rate = rates[currency] ?? 1;

    const lineCount = int(1, 4);
    const chosen = new Set<string>();
    while (chosen.size < lineCount) chosen.add(pick(products).id);
    const lines = [...chosen].map((productId, idx) => {
      const p = products.find((x) => x.id === productId)!;
      return {
        id: `${id}_${idx + 1}`,
        orderId: id,
        productId,
        sku: p.sku,
        name: p.name,
        unitPriceCents: convertFromUsd(p.priceCents, rate),
        quantity: int(1, 3),
      };
    });

    const coupon = rand() < 0.25 ? pick(COUPONS) : null;
    const totals = calculateTotals(lines, coupon, { ratePerUsd: rate });

    orders.push({
      id,
      userId: customer.id,
      status,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      shippingCents: totals.shippingCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      currency: currency.toLowerCase(),
      fxRate: rate,
      couponCode: totals.appliedCoupon,
      shippingName: customer.name,
      shippingLine1: `${int(1, 999)} Main Street`,
      shippingCity: place.city,
      shippingPostalCode: place.postal,
      shippingCountry: place.country,
      createdAt,
      updatedAt,
      paidAt,
    });
    items.push(...lines);
  }

  await prisma.order.createMany({ data: orders });
  await prisma.orderItem.createMany({ data: items });
  console.log(
    `Demo data: ${customers.length} customers, ${orders.length} orders, ${items.length} order lines.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
