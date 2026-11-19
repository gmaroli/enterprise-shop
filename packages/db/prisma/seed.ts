import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  [
    'LAP-001',
    'Aero 14 Laptop',
    'Lightweight 14-inch laptop, 16 GB RAM, 512 GB SSD.',
    129900,
    25,
    'Computers',
  ],
  [
    'LAP-002',
    'Forge 16 Pro Laptop',
    '16-inch creator laptop with dedicated GPU.',
    219900,
    10,
    'Computers',
  ],
  [
    'MON-001',
    'ClearView 27" Monitor',
    '27-inch 4K IPS monitor with USB-C.',
    42900,
    40,
    'Computers',
  ],
  [
    'KEY-001',
    'Tactile Mechanical Keyboard',
    'Hot-swappable mechanical keyboard, brown switches.',
    8900,
    120,
    'Accessories',
  ],
  [
    'MOU-001',
    'Glide Wireless Mouse',
    'Ergonomic wireless mouse, 70-day battery.',
    4900,
    200,
    'Accessories',
  ],
  [
    'WEB-001',
    'Focus 1080p Webcam',
    'Full HD webcam with privacy shutter.',
    6900,
    75,
    'Accessories',
  ],
  ['HDP-001', 'Calm ANC Headphones', 'Over-ear noise cancelling headphones.', 19900, 60, 'Audio'],
  ['HDP-002', 'Pulse Earbuds', 'True wireless earbuds, 28-hour case.', 12900, 90, 'Audio'],
  ['SPK-001', 'Boom Portable Speaker', 'Waterproof Bluetooth speaker.', 7900, 80, 'Audio'],
  ['PHN-001', 'Nova 5G Phone 128 GB', '6.4-inch OLED smartphone.', 69900, 35, 'Phones'],
  ['PHN-002', 'Nova Max 256 GB', '6.9-inch flagship smartphone.', 99900, 20, 'Phones'],
  ['CAS-001', 'Armor Phone Case', 'Drop-protection case, fits Nova 5G.', 2900, 300, 'Phones'],
  ['TAB-001', 'Slate 11 Tablet', '11-inch tablet with stylus support.', 49900, 30, 'Computers'],
  ['CHG-001', 'Volt 65W GaN Charger', 'Compact 65W USB-C charger.', 4500, 150, 'Accessories'],
  ['CBL-001', 'Braided USB-C Cable 2m', 'Fast-charging braided cable.', 1500, 500, 'Accessories'],
  [
    'DSK-001',
    'Rise Standing Desk',
    'Electric height-adjustable desk, 140 cm.',
    38900,
    12,
    'Office',
  ],
  [
    'CHR-001',
    'Lumbar Ergonomic Chair',
    'Mesh office chair with lumbar support.',
    27900,
    18,
    'Office',
  ],
  [
    'LMP-001',
    'Beam LED Desk Lamp',
    'Dimmable LED lamp with wireless charging pad.',
    5900,
    70,
    'Office',
  ],
  ['NTB-001', 'Dot-Grid Notebook (3-pack)', 'A5 dot-grid notebooks.', 1800, 400, 'Office'],
  [
    'HUB-001',
    'Link 8-in-1 USB-C Hub',
    'HDMI, SD, Ethernet and USB-A ports.',
    5900,
    110,
    'Accessories',
  ],
  ['SSD-001', 'Swift 1 TB Portable SSD', 'USB 3.2 portable SSD, 1050 MB/s.', 9900, 85, 'Computers'],
  ['SMW-001', 'Pace Smartwatch', 'Fitness smartwatch with GPS.', 24900, 45, 'Wearables'],
  [
    'FIT-001',
    'Band Fitness Tracker',
    'Slim tracker with heart-rate monitoring.',
    5900,
    140,
    'Wearables',
  ],
  [
    'OOS-001',
    'Retro Game Console (sold out)',
    'Limited edition console, currently out of stock.',
    17900,
    0,
    'Computers',
  ],
] as const;

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.exchangeRate.deleteMany();

  const [adminHash, customerHash] = await Promise.all([
    bcrypt.hash('Admin123!', 10),
    bcrypt.hash('Customer123!', 10),
  ]);

  await prisma.user.createMany({
    data: [
      { email: 'admin@shop.test', name: 'Alex Admin', passwordHash: adminHash, role: 'ADMIN' },
      {
        email: 'customer@shop.test',
        name: 'Casey Customer',
        passwordHash: customerHash,
        role: 'CUSTOMER',
      },
    ],
  });

  await prisma.product.createMany({
    data: products.map(([sku, name, description, priceCents, stock, category]) => ({
      sku,
      name,
      description,
      priceCents,
      stock,
      category,
    })),
  });

  await prisma.exchangeRate.createMany({
    data: [
      { currency: 'USD', perUsd: 1 },
      { currency: 'AUD', perUsd: 1.52 },
      { currency: 'GBP', perUsd: 0.78 },
      { currency: 'CAD', perUsd: 1.37 },
      { currency: 'EUR', perUsd: 0.92 },
    ],
  });

  console.log(`Seeded ${products.length} products, 2 users and 5 exchange rates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
