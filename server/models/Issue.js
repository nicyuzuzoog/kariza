import mongoose from 'mongoose';

const issueItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    unit: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitCost: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const issueSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, uppercase: true },
    items: {
      type: [issueItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'An issue must contain at least one item',
      },
    },
    recipientName: {
      type: String,
      required: [true, 'Recipient name is required'],
      trim: true,
      maxlength: 120,
    },
    recipientType: {
      type: String,
      enum: ['student', 'class', 'department', 'staff', 'other'],
      default: 'department',
    },
    className: { type: String, trim: true, maxlength: 60 },
    department: { type: String, trim: true, maxlength: 80 },
    purpose: { type: String, trim: true, maxlength: 300 },
    location: { type: String, enum: ['main', 'branch'], default: 'main' },
    issueDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['issued', 'voided'], default: 'issued' },
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

issueSchema.index({ createdAt: -1 });
issueSchema.index({ issueDate: -1, status: 1 });

export default mongoose.model('Issue', issueSchema);
