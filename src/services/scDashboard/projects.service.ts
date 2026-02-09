import pool from '../../config/database';

// ============================================
// SC PROJECTS SERVICE
// ============================================

export interface CreateSCProjectData {
    scId: number;
    name: string;
    client?: string;
    project_type?: string;
    trade?: string;
    city?: string;
    state?: string;
    address?: string;
    contract_value?: number;
    status?: string;
    progress?: number;
    phase?: string;
    start_date?: string;
    expected_completion_date?: string;
    team_size?: number;
    gc_project_id?: number;
    description?: string;
    notes?: string;
}

export interface UpdateSCProjectData {
    name?: string;
    client?: string;
    project_type?: string;
    trade?: string;
    city?: string;
    state?: string;
    address?: string;
    contract_value?: number;
    status?: string;
    progress?: number;
    phase?: string;
    start_date?: string;
    expected_completion_date?: string;
    actual_completion_date?: string;
    team_size?: number;
    description?: string;
    notes?: string;
}

export interface SCProjectFilters {
    scId: number;
    status?: string;
    trade?: string;
    search?: string;
    page?: number;
    limit?: number;
}

// Check if user exists and is a subcontractor
export const checkSCUserExists = async (userId: number): Promise<boolean> => {
    const result = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'subcontractor'`,
        [userId]
    );
    return result.rows.length > 0;
};

// Create SC Project
export const createProject = async (data: CreateSCProjectData) => {
    // First verify user exists
    const userExists = await checkSCUserExists(data.scId);
    if (!userExists) {
        throw new Error(`User with ID ${data.scId} does not exist or is not a subcontractor`);
    }

    const result = await pool.query(
        `INSERT INTO sc_projects (
      sc_id, name, client, project_type, trade, city, state, address,
      contract_value, status, progress, phase, start_date, expected_completion_date,
      team_size, gc_project_id, description, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *`,
        [
            data.scId,
            data.name,
            data.client || null,
            data.project_type || null,
            data.trade || null,
            data.city || null,
            data.state || null,
            data.address || null,
            data.contract_value || null,
            data.status || 'Planning',
            data.progress || 0,
            data.phase || null,
            data.start_date || null,
            data.expected_completion_date || null,
            data.team_size || 0,
            data.gc_project_id || null,
            data.description || null,
            data.notes || null,
        ]
    );
    return result.rows[0];
};

// Get All SC Projects with counts
export const getProjects = async (filters: SCProjectFilters) => {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    let query = `
    SELECT 
      p.*,
      COUNT(DISTINCT d.id) as documents_count,
      COUNT(DISTINCT t.id) as team_count
    FROM sc_projects p
    LEFT JOIN sc_documents d ON d.project_id = p.id
    LEFT JOIN sc_project_team t ON t.project_id = p.id
    WHERE p.sc_id = $1 AND p.deleted_at IS NULL
  `;

    const params: any[] = [filters.scId];
    let paramCount = 2;

    if (filters.status) {
        query += ` AND p.status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
    }

    if (filters.trade) {
        query += ` AND p.trade = $${paramCount}`;
        params.push(filters.trade);
        paramCount++;
    }

    if (filters.search) {
        query += ` AND (p.name ILIKE $${paramCount} OR p.client ILIKE $${paramCount} OR p.city ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
        paramCount++;
    }

    query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
    SELECT COUNT(DISTINCT p.id) as total
    FROM sc_projects p
    WHERE p.sc_id = $1 AND p.deleted_at IS NULL
  `;
    const countParams: any[] = [filters.scId];
    let countParamCount = 2;

    if (filters.status) {
        countQuery += ` AND p.status = $${countParamCount}`;
        countParams.push(filters.status);
        countParamCount++;
    }

    if (filters.trade) {
        countQuery += ` AND p.trade = $${countParamCount}`;
        countParams.push(filters.trade);
        countParamCount++;
    }

    if (filters.search) {
        countQuery += ` AND (p.name ILIKE $${countParamCount} OR p.client ILIKE $${countParamCount} OR p.city ILIKE $${countParamCount})`;
        countParams.push(`%${filters.search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Get status counts for tabs
    const statusCountsResult = await pool.query(`
    SELECT 
      status,
      COUNT(*) as count
    FROM sc_projects
    WHERE sc_id = $1 AND deleted_at IS NULL
    GROUP BY status
  `, [filters.scId]);

    const statusCounts: Record<string, number> = {};
    statusCountsResult.rows.forEach(row => {
        statusCounts[row.status] = parseInt(row.count);
    });

    return {
        projects: result.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        statusCounts,
    };
};

// Get Single SC Project with details
export const getProjectById = async (projectId: number, scId: number) => {
    const result = await pool.query(
        `SELECT * FROM sc_projects 
     WHERE id = $1 AND sc_id = $2 AND deleted_at IS NULL`,
        [projectId, scId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const project = result.rows[0];

    // Get team members
    const teamResult = await pool.query(
        `SELECT * FROM sc_project_team
     WHERE project_id = $1 AND status = 'Active'
     ORDER BY assigned_at DESC`,
        [projectId]
    );

    // Get documents count
    const docCountResult = await pool.query(
        `SELECT COUNT(*) as count FROM sc_documents WHERE project_id = $1`,
        [projectId]
    );

    return {
        ...project,
        team_members: teamResult.rows,
        documents_count: parseInt(docCountResult.rows[0].count),
    };
};

// Update SC Project
export const updateProject = async (projectId: number, scId: number, data: UpdateSCProjectData) => {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            updateFields.push(`${key} = $${paramCount}`);
            values.push(value);
            paramCount++;
        }
    });

    if (updateFields.length === 0) {
        throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(projectId, scId);

    const result = await pool.query(
        `UPDATE sc_projects 
     SET ${updateFields.join(', ')}
     WHERE id = $${paramCount} AND sc_id = $${paramCount + 1} AND deleted_at IS NULL
     RETURNING *`,
        values
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
};

// Delete SC Project (Hard Delete)
export const deleteProject = async (projectId: number, scId: number) => {
    console.log('[SC deleteProject] Starting HARD delete - projectId:', projectId, 'scId:', scId);

    try {
        const result = await pool.query(
            `DELETE FROM sc_projects 
       WHERE id = $1 AND sc_id = $2
       RETURNING *`,
            [projectId, scId]
        );

        console.log('[SC deleteProject] Rows deleted:', result.rowCount);

        if (result.rows.length > 0) {
            console.log('[SC deleteProject] Permanently deleted project:', result.rows[0].name);
        }

        return result.rows.length > 0;
    } catch (error) {
        console.error('[SC deleteProject] Database error:', error);
        throw error;
    }
};

// Check SC Project Ownership
export const checkProjectOwnership = async (projectId: number, scId: number): Promise<boolean> => {
    const result = await pool.query(
        `SELECT id FROM sc_projects 
     WHERE id = $1 AND sc_id = $2 AND deleted_at IS NULL`,
        [projectId, scId]
    );
    return result.rows.length > 0;
};

// Get SC Dashboard Overview Stats
export const getDashboardOverview = async (scId: number) => {
    // Get active projects count
    const projectsResult = await pool.query(
        `SELECT COUNT(*) as count FROM sc_projects 
     WHERE sc_id = $1 AND deleted_at IS NULL AND status IN ('Active', 'Bidding')`,
        [scId]
    );

    // Get completed projects count
    const completedResult = await pool.query(
        `SELECT COUNT(*) as count FROM sc_projects 
     WHERE sc_id = $1 AND deleted_at IS NULL AND status = 'Completed'`,
        [scId]
    );

    // Get total team size across all active projects
    const teamResult = await pool.query(
        `SELECT COALESCE(SUM(team_size), 0) as total FROM sc_projects 
     WHERE sc_id = $1 AND deleted_at IS NULL AND status = 'Active'`,
        [scId]
    );

    // Get total contract value
    const valueResult = await pool.query(
        `SELECT COALESCE(SUM(contract_value), 0) as total FROM sc_projects 
     WHERE sc_id = $1 AND deleted_at IS NULL`,
        [scId]
    );

    // Get average progress of active projects
    const progressResult = await pool.query(
        `SELECT COALESCE(AVG(progress), 0) as avg_progress FROM sc_projects 
     WHERE sc_id = $1 AND deleted_at IS NULL AND status = 'Active'`,
        [scId]
    );

    return {
        activeProjectsCount: parseInt(projectsResult.rows[0].count),
        completedProjectsCount: parseInt(completedResult.rows[0].count),
        totalTeamSize: parseInt(teamResult.rows[0].total),
        totalContractValue: parseFloat(valueResult.rows[0].total),
        averageProgress: parseFloat(progressResult.rows[0].avg_progress).toFixed(1),
    };
};

// Get Recent SC Projects
export const getRecentProjects = async (scId: number, limit: number = 3) => {
    const result = await pool.query(
        `SELECT 
      id, name, client, city, state, status, contract_value, progress, phase, start_date, expected_completion_date
     FROM sc_projects 
     WHERE sc_id = $1 AND deleted_at IS NULL 
     ORDER BY created_at DESC 
     LIMIT $2`,
        [scId, limit]
    );

    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        client: row.client || 'N/A',
        location: row.city && row.state ? `${row.city}, ${row.state}` : 'N/A',
        status: row.status,
        value: row.contract_value ? `$${(row.contract_value / 1000).toFixed(0)}k` : 'N/A',
        progress: row.progress || 0,
        phase: row.phase || 'N/A',
        startDate: row.start_date,
        endDate: row.expected_completion_date,
    }));
};

// ============================================
// SC DOCUMENTS SERVICE
// ============================================

export interface UploadDocumentData {
    projectId: number;
    name: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    category: string;
    uploadedBy: number;
}

export const uploadDocument = async (data: UploadDocumentData) => {
    const result = await pool.query(
        `INSERT INTO sc_documents (project_id, name, file_path, file_type, file_size, category, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
        [data.projectId, data.name, data.filePath, data.fileType, data.fileSize, data.category, data.uploadedBy]
    );
    return result.rows[0];
};

export const getProjectDocuments = async (projectId: number, scId: number) => {
    // First verify ownership
    const ownershipCheck = await checkProjectOwnership(projectId, scId);
    if (!ownershipCheck) {
        throw new Error('Project not found or access denied');
    }

    const result = await pool.query(
        `SELECT d.*, u.first_name || ' ' || u.last_name as uploaded_by_name
     FROM sc_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.project_id = $1
     ORDER BY d.created_at DESC`,
        [projectId]
    );

    return result.rows;
};

export const deleteDocument = async (documentId: number, projectId: number, scId: number) => {
    // First verify ownership
    const ownershipCheck = await checkProjectOwnership(projectId, scId);
    if (!ownershipCheck) {
        throw new Error('Project not found or access denied');
    }

    const result = await pool.query(
        `DELETE FROM sc_documents WHERE id = $1 AND project_id = $2 RETURNING *`,
        [documentId, projectId]
    );

    return result.rows.length > 0;
};

export const getDocumentById = async (documentId: number, projectId: number, scId: number) => {
    // First verify ownership
    const ownershipCheck = await checkProjectOwnership(projectId, scId);
    if (!ownershipCheck) {
        return null;
    }

    const result = await pool.query(
        `SELECT * FROM sc_documents WHERE id = $1 AND project_id = $2`,
        [documentId, projectId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
};

// ============================================
// SC PROJECT TEAM SERVICE
// ============================================

export interface AddTeamMemberData {
    projectId: number;
    memberName: string;
    role?: string;
    phone?: string;
    email?: string;
}

export const addTeamMember = async (data: AddTeamMemberData, scId: number) => {
    // First verify ownership
    const ownershipCheck = await checkProjectOwnership(data.projectId, scId);
    if (!ownershipCheck) {
        throw new Error('Project not found or access denied');
    }

    const result = await pool.query(
        `INSERT INTO sc_project_team (project_id, member_name, role, phone, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [data.projectId, data.memberName, data.role || null, data.phone || null, data.email || null]
    );

    // Update team_size in project
    await pool.query(
        `UPDATE sc_projects SET team_size = (
      SELECT COUNT(*) FROM sc_project_team WHERE project_id = $1 AND status = 'Active'
    ) WHERE id = $1`,
        [data.projectId]
    );

    return result.rows[0];
};

export const removeTeamMember = async (memberId: number, projectId: number, scId: number) => {
    // First verify ownership
    const ownershipCheck = await checkProjectOwnership(projectId, scId);
    if (!ownershipCheck) {
        throw new Error('Project not found or access denied');
    }

    const result = await pool.query(
        `UPDATE sc_project_team SET status = 'Inactive' WHERE id = $1 AND project_id = $2 RETURNING *`,
        [memberId, projectId]
    );

    // Update team_size in project
    await pool.query(
        `UPDATE sc_projects SET team_size = (
      SELECT COUNT(*) FROM sc_project_team WHERE project_id = $1 AND status = 'Active'
    ) WHERE id = $1`,
        [projectId]
    );

    return result.rows.length > 0;
};

export const getProjectTeam = async (projectId: number, scId: number) => {
    // First verify ownership
    const ownershipCheck = await checkProjectOwnership(projectId, scId);
    if (!ownershipCheck) {
        throw new Error('Project not found or access denied');
    }

    const result = await pool.query(
        `SELECT * FROM sc_project_team WHERE project_id = $1 AND status = 'Active' ORDER BY assigned_at DESC`,
        [projectId]
    );

    return result.rows;
};
