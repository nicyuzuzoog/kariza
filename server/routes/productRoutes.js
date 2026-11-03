import { Router } from 'express';
import {
  adjustStock,
  archiveProduct,
  createProduct,
  getProduct,
  getProductOptions,
  listProducts,
  restoreProduct,
  updateProduct,
} from '../controllers/productController.js';
import { ROLES } from '../config/constants.js';
import { allowRoles, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  adjustStockSchema,
  productSchema,
  productUpdateSchema,
} from '../validators/index.js';

const router = Router();

router.use(protect);

const managers = allowRoles(ROLES.ACCOUNTANT);

router.get('/', listProducts);
router.get('/meta/options', getProductOptions);
router.get('/:id', getProduct);

router.post('/', managers, validate(productSchema), createProduct);
router.patch('/:id', managers, validate(productUpdateSchema), updateProduct);
router.post('/:id/adjust', managers, validate(adjustStockSchema), adjustStock);
router.delete('/:id', managers, archiveProduct);
router.post('/:id/restore', managers, restoreProduct);

export default router;
