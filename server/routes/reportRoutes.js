import { Router } from 'express';
import {
  consumptionReport,
  movementReport,
  stockReport,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/stock', stockReport);
router.get('/movements', movementReport);
router.get('/consumption', consumptionReport);

export default router;
