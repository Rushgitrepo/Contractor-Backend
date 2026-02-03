import pool from '../../config/database';
import { config } from '../../config';
import { sendEmail } from '../emailService';
import { sendSms } from '../smsService';
import { v4 as uuidv4 } from 'uuid';


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
