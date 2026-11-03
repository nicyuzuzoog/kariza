import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ZodError') {
    statusCode = 422;
    message = 'Please correct the highlighted fields';
    details = err.issues?.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  }

  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 422;
    details = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    message = details[0]?.message || 'Validation failed';
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with that ${field} already exists`;
    details = [{ field, message }];
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session is invalid or has expired';
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    message,
    ...(details ? { details } : {}),
    ...(env.isProd || statusCode < 500 ? {} : { stack: err.stack }),
  });
}

export const dbState = () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
};
