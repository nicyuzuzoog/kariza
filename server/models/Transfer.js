import mongoose from 'mongoose';

const transferItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    unit: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, uppercase: true },
    from: { type: String, enum: ['main', 'branch'], required: true },
    to: { type: String, enum: ['main', 'branch'], required: true },
    items: {
      type: [transferItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'A transfer must contain at least one item',
      },
    },
    status: {
      type: String,
      enum: ['in_transit', 'completed', 'cancelled'],
      default: 'in_transit',
    },
    notes: { type: String, trim: true, maxlength: 500 },
    dispatchedAt: { type: Date, default: Date.now },
    completedAt: Date,
    cancelledAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

transferSchema.index({ createdAt: -1 });
transferSchema.index({ status: 1 });

export default mongoose.model('Transfer', transferSchema);
