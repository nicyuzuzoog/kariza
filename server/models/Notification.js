import mongoose from 'mongoose';
import { NOTIFICATION_AUDIENCE, ROLE_LIST } from '../config/constants.js';

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['low_stock', 'out_of_stock', 'system'],
      default: 'system',
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    audience: [
      {
        type: String,
        enum: ROLE_LIST,
      },
    ],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    resolvedAt: { type: Date, default: null },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

notificationSchema.index({ audience: 1, createdAt: -1 });
notificationSchema.index({ product: 1, type: 1, resolvedAt: 1 });

notificationSchema.statics.pushToRoles = async function pushToRoles({
  type = 'system',
  title,
  message,
  severity = 'info',
  product,
  meta,
  audience = NOTIFICATION_AUDIENCE,
}) {
  return this.create({ type, title, message, severity, product, meta, audience });
};

export default mongoose.model('Notification', notificationSchema);
