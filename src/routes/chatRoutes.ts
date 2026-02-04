import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    getMyConversations,
    startConversation,
    getMessages
} from '../controllers/chatController';

const router = Router();

router.get('/conversations', authenticate, getMyConversations);
router.post('/conversations', authenticate, startConversation);
router.get('/conversations/:conversationId/messages', authenticate, getMessages);

export default router;
