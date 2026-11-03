import Issue from '../models/Issue.js';
import { badRequest, catchAsync, notFound } from '../utils/ApiError.js';
import { escapeRegex, makeReference, parseDateRange, parsePagination, startOfMonth } from '../utils/helpers.js';
import { recordAudit } from '../utils/audit.js';
import {
  assertStockAvailable,
  buildItemsWithNames,
  locationLabel,
  moveStock,
  rollbackMovements,
} from '../utils/stock.js';

export const listIssues = catchAsync(async (req, res) => {
  const { search = '', status = '', location = '', from = '', to = '' } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 10);

  const filter = {};
  if (status) filter.status = status;
  if (location) filter.location = location;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { reference: rx },
      { recipientName: rx },
      { department: rx },
      { className: rx },
      { purpose: rx },
    ];
  }
  const range = parseDateRange(from, to);
  if (range) filter.issueDate = range;

  const [items, total, statsRow, monthRow] = await Promise.all([
    Issue.find(filter)
      .populate('createdBy', 'name role')
      .sort({ issueDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Issue.countDocuments(filter),
    Issue.aggregate([
      { $match: { status: 'issued' } },
      { $unwind: '$items' },
      { $group: { _id: null, units: { $sum: '$items.quantity' }, lines: { $sum: 1 } } },
    ]),
    Issue.aggregate([
      { $match: { status: 'issued', issueDate: { $gte: startOfMonth() } } },
      { $unwind: '$items' },
      { $group: { _id: null, units: { $sum: '$items.quantity' } } },
    ]),
  ]);

  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      unitsIssued: statsRow[0]?.units || 0,
      issueLines: statsRow[0]?.lines || 0,
      monthUnits: monthRow[0]?.units || 0,
      issued: await Issue.countDocuments({ status: 'issued' }),
      voided: await Issue.countDocuments({ status: 'voided' }),
    },
  });
});

export const getIssue = catchAsync(async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate('createdBy', 'name role')
    .populate('voidedBy', 'name role');
  if (!issue) throw notFound('Issue record not found');
  res.json({ issue });
});

export const createIssue = catchAsync(async (req, res) => {
  const { items, recipientName, recipientType, className, department, purpose, location, issueDate } =
    req.body;

  await assertStockAvailable(items, location);
  const enriched = await buildItemsWithNames(items);

  const issue = await Issue.create({
    reference: makeReference('ISS'),
    items: enriched,
    recipientName,
    recipientType,
    className: className || '',
    department: department || '',
    purpose: purpose || '',
    location,
    issueDate: issueDate || new Date(),
    createdBy: req.user._id,
  });

  try {
    for (const item of enriched) {
      await moveStock({
        productId: item.product,
        quantity: item.quantity,
        direction: 'out',
        type: 'issue',
        location,
        unitCost: item.unitCost,
        party: recipientName,
        referenceDoc: issue.reference,
        note: purpose || `Issued to ${recipientName}`,
        performedBy: req.user._id,
      });
    }
  } catch (error) {
    await rollbackMovements(issue.reference);
    await Issue.findByIdAndDelete(issue._id);
    throw error;
  }

  recordAudit(req, {
    action: 'issue.create',
    entity: 'Issue',
    entityId: issue._id,
    description: `Issued ${enriched.length} item line(s) to ${recipientName} from the ${locationLabel(
      location
    )}`,
  });

  res.status(201).json({
    issue,
    message: `${issue.reference} recorded. Stock has been issued to ${recipientName}.`,
  });
});

export const voidIssue = catchAsync(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw notFound('Issue record not found');
  if (issue.status === 'voided') throw badRequest('This issue has already been voided');

  // Return each line to the store and write a reversing ledger entry.
  for (const item of issue.items) {
    await moveStock({
      productId: item.product,
      quantity: item.quantity,
      direction: 'in',
      type: 'return',
      location: issue.location,
      unitCost: item.unitCost,
      party: issue.recipientName,
      referenceDoc: issue.reference,
      note: `Issue voided: ${req.body.reason}`,
      performedBy: req.user._id,
    }).catch((error) => {
      console.error(`[issue.void] Could not return ${item.name}:`, error.message);
    });
  }

  issue.status = 'voided';
  issue.voidedAt = new Date();
  issue.voidedBy = req.user._id;
  issue.voidReason = req.body.reason;
  await issue.save();

  recordAudit(req, {
    action: 'issue.void',
    entity: 'Issue',
    entityId: issue._id,
    description: `Voided issue ${issue.reference} — ${req.body.reason}`,
  });

  res.json({ message: `Issue ${issue.reference} voided and stock returned to the store.` });
});
