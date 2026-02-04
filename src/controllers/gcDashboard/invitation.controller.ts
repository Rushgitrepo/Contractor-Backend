import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as invitationService from '../../services/gcDashboard/invitation.service';
import * as projectsService from '../../services/gcDashboard/projects.service';
import pool from '../../config/database';

// Send Team Invitation
export const inviteTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid project ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check project ownership
    const isOwner = await projectsService.checkProjectOwnership(projectId, gcId);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to invite team members to this project',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const { email, phone, role, message } = req.body;

    // Validate: at least email or phone must be provided
    if (!email && !phone) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONTACT',
          message: 'Either email or phone number must be provided',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get project details
    const project = await projectsService.getProjectById(projectId, gcId);
    if (!project) {
      res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Create invitation
    const invitation = await invitationService.createInvitation({
      projectId,
      gcId,
      email,
      phone,
      role,
      message,
    });

    // Send invitations
    const results = {
      email: false,
      sms: false,
    };

    if (email) {
      // Fetch GC info for the email
      const gcResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [gcId]);
      const gcName = gcResult.rows.length > 0
        ? `${gcResult.rows[0].first_name} ${gcResult.rows[0].last_name}`
        : req.user!.email || 'General Contractor';

      results.email = await invitationService.sendEmailInvitation(
        email,
        project.name,
        gcName,
        role || 'Team Member',
        invitation.token,
        message
      );
    }

    if (phone) {
      results.sms = await invitationService.sendSmsInvitation(
        phone,
        project.name,
        req.user!.email || 'General Contractor',
        invitation.token
      );
    }

    res.status(201).json({
      success: true,
      data: {
        invitation,
        sent: results,
      },
      message: 'Invitation sent successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Invite team member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to send invitation',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get Project Invitations
export const getProjectInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid project ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check project ownership
    const isOwner = await projectsService.checkProjectOwnership(projectId, gcId);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to view invitations for this project',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const invitations = await invitationService.getProjectInvitations(projectId, gcId);

    res.status(200).json({
      success: true,
      data: invitations,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Get invitations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch invitations',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Accept Invitation (Public endpoint - no auth required)
export const acceptInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Invitation token is required',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get invitation details
    const invitation = await invitationService.getInvitationByToken(token);
    if (!invitation) {
      res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired invitation token',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Accept invitation
    const accepted = await invitationService.acceptInvitation(token);

    res.status(200).json({
      success: true,
      data: {
        invitation: accepted,
        project: {
          id: invitation.project_id,
          name: invitation.project_name,
        },
      },
      message: 'Invitation accepted successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to accept invitation',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};
