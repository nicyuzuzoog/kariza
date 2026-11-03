import Product from '../models/Product.js';
import Supplier from '../models/Supplier.js';
import LedgerEntry from '../models/LedgerEntry.js';
import Purchase from '../models/Purchase.js';
import { PRODUCT_CATEGORIES, UNITS } from '../config/constants.js';
import { badRequest, catchAsync, notFound } from '../utils/ApiError.js';
import { escapeRegex, parsePagination } from '../utils/helpers.js';
import { recordAudit } from '../utils/audit.js';
import { moveStock } from '../utils/stock.js';
import { resolveStockNotifications, syncStockNotification } from '../utils/notifications.js';

const sortMap = {
  name: 'name',
  quantity: 'quantity',
  category: 'category',
  value: 'quantity',
  updated: 'updatedAt',
  created: 'createdAt',
};

export const listProducts = catchAsync(async (req, res) => {
  const { search = '', category = '', status = 'all', supplier = '', includeArchived } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 12);

  const filter = {};

  if (includeArchived === 'true') {
    // include both active and archived
  } else if (status === 'archived') {
    filter.isActive = false;
  } else {
    filter.isActive = true;
  }

  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { description: rx }, { storageLocation: rx }];
  }
  if (category) filter.category = category;
  if (supplier) filter.supplier = supplier;

  if (status === 'low') {
    filter.$expr = {
      $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$reorderLevel'] }],
    };
  } else if (status === 'out') {
    filter.quantity = { $lte: 0 };
  } else if (status === 'ok') {
    filter.$expr = { $gt: ['$quantity', '$reorderLevel'] };
  } else if (status === 'branch') {
    filter.branchQuantity = { $gt: 0 };
  }

  const sortField = sortMap[req.query.sort] || 'name';
  const sortDir = req.query.dir === 'desc' ? -1 : 1;

  const [items, total, statsRow] = await Promise.all([
    Product.find(filter)
      .populate('supplier', 'name phone')
      .sort(sortField === 'quantity' ? { quantity: sortDir, name: 1 } : { [sortField]: sortDir })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          inventoryValue: {
            $sum: { $multiply: [{ $add: ['$quantity', '$branchQuantity'] }, '$unitCost'] },
          },
          mainValue: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
          branchValue: { $sum: { $multiply: ['$branchQuantity', '$unitCost'] } },
          lowStock: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$reorderLevel'] }] },
                1,
                0,
              ],
            },
          },
          outOfStock: { $sum: { $cond: [{ $lte: ['$quantity', 0] }, 1, 0] } },
          unitsInStore: { $sum: { $add: ['$quantity', '$branchQuantity'] } },
        },
      },
    ]),
  ]);

  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    stats: statsRow[0] || {
      total: 0,
      inventoryValue: 0,
      mainValue: 0,
      branchValue: 0,
      lowStock: 0,
      outOfStock: 0,
      unitsInStore: 0,
    },
  });
});

export const getProductOptions = catchAsync(async (_req, res) => {
  const suppliers = await Supplier.find({ status: 'active' }).select('name category').sort('name');
  res.json({
    categories: PRODUCT_CATEGORIES,
    units: UNITS,
    suppliers,
  });
});

export const getProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id).populate(
    'supplier',
    'name phone email contactName'
  );
  if (!product) throw notFound('Product not found');

  const [recentMovements, purchases, usage] = await Promise.all([
    LedgerEntry.find({ product: product._id })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate('performedBy', 'name role'),
    Purchase.find({ 'items.product': product._id })
      .sort({ purchaseDate: -1 })
      .limit(8)
      .populate('supplier', 'name'),
    LedgerEntry.aggregate([
      { $match: { product: product._id, direction: 'out' } },
      { $group: { _id: null, totalOut: { $sum: '$quantity' }, movements: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    product,
    recentMovements,
    purchases,
    usage: usage[0] || { totalOut: 0, movements: 0 },
  });
});

export const createProduct = catchAsync(async (req, res) => {
  const body = { ...req.body, createdBy: req.user._id };
  if (!body.supplier) delete body.supplier;
  if (!body.sku) delete body.sku;

  const product = await Product.create(body);

  if (product.quantity > 0) {
    await LedgerEntry.create({
      reference: `OPEN-${product.sku}`,
      type: 'adjustment_in',
      direction: 'in',
      product: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: product.quantity,
      unit: product.unit,
      location: 'main',
      unitCost: product.unitCost,
      totalCost: product.quantity * product.unitCost,
      note: 'Opening stock balance',
      performedBy: req.user._id,
      balanceAfter: { main: product.quantity, branch: product.branchQuantity },
    });
  }
  await syncStockNotification(product);

  recordAudit(req, {
    action: 'product.create',
    entity: 'Product',
    entityId: product._id,
    description: `Added ${product.name} (${product.sku})`,
  });

  res.status(201).json({ product, message: `${product.name} added to inventory` });
});

export const updateProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound('Product not found');

  if (req.body.quantity !== undefined || req.body.branchQuantity !== undefined) {
    throw badRequest(
      'Stock quantities cannot be edited directly. Use “Adjust stock” to record a movement instead.'
    );
  }

  const allowed = [
    'name',
    'sku',
    'category',
    'unit',
    'description',
    'imageUrl',
    'reorderLevel',
    'unitCost',
    'storageLocation',
    'supplier',
  ];

  allowed.forEach((key) => {
    if (req.body[key] !== undefined) {
      if (key === 'supplier' && !req.body[key]) product[key] = undefined;
      else if (key === 'sku' && !req.body[key]) return;
      else product[key] = req.body[key];
    }
  });

  await product.save();
  await syncStockNotification(product);

  recordAudit(req, {
    action: 'product.update',
    entity: 'Product',
    entityId: product._id,
    description: `Updated ${product.name} details`,
  });

  res.json({ product, message: `${product.name} updated` });
});

export const adjustStock = catchAsync(async (req, res) => {
  const { quantity, direction, reason, location } = req.body;
  const { product, entry } = await moveStock({
    productId: req.params.id,
    quantity,
    direction,
    type: direction === 'in' ? 'adjustment_in' : 'adjustment_out',
    location,
    party: 'Manual adjustment',
    referenceDoc: `ADJ-${req.user._id.toString().slice(-6)}`,
    note: reason,
    performedBy: req.user._id,
  });

  recordAudit(req, {
    action: 'product.adjust',
    entity: 'Product',
    entityId: product._id,
    description: `${direction === 'in' ? 'Added' : 'Removed'} ${quantity} ${product.unit} of ${
      product.name
    } (${reason})`,
  });

  res.json({
    product,
    entry,
    message: `Stock adjusted. ${product.name} now holds ${product.quantity} ${product.unit} at the main store.`,
  });
});

export const archiveProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound('Product not found');

  product.isActive = false;
  await product.save();
  await resolveStockNotifications(product._id);

  recordAudit(req, {
    action: 'product.archive',
    entity: 'Product',
    entityId: product._id,
    description: `Archived ${product.name} (${product.sku})`,
  });

  res.json({ message: `${product.name} archived. Historical records are preserved.` });
});

export const restoreProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound('Product not found');

  product.isActive = true;
  await product.save();
  await syncStockNotification(product);

  recordAudit(req, {
    action: 'product.restore',
    entity: 'Product',
    entityId: product._id,
    description: `Restored ${product.name} (${product.sku})`,
  });

  res.json({ product, message: `${product.name} restored to active inventory` });
});
