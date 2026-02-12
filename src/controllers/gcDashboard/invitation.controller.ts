import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as invitationService from '../../services/gcDashboard/invitation.service';
import * as projectsService from '../../services/gcDashboard/projects.service';
import * as chatService from '../../services/chat.service';
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

    // Send invitations in background
    const sendInvitationsBackground = async () => {
      try {
        if (email) {
          // Fetch GC info for the email
          const gcResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [gcId]);
          const gcName = gcResult.rows.length > 0
            ? `${gcResult.rows[0].first_name} ${gcResult.rows[0].last_name}`
            : req.user!.email || 'General Contractor';

          await invitationService.sendEmailInvitation(
            email,
            project.name,
            gcName,
            role || 'Team Member',
            invitation.token,
            message
          );
        }

        if (phone) {
          await invitationService.sendSmsInvitation(
            phone,
            project.name,
            req.user!.email || 'General Contractor',
            invitation.token
          );
        }
      } catch (backgroundError) {
        console.error('Background invitation sending failed:', backgroundError);
      }
    };

    // Trigger background sending without awaiting
    sendInvitationsBackground();

    res.status(201).json({
      success: true,
      data: {
        invitation,
        status: 'queued',
      },
      message: 'Invitation queuing for delivery',
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

// Verify Invitation Token (Public)
export const verifyInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Token is required'
      });
      return;
    }

    const invitation = await invitationService.getInvitationByToken(token);

    if (!invitation) {
      res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation token'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        project_name: invitation.project_name,
        gc_name: invitation.gc_name,
        role: invitation.role,
        email: invitation.email
      }
    });
  } catch (error: any) {
    console.error('Verify invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify invitation'
    });
  }
};

// Accept Invitation (Requires Auth)
export const acceptInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

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
    const accepted = await invitationService.acceptInvitation(token, userId);

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

    // Notify user via socket to join new conversation
    try {
      const io = req.app.get('io');
      if (io) {
        // Find existing conversation or create if somehow missed by service
        const convId = await chatService.getOrCreateProjectConversation(invitation.project_id, invitation.gc_id, userId);

        io.to(`user:${userId}`).emit('conversation:new', {
          conversation_id: convId,
          project_name: invitation.project_name
        });

        // Force user's sockets to join the room
        const userSockets = io.sockets.adapter.rooms.get(`user:${userId}`);
        if (userSockets) {
          userSockets.forEach((sId: string) => {
            const s = io.sockets.sockets.get(sId);
            if (s) {
              s.join(convId);
            }
          });
        }
      }
    } catch (socketError) {
      console.error('Failed to emit socket notification for new conversation:', socketError);
    }
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

// Get My Pending Invitations
export const getMyPendingInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;
    if (!userEmail) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const result = await pool.query(
      `SELECT i.*, p.name as project_name, u.first_name || ' ' || u.last_name as gc_name
       FROM gc_project_invitations i
       JOIN gc_projects p ON p.id = i.project_id
       JOIN users u ON u.id = i.gc_id
       WHERE (i.email = $1 OR i.phone = $2) AND i.status = 'pending' AND i.expires_at > NOW()`,
      [userEmail, req.user?.phone || '']
    );

    res.status(200).json({
      success: true,
      data: result.rows,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Get my pending invitations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch pending invitations',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Decline Invitation
export const declineInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, message: 'Token is required' });
      return;
    }

    const declined = await invitationService.declineInvitation(token);

    res.status(200).json({
      success: true,
      data: declined,
      message: 'Invitation declined successfully'
    });
  } catch (error: any) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ success: false, message: 'Failed to decline invitation' });
  }
};
