
import pool from '../../config/database';

export interface CreateBidData {
    projectId: string;
    contractorId: number;
    contractorType?: string; // 'gc' or 'sc'
    totalPrice: number;
    estimatedStartDate?: Date | string;
    estimatedEndDate?: Date | string;
    notes?: string;
    companyHighlights?: string;
    relevantExperience?: string;
    credentials?: string;
    items?: {
        name: string;
        description?: string;
        price: number;
    }[];
}

export interface UpdateBidItemsData {
    items: {
        name: string;
        description?: string;
        price: number;
    }[];
}

// 1. Create Bid (Draft)
export const createBid = async (data: CreateBidData) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check strict unique constraint
        const existCheck = await client.query(
            'SELECT id FROM bids WHERE project_id = $1 AND contractor_id = $2',
            [data.projectId, data.contractorId]
        );

        if (existCheck.rows.length > 0) {
            throw new Error('You have already created a bid for this project.');
        }

        // Insert Bid
        const bidResult = await client.query(
            `INSERT INTO bids 
       (project_id, contractor_id, contractor_type, total_price, estimated_start_date, estimated_end_date, notes, company_highlights, relevant_experience, credentials, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
       RETURNING *`,
            [
                data.projectId,
                data.contractorId,
                data.contractorType || 'gc',
                data.totalPrice,
                data.estimatedStartDate || null,
                data.estimatedEndDate || null,
                data.notes || null,
                data.companyHighlights || null,
                data.relevantExperience || null,
                data.credentials || null,
            ]
        );
        const bid = bidResult.rows[0];

        // Insert Items if present
        if (data.items && data.items.length > 0) {
            for (const item of data.items) {
                await client.query(
                    `INSERT INTO bid_items (bid_id, item_name, item_description, item_price)
           VALUES ($1, $2, $3, $4)`,
                    [bid.id, item.name, item.description || null, item.price]
                );
            }
        }

        // Log status
        await client.query(
            `INSERT INTO bid_status_log (bid_id, old_status, new_status, changed_by)
       VALUES ($1, NULL, 'draft', $2)`,
            [bid.id, data.contractorId]
        );

        await client.query('COMMIT');
        return bid;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 2. Add/Update Bid Items (Replace all items)
export const updateBidItems = async (bidId: string, contractorId: number, data: UpdateBidItemsData) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify ownership and status
        const bidCheck = await client.query(
            'SELECT status FROM bids WHERE id = $1 AND contractor_id = $2',
            [bidId, contractorId]
        );

        if (bidCheck.rows.length === 0) {
            throw new Error('Bid not found or unauthorized.');
        }
        if (bidCheck.rows[0].status !== 'draft') {
            throw new Error('Cannot update items unless bid is in draft status.');
        }

        // Delete existing items
        await client.query('DELETE FROM bid_items WHERE bid_id = $1', [bidId]);

        // Insert new items
        let calculatedTotal = 0;
        for (const item of data.items) {
            calculatedTotal += Number(item.price);
            await client.query(
                `INSERT INTO bid_items (bid_id, item_name, item_description, item_price)
         VALUES ($1, $2, $3, $4)`,
                [bidId, item.name, item.description || null, item.price]
            );
        }

        // Update total price on bid
        await client.query(
            'UPDATE bids SET total_price = $1, updated_at = NOW() WHERE id = $2',
            [calculatedTotal, bidId]
        );

        await client.query('COMMIT');
        return { count: data.items.length, totalCalculated: calculatedTotal };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 3. Submit Bid
export const submitBid = async (bidId: string, contractorId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const bidRes = await client.query(
            'SELECT status FROM bids WHERE id = $1 AND contractor_id = $2 FOR UPDATE',
            [bidId, contractorId]
        );

        if (bidRes.rows.length === 0) throw new Error('Bid not found.');
        if (bidRes.rows[0].status !== 'draft') throw new Error('Bid is not in draft status.');

        const updated = await client.query(
            `UPDATE bids SET status = 'submitted', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [bidId]
        );

        await client.query(
            `INSERT INTO bid_status_log (bid_id, old_status, new_status, changed_by)
       VALUES ($1, 'draft', 'submitted', $2)`,
            [bidId, contractorId]
        );

        await client.query('COMMIT');
        return updated.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 4. Withdraw Bid
export const withdrawBid = async (bidId: string, contractorId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const bidRes = await client.query(
            'SELECT status FROM bids WHERE id = $1 AND contractor_id = $2 FOR UPDATE',
            [bidId, contractorId]
        );

        if (bidRes.rows.length === 0) throw new Error('Bid not found.');
        const currentStatus = bidRes.rows[0].status;

        if (['withdrawn', 'rejected'].includes(currentStatus)) {
            throw new Error(`Cannot withdraw bid that is already ${currentStatus}.`);
        }

        const updated = await client.query(
            `UPDATE bids SET status = 'withdrawn', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [bidId]
        );

        await client.query(
            `INSERT INTO bid_status_log (bid_id, old_status, new_status, changed_by)
       VALUES ($1, $2, 'withdrawn', $3)`,
            [bidId, currentStatus, contractorId]
        );

        await client.query('COMMIT');
        return updated.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 5. Accept Bid (Owner Only)
export const acceptBid = async (bidId: string, ownerId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify owner owns the project
        const bidRes = await client.query(
            `SELECT b.id, b.status, p.owner_id, p.id as project_id
       FROM bids b
       JOIN projects p ON b.project_id = p.id
       WHERE b.id = $1 FOR UPDATE`,
            [bidId]
        );

        if (bidRes.rows.length === 0) throw new Error('Bid not found.');
        const bid = bidRes.rows[0];

        if (bid.owner_id !== ownerId) throw new Error('Unauthorized: You do not own this project.');
        if (bid.status !== 'submitted') throw new Error('Only submitted bids can be accepted.');

        const updated = await client.query(
            `UPDATE bids SET status = 'accepted', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [bidId]
        );

        // Optionally update project status? Not explicitly requested but logical.
        // await client.query("UPDATE projects SET status = 'awarded' WHERE id = $1", [bid.project_id]);

        await client.query(
            `INSERT INTO bid_status_log (bid_id, old_status, new_status, changed_by)
       VALUES ($1, 'submitted', 'accepted', $2)`,
            [bidId, ownerId]
        );

        await client.query('COMMIT');
        return updated.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 6. Reject Bid (Owner Only)
export const rejectBid = async (bidId: string, ownerId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const bidRes = await client.query(
            `SELECT b.id, b.status, p.owner_id
       FROM bids b
       JOIN projects p ON b.project_id = p.id
       WHERE b.id = $1 FOR UPDATE`,
            [bidId]
        );

        if (bidRes.rows.length === 0) throw new Error('Bid not found.');
        const bid = bidRes.rows[0];

        if (bid.owner_id !== ownerId) throw new Error('Unauthorized.');
        if (bid.status === 'rejected') throw new Error('Bid is already rejected.');

        const updated = await client.query(
            `UPDATE bids SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [bidId]
        );

        await client.query(
            `INSERT INTO bid_status_log (bid_id, old_status, new_status, changed_by)
       VALUES ($1, $2, 'rejected', $3)`,
            [bidId, bid.status, ownerId]
        );

        await client.query('COMMIT');
        return updated.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 7. Get Project Bids (Owner)
export const getProjectBids = async (projectId: string, ownerId: number) => {
    // First verify project ownership
    const projectCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
        [projectId, ownerId]
    );
    if (projectCheck.rows.length === 0) {
        throw new Error('Project not found or unauthorized.');
    }

    const result = await pool.query(
        `SELECT 
       b.*,
       u.first_name || ' ' || u.last_name as contractor_name,
       u.email as contractor_email
     FROM bids b
     JOIN users u ON b.contractor_id = u.id
     WHERE b.project_id = $1
     ORDER BY b.created_at DESC`,
        [projectId]
    );

    return result.rows;
};

// 8. Get My Bids (Contractor)
export const getMyBids = async (contractorId: number) => {
    const result = await pool.query(
        `SELECT 
       b.id,
       b.status,
       b.total_price as amount,
       b.created_at,
       b.updated_at,
       p.title as project_name,
       p.location_city || ', ' || p.location_state as location,
       p.project_type,
       u.first_name || ' ' || u.last_name as client_name,
       (SELECT count(*)::int FROM bid_items bi WHERE bi.bid_id = b.id) as items_count
     FROM bids b
     JOIN projects p ON b.project_id = p.id
     JOIN users u ON p.owner_id = u.id
     WHERE b.contractor_id = $1
     ORDER BY b.created_at DESC`,
        [contractorId]
    );
    return result.rows;
};

// 9. Get Bid Detail
export const getBidDetail = async (bidId: string, userId: number) => {
    // Check access: Must be Owner of project OR Contractor of bid
    const accessCheck = await pool.query(
        `SELECT b.id, b.contractor_id, p.owner_id
     FROM bids b
     JOIN projects p ON b.project_id = p.id
     WHERE b.id = $1`,
        [bidId]
    );

    if (accessCheck.rows.length === 0) throw new Error('Bid not found.');

    const { contractor_id, owner_id } = accessCheck.rows[0];
    if (userId !== contractor_id && userId !== owner_id) {
        throw new Error('Unauthorized access to bid detail.');
    }

    // Auto-mark as viewed if owner is looking at a submitted bid
    if (userId === owner_id) {
        await markBidViewed(bidId, userId);
    }

    // Fetch Details
    const bidRes = await pool.query(
        `SELECT 
       b.*,
       p.title as project_title,
       u.first_name || ' ' || u.last_name as contractor_name
     FROM bids b
     JOIN projects p ON b.project_id = p.id
     JOIN users u ON b.contractor_id = u.id
     WHERE b.id = $1`,
        [bidId]
    );

    const itemsRes = await pool.query(
        'SELECT * FROM bid_items WHERE bid_id = $1',
        [bidId]
    );

    const historyRes = await pool.query(
        `SELECT l.*, u.first_name || ' ' || u.last_name as changed_by_name
     FROM bid_status_log l
     JOIN users u ON l.changed_by = u.id
     WHERE l.bid_id = $1
     ORDER BY l.changed_at DESC`,
        [bidId]
    );

    return {
        ...bidRes.rows[0],
        items: itemsRes.rows,
        history: historyRes.rows
    };
};
// 7. Mark Bid as Viewed (Owner Only)
export const markBidViewed = async (bidId: string, ownerId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const bidRes = await client.query(
            `SELECT b.status, p.owner_id FROM bids b 
             JOIN projects p ON b.project_id = p.id 
             WHERE b.id = $1`,
            [bidId]
        );

        if (bidRes.rows.length === 0) throw new Error('Bid not found.');
        const bid = bidRes.rows[0];

        if (bid.owner_id !== ownerId) throw new Error('Unauthorized');

        // Only move to viewed if currently submitted
        if (bid.status === 'submitted') {
            await client.query(
                "UPDATE bids SET status = 'viewed', updated_at = NOW() WHERE id = $1",
                [bidId]
            );
            await client.query(
                "INSERT INTO bid_status_log (bid_id, old_status, new_status, changed_by) VALUES ($1, 'submitted', 'viewed', $2)",
                [bidId, ownerId]
            );
        }

        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 8. Start Project from Bid (Owner Only)
export const startProjectFromBid = async (bidId: string, ownerId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const bidRes = await client.query(
            `SELECT b.status, p.owner_id, p.id as project_id FROM bids b 
             JOIN projects p ON b.project_id = p.id 
             WHERE b.id = $1`,
            [bidId]
        );

        if (bidRes.rows.length === 0) throw new Error('Bid not found.');
        const bid = bidRes.rows[0];

        if (bid.owner_id !== ownerId) throw new Error('Unauthorized');
        if (bid.status !== 'accepted') throw new Error('Only accepted bids can be started.');

        await client.query(
            "UPDATE bids SET status = 'started', updated_at = NOW() WHERE id = $1",
            [bidId]
        );

        // Update project status to Active
        await client.query(
            "UPDATE projects SET status = 'active' WHERE id = $1",
            [bid.project_id]
        );

        await client.query(
            "INSERT INTO bid_status_log (bid_id, old_status, new_status, changed_by) VALUES ($1, 'accepted', 'started', $2)",
            [bidId, ownerId]
        );

        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// 9. Delete Bid
export const deleteBid = async (bidId: string, userId: number) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check ownership - either the contractor who made it or the project owner
        const bidRes = await client.query(
            `SELECT b.contractor_id, p.owner_id FROM bids b 
             JOIN projects p ON b.project_id = p.id 
             WHERE b.id = $1`,
            [bidId]
        );

        if (bidRes.rows.length === 0) throw new Error('Bid not found.');
        const bid = bidRes.rows[0];

        if (bid.contractor_id !== userId && bid.owner_id !== userId) {
            throw new Error('Unauthorized to delete this bid.');
        }

        // Delete bid items first (cascade should handle it but let's be explicit if needed, 
        // though our schema says ON DELETE CASCADE)
        await client.query('DELETE FROM bids WHERE id = $1', [bidId]);

        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};
