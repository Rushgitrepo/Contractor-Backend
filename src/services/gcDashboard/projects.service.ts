import { Pool } from 'pg';
import { config } from '../../config';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

export interface CreateProjectData {
  gcId: number;
  name: string;
  location?: string;
  client?: string;
  status?: string;
  budget?: number;
  duration?: number;
  description?: string;
  progress?: number;
}

export interface UpdateProjectData {
  name?: string;
  location?: string;
  client?: string;
  status?: string;
  budget?: number;
  duration?: number;
  description?: string;
  progress?: number;
}

export interface ProjectFilters {
  gcId: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Check if user exists
export const checkUserExists = async (userId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT id FROM users WHERE id = $1 AND role = 'general-contractor'`,
    [userId]
  );
  return result.rows.length > 0;
};

// Create Project
export const createProject = async (data: CreateProjectData) => {
  // First verify user exists
  const userExists = await checkUserExists(data.gcId);
  if (!userExists) {
    throw new Error(`User with ID ${data.gcId} does not exist or is not a general contractor`);
  }

  const result = await pool.query(
    `INSERT INTO gc_projects (gc_id, name, location, client, status, budget, duration, description, progress)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.gcId,
      data.name,
      data.location || null,
      data.client || null,
      data.status || 'Planning',
      data.budget || null,
      data.duration || null,
      data.description || null,
      data.progress || 0,
    ]
  );
  return result.rows[0];
};

// Get All Projects with counts
export const getProjects = async (filters: ProjectFilters) => {
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;

  let query = `
    SELECT 
      p.*,
      COUNT(DISTINCT d.id) as documents_count,
      COUNT(DISTINCT ta.id) as team_count
    FROM gc_projects p
    LEFT JOIN gc_documents d ON d.project_id = p.id
    LEFT JOIN gc_project_team_assignments ta ON ta.project_id = p.id
    WHERE p.gc_id = $1 AND p.deleted_at IS NULL
  `;

  const params: any[] = [filters.gcId];
  let paramCount = 2;

  if (filters.status) {
    query += ` AND p.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  if (filters.search) {
    query += ` AND (p.name ILIKE $${paramCount} OR p.client ILIKE $${paramCount} OR p.location ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  query += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);

  // Get total count
  let countQuery = `
    SELECT COUNT(DISTINCT p.id) as total
    FROM gc_projects p
    WHERE p.gc_id = $1 AND p.deleted_at IS NULL
  `;
  const countParams: any[] = [filters.gcId];
  let countParamCount = 2;

  if (filters.status) {
    countQuery += ` AND p.status = $${countParamCount}`;
    countParams.push(filters.status);
    countParamCount++;
  }

  if (filters.search) {
    countQuery += ` AND (p.name ILIKE $${countParamCount} OR p.client ILIKE $${countParamCount} OR p.location ILIKE $${countParamCount})`;
    countParams.push(`%${filters.search}%`);
  }

  const countResult = await pool.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].total);

  return {
    projects: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Single Project with details
export const getProjectById = async (projectId: number, gcId: number) => {
  const result = await pool.query(
    `SELECT * FROM gc_projects 
     WHERE id = $1 AND gc_id = $2 AND deleted_at IS NULL`,
    [projectId, gcId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const project = result.rows[0];

  // Get team members
  const teamResult = await pool.query(
    `SELECT 
      tm.*,
      ta.role as project_role,
      ta.assigned_at
     FROM gc_team_members tm
     JOIN gc_project_team_assignments ta ON ta.team_member_id = tm.id
     WHERE ta.project_id = $1 AND tm.gc_id = $2
     ORDER BY ta.assigned_at DESC`,
    [projectId, gcId]
  );

  // Get documents count
  const docCountResult = await pool.query(
    `SELECT COUNT(*) as count FROM gc_documents WHERE project_id = $1`,
    [projectId]
  );

  return {
    ...project,
    team_members: teamResult.rows,
    documents_count: parseInt(docCountResult.rows[0].count),
  };
};

// Update Project
export const updateProject = async (projectId: number, gcId: number, data: UpdateProjectData) => {
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
  values.push(projectId, gcId);

  const result = await pool.query(
    `UPDATE gc_projects 
     SET ${updateFields.join(', ')}
     WHERE id = $${paramCount} AND gc_id = $${paramCount + 1} AND deleted_at IS NULL
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// Delete Project (Soft Delete)
export const deleteProject = async (projectId: number, gcId: number) => {
  const result = await pool.query(
    `UPDATE gc_projects 
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND gc_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [projectId, gcId]
  );

  return result.rows.length > 0;
};

// Check Project Ownership
export const checkProjectOwnership = async (projectId: number, gcId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT id FROM gc_projects 
     WHERE id = $1 AND gc_id = $2 AND deleted_at IS NULL`,
    [projectId, gcId]
  );
  return result.rows.length > 0;
};


