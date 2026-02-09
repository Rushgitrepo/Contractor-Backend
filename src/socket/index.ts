import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import pool from '../config/database';

interface AuthSocket extends Socket {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

export const initializeSocket = (io: Server) => {
    // expose io on app for HTTP controllers
    io.engine?.on?.('connection', () => { });

    io.use((socket: AuthSocket, next) => {
        let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

        // Check cookies if no token found
        if (!token && socket.handshake.headers.cookie) {
            const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = value;
                return acc;
            }, {} as any);
            token = cookies['token'];
        }

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            const decoded = jwt.verify(token, config.jwt.secret || process.env.JWT_SECRET!) as any;
            socket.user = decoded;
            next();
        } catch (err) {
            console.error('Socket Auth Error:', err);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', async (socket: AuthSocket) => {
        const userId = socket.user?.id;
        if (userId) {
            console.log(`User connected to socket: ${userId}`);
            socket.join(`user:${userId}`);

            try {
                // Automatically join all rooms this user is a participant of
                const convs = await pool.query(
                    'SELECT conversation_id FROM conversation_participants WHERE user_id = $1',
                    [userId]
                );
                convs.rows.forEach(r => {
                    socket.join(r.conversation_id);
                    // console.log(`User ${userId} joined room ${r.conversation_id}`);
                });
            } catch (err) {
                console.error('Error joining conversation rooms:', err);
            }
        }

        const requireParticipant = async (conversationId: string) => {
            if (!userId) return false;
            const check = await pool.query(
                'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, userId]
            );
            return check.rows.length > 0;
        };

        socket.on('conversation:join', async (conversationId: string) => {
            try {
                if (await requireParticipant(conversationId)) {
                    socket.join(conversationId);
                    console.log(`User ${userId} explicitly joined room ${conversationId}`);
                } else {
                    socket.emit('error', { message: 'Unauthorized to join this conversation' });
                }
            } catch (error) {
                console.error('conversation:join error', error);
            }
        });

        socket.on('message:send', async (data: { conversationId: string; content?: string; attachments?: any[]; messageType?: string }) => {
            const { conversationId, content, attachments = [], messageType = 'text' } = data;
            const senderId = userId;
            if (!senderId) return;
            try {
                if (!(await requireParticipant(conversationId))) {
                    return socket.emit('error', { message: 'Unauthorized' });
                }

                const result = await pool.query(
                    `INSERT INTO messages (conversation_id, sender_id, message_type, content, attachments)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *`,
                    [conversationId, senderId, messageType, content, JSON.stringify(attachments)]
                );

                await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

                const senderInfo = await pool.query(
                    'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
                    [senderId]
                );

                const fullMessage = { ...result.rows[0], sender: senderInfo.rows[0] };
                io.to(conversationId).emit('message:new', fullMessage);
                io.to(conversationId).emit('conversation:updated', { conversationId, updated_at: new Date().toISOString() });
            } catch (error) {
                console.error('message:send error', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('message:delete', async (messageId: string) => {
            const senderId = userId;
            if (!senderId) return;
            try {
                const message = await pool.query('SELECT id, sender_id, conversation_id FROM messages WHERE id = $1', [messageId]);
                if (message.rows.length === 0) return;
                const row = message.rows[0];
                if (row.sender_id !== senderId) {
                    return socket.emit('error', { message: 'Only sender can delete message' });
                }
                await pool.query(
                    `UPDATE messages SET is_deleted = TRUE, content = NULL, attachments = '[]'::jsonb WHERE id = $1`,
                    [messageId]
                );
                io.to(row.conversation_id).emit('message:deleted', { id: messageId, conversationId: row.conversation_id });
            } catch (error) {
                console.error('message:delete error', error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected from socket: ${userId}`);
        });
    });
};
