import User from '../models/User.js';
import { ROLES } from '../config/constants.js';
import { badRequest, catchAsync, conflict, notFound } from '../utils/ApiError.js';
import { escapeRegex, parsePagination } from '../utils/helpers.js';
import { recordAudit } from '../utils/audit.js';

const superAdminCount = () =>
  User.countDocuments({ role: ROLES.SUPER_ADMIN, status: 'active' });

export const listUsers = catchAsync(async (req, res) => {
  const { search = '', role = '', status = '' } = req.query;
  const { page, limit, skip } = parsePagination(req.query, 10);
  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  if (role) filter.role = role;
  if (status) filter.status = status;

  const [items, total, counts] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);

  const stats = counts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});

  res.json({
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      total: Object.values(stats).reduce((sum, value) => sum + value, 0),
      active: await User.countDocuments({ status: 'active' }),
      ...stats,
    },
  });
});

export const createUser = catchAsync(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw conflict('An account with this email already exists');

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    createdBy: req.user._id,
  });

  recordAudit(req, {
    action: 'user.create',
    entity: 'User',
    entityId: user._id,
    description: `Created ${role.replace('_', ' ')} account for ${name}`,
  });

  res.status(201).json({ user: user.toJSON(), message: 'Account created successfully' });
});

export const updateUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id).select('+tokenVersion');
  if (!user) throw notFound('Account not found');

  const isSelf = String(user._id) === String(req.user._id);
  const { name, role, phone, status } = req.body;
  const previousRole = user.role;
  const previousStatus = user.status;

  if (isSelf && status === 'inactive') {
    throw badRequest('You cannot deactivate your own account');
  }
  if (isSelf && role && role !== previousRole) {
    throw badRequest('You cannot change your own role');
  }

  if (role && role !== previousRole && previousRole === ROLES.SUPER_ADMIN) {
    if ((await superAdminCount()) <= 1) {
      throw badRequest('At least one active Super Admin must remain');
    }
  }
  if (status === 'inactive' && previousRole === ROLES.SUPER_ADMIN) {
    if ((await superAdminCount()) <= 1) {
      throw badRequest('At least one active Super Admin must remain');
    }
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) user.role = role;
  if (status !== undefined) user.status = status;

  // Privilege or status changes end existing sessions.
  if ((role && role !== previousRole) || (status === 'inactive' && previousStatus !== 'inactive')) {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }

  await user.save();

  recordAudit(req, {
    action: 'user.update',
    entity: 'User',
    entityId: user._id,
    description: `Updated account for ${user.name}${status ? ` (${status})` : ''}`,
  });

  res.json({ user: user.toJSON(), message: 'Account updated' });
});

export const resetPassword = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id).select('+tokenVersion');
  if (!user) throw notFound('Account not found');

  user.password = req.body.password;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  recordAudit(req, {
    action: 'user.password_reset',
    entity: 'User',
    entityId: user._id,
    description: `Reset password for ${user.name}`,
  });

  res.json({ message: `Password reset for ${user.name}. They will need to sign in again.` });
});

export const deactivateUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id).select('+tokenVersion');
  if (!user) throw notFound('Account not found');
  if (String(user._id) === String(req.user._id)) {
    throw badRequest('You cannot deactivate your own account');
  }
  if (user.role === ROLES.SUPER_ADMIN && (await superAdminCount()) <= 1) {
    throw badRequest('At least one active Super Admin must remain');
  }

  user.status = 'inactive';
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  recordAudit(req, {
    action: 'user.deactivate',
    entity: 'User',
    entityId: user._id,
    description: `Deactivated account for ${user.name}`,
  });

  res.json({ message: `${user.name}'s account has been deactivated` });
});
