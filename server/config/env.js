import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (process.env.NODE_ENV === 'production' && missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

if (missing.length) {
  // Keep local development friendly, but warn loudly.
  console.warn(
    `\n⚠️  Missing environment variables: ${missing.join(', ')}.` +
      `\n   Copy .env.example to .env and fill in your MongoDB Atlas connection string.\n`
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'mrskariza-development-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  superAdmin: {
    name: process.env.SUPER_ADMIN_NAME || 'Mrskariza Super Admin',
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@mrskariza.school',
    password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@1234',
  },
  isProd: process.env.NODE_ENV === 'production',
};
