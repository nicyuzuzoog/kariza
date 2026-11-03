import Transfer from '../models/Transfer.js';
import Product from '../models/Product.js';
import { badRequest, catchAsync, notFound } from '../utils/ApiError.js';
import { escapeRegex, makeReference, parsePagination } from '../utils/helpers.js';
import { recordAudit } from '../utils/audit.js';
import {
  assertStockAvailable,
  buildItemsWithNames,
  locationLabel,
  moveStock,
  rollbackMovements,
} from '../utils/stock.js';

export const listTransfers = catchAsync(async (req, res) => {
  const { search = '', status = '' } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 10);

  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ reference: rx }, { notes: rx }, { 'items.name': rx }];
  }

  const [items, total, statsRow, statusCounts] = await Promise.all([
    Transfer.find(filter)
      .populate('createdBy', 'name role')
      .populate('completedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transfer.countDocuments(filter),
    Transfer.aggregate([
      { $match: { status: 'in_transit' } },
      { $unwind: '$items' },
      { $group: { _id: null, units: { $sum: '$items.quantity' } } },
    ]),
    Transfer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const statuses = statusCounts.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});

  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      inTransitUnits: statsRow[0]?.units || 0,
      inTransit: statuses.in_transit || 0,
      completed: statuses.completed || 0,
      cancelled: statuses.cancelled || 0,
    },
  });
});

export const getTransfer = catchAsync(async (req, res) => {
  const transfer = await Transfer.findById(req.params.id)
    .populate('createdBy', 'name role')
    .populate('completedBy', 'name')
    .populate('cancelledBy', 'name');
  if (!transfer) throw notFound('Transfer not found');
  res.json({ transfer });
});

export const createTransfer = catchAsync(async (req, res) => {
  const { from, to, items, notes } = req.body;

  await assertStockAvailable(items, from);
  const enriched = await buildItemsWithNames(items);

  const transfer = await Transfer.create({
    reference: makeReference('TRF'),
    from,
    to,
    items: enriched,
    notes: notes || '',
    createdBy: req.user._id,
  });

  try {
    for (const item of enriched) {
      await moveStock({
        productId: item.product,
        quantity: item.quantity,
        direction: 'out',
        type: 'transfer_out',
        location: from,
        unitCost: item.unitCost,
        party: `Transfer to ${locationLabel(to)}`,
        referenceDoc: transfer.reference,
        note: notes || `Dispatched to ${locationLabel(to)}`,
        performedBy: req.user._id,
      });
    }
  } catch (error) {
    await rollbackMovements(transfer.reference);
    await Transfer.findByIdAndDelete(transfer._id);
    throw error;
  }

  recordAudit(req, {
    action: 'transfer.create',
    entity: 'Transfer',
    entityId: transfer._id,
    description: `Dispatched ${transfer.reference} from ${locationLabel(from)} to ${locationLabel(to)}`,
  });

  res.status(201).json({
    transfer,
    message: `${transfer.reference} dispatched. Mark it completed once the branch confirms receipt.`,
  });
});

export const completeTransfer = catchAsync(async (req, res) => {
  const transfer = await Transfer.findById(req.params.id);
  if (!transfer) throw notFound('Transfer not found');
  if (transfer.status === 'completed') throw badRequest('This transfer is already completed');
  if (transfer.status === 'cancelled') throw badRequest('Cancelled transfers cannot be completed');

  const products = await Product.find({ _id: { $in: transfer.items.map((item) => item.product) } });
  const archived = products.find((product) => !product.isActive);
  if (archived) throw badRequest(`${archived.name} is archived and cannot be received`);

  try {
    for (const item of transfer.items) {
      await moveStock({
        productId: item.product,
        quantity: item.quantity,
        direction: 'in',
        type: 'transfer_in',
        location: transfer.to,
        party: `Transfer from ${locationLabel(transfer.from)}`,
        referenceDoc: `${transfer.reference}-IN`,
        note: transfer.notes || 'Branch receipt confirmed',
        performedBy: req.user._id,
      });
    }
  } catch (error) {
    await rollbackMovements(`${transfer.reference}-IN`);
    throw error;
  }

  transfer.status = 'completed';
  transfer.completedAt = new Date();
  transfer.completedBy = req.user._id;
  await transfer.save();

  recordAudit(req, {
    action: 'transfer.complete',
    entity: 'Transfer',
    entityId: transfer._id,
    description: `Completed transfer ${transfer.reference} into ${locationLabel(transfer.to)}`,
  });

  res.json({
    transfer,
    message: `${transfer.reference} completed. Stock added to the ${locationLabel(transfer.to)}.`,
  });
});

export const cancelTransfer = catchAsync(async (req, res) => {
  const transfer = await Transfer.findById(req.params.id);
  if (!transfer) throw notFound('Transfer not found');
  if (transfer.status === 'cancelled') throw badRequest('This transfer is already cancelled');
  if (transfer.status === 'completed') {
    throw badRequest('Completed transfers cannot be cancelled');
  }

  const products = await Product.find({ _id: { $in: transfer.items.map((item) => item.product) } });
  const archived = products.find((product) => !product.isActive);
  if (archived) throw badRequest(`${archived.name} is archived and cannot be returned`);

  for (const item of transfer.items) {
    await moveStock({
      productId: item.product,
      quantity: item.quantity,
      direction: 'in',
      type: 'return',
      location: transfer.from,
      party: 'Transfer cancelled',
      referenceDoc: `${transfer.reference}-CANCEL`,
      note: req.body.reason || 'Transfer returned to source store',
      performedBy: req.user._id,
    });
  }

  transfer.status = 'cancelled';
  transfer.cancelledAt = new Date();
  transfer.cancelledBy = req.user._id;
  transfer.cancelReason = req.body.reason || '';
  await transfer.save();

  recordAudit(req, {
    action: 'transfer.cancel',
    entity: 'Transfer',
    entityId: transfer._id,
    description: `Cancelled transfer ${transfer.reference} — stock returned to ${locationLabel(
      transfer.from
    )}`,
  });

  res.json({ transfer, message: `${transfer.reference} cancelled and stock returned to the source store.` });
});
