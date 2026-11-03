import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, default: 'System' },
    actorRole: { type: String },
    action: { type: String, required: true, trim: true },
    entity: { type: String, required: true, trim: true },
    entityId: { type: String },
    description: { type: String, trim: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, action: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
