import LedgerEntry from '../models/LedgerEntry.js';
import { catchAsync } from '../utils/ApiError.js';
import { escapeRegex, parseDateRange, parsePagination } from '../utils/helpers.js';

export const listLedger = catchAsync(async (req, res) => {
  const { type = '', direction = '', location = '', product = '', search = '', from = '', to = '' } =
    req.query;
  const { page, limit, skip } = parsePagination(req.query, 15);

  const filter = {};
  if (type) filter.type = type;
  if (direction) filter.direction = direction;
  if (location) filter.location = location;
  if (product) filter.product = product;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { productName: rx },
      { sku: rx },
      { party: rx },
      { referenceDoc: rx },
      { reference: rx },
      { note: rx },
    ];
  }
  const range = parseDateRange(from, to);
  if (range) filter.createdAt = range;

  const [items, total, totalsRow] = await Promise.all([
    LedgerEntry.find(filter)
      .populate('performedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    LedgerEntry.countDocuments(filter),
    LedgerEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          unitsIn: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$quantity', 0] } },
          unitsOut: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$quantity', 0] } },
          valueIn: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$totalCost', 0] } },
          valueOut: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$totalCost', 0] } },
        },
      },
    ]),
  ]);

  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    totals: totalsRow[0] || { unitsIn: 0, unitsOut: 0, valueIn: 0, valueOut: 0 },
  });
});
