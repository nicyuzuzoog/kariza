import { Router } from 'express';
import { createIssue, getIssue, listIssues, voidIssue } from '../controllers/issueController.js';
import { ROLES } from '../config/constants.js';
import { allowRoles, protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { issueSchema, voidIssueSchema } from '../validators/index.js';

const router = Router();

router.use(protect);

const issuers = allowRoles(ROLES.ACCOUNTANT, ROLES.STOREKEEPER);

router.get('/', listIssues);
router.get('/:id', getIssue);
router.post('/', issuers, validate(issueSchema), createIssue);
router.post('/:id/void', issuers, validate(voidIssueSchema), voidIssue);

export default router;
