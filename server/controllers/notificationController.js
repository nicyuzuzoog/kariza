import Notification from '../models/Notification.js';
import { catchAsync, notFound } from '../utils/ApiError.js';
import { parsePagination } from '../utils/helpers.js';

export const listNotifications = catchAsync(async (req, res) => {
  const { unread = '', includeResolved = '' } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 12);

  const filter = { audience: req.user.role };
  if (includeResolved !== 'true') filter.resolvedAt = null;
  if (unread === 'true') filter.readBy = { $ne: req.user._id };

  const [items, total, unreadCount, unresolvedCount] = await Promise.all([
    Notification.find(filter)
      .populate('product', 'name sku quantity unit reorderLevel imageUrl category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({
      audience: req.user.role,
      resolvedAt: null,
      readBy: { $ne: req.user._id },
    }),
    Notification.countDocuments({ audience: req.user.role, resolvedAt: null }),
  ]);

  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    unreadCount,
    unresolvedCount,
  });
});

export const unreadCount = catchAsync(async (req, res) => {
  const count = await Notification.countDocuments({
    audience: req.user.role,
    resolvedAt: null,
    readBy: { $ne: req.user._id },
  });
  res.json({ count });
});

export const markRead = catchAsync(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, audience: req.user.role },
    { $addToSet: { readBy: req.user._id } },
    { new: true }
  );
  if (!notification) throw notFound('Notification not found');
  res.json({ message: 'Notification marked as read' });
});

export const markAllRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { audience: req.user.role, readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } }
  );
  res.json({ message: 'All notifications marked as read' });
});
