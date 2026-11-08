import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Demo data for the admin dashboard: customers, orders across every status,
// and coupons. Everything created here is tagged DEMO- so it can be removed
// again by re-running this script (it clears the DEMO- rows first).
const prisma = new PrismaClient();

const CUSTOMERS = [
  { email: "mia.thompson@example.com", firstName: "Mia", lastName: "Thompson", countryCode: "US" },
  { email: "jonas.weber@example.com", firstName: "Jonas", lastName: "Weber", countryCode: "DE" },
  { email: "chen.wei@example.com", firstName: "Wei", lastName: "Chen", countryCode: "CN" },
  { email: "sofia.rossi@example.com", firstName: "Sofia", lastName: "Rossi", countryCode: "IT" },
  { email: "liam.oconnor@example.com", firstName: "Liam", lastName: "OConnor", countryCode: "IE" },
  { email: "yuki.tanaka@example.com", firstName: "Yuki", lastName: "Tanaka", countryCode: "JP" },
  { email: "ana.silva@example.com", firstName: "Ana", lastName: "Silva", countryCode: "BR" },
  { email: "omar.haddad@example.com", firstName: "Omar", lastName: "Haddad", countryCode: "AE" },
];

const ADDRESSES = [
  { line1: "18 Kearny St", city: "San Francisco", region: "CA", postalCode: "94108", countryCode: "US" },
  { line1: "Torstrasse 42", city: "Berlin", region: "Berlin", postalCode: "10119", countryCode: "DE" },
  { line1: "Nanjing West Rd 220", city: "Shanghai", region: "Shanghai", postalCode: "200041", countryCode: "CN" },
  { line1: "Via Brera 7", city: "Milan", region: "Lombardy", postalCode: "20121", countryCode: "IT" },
  { line1: "4 Grafton St", city: "Dublin", region: "Leinster", postalCode: "D02 XY66", countryCode: "IE" },
  { line1: "2-14-6 Shibuya", city: "Tokyo", region: "Tokyo", postalCode: "150-0002", countryCode: "JP" },
  { line1: "Av Paulista 1500", city: "Sao Paulo", region: "SP", postalCode: "01310-100", countryCode: "BR" },
  { line1: "Sheikh Zayed Rd 900", city: "Dubai", region: "Dubai", postalCode: "00000", countryCode: "AE" },
];

// status, paymentStatus, daysAgo, item count
const ORDER_PLAN = [
  { status: "DELIVERED", paymentStatus: "PAID", daysAgo: 2, items: 2 },
  { status: "DELIVERED", paymentStatus: "PAID", daysAgo: 4, items: 1 },
  { status: "DELIVERED", paymentStatus: "PAID", daysAgo: 7, items: 3 },
  { status: "SHIPPED", paymentStatus: "PAID", daysAgo: 3, items: 1 },
  { status: "SHIPPED", paymentStatus: "PAID", daysAgo: 5, items: 2 },
  { status: "SHIPPED", paymentStatus: "PAID", daysAgo: 9, items: 1 },
  { status: "PROCESSING", paymentStatus: "PAID", daysAgo: 1, items: 2 },
  { status: "PROCESSING", paymentStatus: "PAID", daysAgo: 6, items: 1 },
  { status: "PROCESSING", paymentStatus: "PAID", daysAgo: 11, items: 2 },
  { status: "PAID", paymentStatus: "PAID", daysAgo: 2, items: 1 },
  { status: "PAID", paymentStatus: "PAID", daysAgo: 8, items: 3 },
  { status: "PENDING", paymentStatus: "UNPAID", daysAgo: 1, items: 1 },
  { status: "PENDING", paymentStatus: "UNPAID", daysAgo: 3, items: 2 },
  { status: "PENDING", paymentStatus: "PENDING", daysAgo: 0, items: 1 },
  { status: "CANCELLED", paymentStatus: "UNPAID", daysAgo: 12, items: 1 },
  { status: "REFUNDED", paymentStatus: "REFUNDED", daysAgo: 15, items: 2 },
];

const COUPONS = [
  { code: "WELCOME10", type: "PERCENTAGE", value: 10, minSpend: 50, usageLimit: 500, usageCount: 37, expiresAtDays: 60, active: true },
  { code: "SUMMER25", type: "PERCENTAGE", value: 25, minSpend: 120, usageLimit: 200, usageCount: 12, expiresAtDays: 21, active: true },
  { code: "FLAT15", type: "FIXED", value: 15, minSpend: 80, usageLimit: 100, usageCount: 4, expiresAtDays: null, active: true },
  { code: "SUMMER24", type: "PERCENTAGE", value: 30, minSpend: 100, usageLimit: 200, usageCount: 120, expiresAtDays: -5, active: false },
];

const round2 = n => Math.round(n * 100) / 100;
const daysAgo = n => new Date(Date.now() - n * 86400000);

async function clearDemo() {
  await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: "DEMO-" } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "DEMO-" } } });
  await prisma.customer.deleteMany({ where: { email: { in: CUSTOMERS.map(c => c.email) } } });
  await prisma.coupon.deleteMany({ where: { code: { in: COUPONS.map(c => c.code) } } });
  await prisma.auditLog.deleteMany({ where: { action: "SEED_DEMO" } });
}

async function main() {
  await clearDemo();

  const customers = [];
  for (const c of CUSTOMERS) {
    customers.push(
      await prisma.customer.upsert({
        where: { email: c.email },
        update: c,
        create: { ...c, marketingOptIn: Math.random() > 0.5 },
      })
    );
  }

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: { variants: { include: { inventory: true } } },
  });
  if (products.length === 0) throw new Error("Run `npm run seed` first - no products to build orders from.");

  const orders = [];
  for (let i = 0; i < ORDER_PLAN.length; i++) {
    const plan = ORDER_PLAN[i];
    const customer = customers[i % customers.length];
    const address = ADDRESSES[customers.indexOf(customer)];

    const lines = [];
    for (let k = 0; k < plan.items; k++) {
      const product = products[(i + k) % products.length];
      const variant = product.variants[0];
      const quantity = 1 + ((i + k) % 2);
      const unitPrice = Number(product.basePrice);
      lines.push({
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        sku: variant.sku,
        quantity,
        unitPrice,
        lineTotal: round2(unitPrice * quantity),
      });
    }

    const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const discount = plan.paymentStatus === "PAID" ? round2(subtotal * 0.1) : 0;
    const shipping = subtotal >= 100 ? 0 : 9.5;
    const tax = round2((subtotal - discount) * 0.08);
    const grandTotal = round2(subtotal - discount + shipping + tax);
    const createdAt = daysAgo(plan.daysAgo);

    const order = await prisma.order.create({
      data: {
        orderNumber: `DEMO-${1000 + i}`,
        customerId: customer.id,
        email: customer.email,
        status: plan.status,
        paymentStatus: plan.paymentStatus,
        currency: "USD",
        subtotal,
        discountTotal: discount,
        shippingTotal: shipping,
        taxTotal: tax,
        grandTotal,
        shippingAddress: address,
        billingAddress: address,
        fulfillmentType: "OWN_WAREHOUSE",
        carrier: ["SHIPPED", "DELIVERED"].includes(plan.status) ? "DHL Express" : null,
        trackingNumber: ["SHIPPED", "DELIVERED"].includes(plan.status) ? `DHL${9200000 + i * 37}` : null,
        createdAt,
        updatedAt: createdAt,
        items: { create: lines },
      },
    });
    orders.push(order);

    // Record the stock movement for fulfilled orders.
    if (["SHIPPED", "DELIVERED"].includes(plan.status)) {
      for (const l of lines) {
        const variant = products.flatMap(p => p.variants).find(v => v.id === l.variantId);
        if (variant?.inventory) {
          await prisma.inventoryMovement.create({
            data: {
              inventoryId: variant.inventory.id,
              type: "SALE",
              quantity: -l.quantity,
              reference: order.orderNumber,
              note: "Demo order",
              createdAt,
            },
          });
        }
      }
    }
  }

  for (const c of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        type: c.type,
        value: c.value,
        currency: "USD",
        minSpend: c.minSpend,
        usageLimit: c.usageLimit,
        usageCount: c.usageCount,
        startsAt: daysAgo(30),
        expiresAt: c.expiresAtDays === null ? null : daysAgo(-c.expiresAtDays),
        active: c.active,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "SEED_DEMO",
      entityType: "Order",
      entityId: orders[0].id,
      metadata: { note: "Demo dataset loaded", orders: orders.length, customers: customers.length },
      ipAddress: "127.0.0.1",
    },
  });

  const paid = orders.filter(o => o.paymentStatus === "PAID");
  const revenue = round2(paid.reduce((sum, o) => sum + Number(o.grandTotal), 0));
  console.log(`Seeded demo data: ${customers.length} customers, ${orders.length} orders (${paid.length} paid, $${revenue} revenue), ${COUPONS.length} coupons.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
