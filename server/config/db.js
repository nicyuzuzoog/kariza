import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Vercel serverless functions are recycled frequently, so the connection is
 * cached on the global object to avoid opening a new pool on every request.
 */
let cached = globalThis.__mrskarizaMongoose;

if (!cached) {
  cached = globalThis.__mrskarizaMongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!env.mongoUri) {
    throw new Error(
      'MONGO_URI is not configured. Add your MongoDB Atlas connection string to the environment.'
    );
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(env.mongoUri, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10,
      })
      .then((instance) => instance);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export { mongoose };
