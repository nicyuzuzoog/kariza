import { Router } from 'express';
import { login, me, updateProfile, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, loginSchema, updateProfileSchema } from '../validators/index.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.get('/me', protect, me);
router.patch('/profile', protect, validate(updateProfileSchema), updateProfile);
router.post('/change-password', protect, validate(changePasswordSchema), changePassword);

export default router;
