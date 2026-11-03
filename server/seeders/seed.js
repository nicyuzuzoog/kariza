import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { ROLES } from '../config/constants.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';
import Issue from '../models/Issue.js';
import Transfer from '../models/Transfer.js';
import LedgerEntry from '../models/LedgerEntry.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import { makeReference } from '../utils/helpers.js';
import { moveStock } from '../utils/stock.js';
import { syncStockNotification } from '../utils/notifications.js';

const WITH_DEMO = process.argv.includes('--demo');
const FRESH = process.argv.includes('--fresh');

const at = (daysAgo, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date;
};

const IMAGES = {
  maize: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
  oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
  beans: 'https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=600&q=80',
  milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
  sugar: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=600&q=80',
  tea: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
  books: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=600&q=80',
  paper: 'https://images.unsplash.com/photo-1568205612837-017257d2310a?auto=format&fit=crop&w=600&q=80',
  pens: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=600&q=80',
  markers: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=80',
  chalk: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80',
  soap: 'https://images.unsplash.com/photo-1607006483224-5c5b6e2e6a5b?auto=format&fit=crop&w=600&q=80',
  tissue: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?auto=format&fit=crop&w=600&q=80',
  disinfectant: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=600&q=80',
  sweater: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=600&q=80',
  sports: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=80',
  desk: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80',
  water: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=600&q=80',
};

async function ensureUser(data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) return existing;
  return User.create(data);
}

async function clearData() {
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Supplier.deleteMany({}),
    Purchase.deleteMany({}),
    Issue.deleteMany({}),
    Transfer.deleteMany({}),
    LedgerEntry.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('✓ Existing collections cleared (--fresh)');
}

async function run() {
  await connectDB();

  if (FRESH) await clearData();

  const superAdmin = await ensureUser({
    name: env.superAdmin.name,
    email: env.superAdmin.email.toLowerCase(),
    password: env.superAdmin.password,
    role: ROLES.SUPER_ADMIN,
    status: 'active',
  });

  console.log('✓ Super Admin ready');
  console.log(`  ${superAdmin.email} / ${env.superAdmin.password}`);

  if (!WITH_DEMO) {
    console.log('\n  Tip: run “npm run seed:demo” to load sample inventory, purchases and alerts.');
    await mongoose.connection.close();
    process.exit(0);
  }

  if ((await Product.countDocuments()) > 0) {
    console.log('\n✓ Demo data already present — skipping demo seed.');
    console.log('  Use “npm run seed:demo -- --fresh” to rebuild the demo dataset.');
    await mongoose.connection.close();
    process.exit(0);
  }

  const accountant = await ensureUser({
    name: 'Amina Yusuf',
    email: 'accountant@mrskariza.school',
    password: 'Account@1234',
    role: ROLES.ACCOUNTANT,
    phone: '+254 712 400 118',
    status: 'active',
    createdBy: superAdmin._id,
  });

  const storekeeper = await ensureUser({
    name: 'Joseph Mwangi',
    email: 'storekeeper@mrskariza.school',
    password: 'Store@1234',
    role: ROLES.STOREKEEPER,
    phone: '+254 733 210 904',
    status: 'active',
    createdBy: superAdmin._id,
  });

  const principal = await ensureUser({
    name: 'Dr. Grace Ndlovu',
    email: 'principal@mrskariza.school',
    password: 'Principal@1234',
    role: ROLES.PRINCIPAL,
    phone: '+254 700 887 221',
    status: 'active',
    createdBy: superAdmin._id,
  });

  console.log('✓ Demo accounts ready (accountant, storekeeper, principal)');

  const suppliers = await Supplier.create([
    {
      name: 'Kilimanjaro Wholesale Foods',
      contactName: 'Peter Otieno',
      phone: '+254 722 114 900',
      email: 'orders@kilimanjarofoods.co.ke',
      address: 'Industrial Area, Nairobi',
      category: 'Food & Provisions',
      notes: 'Weekly dry goods and cooking supplies. Deliveries on Tuesdays.',
    },
    {
      name: 'Stationery World Ltd',
      contactName: 'Lydia Chebet',
      phone: '+254 711 502 337',
      email: 'sales@stationeryworld.co.ke',
      address: 'River Road, Nairobi',
      category: 'Stationery & Supplies',
      notes: 'Bulk exercise books, paper and writing materials.',
    },
    {
      name: 'CleanPro Hygiene Supplies',
      contactName: 'Daniel Kimani',
      phone: '+254 720 665 112',
      email: 'hello@cleanpro.co.ke',
      address: 'Mombasa Road, Nairobi',
      category: 'Cleaning & Hygiene',
      notes: 'Soap, tissue and disinfectant. Monthly contract pricing.',
    },
    {
      name: 'EduFit Uniforms & Sports',
      contactName: 'Faith Wanjiru',
      phone: '+254 734 889 001',
      email: 'school@edufit.co.ke',
      address: 'Ngara, Nairobi',
      category: 'Uniforms & Wear',
      notes: 'Uniforms, sweaters and sports kits. Custom sizing available.',
    },
    {
      name: 'Rift Valley School Furniture',
      contactName: 'Samuel Kariuki',
      phone: '+254 705 330 240',
      email: 'furniture@rvschool.co.ke',
      address: 'Nakuru',
      category: 'Furniture & Equipment',
      notes: 'Desks, chairs and classroom equipment.',
    },
  ]);

  const [food, stationery, hygiene, uniforms, furniture] = suppliers;

  const productRows = [
    {
      name: 'Maize Flour (25kg)',
      sku: 'FOD-MAIZE25',
      category: 'Food & Provisions',
      unit: 'pack',
      quantity: 18,
      reorderLevel: 20,
      unitCost: 480,
      supplier: food._id,
      storageLocation: 'Dry store — Rack A',
      imageUrl: IMAGES.maize,
      description: 'Fortified maize flour used by the school kitchen for ugali and porridge.',
    },
    {
      name: 'Basmati Rice (25kg)',
      sku: 'FOD-RICE25',
      category: 'Food & Provisions',
      unit: 'pack',
      quantity: 42,
      branchQuantity: 6,
      reorderLevel: 15,
      unitCost: 780,
      supplier: food._id,
      storageLocation: 'Dry store — Rack A',
      imageUrl: IMAGES.rice,
      description: 'Premium long-grain rice for boarding meals.',
    },
    {
      name: 'Cooking Oil (5L)',
      sku: 'FOD-OIL5L',
      category: 'Food & Provisions',
      unit: 'piece',
      quantity: 0,
      reorderLevel: 12,
      unitCost: 420,
      supplier: food._id,
      storageLocation: 'Dry store — Rack B',
      imageUrl: IMAGES.oil,
      description: 'Refined vegetable cooking oil, 5-litre jerrican.',
    },
    {
      name: 'Beans (10kg)',
      sku: 'FOD-BEANS10',
      category: 'Food & Provisions',
      unit: 'pack',
      quantity: 9,
      reorderLevel: 10,
      unitCost: 650,
      supplier: food._id,
      storageLocation: 'Dry store — Rack B',
      imageUrl: IMAGES.beans,
      description: 'Rosecoco beans for the weekly school menu.',
    },
    {
      name: 'Milk Powder (900g)',
      sku: 'FOD-MILK900',
      category: 'Food & Provisions',
      unit: 'piece',
      quantity: 64,
      reorderLevel: 20,
      unitCost: 290,
      supplier: food._id,
      storageLocation: 'Dry store — Shelf C',
      imageUrl: IMAGES.milk,
      description: 'Fortified instant milk powder for tea and porridge.',
    },
    {
      name: 'Sugar (2kg)',
      sku: 'FOD-SUGAR2',
      category: 'Food & Provisions',
      unit: 'pack',
      quantity: 120,
      reorderLevel: 30,
      unitCost: 95,
      supplier: food._id,
      storageLocation: 'Dry store — Shelf C',
      imageUrl: IMAGES.sugar,
      description: 'White refined sugar for kitchen and staff room use.',
    },
    {
      name: 'Tea Leaves (500g)',
      sku: 'FOD-TEA500',
      category: 'Food & Provisions',
      unit: 'pack',
      quantity: 36,
      reorderLevel: 15,
      unitCost: 140,
      supplier: food._id,
      storageLocation: 'Dry store — Shelf C',
      imageUrl: IMAGES.tea,
      description: 'Black tea blend served during breaks.',
    },
    {
      name: 'Exercise Books (48 pages)',
      sku: 'STN-EXBOOK48',
      category: 'Stationery & Supplies',
      unit: 'dozen',
      quantity: 48,
      branchQuantity: 12,
      reorderLevel: 20,
      unitCost: 220,
      supplier: stationery._id,
      storageLocation: 'Stationery store — Bay 1',
      imageUrl: IMAGES.books,
      description: 'A5 ruled exercise books, sold in dozens.',
    },
    {
      name: 'A4 Copy Paper (80gsm)',
      sku: 'STN-A4REAM',
      category: 'Stationery & Supplies',
      unit: 'ream',
      quantity: 26,
      branchQuantity: 4,
      reorderLevel: 15,
      unitCost: 320,
      supplier: stationery._id,
      storageLocation: 'Stationery store — Bay 1',
      imageUrl: IMAGES.paper,
      description: '500-sheet reams for examinations and administration.',
    },
    {
      name: 'Ballpoint Pens (Blue)',
      sku: 'STN-PENBLUE',
      category: 'Stationery & Supplies',
      unit: 'box',
      quantity: 12,
      reorderLevel: 10,
      unitCost: 185,
      supplier: stationery._id,
      storageLocation: 'Stationery store — Bay 2',
      imageUrl: IMAGES.pens,
      description: 'Box of 50 blue ballpoint pens.',
    },
    {
      name: 'Whiteboard Markers',
      sku: 'STN-MARKER',
      category: 'Stationery & Supplies',
      unit: 'pack',
      quantity: 7,
      reorderLevel: 10,
      unitCost: 260,
      supplier: stationery._id,
      storageLocation: 'Stationery store — Bay 2',
      imageUrl: IMAGES.markers,
      description: 'Assorted colours, pack of 4.',
    },
    {
      name: 'Chalk Boxes',
      sku: 'STN-CHALK',
      category: 'Stationery & Supplies',
      unit: 'box',
      quantity: 32,
      reorderLevel: 12,
      unitCost: 130,
      supplier: stationery._id,
      storageLocation: 'Stationery store — Bay 3',
      imageUrl: IMAGES.chalk,
      description: 'Dustless white chalk, 100 sticks per box.',
    },
    {
      name: 'Hand Soap (5L)',
      sku: 'CLN-SOAP5L',
      category: 'Cleaning & Hygiene',
      unit: 'piece',
      quantity: 8,
      branchQuantity: 2,
      reorderLevel: 6,
      unitCost: 380,
      supplier: hygiene._id,
      storageLocation: 'Hygiene store — Shelf A',
      imageUrl: IMAGES.soap,
      description: 'Liquid hand soap for washrooms and dining hall.',
    },
    {
      name: 'Toilet Paper (24 rolls)',
      sku: 'CLN-TISSUE24',
      category: 'Cleaning & Hygiene',
      unit: 'pack',
      quantity: 4,
      reorderLevel: 8,
      unitCost: 640,
      supplier: hygiene._id,
      storageLocation: 'Hygiene store — Shelf B',
      imageUrl: IMAGES.tissue,
      description: 'Two-ply toilet tissue, bulk pack.',
    },
    {
      name: 'Disinfectant (5L)',
      sku: 'CLN-DISINF5L',
      category: 'Cleaning & Hygiene',
      unit: 'piece',
      quantity: 15,
      reorderLevel: 5,
      unitCost: 520,
      supplier: hygiene._id,
      storageLocation: 'Hygiene store — Shelf B',
      imageUrl: IMAGES.disinfectant,
      description: 'Concentrated floor and surface disinfectant.',
    },
    {
      name: 'School Sweater',
      sku: 'UNF-SWEATER',
      category: 'Uniforms & Wear',
      unit: 'piece',
      quantity: 22,
      reorderLevel: 10,
      unitCost: 850,
      supplier: uniforms._id,
      storageLocation: 'Uniform store — Bay A',
      imageUrl: IMAGES.sweater,
      description: 'Navy blue knitted school sweater, sizes 8–16.',
    },
    {
      name: 'Sports Kit',
      sku: 'UNF-SPORTKIT',
      category: 'Uniforms & Wear',
      unit: 'piece',
      quantity: 14,
      branchQuantity: 3,
      reorderLevel: 12,
      unitCost: 1200,
      supplier: uniforms._id,
      storageLocation: 'Uniform store — Bay B',
      imageUrl: IMAGES.sports,
      description: 'House-colour jersey and shorts set.',
    },
    {
      name: 'Student Desk',
      sku: 'EQP-DESK',
      category: 'Furniture & Equipment',
      unit: 'piece',
      quantity: 40,
      branchQuantity: 12,
      reorderLevel: 10,
      unitCost: 3200,
      supplier: furniture._id,
      storageLocation: 'Furniture yard',
      imageUrl: IMAGES.desk,
      description: 'Twin-seater wooden student desk.',
    },
    {
      name: 'Water Dispenser',
      sku: 'EQP-DISPENSER',
      category: 'Furniture & Equipment',
      unit: 'piece',
      quantity: 3,
      reorderLevel: 2,
      unitCost: 12500,
      supplier: furniture._id,
      storageLocation: 'Equipment room',
      imageUrl: IMAGES.water,
      description: 'Floor-standing hot and cold water dispenser.',
    },
  ];

  const products = await Product.create(
    productRows.map((row) => ({
      ...row,
      quantity: 0,
      branchQuantity: 0,
      createdBy: accountant._id,
    }))
  );
  const bySku = Object.fromEntries(products.map((product) => [product.sku, product]));

  // Opening balances so every unit in the store has a traceable origin.
  for (const row of productRows) {
    const product = bySku[row.sku];
    if (row.quantity > 0) {
      await moveStock({
        productId: product._id,
        quantity: row.quantity,
        direction: 'in',
        type: 'adjustment_in',
        location: 'main',
        unitCost: product.unitCost,
        party: 'Opening balance',
        referenceDoc: `OPEN-${product.sku}`,
        note: 'Stock carried forward when Mrskariza was set up',
        performedBy: accountant._id,
        occurredAt: at(60, 8),
      });
    }
    if (row.branchQuantity > 0) {
      await moveStock({
        productId: product._id,
        quantity: row.branchQuantity,
        direction: 'in',
        type: 'adjustment_in',
        location: 'branch',
        unitCost: product.unitCost,
        party: 'Opening balance',
        referenceDoc: `OPEN-${product.sku}-BR`,
        note: 'Branch opening balance',
        performedBy: accountant._id,
        occurredAt: at(60, 8),
      });
    }
  }

  // ── Purchases ──────────────────────────────────────────────────────────
  async function seedPurchase({ supplier, lines, daysAgo, status, paymentStatus, invoiceNo, notes }) {
    const date = at(daysAgo);
    const items = lines.map(({ sku, quantity }) => {
      const product = bySku[sku];
      return {
        product: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity,
        unitCost: product.unitCost,
      };
    });

    const purchase = await Purchase.create({
      reference: makeReference('PO'),
      supplier: supplier._id,
      supplierName: supplier.name,
      invoiceNo,
      purchaseDate: date,
      items,
      paymentStatus,
      status,
      notes,
      createdBy: accountant._id,
      receivedAt: status === 'received' ? date : undefined,
      receivedBy: status === 'received' ? accountant._id : undefined,
      createdAt: date,
    });

    if (status === 'received') {
      for (const item of items) {
        await moveStock({
          productId: item.product,
          quantity: item.quantity,
          direction: 'in',
          type: 'purchase',
          location: 'main',
          unitCost: item.unitCost,
          party: supplier.name,
          referenceDoc: purchase.reference,
          note: invoiceNo ? `Invoice ${invoiceNo}` : 'Goods received',
          performedBy: accountant._id,
          occurredAt: date,
        });
      }
    }
    return purchase;
  }

  await seedPurchase({
    supplier: food,
    lines: [
      { sku: 'FOD-RICE25', quantity: 10 },
      { sku: 'FOD-MILK900', quantity: 12 },
      { sku: 'FOD-TEA500', quantity: 10 },
      { sku: 'FOD-SUGAR2', quantity: 20 },
    ],
    daysAgo: 34,
    status: 'received',
    paymentStatus: 'paid',
    invoiceNo: 'KWF-4412',
    notes: 'Monthly dry goods delivery.',
  });

  await seedPurchase({
    supplier: stationery,
    lines: [
      { sku: 'STN-EXBOOK48', quantity: 24 },
      { sku: 'STN-A4REAM', quantity: 10 },
      { sku: 'STN-PENBLUE', quantity: 6 },
    ],
    daysAgo: 3,
    status: 'received',
    paymentStatus: 'partial',
    invoiceNo: 'STW-2091',
    notes: 'Term two stationery restock.',
  });

  await seedPurchase({
    supplier: stationery,
    lines: [{ sku: 'STN-CHALK', quantity: 10 }],
    daysAgo: 5,
    status: 'received',
    paymentStatus: 'paid',
    invoiceNo: 'STW-2074',
    notes: 'Chalk top-up for classrooms.',
  });

  await seedPurchase({
    supplier: food,
    lines: [
      { sku: 'FOD-MAIZE25', quantity: 40 },
      { sku: 'FOD-OIL5L', quantity: 24 },
    ],
    daysAgo: 2,
    status: 'ordered',
    paymentStatus: 'unpaid',
    invoiceNo: '',
    notes: 'Urgent — kitchen staples below reorder level.',
  });

  await seedPurchase({
    supplier: hygiene,
    lines: [
      { sku: 'CLN-SOAP5L', quantity: 12 },
      { sku: 'CLN-DISINF5L', quantity: 10 },
    ],
    daysAgo: 1,
    status: 'ordered',
    paymentStatus: 'unpaid',
    invoiceNo: '',
    notes: 'Awaiting delivery confirmation.',
  });

  await seedPurchase({
    supplier: uniforms,
    lines: [{ sku: 'UNF-SPORTKIT', quantity: 5 }],
    daysAgo: 10,
    status: 'cancelled',
    paymentStatus: 'unpaid',
    invoiceNo: 'EDF-1180',
    notes: 'Cancelled — wrong house colours supplied.',
  });

  // ── Issues ─────────────────────────────────────────────────────────────
  async function seedIssue({ lines, recipientName, recipientType, className, department, purpose, daysAgo, issuedBy }) {
    const date = at(daysAgo, 11);
    const items = lines.map(({ sku, quantity }) => {
      const product = bySku[sku];
      return {
        product: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity,
        unitCost: product.unitCost,
      };
    });

    const issue = await Issue.create({
      reference: makeReference('ISS'),
      items,
      recipientName,
      recipientType,
      className,
      department,
      purpose,
      location: 'main',
      issueDate: date,
      status: 'issued',
      createdBy: issuedBy._id,
      createdAt: date,
    });

    for (const item of items) {
      await moveStock({
        productId: item.product,
        quantity: item.quantity,
        direction: 'out',
        type: 'issue',
        location: 'main',
        unitCost: item.unitCost,
        party: recipientName,
        referenceDoc: issue.reference,
        note: purpose,
        performedBy: issuedBy._id,
        occurredAt: date,
      });
    }
    return issue;
  }

  await seedIssue({
    lines: [
      { sku: 'STN-EXBOOK48', quantity: 6 },
      { sku: 'STN-PENBLUE', quantity: 2 },
    ],
    recipientName: 'Form 4A',
    recipientType: 'class',
    className: 'Form 4A',
    department: 'Academics',
    purpose: 'End-of-term examination materials',
    daysAgo: 12,
    issuedBy: storekeeper,
  });

  await seedIssue({
    lines: [
      { sku: 'FOD-RICE25', quantity: 5 },
      { sku: 'FOD-BEANS10', quantity: 2 },
    ],
    recipientName: 'Kitchen & Dining',
    recipientType: 'department',
    department: 'Kitchen & Dining',
    purpose: 'Weekly boarding meal preparation',
    daysAgo: 6,
    issuedBy: storekeeper,
  });

  await seedIssue({
    lines: [
      { sku: 'STN-CHALK', quantity: 4 },
      { sku: 'STN-MARKER', quantity: 2 },
    ],
    recipientName: 'Science Department',
    recipientType: 'department',
    department: 'Science Department',
    purpose: 'Classroom supplies for practical lessons',
    daysAgo: 3,
    issuedBy: storekeeper,
  });

  await seedIssue({
    lines: [
      { sku: 'FOD-TEA500', quantity: 2 },
      { sku: 'FOD-SUGAR2', quantity: 5 },
    ],
    recipientName: 'Staff Room',
    recipientType: 'staff',
    department: 'Administration',
    purpose: 'Staff break refreshments',
    daysAgo: 4,
    issuedBy: accountant,
  });

  await seedIssue({
    lines: [
      { sku: 'CLN-TISSUE24', quantity: 2 },
      { sku: 'CLN-SOAP5L', quantity: 2 },
    ],
    recipientName: 'Boarding Section',
    recipientType: 'department',
    department: 'Boarding Section',
    purpose: 'Washroom and dormitory supplies',
    daysAgo: 1,
    issuedBy: storekeeper,
  });

  // ── Transfers ──────────────────────────────────────────────────────────
  async function seedTransfer({ lines, daysAgo, complete, createdBy }) {
    const date = at(daysAgo, 9);
    const items = lines.map(({ sku, quantity }) => {
      const product = bySku[sku];
      return {
        product: product._id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity,
      };
    });

    const transfer = await Transfer.create({
      reference: makeReference('TRF'),
      from: 'main',
      to: 'branch',
      items,
      status: complete ? 'completed' : 'in_transit',
      notes: 'Scheduled branch replenishment',
      dispatchedAt: date,
      createdBy: createdBy._id,
      completedAt: complete ? at(daysAgo - 1, 15) : undefined,
      completedBy: complete ? accountant._id : undefined,
      createdAt: date,
    });

    for (const item of items) {
      await moveStock({
        productId: item.product,
        quantity: item.quantity,
        direction: 'out',
        type: 'transfer_out',
        location: 'main',
        party: 'Transfer to Branch campus store',
        referenceDoc: transfer.reference,
        note: 'Scheduled branch replenishment',
        performedBy: createdBy._id,
        occurredAt: date,
      });
    }

    if (complete) {
      for (const item of items) {
        await moveStock({
          productId: item.product,
          quantity: item.quantity,
          direction: 'in',
          type: 'transfer_in',
          location: 'branch',
          party: 'Transfer from Main campus store',
          referenceDoc: `${transfer.reference}-IN`,
          note: 'Branch receipt confirmed',
          performedBy: accountant._id,
          occurredAt: at(daysAgo - 1, 15),
        });
      }
    }
    return transfer;
  }

  await seedTransfer({
    lines: [
      { sku: 'FOD-RICE25', quantity: 8 },
      { sku: 'STN-EXBOOK48', quantity: 6 },
      { sku: 'FOD-MILK900', quantity: 10 },
    ],
    daysAgo: 9,
    complete: true,
    createdBy: accountant,
  });

  await seedTransfer({
    lines: [
      { sku: 'FOD-SUGAR2', quantity: 20 },
      { sku: 'STN-CHALK', quantity: 5 },
    ],
    daysAgo: 1,
    complete: false,
    createdBy: storekeeper,
  });

  for (const product of await Product.find()) {
    await syncStockNotification(product);
  }

  await AuditLog.create([
    {
      actor: accountant._id,
      actorName: accountant.name,
      actorRole: accountant.role,
      action: 'purchase.receive',
      entity: 'Purchase',
      description: 'Received stationery restock from Stationery World Ltd',
      createdAt: at(3, 12),
    },
    {
      actor: storekeeper._id,
      actorName: storekeeper.name,
      actorRole: storekeeper.role,
      action: 'issue.create',
      entity: 'Issue',
      description: 'Issued washroom supplies to the Boarding Section',
      createdAt: at(1, 11),
    },
    {
      actor: accountant._id,
      actorName: accountant.name,
      actorRole: accountant.role,
      action: 'transfer.create',
      entity: 'Transfer',
      description: 'Dispatched branch replenishment to the Branch campus store',
      createdAt: at(1, 9),
    },
  ]);

  const counts = {
    products: await Product.countDocuments(),
    purchases: await Purchase.countDocuments(),
    issues: await Issue.countDocuments(),
    transfers: await Transfer.countDocuments(),
    ledgerEntries: await LedgerEntry.countDocuments(),
    notifications: await Notification.countDocuments({ resolvedAt: null }),
  };

  console.log('\n✓ Demo data created');
  console.log(`  ${counts.products} products · ${counts.purchases} purchases · ${counts.issues} issues · ${counts.transfers} transfers`);
  console.log(`  ${counts.ledgerEntries} ledger entries · ${counts.notifications} active alerts`);
  console.log('\n  Demo sign-in details:');
  console.log(`  Super Admin   ${superAdmin.email} / ${env.superAdmin.password}`);
  console.log('  Accountant    accountant@mrskariza.school / Account@1234');
  console.log('  Storekeeper   storekeeper@mrskariza.school / Store@1234');
  console.log('  Principal     principal@mrskariza.school / Principal@1234');
  console.log('\n  Change these passwords after your first sign-in.\n');

  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (error) => {
  console.error('✗ Seed failed:', error);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
