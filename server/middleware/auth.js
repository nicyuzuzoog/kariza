import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { ROLES } from '../config/constants.js';
import { catchAsync, forbidden, unauthorized } from '../utils/ApiError.js';

export const signToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, tv: user.tokenVersion ?? 0 },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

export const protect = catchAsync(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw unauthorized('Please sign in to continue');
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.');
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user) throw unauthorized('This account no longer exists');
  if (user.status !== 'active') {
    throw forbidden('This account has been deactivated. Contact the Super Admin.');
  }
  if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
    throw unauthorized('Your session is no longer valid. Please sign in again.');
  }

  req.user = user;
  return next();
});

/**
 * Super Admin always passes. Everyone else must match one of the roles.
 */
export const allowRoles =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role === ROLES.SUPER_ADMIN || roles.includes(req.user.role)) return next();
    return next(forbidden('Your role does not allow this action'));
  };
