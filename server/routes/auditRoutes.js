import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditController.js';
import { ROLES } from '../config/constants.js';
import { allowRoles, protect } from '../middleware/auth.js';

const router = Router();

router.use(protect, allowRoles(ROLES.PRINCIPAL));
router.get('/', listAuditLogs);

export default router;
