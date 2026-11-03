import User from '../models/User.js';
import { catchAsync, notFound, unauthorized } from '../utils/ApiError.js';
import { signToken } from '../middleware/auth.js';
import { recordAudit } from '../utils/audit.js';

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +tokenVersion');
  if (!user || !(await user.comparePassword(password))) {
    throw unauthorized('Incorrect email or password');
  }
  if (user.status !== 'active') {
    throw unauthorized('This account has been deactivated. Please contact the Super Admin.');
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  req.user = user;
  recordAudit(req, {
    action: 'auth.login',
    entity: 'User',
    entityId: user._id,
    description: `${user.name} signed in`,
  });

  res.json({
    token: signToken(user),
    user: user.toJSON(),
  });
});

export const me = catchAsync(async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

export const updateProfile = catchAsync(async (req, res) => {
  const { name, phone, avatarUrl } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) throw notFound('Account not found');

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  await user.save();

  recordAudit(req, {
    action: 'profile.update',
    entity: 'User',
    entityId: user._id,
    description: `${user.name} updated their profile`,
  });

  res.json({ user: user.toJSON(), message: 'Profile updated' });
});

export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!user) throw notFound('Account not found');

  const matches = await user.comparePassword(currentPassword);
  if (!matches) throw unauthorized('Your current password is incorrect');

  user.password = newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  recordAudit(req, {
    action: 'auth.password_changed',
    entity: 'User',
    entityId: user._id,
    description: `${user.name} changed their password`,
  });

  res.json({
    message: 'Password changed successfully',
    token: signToken(user),
    user: user.toJSON(),
  });
});
