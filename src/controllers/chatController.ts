import { Request, Response } from 'express';
import pool from '../config/database';
import { HTTP_STATUS } from '../constants';

// Get all conversations for current user
export const getMyConversations = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        // Fetch conversations where user is a participant
        // Join with other participants to show their names (for 1:1)
        const result = await pool.query(
            `SELECT 
         c.id, c.type, c.title, c.created_at, c.updated_at,
         MAX(m.content) as last_message_content,
         MAX(m.sender_id) as last_message_sender,
         MAX(m.created_at) as last_message_at,
         (
           SELECT json_agg(json_build_object(
             'id', u.id,
             'first_name', u.first_name,
             'last_name', u.last_name,
             'company_name', COALESCE(scp.company_name, gcp.company_name, supp.company_name, cp.company_name)
           ))
           FROM conversation_participants cp_inner
           JOIN users u ON cp_inner.user_id = u.id
           LEFT JOIN sub_contractor_profiles scp ON u.id = scp.user_id
           LEFT JOIN general_contractor_profiles gcp ON u.id = gcp.user_id
           LEFT JOIN supplier_profiles supp ON u.id = supp.user_id
           LEFT JOIN client_profiles cp ON u.id = cp.user_id
           WHERE cp_inner.conversation_id = c.id AND cp_inner.user_id != $1
         ) as other_participants
       FROM conversations c
       JOIN conversation_participants cp ON c.id = cp.conversation_id
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE cp.user_id = $1
       GROUP BY c.id
       ORDER BY MAX(m.created_at) DESC NULLS LAST, c.updated_at DESC`,
            [userId]
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to fetch conversations'
        });
    }
};

// Start a 1:1 conversation
export const startConversation = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { partnerId } = req.body;

        if (!partnerId) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Partner ID is required' });
        }

        // Check if 1:1 conversation already exists
        const existing = await pool.query(
            `SELECT c.id 
       FROM conversations c
       JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
       JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       WHERE c.type = 'direct' 
         AND cp1.user_id = $1 
         AND cp2.user_id = $2`,
            [userId, partnerId]
        );

        if (existing.rows.length > 0) {
            return res.status(HTTP_STATUS.OK).json({
                success: true,
                data: existing.rows[0],
                message: 'Conversation already exists'
            });
        }

        // Create new conversation
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const convRes = await client.query(
                "INSERT INTO conversations (type) VALUES ('direct') RETURNING id"
            );
            const conversationId = convRes.rows[0].id;

            // Add participants
            await client.query(
                'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
                [conversationId, userId, partnerId]
            );

            await client.query('COMMIT');

            res.status(HTTP_STATUS.CREATED).json({
                success: true,
                data: { id: conversationId },
                message: 'Conversation created'
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Start conversation error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to start conversation'
        });
    }
};

// Get messages for a conversation
export const getMessages = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { conversationId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        // Verify participation
        const check = await pool.query(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, userId]
        );

        if (check.rows.length === 0) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: 'Unauthorized access to this conversation'
            });
        }

        // Fetch messages
        const result = await pool.query(
            `SELECT m.*, 
              u.first_name, u.last_name, u.email
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
            [conversationId, limit, offset]
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result.rows.reverse() // Return in chronological order for frontend
        });

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
};
