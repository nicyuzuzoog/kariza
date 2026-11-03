import mongoose from 'mongoose';
import { LEDGER_TYPES, LOCATION_LABELS } from '../config/constants.js';

const ledgerEntrySchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, uppercase: true },
    type: {
      type: String,
      enum: LEDGER_TYPES,
      required: true,
    },
    direction: { type: String, enum: ['in', 'out'], required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true },
    location: { type: String, enum: ['main', 'branch'], default: 'main' },
    unitCost: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    party: { type: String, trim: true },
    referenceDoc: { type: String, trim: true },
    note: { type: String, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    balanceAfter: {
      main: { type: Number, default: 0 },
      branch: { type: Number, default: 0 },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ledgerEntrySchema.virtual('locationLabel').get(function locationLabel() {
  return LOCATION_LABELS[this.location] || this.location;
});

ledgerEntrySchema.set('toJSON', { virtuals: true });

ledgerEntrySchema.index({ createdAt: -1 });
ledgerEntrySchema.index({ product: 1, createdAt: -1 });
ledgerEntrySchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('LedgerEntry', ledgerEntrySchema);
