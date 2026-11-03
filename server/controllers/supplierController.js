import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Purchase from '../models/Purchase.js';
import { catchAsync, conflict, notFound } from '../utils/ApiError.js';
import { escapeRegex, parsePagination } from '../utils/helpers.js';
import { recordAudit } from '../utils/audit.js';

export const listSuppliers = catchAsync(async (req, res) => {
  const { search = '', status = '' } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 10);

  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { contactName: rx }, { phone: rx }, { email: rx }];
  }
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Supplier.find(filter).sort('name').skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);

  // Attach simple product + purchase counts for the supplier cards.
  const supplierIds = items.map((item) => item._id);
  const [productCounts, purchaseTotals] = await Promise.all([
    Product.aggregate([
      { $match: { supplier: { $in: supplierIds } } },
      { $group: { _id: '$supplier', count: { $sum: 1 } } },
    ]),
    Purchase.aggregate([
      { $match: { supplier: { $in: supplierIds }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$supplier', orders: { $sum: 1 }, value: { $sum: '$totalAmount' } } },
    ]),
  ]);

  const productMap = Object.fromEntries(productCounts.map((row) => [String(row._id), row.count]));
  const purchaseMap = Object.fromEntries(purchaseTotals.map((row) => [String(row._id), row]));

  res.json({
    items: items.map((item) => ({
      ...item.toJSON(),
      productCount: productMap[String(item._id)] || 0,
      purchaseOrders: purchaseMap[String(item._id)]?.orders || 0,
      purchaseValue: purchaseMap[String(item._id)]?.value || 0,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

export const createSupplier = catchAsync(async (req, res) => {
  const exists = await Supplier.findOne({ name: req.body.name });
  if (exists) throw conflict('A supplier with this name already exists');

  const supplier = await Supplier.create(req.body);

  recordAudit(req, {
    action: 'supplier.create',
    entity: 'Supplier',
    entityId: supplier._id,
    description: `Added supplier ${supplier.name}`,
  });

  res.status(201).json({ supplier, message: 'Supplier added' });
});

export const updateSupplier = catchAsync(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw notFound('Supplier not found');

  if (req.body.name && req.body.name !== supplier.name) {
    const exists = await Supplier.findOne({ name: req.body.name, _id: { $ne: supplier._id } });
    if (exists) throw conflict('A supplier with this name already exists');
  }

  Object.assign(supplier, req.body);
  await supplier.save();

  recordAudit(req, {
    action: 'supplier.update',
    entity: 'Supplier',
    entityId: supplier._id,
    description: `Updated supplier ${supplier.name}`,
  });

  res.json({ supplier, message: 'Supplier updated' });
});

export const deactivateSupplier = catchAsync(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) throw notFound('Supplier not found');

  supplier.status = 'inactive';
  await supplier.save();

  recordAudit(req, {
    action: 'supplier.deactivate',
    entity: 'Supplier',
    entityId: supplier._id,
    description: `Deactivated supplier ${supplier.name}`,
  });

  res.json({ message: `${supplier.name} marked as inactive` });
});
