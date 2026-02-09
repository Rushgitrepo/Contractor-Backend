import { Request, Response } from 'express';
import pool from '../config/database';
import { HTTP_STATUS } from '../constants';
import { AuthRequest } from '../middleware/auth';

const MAX_PAGE_SIZE = 100;

const asInt = (value: any, fallback: number) => {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.min(n, MAX_PAGE_SIZE);
};

const loadSenderInfo = async (userId: number) => {
  const senderInfo = await pool.query(
    'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
    [userId]
  );
  return senderInfo.rows[0];
};

const emitIfSocket = (req: Request, event: string, payload: any) => {
  const io = (req.app as any)?.get?.('io');
  if (io) {
    io.to(payload.conversation_id || payload.conversationId || payload.id).emit(event, payload);
  }
};

// ------------------------------------------------------------
// Conversations
// ------------------------------------------------------------

export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;
    const currentUserId = req.user!.id;

    let result;
    if (!query || String(query).length < 1) {
      // Return recent active users as default list
      result = await pool.query(
        `SELECT id, first_name, last_name, email 
         FROM users 
         WHERE id != $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [currentUserId]
      );
    } else {
      const searchQuery = `%${query}%`;
      result = await pool.query(
        `SELECT id, first_name, last_name, email 
         FROM users 
         WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
         AND id != $2
         LIMIT 20`,
        [searchQuery, currentUserId]
      );
    }

    return res.status(HTTP_STATUS.OK).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('searchUsers error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

export const getMyConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = asInt(req.query.limit, 50);
    const offset = parseInt(String(req.query.offset || 0), 10) || 0;

    const result = await pool.query(
      `SELECT 
        c.id,
        c.title,
        c.type,
        c.related_project_id,
        c.related_gc_project_id,
        c.created_by,

        c.created_at,
        c.updated_at,
        lm.id as last_message_id,
        CASE WHEN lm.is_deleted THEN NULL ELSE lm.content END as last_message_content,
        lm.message_type as last_message_type,
        lm.sender_id as last_message_sender_id,
        lm.created_at as last_message_created_at,
        lm.is_deleted as last_message_deleted,
        COALESCE(unread.count, 0) as unread_count,
        participants.participants
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = $1
      LEFT JOIN LATERAL (
        SELECT m.*
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INT AS count
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.is_deleted = FALSE
          AND m.sender_id <> $1
          AND m.created_at > COALESCE(cp.last_read_at, '1970-01-01')
      ) unread ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'email', u.email
        )) AS participants
        FROM conversation_participants cp2
        JOIN users u ON u.id = cp2.user_id
        WHERE cp2.conversation_id = c.id
      ) participants ON TRUE
      ORDER BY c.updated_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.status(HTTP_STATUS.OK).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getMyConversations error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
};

export const createDirectConversation = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { userId: partnerId } = req.body;
  try {
    if (!partnerId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'userId is required' });
    }
    if (partnerId === userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Cannot create direct chat with yourself' });
    }

    const existing = await pool.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
       WHERE c.type = 'direct'
       LIMIT 1`,
      [userId, partnerId]
    );
    if (existing.rows.length > 0) {
      return res.status(HTTP_STATUS.OK).json({ success: true, data: existing.rows[0], message: 'Conversation already exists' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const convRes = await client.query(
        `INSERT INTO conversations (type, created_by) VALUES ('direct', $1) RETURNING id, created_at, updated_at`,
        [userId]
      );
      const conversationId = convRes.rows[0].id;
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [conversationId, userId, partnerId]
      );
      await client.query('COMMIT');
      return res.status(HTTP_STATUS.CREATED).json({ success: true, data: { id: conversationId } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('createDirectConversation error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to create conversation' });
  }
};

export const createGroupConversation = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { title, participantIds = [] } = req.body;
  try {
    if (!title) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'title is required' });
    }
    const uniqueParticipants = Array.from(new Set([userId, ...(participantIds as number[])]));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const convRes = await client.query(
        `INSERT INTO conversations (type, title, created_by) VALUES ('group', $1, $2) RETURNING id`,
        [title, userId]
      );
      const conversationId = convRes.rows[0].id;
      const values = uniqueParticipants
        .map((_pid, idx) => `($1, $${idx + 2})`)
        .join(',');

      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${values}`,
        [conversationId, ...uniqueParticipants]
      );
      await client.query('COMMIT');
      return res.status(HTTP_STATUS.CREATED).json({ success: true, data: { id: conversationId } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('createGroupConversation error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to create group conversation' });
  }
};

export const ensureProjectConversation = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { projectId: rawProjectId } = req.params;
  const projectId = parseInt(String(rawProjectId), 10);
  const { participantIds = [] } = req.body || {};

  if (!Number.isFinite(projectId)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Invalid project id' });
  }

  try {
    const project = await pool.query('SELECT id, name, gc_id FROM gc_projects WHERE id = $1 AND deleted_at IS NULL', [projectId]);
    if (project.rows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Project not found' });
    }

    const existing = await pool.query(
      `SELECT id FROM conversations WHERE type = 'project' AND related_gc_project_id = $1 LIMIT 1`,
      [projectId]
    );
    if (existing.rows.length > 0) {
      return res.status(HTTP_STATUS.OK).json({ success: true, data: existing.rows[0], message: 'Conversation already exists' });
    }

    const title = project.rows[0].name ? `Project: ${project.rows[0].name}` : 'Project Conversation';
    const participants = Array.from(new Set([userId, project.rows[0].gc_id, ...(participantIds as number[])]
      .filter((pid): pid is number => typeof pid === 'number' && Number.isFinite(pid))));

    if (participants.length === 0) {
      participants.push(userId);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const convRes = await client.query(
        `INSERT INTO conversations (type, title, related_gc_project_id, created_by) VALUES ('project', $1, $2, $3) RETURNING id`,
        [title, projectId, userId]
      );
      const conversationId = convRes.rows[0].id;
      const values = participants.map((_pid, idx) => `($1, $${idx + 2})`).join(',');

      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${values}`,
        [conversationId, ...participants]
      );
      await client.query('COMMIT');
      return res.status(HTTP_STATUS.CREATED).json({ success: true, data: { id: conversationId } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('ensureProjectConversation error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to create project conversation' });
  }
};


// ------------------------------------------------------------
// Messages
// ------------------------------------------------------------

export const getMessages = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const limit = asInt(req.query.limit, 50);
  const cursor = req.query.cursor as string | undefined;

  try {
    const participant = await pool.query(
      'SELECT last_read_at FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (participant.rows.length === 0) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Unauthorized access to this conversation' });
    }

    const params: any[] = [conversationId, limit];
    let cursorClause = '';
    if (cursor) {
      params.push(new Date(cursor));
      cursorClause = `AND m.created_at < $${params.length}`;
    }

    const result = await pool.query(
      `SELECT m.*, u.first_name, u.last_name, u.email
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ${cursorClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      data: result.rows.reverse() // chronological
    });
  } catch (error) {
    console.error('getMessages error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to fetch messages' });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const { content, attachments = [], messageType = 'text' } = req.body;

  try {
    const participant = await pool.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (participant.rows.length === 0) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Unauthorized access to this conversation' });
    }

    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, content, attachments)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [conversationId, userId, messageType, content, JSON.stringify(attachments)]
    );

    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    const sender = await loadSenderInfo(userId);
    const message = { ...result.rows[0], sender };

    emitIfSocket(req, 'message:new', { ...message, conversationId });
    emitIfSocket(req, 'conversation:updated', { conversationId, updated_at: new Date().toISOString() });

    return res.status(HTTP_STATUS.CREATED).json({ success: true, data: message });
  } catch (error) {
    console.error('sendMessage error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to send message' });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { messageId } = req.params;
  try {
    const message = await pool.query(
      'SELECT id, sender_id, conversation_id FROM messages WHERE id = $1',
      [messageId]
    );
    if (message.rows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Message not found' });
    }
    const row = message.rows[0];
    if (row.sender_id !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Only sender can delete message' });
    }

    const updated = await pool.query(
      `UPDATE messages SET is_deleted = TRUE, content = NULL, attachments = '[]'::jsonb
       WHERE id = $1 RETURNING *`,
      [messageId]
    );

    emitIfSocket(req, 'message:deleted', { id: messageId, conversationId: row.conversation_id });

    return res.status(HTTP_STATUS.OK).json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error('deleteMessage error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to delete message' });
  }
};

// ------------------------------------------------------------
// Read status
// ------------------------------------------------------------

export const markRead = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  try {
    const participant = await pool.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (participant.rows.length === 0) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Unauthorized access to this conversation' });
    }

    await pool.query(
      `UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    emitIfSocket(req, 'conversation:updated', { conversationId, last_read_at: new Date().toISOString(), userId });

    return res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (error) {
    console.error('markRead error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to mark read' });
  }
};

// ------------------------------------------------------------
// Participants
// ------------------------------------------------------------

export const addParticipants = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { conversationId } = req.params;
  const { userIds = [] } = req.body;

  try {
    // Validate caller is participant
    const participant = await pool.query(
      'SELECT c.type FROM conversation_participants cp JOIN conversations c ON c.id = cp.conversation_id WHERE cp.conversation_id = $1 AND cp.user_id = $2',
      [conversationId, userId]
    );
    if (participant.rows.length === 0) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Unauthorized access to this conversation' });
    }
    if (participant.rows[0].type === 'direct') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Cannot add participants to a direct conversation' });
    }

    const uniqueIds = Array.from(new Set(userIds as number[]));
    if (uniqueIds.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'userIds are required' });
    }

    const values = uniqueIds.map((_uid, idx) => `($1, $${idx + 2})`).join(',');

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       VALUES ${values}
       ON CONFLICT DO NOTHING`,
      [conversationId, ...uniqueIds]
    );

    await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    emitIfSocket(req, 'participant:added', { conversationId, userIds: uniqueIds });

    // system message
    await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, content)
       VALUES ($1, $2, 'system', $3)`,
      [conversationId, userId, 'Participants added']
    );

    return res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (error) {
    console.error('addParticipants error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to add participants' });
  }
};

export const removeParticipant = async (req: AuthRequest, res: Response) => {
  const requesterId = req.user!.id;
  const { conversationId, userId } = req.params;
  const targetUserId = parseInt(userId, 10);

  try {
    const conversation = await pool.query(
      'SELECT type FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (conversation.rows.length === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Conversation not found' });
    }
    if (conversation.rows[0].type === 'direct') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Cannot remove participants from a direct conversation' });
    }

    // requester must be a participant
    const requester = await pool.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, requesterId]
    );
    if (requester.rows.length === 0) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: 'Unauthorized' });
    }

    await pool.query(
      'DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, targetUserId]
    );

    emitIfSocket(req, 'participant:removed', { conversationId, userId: targetUserId });

    await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, content)
       VALUES ($1, $2, 'system', $3)`,
      [conversationId, requesterId, 'Participant removed']
    );

    return res.status(HTTP_STATUS.OK).json({ success: true });
  } catch (error) {
    console.error('removeParticipant error', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to remove participant' });
  }
};
