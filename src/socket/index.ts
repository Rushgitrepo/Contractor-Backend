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
    // Middleware for authentication
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
            // Verify token directly using jwt library as utils might leverage different logic or Env 
            // Assuming config.jwt.secret holds the secret
            const decoded = jwt.verify(token, config.jwt.secret || process.env.JWT_SECRET!) as any;
            socket.user = decoded;
            next();
        } catch (err) {
            console.error('Socket Auth Error:', err);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket: AuthSocket) => {
        // console.log(`User connected: ${socket.user?.id}`);

        // Join user's own room for private notifications
        if (socket.user?.id) {
            socket.join(`user:${socket.user.id}`);
        }

        // Join a specific conversation
        socket.on('join_conversation', async (conversationId: string) => {
            try {
                // Verify user is a participant
                const check = await pool.query(
                    'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
                    [conversationId, socket.user!.id]
                );

                if (check.rows.length > 0) {
                    socket.join(conversationId);
                    // console.log(`User ${socket.user?.id} joined room ${conversationId}`);
                } else {
                    socket.emit('error', { message: 'Unauthorized to join this conversation' });
                }
            } catch (error) {
                console.error('Join error:', error);
            }
        });

        // Handle sending messages
        socket.on('send_message', async (data: { conversationId: string; content: string; attachments?: any[] }) => {
            const { conversationId, content, attachments } = data;
            const senderId = socket.user?.id;

            if (!senderId) return;

            try {
                // Validate participation again (optional but safer)
                const participantCheck = await pool.query(
                    'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
                    [conversationId, senderId]
                );

                if (participantCheck.rows.length === 0) {
                    return socket.emit('error', 'You are not a participant of this conversation');
                }

                // Insert Message
                const result = await pool.query(
                    `INSERT INTO messages (conversation_id, sender_id, content, attachments)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
                    [conversationId, senderId, content, JSON.stringify(attachments || [])]
                );

                const message = result.rows[0];

                // Fetch sender details to populate in real-time
                const senderInfo = await pool.query(
                    'SELECT id, first_name, last_name, email FROM users WHERE id = $1',
                    [senderId]
                );

                const fullMessage = {
                    ...message,
                    sender: senderInfo.rows[0]
                };

                // Broadcast to everyone in the room (including sender for confirmation)
                io.to(conversationId).emit('new_message', fullMessage);

                // Update conversation updated_at
                await pool.query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

            } catch (error) {
                console.error('Message send error:', error);
                socket.emit('error', 'Failed to send message');
            }
        });

        // Typing indicators
        socket.on('typing_start', (conversationId) => {
            socket.to(conversationId).emit('user_typing', { userId: socket.user?.id, conversationId });
        });

        socket.on('typing_stop', (conversationId) => {
            socket.to(conversationId).emit('user_stopped_typing', { userId: socket.user?.id, conversationId });
        });

        socket.on('disconnect', () => {
            // console.log('User disconnected');
        });
    });
};
