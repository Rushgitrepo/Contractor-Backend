import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as teamService from '../../services/gcDashboard/team.service';
import * as projectsService from '../../services/gcDashboard/projects.service';
import { createTeamMemberSchema, updateTeamMemberSchema, assignTeamMemberSchema } from '../../validators/gcDashboard.validator';
import pool from '../../config/database';
import { sendTeamMemberInvitation } from '../../services/emailService';

// Create Team Member
export const createTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;

    // Validate request body
    const validatedData = createTeamMemberSchema.parse(req.body);

    // Create team member
    const teamMember = await teamService.createTeamMember({
      gcId,
      ...validatedData,
      employeeId: validatedData.employee_id,
      avatarUrl: validatedData.avatar_url,
    });

    // Send email invitation if email provided
    if (validatedData.email) {
      try {
        // Fetch GC info for the email
        const gcResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [gcId]);
        const gcName = gcResult.rows.length > 0
          ? `${gcResult.rows[0].first_name} ${gcResult.rows[0].last_name}`
          : 'General Contractor';

        await sendTeamMemberInvitation(
          validatedData.email,
          validatedData.name,
          gcName,
          validatedData.role || 'Team Member'
        );
        console.log(`[Invitation] Email sent to ${validatedData.email}`);
      } catch (emailError) {
        console.error('[Invitation] Failed to send email:', emailError);
        // We don't fail the request if email fails, but we log it
      }
    }

    res.status(201).json({
      success: true,
      data: teamMember,
      message: 'Team member created successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    console.error('Create team member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to create team member',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get All Team Members
export const getTeamMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

    if (projectId && isNaN(projectId)) {
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

    // If projectId provided, check ownership
    if (projectId) {
      const isOwner = await projectsService.checkProjectOwnership(projectId, gcId);
      if (!isOwner) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You do not have permission to access this project',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }
    }

    const teamMembers = await teamService.getTeamMembers(gcId, projectId);

    res.status(200).json({
      success: true,
      data: teamMembers,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Get team members error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch team members',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get Single Team Member
export const getTeamMemberById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const teamMemberId = parseInt(req.params.id);

    if (isNaN(teamMemberId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid team member ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const teamMember = await teamService.getTeamMemberById(teamMemberId, gcId);

    if (!teamMember) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_MEMBER_NOT_FOUND',
          message: `Team member with ID ${teamMemberId} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: teamMember,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Get team member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch team member',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Update Team Member
export const updateTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const teamMemberId = parseInt(req.params.id);

    if (isNaN(teamMemberId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid team member ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Validate request body
    const validatedData = updateTeamMemberSchema.parse(req.body);

    // Check ownership
    const isOwner = await teamService.checkTeamMemberOwnership(teamMemberId, gcId);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to update this team member',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Update team member - transform snake_case to camelCase
    const updateData: any = {};

    // Copy all fields from validatedData, transforming snake_case to camelCase
    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'employee_id') {
          updateData.employeeId = value;
        } else if (key === 'avatar_url') {
          updateData.avatarUrl = value;
        } else {
          updateData[key] = value;
        }
      }
    });

    const teamMember = await teamService.updateTeamMember(teamMemberId, gcId, updateData);

    if (!teamMember) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_MEMBER_NOT_FOUND',
          message: `Team member with ID ${teamMemberId} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: teamMember,
      message: 'Team member updated successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    console.error('Update team member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to update team member',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Delete Team Member
export const deleteTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const teamMemberId = parseInt(req.params.id);

    if (isNaN(teamMemberId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid team member ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check ownership
    const isOwner = await teamService.checkTeamMemberOwnership(teamMemberId, gcId);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to delete this team member',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Delete team member
    const deleted = await teamService.deleteTeamMember(teamMemberId, gcId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_MEMBER_NOT_FOUND',
          message: `Team member with ID ${teamMemberId} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Team member deleted successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Delete team member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to delete team member',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get Team Members Assigned to Project
export const getProjectTeamMembers = async (req: AuthRequest, res: Response): Promise<void> => {
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
          message: 'You do not have permission to access this project',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get team members assigned to this project
    const teamMembers = await pool.query(
      `SELECT 
        tm.id,
        tm.name,
        tm.email,
        tm.phone,
        tm.role,
        tm.employee_id,
        tm.type,
        tm.status,
        tm.avatar_url,
        pta.role as project_role,
        pta.assigned_at
      FROM gc_team_members tm
      INNER JOIN gc_project_team_assignments pta ON tm.id = pta.team_member_id
      WHERE pta.project_id = $1 AND tm.gc_id = $2
      ORDER BY pta.assigned_at DESC`,
      [projectId, gcId]
    );

    res.status(200).json({
      success: true,
      data: teamMembers.rows,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Get project team members error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to get project team members',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Assign Team Member to Project
export const assignTeamMemberToProject = async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Validate request body
    const validatedData = assignTeamMemberSchema.parse(req.body);

    // Check project ownership
    const isOwner = await projectsService.checkProjectOwnership(projectId, gcId);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to access this project',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check team member ownership
    const isTeamMemberOwner = await teamService.checkTeamMemberOwnership(validatedData.teamMemberId, gcId);
    if (!isTeamMemberOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to assign this team member',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Assign team member
    const assignment = await teamService.assignTeamMemberToProject(
      projectId,
      validatedData.teamMemberId,
      validatedData.role
    );

    res.status(201).json({
      success: true,
      data: assignment,
      message: 'Team member assigned to project successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: error.errors,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (error.message && error.message.includes('already assigned')) {
      res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_ASSIGNED',
          message: error.message,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    console.error('Assign team member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to assign team member',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Remove Team Member from Project
export const removeTeamMemberFromProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const projectId = parseInt(req.params.projectId);
    const teamMemberId = parseInt(req.params.teamMemberId);

    if (isNaN(projectId) || isNaN(teamMemberId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid project ID or team member ID',
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
          message: 'You do not have permission to access this project',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Remove team member
    const removed = await teamService.removeTeamMemberFromProject(projectId, teamMemberId);

    if (!removed) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ASSIGNMENT_NOT_FOUND',
          message: 'Team member is not assigned to this project',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Team member removed from project successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Remove team member error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to remove team member',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};


// Send Reminder Email to Team Member
export const sendTeamMemberReminder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const teamMemberId = parseInt(req.params.id);

    if (isNaN(teamMemberId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid team member ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get team member details
    const teamMember = await teamService.getTeamMemberById(teamMemberId, gcId);

    if (!teamMember) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_MEMBER_NOT_FOUND',
          message: `Team member with ID ${teamMemberId} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if team member has an email
    if (!teamMember.email) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_EMAIL',
          message: 'Team member does not have an email address',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get GC name for email
    const gcResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [gcId]);
    const gcName = gcResult.rows[0]
      ? `${gcResult.rows[0].first_name} ${gcResult.rows[0].last_name}`
      : 'Your Team Lead';

    // Send reminder email
    await sendTeamMemberInvitation(
      teamMember.email,
      teamMember.name,
      gcName,
      teamMember.role || 'Team Member'
    );

    res.status(200).json({
      success: true,
      message: 'Reminder email sent successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Send reminder error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to send reminder',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};



