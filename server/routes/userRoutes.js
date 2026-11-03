import { Router } from 'express';
import {
  createUser,
  deactivateUser,
  listUsers,
  resetPassword,
  updateUser,
} from '../controllers/userController.js';
import { allowRoles, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from '../validators/index.js';

const router = Router();

router.use(protect, allowRoles());

router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id', validate(updateUserSchema), updateUser);
router.post('/:id/reset-password', validate(resetPasswordSchema), resetPassword);
router.delete('/:id', deactivateUser);

export default router;
