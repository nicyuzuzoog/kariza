import AuditLog from '../models/AuditLog.js';
import { catchAsync } from '../utils/ApiError.js';
import { escapeRegex, parseDateRange, parsePagination } from '../utils/helpers.js';

export const listAuditLogs = catchAsync(async (req, res) => {
  const { search = '', entity = '', action = '', from = '', to = '' } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 20);

  const filter = {};
  if (entity) filter.entity = entity;
  if (action) filter.action = action;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ actorName: rx }, { description: rx }, { action: rx }];
  }
  const range = parseDateRange(from, to);
  if (range) filter.createdAt = range;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});
