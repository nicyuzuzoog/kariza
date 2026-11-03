import { Router } from 'express';
import {
  cancelPurchase,
  createPurchase,
  getPurchase,
  listPurchases,
  receivePurchase,
  updatePurchaseMeta,
} from '../controllers/purchaseController.js';
import { ROLES } from '../config/constants.js';
import { allowRoles, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { purchaseSchema, purchaseUpdateSchema } from '../validators/index.js';

const router = Router();

router.use(protect);

const managers = allowRoles(ROLES.ACCOUNTANT);

router.get('/', listPurchases);
router.get('/:id', getPurchase);
router.post('/', managers, validate(purchaseSchema), createPurchase);
router.patch('/:id', managers, validate(purchaseUpdateSchema), updatePurchaseMeta);
router.post('/:id/receive', managers, receivePurchase);
router.post('/:id/cancel', managers, cancelPurchase);

export default router;
