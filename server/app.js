import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { dbState, errorHandler, notFoundHandler } from './middleware/error.js';
import { ApiError } from './utils/ApiError.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import auditRoutes from './routes/auditRoutes.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const isAllowed =
        env.clientUrls.includes(origin) ||
        /\.vercel\.app$/i.test(origin) ||
        (env.nodeEnv !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

      if (isAllowed) return callback(null, true);
      return callback(new ApiError(403, 'This origin is not allowed to access the API'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (env.nodeEnv !== 'production') {
  app.use(morgan('dev'));
}

// Light protection for the whole API surface.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again in a few minutes.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Mrskariza API',
    database: dbState(),
    timestamp: new Date().toISOString(),
  });
});

// Every data route requires a live database connection.
app.use('/api', apiLimiter, async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(new ApiError(503, `Database connection failed: ${error.message}`));
  }
});

app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);

app.get('/api', (_req, res) => {
  res.json({
    name: 'Mrskariza API',
    version: '1.0.0',
    docs: 'See README.md for the API overview',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
