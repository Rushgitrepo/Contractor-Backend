import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getMyConversations,
  createDirectConversation,
  createGroupConversation,
  ensureProjectConversation,
  getMessages,
  sendMessage,
  deleteMessage,
  markRead,
  addParticipants,
  removeParticipant,
  searchUsers,
} from '../controllers/chatController';

const router = Router();

router.get('/users/search', authenticate, searchUsers);
router.get('/conversations', authenticate, getMyConversations);
router.post('/conversations/direct', authenticate, createDirectConversation);
router.post('/conversations/group', authenticate, createGroupConversation);
router.post('/projects/:projectId/conversation', authenticate, ensureProjectConversation);
router.get('/conversations/:conversationId/messages', authenticate, getMessages);
router.post('/conversations/:conversationId/messages', authenticate, sendMessage);
router.delete('/messages/:messageId', authenticate, deleteMessage);
router.post('/conversations/:conversationId/read', authenticate, markRead);
router.post('/conversations/:conversationId/participants', authenticate, addParticipants);
router.delete('/conversations/:conversationId/participants/:userId', authenticate, removeParticipant);

export default router;
