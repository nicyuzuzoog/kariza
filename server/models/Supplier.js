import mongoose from 'mongoose';
import { PRODUCT_CATEGORIES } from '../config/constants.js';

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: 120,
      unique: true,
    },
    contactName: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 30 },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    address: { type: String, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: { values: [...PRODUCT_CATEGORIES, 'General'], message: 'Invalid category' },
      default: 'General',
    },
    notes: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

supplierSchema.index({ name: 'text', contactName: 'text' });

export default mongoose.model('Supplier', supplierSchema);
