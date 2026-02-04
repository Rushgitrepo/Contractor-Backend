import { Pool } from 'pg';
import { config } from '../../config';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

export interface CreateTeamMemberData {
  gcId: number;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  employeeId?: string;
  type: string;
  status?: string;
  progress?: number;
  avatarUrl?: string;
}

export interface UpdateTeamMemberData {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  employeeId?: string;
  type?: string;
  status?: string;
  progress?: number;
  avatarUrl?: string;
}

// Create Team Member
export const createTeamMember = async (data: CreateTeamMemberData) => {
  const result = await pool.query(
    `INSERT INTO gc_team_members (gc_id, name, email, phone, role, employee_id, type, status, progress, avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.gcId,
      data.name,
      data.email || null,
      data.phone || null,
      data.role || null,
      data.employeeId || null,
      data.type,
      data.status || 'Active',
      data.progress || 0,
      data.avatarUrl || null,
    ]
  );
  return result.rows[0];
};

// Get All Team Members
export const getTeamMembers = async (gcId: number, projectId?: number) => {
  if (projectId) {
    // Get team members assigned to specific project
    const result = await pool.query(
      `SELECT 
        tm.*,
        ta.role as project_role,
        ta.assigned_at
       FROM gc_team_members tm
       JOIN gc_project_team_assignments ta ON ta.team_member_id = tm.id
       WHERE ta.project_id = $1 AND tm.gc_id = $2
       ORDER BY tm.created_at DESC`,
      [projectId, gcId]
    );
    return result.rows;
  } else {
    // Get all team members for GC
    const result = await pool.query(
      `SELECT * FROM gc_team_members 
       WHERE gc_id = $1 
       ORDER BY created_at DESC`,
      [gcId]
    );
    return result.rows;
  }
};

// Get Single Team Member
export const getTeamMemberById = async (teamMemberId: number, gcId: number) => {
  const result = await pool.query(
    `SELECT * FROM gc_team_members 
     WHERE id = $1 AND gc_id = $2`,
    [teamMemberId, gcId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// Update Team Member
export const updateTeamMember = async (teamMemberId: number, gcId: number, data: UpdateTeamMemberData) => {
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      const dbKey = key === 'employeeId' ? 'employee_id' : key === 'avatarUrl' ? 'avatar_url' : key;
      updateFields.push(`${dbKey} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(teamMemberId, gcId);

  const result = await pool.query(
    `UPDATE gc_team_members 
     SET ${updateFields.join(', ')}
     WHERE id = $${paramCount} AND gc_id = $${paramCount + 1}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// Delete Team Member
export const deleteTeamMember = async (teamMemberId: number, gcId: number) => {
  const result = await pool.query(
    `DELETE FROM gc_team_members 
     WHERE id = $1 AND gc_id = $2
     RETURNING *`,
    [teamMemberId, gcId]
  );

  return result.rows.length > 0;
};

// Assign Team Member to Project
export const assignTeamMemberToProject = async (
  projectId: number,
  teamMemberId: number,
  role?: string
) => {
  // Check if already assigned
  const existing = await pool.query(
    `SELECT id FROM gc_project_team_assignments 
     WHERE project_id = $1 AND team_member_id = $2`,
    [projectId, teamMemberId]
  );

  if (existing.rows.length > 0) {
    throw new Error('Team member already assigned to this project');
  }

  const result = await pool.query(
    `INSERT INTO gc_project_team_assignments (project_id, team_member_id, role)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [projectId, teamMemberId, role || null]
  );

  return result.rows[0];
};

// Remove Team Member from Project
export const removeTeamMemberFromProject = async (projectId: number, teamMemberId: number) => {
  const result = await pool.query(
    `DELETE FROM gc_project_team_assignments 
     WHERE project_id = $1 AND team_member_id = $2
     RETURNING *`,
    [projectId, teamMemberId]
  );

  return result.rows.length > 0;
};

// Check Team Member Ownership
export const checkTeamMemberOwnership = async (teamMemberId: number, gcId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT id FROM gc_team_members 
     WHERE id = $1 AND gc_id = $2`,
    [teamMemberId, gcId]
  );
  return result.rows.length > 0;
};





