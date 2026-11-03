import Product from '../models/Product.js';
import LedgerEntry from '../models/LedgerEntry.js';
import Issue from '../models/Issue.js';
import { catchAsync } from '../utils/ApiError.js';
import { daysAgo, parseDateRange } from '../utils/helpers.js';

export const stockReport = catchAsync(async (_req, res) => {
  const [products, categories, totalsRow] = await Promise.all([
    Product.find({ isActive: true })
      .populate('supplier', 'name')
      .sort({ quantity: 1 })
      .select('name sku category unit quantity branchQuantity reorderLevel unitCost supplier'),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          products: { $sum: 1 },
          mainUnits: { $sum: '$quantity' },
          branchUnits: { $sum: '$branchQuantity' },
          value: { $sum: { $multiply: [{ $add: ['$quantity', '$branchQuantity'] }, '$unitCost'] } },
        },
      },
      { $sort: { value: -1 } },
    ]),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          mainUnits: { $sum: '$quantity' },
          branchUnits: { $sum: '$branchQuantity' },
          value: { $sum: { $multiply: [{ $add: ['$quantity', '$branchQuantity'] }, '$unitCost'] } },
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
        },
      },
    ]),
  ]);

  res.json({
    products,
    categories,
    totals: totalsRow[0] || {
      products: 0,
      mainUnits: 0,
      branchUnits: 0,
      value: 0,
      lowStock: 0,
      outOfStock: 0,
    },
  });
});

export const movementReport = catchAsync(async (req, res) => {
  const range =
    parseDateRange(req.query.from, req.query.to) ||
    (() => {
      const start = daysAgo(29);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { $gte: start, $lte: end };
    })();

  const filter = { createdAt: range };

  const [summaryRow, byType, byDay, topProducts, byCategory] = await Promise.all([
    LedgerEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          entries: { $sum: 1 },
          unitsIn: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$quantity', 0] } },
          unitsOut: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$quantity', 0] } },
          valueIn: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$totalCost', 0] } },
          valueOut: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$totalCost', 0] } },
        },
      },
    ]),
    LedgerEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          direction: { $first: '$direction' },
          units: { $sum: '$quantity' },
          value: { $sum: '$totalCost' },
          entries: { $sum: 1 },
        },
      },
      { $sort: { units: -1 } },
    ]),
    LedgerEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            direction: '$direction',
          },
          units: { $sum: '$quantity' },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]),
    LedgerEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { product: '$product', name: '$productName', unit: '$unit' },
          unitsIn: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$quantity', 0] } },
          unitsOut: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$quantity', 0] } },
          value: { $sum: '$totalCost' },
        },
      },
      { $sort: { unitsOut: -1, unitsIn: -1 } },
      { $limit: 12 },
    ]),
    LedgerEntry.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      { $unwind: { path: '$productDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$productDoc.category', 'Other'] },
          unitsIn: { $sum: { $cond: [{ $eq: ['$direction', 'in'] }, '$quantity', 0] } },
          unitsOut: { $sum: { $cond: [{ $eq: ['$direction', 'out'] }, '$quantity', 0] } },
          value: { $sum: '$totalCost' },
        },
      },
      { $sort: { value: -1 } },
    ]),
  ]);

  res.json({
    range: { from: range.$gte, to: range.$lte },
    summary: summaryRow[0] || {
      entries: 0,
      unitsIn: 0,
      unitsOut: 0,
      valueIn: 0,
      valueOut: 0,
    },
    byType,
    byDay,
    topProducts: topProducts.map((row) => ({
      product: row._id.product,
      name: row._id.name,
      unit: row._id.unit,
      unitsIn: row.unitsIn,
      unitsOut: row.unitsOut,
      value: row.value,
    })),
    byCategory,
  });
});

export const consumptionReport = catchAsync(async (req, res) => {
  const range =
    parseDateRange(req.query.from, req.query.to) ||
    (() => {
      const start = daysAgo(29);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      return { $gte: start, $lte: end };
    })();

  const match = { status: 'issued', issueDate: range };

  const [byDepartment, byProduct, byRecipientType, summaryRow] = await Promise.all([
    Issue.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$department', ''] } }, 0] },
              '$department',
              { $ifNull: ['$className', 'Unassigned'] },
            ],
          },
          units: { $sum: '$items.quantity' },
          value: { $sum: { $multiply: ['$items.quantity', '$items.unitCost'] } },
          records: { $addToSet: '$_id' },
        },
      },
      { $project: { units: 1, value: 1, records: { $size: '$records' } } },
      { $sort: { units: -1 } },
    ]),
    Issue.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: { name: '$items.name', unit: '$items.unit' },
          units: { $sum: '$items.quantity' },
          value: { $sum: { $multiply: ['$items.quantity', '$items.unitCost'] } },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 15 },
    ]),
    Issue.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$recipientType',
          units: { $sum: '$items.quantity' },
          records: { $addToSet: '$_id' },
        },
      },
      { $project: { units: 1, records: { $size: '$records' } } },
      { $sort: { units: -1 } },
    ]),
    Issue.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          units: { $sum: '$items.quantity' },
          value: { $sum: { $multiply: ['$items.quantity', '$items.unitCost'] } },
          records: { $addToSet: '$_id' },
        },
      },
      { $project: { units: 1, value: 1, records: { $size: '$records' } } },
    ]),
  ]);

  res.json({
    range: { from: range.$gte, to: range.$lte },
    summary: summaryRow[0] || { units: 0, value: 0, records: 0 },
    byDepartment,
    byProduct: byProduct.map((row) => ({
      name: row._id.name,
      unit: row._id.unit,
      units: row.units,
      value: row.value,
    })),
    byRecipientType,
  });
});
