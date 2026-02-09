import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export const getOrCreateProjectConversation = async (projectId: number, gcId: number, userId?: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get project details
        const project = await client.query(
            'SELECT name FROM gc_projects WHERE id = $1',
            [projectId]
        );

        if (project.rows.length === 0) {
            throw new Error('Project not found');
        }

        const projectName = project.rows[0].name;

        // 2. Check if conversation already exists
        const existing = await client.query(
            `SELECT id FROM conversations 
       WHERE type = 'project' AND related_gc_project_id = $1 
       LIMIT 1`,
            [projectId]
        );

        let conversationId: string;

        if (existing.rows.length > 0) {
            conversationId = existing.rows[0].id;
        } else {
            // 3. Create new project conversation
            const convRes = await client.query(
                `INSERT INTO conversations (type, title, related_gc_project_id, created_by) 
         VALUES ('project', $1, $2, $3) 
         RETURNING id`,
                [`Project: ${projectName}`, projectId, gcId]
            );
            conversationId = convRes.rows[0].id;

            // Add GC as participant
            await client.query(
                `INSERT INTO conversation_participants (conversation_id, user_id) 
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [conversationId, gcId]
            );
        }

        // 4. Add the user as participant if provided
        if (userId) {
            await client.query(
                `INSERT INTO conversation_participants (conversation_id, user_id) 
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [conversationId, userId]
            );
        }

        await client.query('COMMIT');
        return conversationId;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const addParticipantToConversation = async (conversationId: string, userId: number) => {
    await pool.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) 
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [conversationId, userId]
    );
};
