import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const PRODUCTS = [
  {
    sku: 'SKU-001',
    name: 'Panadol 500mg, Xanh, GSK, H/120v',
    category: 'Giảm đau - Hạ sốt',
    manufacturer: 'GSK',
    unit: 'chai',
    packagingInfo: 'H/120v',
    expiryDate: new Date('2031-03-01'),
    images: [],
    basePrice: 89000,
    currentPrice: 92000,
    previousPrice: 89000,
    priceChangePercent: 3,
    isVAT: true,
    stockQuantity: 500,
    isLimitedStock: false,
    isFeatured: true,
    isActive: true,
    tierPricing: [
      { minQuantity: 5, price: 90000 },
      { minQuantity: 10, price: 88000 },
      { minQuantity: 20, price: 85000 },
    ],
  },
  {
    sku: 'SKU-002',
    name: 'Concor 5mg, Vàng, Merck, H/30v',
    category: 'Tim mạch & Huyết áp',
    manufacturer: 'Merck',
    unit: 'hộp',
    packagingInfo: 'H/30v',
    expiryDate: new Date('2030-11-01'),
    images: [],
    basePrice: 145000,
    currentPrice: 136000,
    previousPrice: 145000,
    priceChangePercent: -6,
    isVAT: true,
    stockQuantity: 120,
    isLimitedStock: false,
    isFeatured: true,
    isActive: true,
    tierPricing: [
      { minQuantity: 5, price: 133000 },
      { minQuantity: 10, price: 130000 },
    ],
  },
  {
    sku: 'SKU-003',
    name: 'Augmentin 1g, Trắng, GSK, H/14v',
    category: 'Kháng sinh',
    manufacturer: 'GSK',
    unit: 'hộp',
    packagingInfo: 'H/14v',
    images: [],
    basePrice: 178000,
    currentPrice: 178000,
    isVAT: true,
    stockQuantity: 80,
    isLimitedStock: true,
    isFeatured: false,
    isActive: true,
    tierPricing: [{ minQuantity: 5, price: 172000 }],
  },
  {
    sku: 'SKU-004',
    name: 'Vitamin C 1000mg, Cam, DHG, Lốc/10 ống',
    category: 'Vitamin & Khoáng chất',
    manufacturer: 'DHG Pharma',
    unit: 'lốc',
    packagingInfo: 'Lốc/10 ống',
    images: [],
    basePrice: 45000,
    currentPrice: 45000,
    isVAT: true,
    stockQuantity: 300,
    isLimitedStock: false,
    isFeatured: false,
    isActive: true,
    tierPricing: [
      { minQuantity: 10, price: 43000 },
      { minQuantity: 20, price: 41000 },
    ],
  },
];

async function main() {
  // ── Admin User ────────────────────────────────────────────────────────────
  const adminEmail = 'admin@jnapharma.vn';
  const existing = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        name: 'Admin JNA Pharma',
        passwordHash: await bcrypt.hash('Admin@2026', 10),
      },
    });
    console.log('Created admin account: admin@jnapharma.vn / Admin@2026');
  } else {
    console.log('Admin account already exists.');
  }

  // ── Products ──────────────────────────────────────────────────────────────
  const productMap: Record<string, string> = {};
  for (const { tierPricing, ...data } of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { sku: data.sku },
      update: data,
      create: data,
    });
    productMap[data.sku] = product.id;
    await prisma.tierPrice.deleteMany({ where: { productId: product.id } });
    await prisma.tierPrice.createMany({
      data: tierPricing.map((t) => ({ ...t, productId: product.id })),
    });
  }
  console.log(`Seeded ${PRODUCTS.length} products.`);

  // ── Promotions & Flash Sales ──────────────────────────────────────────────
  // Clear existing to keep seed idempotent
  await prisma.promotionProduct.deleteMany();
  await prisma.promotion.deleteMany();

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in3hours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const in45min = new Date(now.getTime() + 45 * 60 * 1000);

  // Flash sale 1: Concor -13%
  const flashConcor = await prisma.promotion.create({
    data: {
      type: 'flash_sale',
      manufacturerName: 'Merck',
      title: 'Flash Sale - Concor 5mg giảm 13%',
      totalSaving: 17000,
      startDate: now,
      endDate: in3hours,
      isActive: true,
    },
  });
  await prisma.promotionProduct.create({
    data: {
      productId: productMap['SKU-002'],
      quantity: 1,
      price: 119000,
      isFree: false,
      buyPromotionId: flashConcor.id,
    },
  });

  // Flash sale 2: Augmentin -11%
  const flashAugmentin = await prisma.promotion.create({
    data: {
      type: 'flash_sale',
      manufacturerName: 'GSK',
      title: 'Flash Sale - Augmentin 1g giảm 11%',
      totalSaving: 19000,
      startDate: now,
      endDate: in45min,
      isActive: true,
    },
  });
  await prisma.promotionProduct.create({
    data: {
      productId: productMap['SKU-003'],
      quantity: 1,
      price: 159000,
      isFree: false,
      buyPromotionId: flashAugmentin.id,
    },
  });

  // Buy-get-free 1: Mua 10 Panadol tặng 1 Panadol
  const promoBuyPanadol = await prisma.promotion.create({
    data: {
      type: 'buy_get_free',
      manufacturerName: 'GSK',
      title: 'Mua 10 hộp Panadol tặng 1 hộp',
      totalSaving: 92000,
      minOrderQuantity: 1,
      startDate: now,
      endDate: in7days,
      isActive: true,
    },
  });
  await prisma.promotionProduct.createMany({
    data: [
      {
        productId: productMap['SKU-001'],
        quantity: 10,
        price: 92000,
        isFree: false,
        buyPromotionId: promoBuyPanadol.id,
      },
      {
        productId: productMap['SKU-001'],
        quantity: 1,
        price: 92000,
        isFree: true,
        givePromotionId: promoBuyPanadol.id,
      },
    ],
  });

  // Buy-get-free 2: Mua 5 Concor tặng 1 Vitamin C
  const promoConcorVitC = await prisma.promotion.create({
    data: {
      type: 'buy_get_free',
      manufacturerName: 'Merck',
      title: 'Mua 5 hộp Concor tặng 1 lốc Vitamin C',
      totalSaving: 45000,
      minOrderQuantity: 1,
      startDate: now,
      endDate: in7days,
      isActive: true,
    },
  });
  await prisma.promotionProduct.createMany({
    data: [
      {
        productId: productMap['SKU-002'],
        quantity: 5,
        price: 136000,
        isFree: false,
        buyPromotionId: promoConcorVitC.id,
      },
      {
        productId: productMap['SKU-004'],
        quantity: 1,
        price: 45000,
        isFree: true,
        givePromotionId: promoConcorVitC.id,
      },
    ],
  });

  console.log('Seeded 2 flash sales + 2 buy-get-free promotions.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
