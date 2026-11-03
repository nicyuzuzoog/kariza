import { Router } from 'express';
import {
  cancelTransfer,
  completeTransfer,
  createTransfer,
  getTransfer,
  listTransfers,
} from '../controllers/transferController.js';
import { ROLES } from '../config/constants.js';
import { allowRoles, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { transferSchema, cancelTransferSchema } from '../validators/index.js';

const router = Router();

router.use(protect);

const managers = allowRoles(ROLES.ACCOUNTANT, ROLES.STOREKEEPER);

router.get('/', listTransfers);
router.get('/:id', getTransfer);
router.post('/', managers, validate(transferSchema), createTransfer);
router.post('/:id/complete', managers, completeTransfer);
router.post('/:id/cancel', managers, validate(cancelTransferSchema), cancelTransfer);

export default router;
