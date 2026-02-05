import pool from '../../config/database';
import { config } from '../../config';


export interface CreateProjectData {
  gcId: number;
  name: string;
  client?: string;
  project_type?: string;
  city?: string;
  state?: string;
  contract_value?: number;
  status?: string;
  start_date?: string;
  expected_completion_date?: string;
}

export interface UpdateProjectData {
  name?: string;
  client?: string;
  project_type?: string;
  city?: string;
  state?: string;
  contract_value?: number;
  status?: string;
  start_date?: string;
  expected_completion_date?: string;
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
    `INSERT INTO gc_projects (gc_id, name, client, project_type, city, state, contract_value, status, start_date, expected_completion_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.gcId,
      data.name,
      data.client || null,
      data.project_type || null,
      data.city || null,
      data.state || null,
      data.contract_value || null,
      data.status || 'Planning',
      data.start_date || null,
      data.expected_completion_date || null,
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
    WHERE p.gc_id = $1
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
    WHERE p.gc_id = $1
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

// Delete Project (Hard Delete - Permanent Removal)
export const deleteProject = async (projectId: number, gcId: number) => {
  console.log('[deleteProject] Starting HARD delete - projectId:', projectId, 'gcId:', gcId);

  try {
    // Hard delete - permanently removes the project from database
    // Note: CASCADE rules in schema will automatically delete related records:
    // - gc_documents (documents)
    // - gc_project_team_assignments (team assignments)
    // - gc_invitations (invitations)
    const result = await pool.query(
      `DELETE FROM gc_projects 
       WHERE id = $1 AND gc_id = $2
       RETURNING *`,
      [projectId, gcId]
    );

    console.log('[deleteProject] Query executed. Rows deleted:', result.rowCount);
    console.log('[deleteProject] Rows returned:', result.rows.length);

    if (result.rows.length > 0) {
      console.log('[deleteProject] Permanently deleted project:', result.rows[0]);
    } else {
      console.log('[deleteProject] No project found matching criteria');

      // Check if project exists at all
      const checkResult = await pool.query(
        'SELECT id, gc_id FROM gc_projects WHERE id = $1',
        [projectId]
      );

      if (checkResult.rows.length === 0) {
        console.log('[deleteProject] Project does not exist in database');
      } else {
        console.log('[deleteProject] Project exists but belongs to different user:', checkResult.rows[0]);
      }
    }

    return result.rows.length > 0;
  } catch (error) {
    console.error('[deleteProject] Database error:', error);
    throw error;
  }
};

// Check Project Ownership
export const checkProjectOwnership = async (projectId: number, gcId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT id FROM gc_projects 
     WHERE id = $1 AND gc_id = $2`,
    [projectId, gcId]
  );
  return result.rows.length > 0;
};



// Get Dashboard Overview Stats
export const getDashboardOverview = async (gcId: number) => {
  // Get active projects count
  const projectsResult = await pool.query(
    'SELECT COUNT(*) as count FROM gc_projects WHERE gc_id = $1 AND deleted_at IS NULL AND status IN (\'Active\', \'Bidding\')',
    [gcId]
  );

  // Get pending bids count from the new 'bids' table
  // We count bids submitted by this GC OR bids received for this GC's projects
  const bidsResult = await pool.query(
    `SELECT COUNT(*) as count FROM bids 
     WHERE (contractor_id = $1 AND status = 'submitted')
     OR (project_id IN (SELECT id FROM gc_projects WHERE gc_id = $1) AND status = 'submitted')`,
    [gcId]
  );

  // Get team members count
  const teamResult = await pool.query(
    'SELECT COUNT(*) as count FROM gc_team_members WHERE gc_id = $1 AND deleted_at IS NULL',
    [gcId]
  );

  // Get total budget sum
  const budgetResult = await pool.query(
    'SELECT SUM(budget) as total FROM gc_projects WHERE gc_id = $1 AND deleted_at IS NULL',
    [gcId]
  );

  return {
    activeProjectsCount: parseInt(projectsResult.rows[0].count),
    pendingBidsCount: parseInt(bidsResult.rows[0].count),
    teamMembersCount: parseInt(teamResult.rows[0].count),
    totalBudget: `$${(parseFloat(budgetResult.rows[0].total || 0) / 1000000).toFixed(1)}M`,
  };
};

// Get Recent Projects
export const getRecentProjects = async (gcId: number, limit: number = 3) => {
  const result = await pool.query(
    `SELECT 
      name, client, location, status, budget, duration as completion, progress
     FROM gc_projects 
     WHERE gc_id = $1 AND deleted_at IS NULL 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [gcId, limit]
  );

  return result.rows.map(row => ({
    name: row.name,
    client: row.client || 'N/A',
    location: row.location || 'N/A',
    status: row.status,
    budget: row.budget ? `$${(row.budget / 1000000).toFixed(1)}M` : 'N/A',
    completion: row.completion || 'N/A',
    progress: row.progress || 0
  }));
};

// Get Project Discovery (Marketplace Projects)
export const getProjectDiscovery = async (filters: { search?: string, location?: string, type?: string }) => {
  let query = `
    SELECT 
      id,
      title as name, 
      description, 
      location_city || ', ' || location_state as location, 
      budget_min, 
      budget_max, 
      project_type as category, 
      'Marketplace' as source, 
      created_at as posted, 
      bid_deadline as deadline, 
      status, 
      owner_id,
      sector
    FROM projects 
    WHERE status = 'open'
  `;

  const params: any[] = [];
  let paramCount = 1;

  if (filters.search) {
    query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
    paramCount++;
  }

  if (filters.location && filters.location !== 'AllRegions') {
    query += ` AND (location_city ILIKE $${paramCount} OR location_state ILIKE $${paramCount})`;
    params.push(`%${filters.location}%`);
    paramCount++;
  }

  // Not filtering by type for now to show all, or map type if needed.
  // if (filters.type) { }

  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, params);

  return result.rows.map(row => {
    // Format budget
    const min = row.budget_min ? `$${(row.budget_min / 1000).toFixed(0)}k` : '';
    const max = row.budget_max ? `$${(row.budget_max / 1000).toFixed(0)}k` : '';
    const budget = (min && max) ? `${min} - ${max}` : (min || max || 'Negotiable');

    // Normalize category/trades
    const categoryMap: any = {
      'kitchen_remodel': 'Residential',
      'bathroom_remodel': 'Residential',
      'commercial_renovation': 'Commercial',
      'roofing': 'Construction',
      'new_construction': 'Construction'
    };

    return {
      id: row.id,
      name: row.name,
      location: row.location || 'Unknown',
      distance: '5 mi', // Placeholders
      distanceValue: 5,
      budget,
      category: categoryMap[row.category] || 'General',
      projectType: row.category,
      source: row.source,
      posted: new Date(row.posted).toLocaleDateString(),
      deadline: new Date(row.deadline).toISOString().split('T')[0],
      nigpCode: '912-00',
      matchScore: Math.floor(Math.random() * 15) + 85,
      isProfileMatch: Math.random() > 0.7,
      trades: [row.category.replace('_', ' ').toUpperCase()],
      description: row.description,
      owner: 'Verified Client',
      sqft: '2,500',
      duration: '3-6 months',
      status: row.status.charAt(0).toUpperCase() + row.status.slice(1)
    };
  });
};

// Get All Bids (Invitations) - Renamed to getSentInvitations to avoid conflict
export const getSentInvitations = async (gcId: number) => {
  const result = await pool.query(
    `SELECT 
      i.id, 
      p.name as project,
      COALESCE(i.email, 'Contractor') as contractor,
      p.location,
      p.status as projectType,
      p.client as clientName,
      i.status,
      i.created_at as submittedDate,
      i.expires_at as deadline
     FROM gc_project_invitations i
     JOIN gc_projects p ON p.id = i.project_id
     WHERE i.gc_id = $1
     ORDER BY i.created_at DESC`,
    [gcId]
  );

  return result.rows.map(row => ({
    id: `BID-${row.id}`,
    project: row.project,
    contractor: row.contractor,
    contractorAvatar: row.contractor.substring(0, 2).toUpperCase(),
    amount: row.status === 'accepted' ? '$245,000' : 'Pending', // Simulated amount
    status: row.status === 'accepted' ? 'accepted' : row.status === 'declined' ? 'project_started' : 'submitted', // Map to UI status
    deadline: new Date(row.deadline).toISOString().split('T')[0],
    submittedDate: new Date(row.submittedDate).toISOString().split('T')[0],
    confidence: Math.floor(Math.random() * 20) + 80,
    items: Math.floor(Math.random() * 20) + 5,
    location: row.location || 'N/A',
    projectType: row.projectType,
    clientName: row.clientName || 'N/A'
  }));
};
