import AuditLog from '../models/AuditLog.js';

/**
 * Fire-and-forget audit trail. Never blocks or breaks the business action.
 */
export function recordAudit(req, { action, entity, entityId, description, meta }) {
  const actor = req?.user;
  AuditLog.create({
    actor: actor?._id,
    actorName: actor?.name || 'System',
    actorRole: actor?.role,
    action,
    entity,
    entityId: entityId ? String(entityId) : undefined,
    description,
    meta,
    ip: req?.ip,
  }).catch((error) => {
    console.error('[audit] failed to write entry:', error.message);
  });
}
