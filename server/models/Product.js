import mongoose from 'mongoose';
import { PRODUCT_CATEGORIES, UNIFORM_VARIANTS, UNITS } from '../config/constants.js';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    sku: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
    },
    category: {
      type: String,
      enum: { values: PRODUCT_CATEGORIES, message: 'Invalid category' },
      required: [true, 'Category is required'],
      default: 'Food & Provisions',
    },
    unit: {
      type: String,
      enum: { values: UNITS, message: 'Invalid unit' },
      default: 'piece',
    },
    // Only used for the "Uniforms & Wear" category: which garment this is.
    variant: {
      type: String,
      enum: { values: UNIFORM_VARIANTS, message: 'Invalid uniform item' },
      trim: true,
    },
    description: { type: String, trim: true, maxlength: 500 },
    imageUrl: { type: String, trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    branchQuantity: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 10, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    storageLocation: { type: String, trim: true, maxlength: 120 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

productSchema.virtual('totalQuantity').get(function totalQuantity() {
  return (this.quantity || 0) + (this.branchQuantity || 0);
});

productSchema.virtual('totalValue').get(function totalValue() {
  return Math.round((this.totalQuantity || 0) * (this.unitCost || 0) * 100) / 100;
});

productSchema.virtual('stockStatus').get(function stockStatus() {
  if ((this.quantity || 0) <= 0) return 'out';
  if ((this.quantity || 0) <= (this.reorderLevel || 0)) return 'low';
  return 'ok';
});

productSchema.pre('validate', function ensureSku() {
  if (!this.sku) {
    const base = (this.name || 'ITEM')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase();
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.sku = `${base || 'ITEM'}-${suffix}`;
  }
});

productSchema.index({ name: 'text', sku: 'text', description: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ category: 1, variant: 1 });
productSchema.index({ quantity: 1, reorderLevel: 1 });

export default mongoose.model('Product', productSchema);
