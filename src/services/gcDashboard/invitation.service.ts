import { Pool } from 'pg';
import { config } from '../../config';
import { sendEmail } from '../emailService';
import { sendSms } from '../smsService';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

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
  const invitationLink = `${config.app.frontendUrl}/accept-invitation?token=${token}`;
  
  const subject = `You're invited to join ${projectName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Project Invitation</h2>
      <p>Hello,</p>
      <p><strong>${gcName}</strong> has invited you to join the project <strong>${projectName}</strong> as a <strong>${role || 'team member'}</strong>.</p>
      ${customMessage ? `<p style="background-color: #f4f4f4; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;"><em>"${customMessage}"</em></p>` : ''}
      <div style="margin: 30px 0;">
        <a href="${invitationLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
      </div>
      <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:</p>
      <p style="color: #007bff; word-break: break-all; font-size: 12px;">${invitationLink}</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">This invitation will expire in 7 days.</p>
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
  const invitationLink = `${config.app.frontendUrl}/accept-invitation?token=${token}`;
  const message = `${gcName} invited you to join project "${projectName}". Accept here: ${invitationLink}`;

  return sendSms(phone, message);
};

// Get invitation by token
export const getInvitationByToken = async (token: string) => {
  const result = await pool.query(
    `SELECT i.*, p.name as project_name, u.name as gc_name
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
export const acceptInvitation = async (token: string) => {
  const result = await pool.query(
    `UPDATE gc_project_invitations
     SET status = 'accepted', accepted_at = NOW()
     WHERE token = $1 AND status = 'pending' AND expires_at > NOW()
     RETURNING *`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
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
