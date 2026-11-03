import mongoose from 'mongoose';
import { roundMoney } from '../utils/helpers.js';

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    unit: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, uppercase: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String, trim: true },
    invoiceNo: { type: String, trim: true, maxlength: 60 },
    purchaseDate: { type: Date, default: Date.now },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'A purchase must contain at least one item',
      },
    },
    totalAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    status: { type: String, enum: ['ordered', 'received', 'cancelled'], default: 'ordered' },
    receivedAt: Date,
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

purchaseSchema.pre('save', function calculateTotals() {
  this.items.forEach((item) => {
    item.lineTotal = roundMoney(item.quantity * item.unitCost);
  });
  this.totalAmount = roundMoney(
    this.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  );
});

purchaseSchema.index({ createdAt: -1 });
purchaseSchema.index({ status: 1, purchaseDate: -1 });
purchaseSchema.index({ supplier: 1 });

export default mongoose.model('Purchase', purchaseSchema);
