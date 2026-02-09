import pool from '../../config/database';
import { config } from '../../config';
import { sendEmail } from '../emailService';
import { sendSms } from '../smsService';
import { v4 as uuidv4 } from 'uuid';
import * as chatService from '../chat.service';


export interface InvitationData {
  projectId: number;
  gcId: number;
  email?: string;
  phone?: string;
  role?: string;
  message?: string;
}

// Create invitation token
export const createInvitation = async (data: InvitationData) => {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const result = await pool.query(
    `INSERT INTO gc_project_invitations (project_id, gc_id, email, phone, role, token, expires_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING *`,
    [data.projectId, data.gcId, data.email || null, data.phone || null, data.role || null, token, expiresAt]
  );

  return result.rows[0];
};

// Send email invitation
export const sendEmailInvitation = async (
  email: string,
  projectName: string,
  gcName: string,
  role: string,
  token: string,
  customMessage?: string
) => {
  const invitationLink = `${config.app.frontendUrl}/signup?token=${token}`;

  const subject = `You're invited to join the project "${projectName}" on ContractorList`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #f6d32d; margin: 0; font-size: 28px;">ContractorList</h1>
      </div>
      
      <div style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; margin-bottom: 25px;">
        <h2 style="color: #333; margin: 0; font-size: 20px; text-align: center;">Project Invitation</h2>
      </div>

      <p style="font-size: 16px; color: #444;">Hello,</p>
      
      <p style="font-size: 16px; color: #444; line-height: 1.6;">
        <strong>${gcName}</strong> has invited you to join the project <strong>${projectName}</strong> as a <strong>${role || 'Team Member'}</strong>.
      </p>

      ${customMessage ? `
      <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #f6d32d; margin: 25px 0; border-radius: 4px;">
        <p style="margin: 0; color: #555; font-style: italic; line-height: 1.5;">"${customMessage}"</p>
      </div>
      ` : ''}

      <div style="margin: 35px 0; text-align: center;">
        <a href="${invitationLink}" style="background-color: #f6d32d; color: #000; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; transition: background-color 0.2s;">Accept Invitation</a>
      </div>

      <div style="background-color: #fff8e1; padding: 15px; border-radius: 8px; margin-top: 30px;">
        <p style="color: #856404; font-size: 13px; margin: 0; text-align: center;">
          Or copy and paste this link in your browser:<br>
          <a href="${invitationLink}" style="color: #007bff; word-break: break-all; font-size: 12px;">${invitationLink}</a>
        </p>
      </div>

      <p style="color: #999; font-size: 12px; margin-top: 35px; text-align: center; line-height: 1.4;">
        This invitation will expire in 7 days.<br>
        &copy; ${new Date().getFullYear()} ContractorList. Empowering Construction Teams.
      </p>
    </div>
  `;

  return sendEmail(email, subject, html);
};

// Send SMS invitation
export const sendSmsInvitation = async (
  phone: string,
  projectName: string,
  gcName: string,
  token: string
) => {
  const invitationLink = `${config.app.frontendUrl}/signup?token=${token}`;
  const message = `${gcName} invited you to join project "${projectName}". Accept here: ${invitationLink}`;

  return sendSms(phone, message);
};

// Get invitation by token
export const getInvitationByToken = async (token: string) => {
  const result = await pool.query(
    `SELECT i.*, p.name as project_name, u.first_name || ' ' || u.last_name as gc_name
     FROM gc_project_invitations i
     JOIN gc_projects p ON p.id = i.project_id
     JOIN users u ON u.id = i.gc_id
     WHERE i.token = $1 AND i.status = 'pending' AND i.expires_at > NOW()`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// Accept invitation
export const acceptInvitation = async (token: string, userId: number) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get invitation details
    const inviteRes = await client.query(
      `SELECT * FROM gc_project_invitations WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
      [token]
    );

    if (inviteRes.rows.length === 0) {
      throw new Error('Invalid or expired invitation token');
    }

    const invitation = inviteRes.rows[0];

    // 2. Update invitation status
    await client.query(
      `UPDATE gc_project_invitations SET status = 'accepted', accepted_at = NOW() WHERE token = $1`,
      [token]
    );

    // 3. Find or create team member entry
    const teamMemberRes = await client.query(
      `SELECT id FROM gc_team_members WHERE gc_id = $1 AND (email = $2 OR user_id = $3)`,
      [invitation.gc_id, invitation.email, userId]
    );

    let teamMemberId: number;

    if (teamMemberRes.rows.length > 0) {
      teamMemberId = teamMemberRes.rows[0].id;
      // Update team member with user_id if not set
      await client.query(
        `UPDATE gc_team_members SET user_id = $1, status = 'Active' WHERE id = $2`,
        [userId, teamMemberId]
      );
    } else {
      // Create new team member
      // Fetch user name for the record
      const userResult = await client.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
      const fullName = userResult.rows.length > 0
        ? `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`
        : 'Team Member';

      const newMemberRes = await client.query(
        `INSERT INTO gc_team_members (gc_id, name, email, phone, role, type, user_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
         RETURNING id`,
        [
          invitation.gc_id,
          fullName,
          invitation.email,
          invitation.phone,
          invitation.role || 'Member',
          'Contractor', // Default to contractor if unknown
          userId
        ]
      );
      teamMemberId = newMemberRes.rows[0].id;
    }

    // 4. Assign to project if not already assigned
    const assignmentRes = await client.query(
      `SELECT id FROM gc_project_team_assignments WHERE project_id = $1 AND team_member_id = $2`,
      [invitation.project_id, teamMemberId]
    );

    if (assignmentRes.rows.length === 0) {
      await client.query(
        `INSERT INTO gc_project_team_assignments (project_id, team_member_id, role)
         VALUES ($1, $2, $3)`,
        [invitation.project_id, teamMemberId, invitation.role]
      );
    }

    // 5. Ensure project conversation exists and add user
    await chatService.getOrCreateProjectConversation(invitation.project_id, invitation.gc_id, userId);

    await client.query('COMMIT');

    return { ...invitation, status: 'accepted', accepted_at: new Date() };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Decline invitation
export const declineInvitation = async (token: string) => {
  const result = await pool.query(
    `UPDATE gc_project_invitations
     SET status = 'declined'
     WHERE token = $1 AND status = 'pending'
     RETURNING *`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// Get all invitations for a project
export const getProjectInvitations = async (projectId: number, gcId: number) => {
  const result = await pool.query(
    `SELECT * FROM gc_project_invitations
     WHERE project_id = $1 AND gc_id = $2
     ORDER BY created_at DESC`,
    [projectId, gcId]
  );

  return result.rows;
};
