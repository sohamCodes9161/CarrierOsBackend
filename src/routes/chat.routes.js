import { Router } from 'express';
import * as chatController from '../controllers/chat.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { checkUsageLimit } from '../middleware/usageLimiter.js';

const router = Router();

// Limit to 3 messages per day per user
router.use(authenticate);
router.post('/', checkUsageLimit('chat_messages', 3), chatController.handleChat);

export default router;