import Product from '../models/Product.js';
import LedgerEntry from '../models/LedgerEntry.js';
import Purchase from '../models/Purchase.js';
import Issue from '../models/Issue.js';
import Transfer from '../models/Transfer.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { catchAsync } from '../utils/ApiError.js';
import { daysAgo, startOfMonth } from '../utils/helpers.js';

export const getDashboard = catchAsync(async (req, res) => {
  const monthStart = startOfMonth();
  const trendStart = daysAgo(6);

  const [
    productStats,
    purchasesMonth,
    pendingPurchases,
    issuesMonth,
    pendingTransfers,
    unreadAlerts,
    categoryBreakdown,
    branchSummary,
    lowStockItems,
    recentActivity,
    trendRows,
    topIssued,
    recentPurchases,
    activeUsers,
  ] = await Promise.all([
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          inventoryValue: {
            $sum: { $multiply: [{ $add: ['$quantity', '$branchQuantity'] }, '$unitCost'] },
          },
          mainValue: { $sum: { $multiply: ['$quantity', '$unitCost'] } },
          branchValue: { $sum: { $multiply: ['$branchQuantity', '$unitCost'] } },
          unitsInStore: { $sum: { $add: ['$quantity', '$branchQuantity'] } },
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
    Purchase.aggregate([
      { $match: { status: { $ne: 'cancelled' }, purchaseDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]),
    Purchase.countDocuments({ status: 'ordered' }),
    Issue.aggregate([
      { $match: { status: 'issued', issueDate: { $gte: monthStart } } },
      { $unwind: '$items' },
      { $group: { _id: null, units: { $sum: '$items.quantity' }, records: { $sum: 1 } } },
    ]),
    Transfer.countDocuments({ status: 'in_transit' }),
    Notification.countDocuments({
      audience: req.user.role,
      resolvedAt: null,
      readBy: { $ne: req.user._id },
    }),
    Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          units: { $sum: { $add: ['$quantity', '$branchQuantity'] } },
          value: { $sum: { $multiply: [{ $add: ['$quantity', '$branchQuantity'] }, '$unitCost'] } },
        },
      },
      { $sort: { value: -1 } },
    ]),
    Product.aggregate([
      { $match: { isActive: true, branchQuantity: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          units: { $sum: '$branchQuantity' },
          value: { $sum: { $multiply: ['$branchQuantity', '$unitCost'] } },
        },
      },
    ]),
    Product.find({ isActive: true, $expr: { $lte: ['$quantity', '$reorderLevel'] } })
      .sort({ quantity: 1 })
      .limit(6)
      .select('name sku category quantity unit reorderLevel unitCost imageUrl'),
    LedgerEntry.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('performedBy', 'name role'),
    LedgerEntry.aggregate([
      { $match: { createdAt: { $gte: trendStart } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            direction: '$direction',
          },
          units: { $sum: '$quantity' },
        },
      },
    ]),
    Issue.aggregate([
      { $match: { status: 'issued', issueDate: { $gte: daysAgo(30) } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          units: { $sum: '$items.quantity' },
          unit: { $first: '$items.unit' },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]),
    Purchase.find({ status: { $ne: 'cancelled' } })
      .populate('supplier', 'name')
      .sort({ purchaseDate: -1 })
      .limit(5),
    User.countDocuments({ status: 'active' }),
  ]);

  const stats = productStats[0] || {
    totalProducts: 0,
    inventoryValue: 0,
    mainValue: 0,
    branchValue: 0,
    unitsInStore: 0,
    lowStock: 0,
    outOfStock: 0,
  };

  // Build a continuous 7-day series, including days with no movement.
  const trendMap = new Map();
  trendRows.forEach((row) => {
    const key = row._id.day;
    if (!trendMap.has(key)) trendMap.set(key, { in: 0, out: 0 });
    trendMap.get(key)[row._id.direction] = row.units;
  });

  const movementTrend = Array.from({ length: 7 }, (_, index) => {
    const date = daysAgo(6 - index);
    const key = date.toISOString().slice(0, 10);
    const row = trendMap.get(key) || { in: 0, out: 0 };
    return {
      date: key,
      label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      in: row.in || 0,
      out: row.out || 0,
    };
  });

  const branch = branchSummary[0] || { products: 0, units: 0, value: 0 };

  res.json({
    stats: {
      ...stats,
      monthSpend: purchasesMonth[0]?.total || 0,
      monthOrders: purchasesMonth[0]?.orders || 0,
      pendingPurchases,
      monthIssuedUnits: issuesMonth[0]?.units || 0,
      monthIssuedRecords: issuesMonth[0]?.records || 0,
      pendingTransfers,
      unreadAlerts,
      activeUsers,
      branchProducts: branch.products,
      branchUnits: branch.units,
      branchValue: branch.value,
    },
    categoryBreakdown,
    movementTrend,
    lowStockItems,
    recentActivity,
    topIssued: topIssued.map((row) => ({ name: row._id, units: row.units, unit: row.unit })),
    recentPurchases,
  });
});
