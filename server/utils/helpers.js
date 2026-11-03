import crypto from 'node:crypto';

export function makeReference(prefix = 'REF') {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

export function parsePagination(query = {}, defaultLimit = 12, maxLimit = 100) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseDateRange(from, to) {
  const range = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      range.$gte = start;
    }
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }
  return Object.keys(range).length ? range : null;
}

export const roundMoney = (value = 0) => Math.round((Number(value) || 0) * 100) / 100;

export const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const daysAgo = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
};
