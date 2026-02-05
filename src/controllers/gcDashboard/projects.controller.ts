import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as projectsService from '../../services/gcDashboard/projects.service';
import { createProjectSchema, updateProjectSchema, projectQuerySchema } from '../../validators/gcDashboard.validator';

// Create Project
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const gcId = req.user!.id;

        console.log('Create project request body:', JSON.stringify(req.body, null, 2));

        // Validate request body
        const validatedData = createProjectSchema.parse(req.body);

        // Create project
        const project = await projectsService.createProject({
            gcId,
            ...validatedData,
        });

        res.status(201).json({
            success: true,
            data: project,
            message: 'Project created successfully',
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Create project error - Full error:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);

        if (error.name === 'ZodError') {
            console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
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

        console.error('Create project error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to create project',
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
};

// Get All Projects
export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const gcId = req.user!.id;

        // Validate query params
        const validatedQuery = projectQuerySchema.parse(req.query);

        // Get projects
        const result = await projectsService.getProjects({
            gcId,
            status: validatedQuery.status,
            search: validatedQuery.search,
            page: validatedQuery.page,
            limit: validatedQuery.limit,
        });

        res.status(200).json({
            success: true,
            data: result.projects,
            pagination: result.pagination,
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
                    message: 'Invalid query parameters',
                    details: error.errors,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }

        console.error('Get projects error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to fetch projects',
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
};

// Get Single Project
export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const gcId = req.user!.id;
        const projectId = parseInt(req.params.id);

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

        const project = await projectsService.getProjectById(projectId, gcId);

        if (!project) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'PROJECT_NOT_FOUND',
                    message: `Project with ID ${projectId} not found`,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: project,
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Get project error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to fetch project',
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
};

// Update Project
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const gcId = req.user!.id;
        const projectId = parseInt(req.params.id);

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
        const validatedData = updateProjectSchema.parse(req.body);

        // Check ownership
        const isOwner = await projectsService.checkProjectOwnership(projectId, gcId);
        if (!isOwner) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'ACCESS_DENIED',
                    message: 'You do not have permission to update this project',
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }

        // Update project
        const project = await projectsService.updateProject(projectId, gcId, validatedData);

        if (!project) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'PROJECT_NOT_FOUND',
                    message: `Project with ID ${projectId} not found`,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: project,
            message: 'Project updated successfully',
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

        console.error('Update project error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to update project',
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
};


// Delete Project (Hard Delete - Permanent Removal)
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const gcId = req.user!.id;
        const projectIdString = req.params.id;
        const projectId = parseInt(projectIdString);

        console.log(`[DELETE] Request to delete project ${projectIdString} (parsed: ${projectId}) by GC ${gcId}`);

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

        // Check ownership
        const isOwner = await projectsService.checkProjectOwnership(projectId, gcId);
        if (!isOwner) {
            res.status(403).json({
                success: false,
                error: {
                    code: 'ACCESS_DENIED',
                    message: 'You do not have permission to delete this project',
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }

        // Delete project
        const deleted = await projectsService.deleteProject(projectId, gcId);
        console.log(`[DELETE] Service result for project ${projectId}: ${deleted}`);

        if (!deleted) {
            res.status(404).json({
                success: false,
                error: {
                    code: 'PROJECT_NOT_FOUND',
                    message: `Project with ID ${projectId} not found`,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Project deleted successfully',
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Delete project error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to delete project',
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    }
};

// Get Dashboard Overview
export const getOverview = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const gcId = req.user!.id;
        const overview = await projectsService.getDashboardOverview(gcId);

        res.status(200).json({
            success: true,
            data: overview,
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Get overview error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to fetch overview',
            },
        });
    }
};

// Get Recent Projects
export const getRecentProjects = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const gcId = req.user!.id;
        const limit = parseInt(req.query.limit as string) || 3;

        const projects = await projectsService.getRecentProjects(gcId, limit);

        res.status(200).json({
            success: true,
            data: projects,
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Get recent projects error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to fetch recent projects',
            },
        });
    }
};

// Get Project Discovery
export const getProjectDiscovery = async (req: any, res: Response): Promise<void> => {
    try {
        const filters = {
            search: req.query.search as string,
            location: req.query.location as string,
            type: req.query.type as string,
        };

        const discovery = await projectsService.getProjectDiscovery(filters);

        res.status(200).json({
            success: true,
            data: discovery,
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Get discovery error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to fetch discovery results',
            },
        });
    }
};

// Get Sent Invitations (previously misnamed "getBids") - This returns invitations sent to SCs/Contractors.
export const getSentInvitations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const gcId = req.user!.id;
        const bids = await projectsService.getSentInvitations(gcId);

        res.status(200).json({
            success: true,
            data: bids,
            meta: {
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Get bids error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: error.message || 'Failed to fetch bids',
            },
        });
    }
};

