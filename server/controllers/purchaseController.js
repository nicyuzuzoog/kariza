import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import { badRequest, catchAsync, notFound } from '../utils/ApiError.js';
import { escapeRegex, makeReference, parseDateRange, parsePagination, startOfMonth } from '../utils/helpers.js';
import { recordAudit } from '../utils/audit.js';
import { buildItemsWithNames, locationLabel, moveStock, rollbackMovements } from '../utils/stock.js';

export const listPurchases = catchAsync(async (req, res) => {
  const { search = '', status = '', paymentStatus = '', from = '', to = '' } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 10);

  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { reference: rx },
      { invoiceNo: rx },
      { supplierName: rx },
      { notes: rx },
    ];
  }

  const dateRange = parseDateRange(from, to);
  if (dateRange) filter.purchaseDate = dateRange;

  const [items, total, statsRow, statusCounts] = await Promise.all([
    Purchase.find(filter)
      .populate('supplier', 'name')
      .populate('createdBy', 'name')
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Purchase.countDocuments(filter),
    Purchase.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          unpaid: {
            $sum: { $cond: [{ $in: ['$paymentStatus', ['unpaid', 'partial']] }, '$totalAmount', 0] },
          },
        },
      },
    ]),
    Purchase.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const [monthSpend, pendingCount] = await Promise.all([
    Purchase.aggregate([
      {
        $match: {
          status: { $ne: 'cancelled' },
          purchaseDate: { $gte: startOfMonth() },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Purchase.countDocuments({ status: 'ordered' }),
  ]);

  const statuses = statusCounts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});

  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      totalSpend: statsRow[0]?.totalSpend || 0,
      orders: statsRow[0]?.orders || 0,
      outstanding: statsRow[0]?.unpaid || 0,
      monthSpend: monthSpend[0]?.total || 0,
      pending: pendingCount,
      ...statuses,
    },
  });
});

export const getPurchase = catchAsync(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate('supplier', 'name phone email contactName address')
    .populate('createdBy', 'name role')
    .populate('receivedBy', 'name')
    .populate('items.product', 'name sku unit imageUrl category quantity');
  if (!purchase) throw notFound('Purchase order not found');

  res.json({ purchase });
});

export const createPurchase = catchAsync(async (req, res) => {
  const supplier = await Supplier.findById(req.body.supplier);
  if (!supplier) throw badRequest('Please choose a valid supplier');

  const items = await buildItemsWithNames(req.body.items);

  const purchase = await Purchase.create({
    reference: makeReference('PO'),
    supplier: supplier._id,
    supplierName: supplier.name,
    invoiceNo: req.body.invoiceNo || '',
    purchaseDate: req.body.purchaseDate || new Date(),
    items,
    paymentStatus: req.body.paymentStatus,
    notes: req.body.notes || '',
    createdBy: req.user._id,
  });

  recordAudit(req, {
    action: 'purchase.create',
    entity: 'Purchase',
    entityId: purchase._id,
    description: `Created purchase ${purchase.reference} for ${supplier.name}`,
  });

  res.status(201).json({
    purchase,
    message: `Purchase ${purchase.reference} recorded. Receive it when goods arrive.`,
  });
});

export const receivePurchase = catchAsync(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) throw notFound('Purchase order not found');
  if (purchase.status === 'received') throw badRequest('This purchase has already been received');
  if (purchase.status === 'cancelled') throw badRequest('Cancelled purchases cannot be received');

  const location = req.body.location === 'branch' ? 'branch' : 'main';

  // Ensure every product still exists and is active before touching stock.
  const products = await Product.find({ _id: { $in: purchase.items.map((item) => item.product) } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  for (const item of purchase.items) {
    const product = productMap.get(String(item.product));
    if (!product) throw badRequest(`Product “${item.name}” no longer exists`);
    if (!product.isActive) throw badRequest(`Product “${item.name}” is archived`);
  }

  try {
    for (const item of purchase.items) {
      await moveStock({
        productId: item.product,
        quantity: item.quantity,
        direction: 'in',
        type: 'purchase',
        location,
        unitCost: item.unitCost,
        party: purchase.supplierName,
        referenceDoc: purchase.reference,
        note: purchase.invoiceNo ? `Invoice ${purchase.invoiceNo}` : 'Goods received',
        performedBy: req.user._id,
      });
    }
  } catch (error) {
    await rollbackMovements(purchase.reference);
    throw error;
  }

  purchase.status = 'received';
  purchase.receivedAt = new Date();
  purchase.receivedBy = req.user._id;
  await purchase.save();

  recordAudit(req, {
    action: 'purchase.receive',
    entity: 'Purchase',
    entityId: purchase._id,
    description: `Received ${purchase.reference} into the ${locationLabel(location)}`,
  });

  res.json({
    purchase,
    message: `${purchase.reference} received. Stock levels updated at the ${locationLabel(location)}.`,
  });
});

export const cancelPurchase = catchAsync(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) throw notFound('Purchase order not found');
  if (purchase.status === 'received') throw badRequest('Received purchases cannot be cancelled');
  if (purchase.status === 'cancelled') throw badRequest('This purchase is already cancelled');

  purchase.status = 'cancelled';
  await purchase.save();

  recordAudit(req, {
    action: 'purchase.cancel',
    entity: 'Purchase',
    entityId: purchase._id,
    description: `Cancelled purchase ${purchase.reference}`,
  });

  res.json({ message: `Purchase ${purchase.reference} cancelled` });
});

export const updatePurchaseMeta = catchAsync(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) throw notFound('Purchase order not found');

  if (req.body.paymentStatus) purchase.paymentStatus = req.body.paymentStatus;
  if (req.body.invoiceNo !== undefined) purchase.invoiceNo = req.body.invoiceNo;
  if (req.body.notes !== undefined) purchase.notes = req.body.notes;

  await purchase.save();

  recordAudit(req, {
    action: 'purchase.update',
    entity: 'Purchase',
    entityId: purchase._id,
    description: `Updated purchase ${purchase.reference}`,
  });

  res.json({ purchase, message: 'Purchase updated' });
});
