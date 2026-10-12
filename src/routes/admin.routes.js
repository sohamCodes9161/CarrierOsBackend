import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { isAdmin } from '../middleware/isAdmin.js';

const router = Router();

// Protect all admin routes with authentication AND admin checks
router.use(authenticate, isAdmin);

router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.listUsers);
router.post('/users/:id/reset-quota', adminController.resetUserQuota);

export default router;