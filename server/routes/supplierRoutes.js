import { Router } from 'express';
import {
  createSupplier,
  deactivateSupplier,
  listSuppliers,
  updateSupplier,
} from '../controllers/supplierController.js';
import { ROLES } from '../config/constants.js';
import { allowRoles, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { supplierSchema, supplierUpdateSchema } from '../validators/index.js';

const router = Router();

router.use(protect);

const managers = allowRoles(ROLES.ACCOUNTANT);

router.get('/', listSuppliers);
router.post('/', managers, validate(supplierSchema), createSupplier);
router.patch('/:id', managers, validate(supplierUpdateSchema), updateSupplier);
router.delete('/:id', managers, deactivateSupplier);

export default router;
