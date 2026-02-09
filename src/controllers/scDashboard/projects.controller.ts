import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as scProjectsService from '../../services/scDashboard/projects.service';
import { getFileType, deleteFile } from '../../services/gcDashboard/storage.service';
import path from 'path';
import fs from 'fs';

// ============================================
// SC PROJECTS CONTROLLER
// ============================================

// Create Project
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        const { name, client, project_type, trade, city, state, address, contract_value, status, progress, phase, start_date, expected_completion_date, team_size, gc_project_id, description, notes } = req.body;

        if (!name) {
            res.status(400).json({ success: false, error: { message: 'Project name is required' } });
            return;
        }

        const project = await scProjectsService.createProject({
            scId,
            name,
            client,
            project_type,
            trade,
            city,
            state,
            address,
            contract_value: contract_value ? parseFloat(contract_value) : undefined,
            status,
            progress: progress ? parseInt(progress) : undefined,
            phase,
            start_date,
            expected_completion_date,
            team_size: team_size ? parseInt(team_size) : undefined,
            gc_project_id: gc_project_id ? parseInt(gc_project_id) : undefined,
            description,
            notes,
        });

        res.status(201).json({
            success: true,
            data: { project },
            message: 'Project created successfully',
        });
    } catch (error: any) {
        console.error('Create SC project error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to create project' },
        });
    }
};

// Get All Projects
export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        const { status, trade, search, page, limit } = req.query;

        const result = await scProjectsService.getProjects({
            scId,
            status: status as string,
            trade: trade as string,
            search: search as string,
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 10,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error('Get SC projects error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to fetch projects' },
        });
    }
};

// Get Single Project
export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.id);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid project ID' } });
            return;
        }

        const project = await scProjectsService.getProjectById(projectId, scId);

        if (!project) {
            res.status(404).json({ success: false, error: { message: 'Project not found' } });
            return;
        }

        res.json({
            success: true,
            data: { project },
        });
    } catch (error: any) {
        console.error('Get SC project by ID error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to fetch project' },
        });
    }
};

// Update Project
export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.id);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid project ID' } });
            return;
        }

        const updateData: scProjectsService.UpdateSCProjectData = {};
        const allowedFields = ['name', 'client', 'project_type', 'trade', 'city', 'state', 'address', 'contract_value', 'status', 'progress', 'phase', 'start_date', 'expected_completion_date', 'actual_completion_date', 'team_size', 'description', 'notes'];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'contract_value') {
                    updateData[field] = parseFloat(req.body[field]);
                } else if (field === 'progress' || field === 'team_size') {
                    updateData[field as 'progress' | 'team_size'] = parseInt(req.body[field]);
                } else {
                    (updateData as any)[field] = req.body[field];
                }
            }
        });

        const project = await scProjectsService.updateProject(projectId, scId, updateData);

        if (!project) {
            res.status(404).json({ success: false, error: { message: 'Project not found or not authorized' } });
            return;
        }

        res.json({
            success: true,
            data: { project },
            message: 'Project updated successfully',
        });
    } catch (error: any) {
        console.error('Update SC project error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to update project' },
        });
    }
};

// Delete Project
export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.id);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid project ID' } });
            return;
        }

        const deleted = await scProjectsService.deleteProject(projectId, scId);

        if (!deleted) {
            res.status(404).json({ success: false, error: { message: 'Project not found or not authorized' } });
            return;
        }

        res.json({
            success: true,
            message: 'Project deleted successfully',
        });
    } catch (error: any) {
        console.error('Delete SC project error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to delete project' },
        });
    }
};

// Get Dashboard Overview
export const getOverview = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        const overview = await scProjectsService.getDashboardOverview(scId);

        res.json({
            success: true,
            data: overview,
        });
    } catch (error: any) {
        console.error('Get SC overview error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to fetch overview' },
        });
    }
};

// Get Recent Projects
export const getRecentProjects = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
        const projects = await scProjectsService.getRecentProjects(scId, limit);

        res.json({
            success: true,
            data: { projects },
        });
    } catch (error: any) {
        console.error('Get SC recent projects error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to fetch recent projects' },
        });
    }
};

// ============================================
// SC DOCUMENTS CONTROLLER
// ============================================

export const getProjectDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.projectId);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid project ID' } });
            return;
        }

        const documents = await scProjectsService.getProjectDocuments(projectId, scId);

        res.json({
            success: true,
            data: { documents },
        });
    } catch (error: any) {
        console.error('Get SC documents error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to fetch documents' },
        });
    }
};

export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.projectId);
        const documentId = parseInt(req.params.documentId);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId) || isNaN(documentId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid ID' } });
            return;
        }

        const deleted = await scProjectsService.deleteDocument(documentId, projectId, scId);

        if (!deleted) {
            res.status(404).json({ success: false, error: { message: 'Document not found' } });
            return;
        }

        res.json({
            success: true,
            message: 'Document deleted successfully',
        });
    } catch (error: any) {
        console.error('Delete SC document error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to delete document' },
        });
    }
};

// Upload Document
export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.projectId);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid project ID' } });
            return;
        }

        // Check project ownership
        const project = await scProjectsService.getProjectById(projectId, scId);
        if (!project) {
            res.status(403).json({ success: false, error: { message: 'Access denied' } });
            return;
        }

        // Check if file was uploaded
        if (!req.file) {
            res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
            return;
        }

        // Get category from body or default
        const category = req.body.category || 'Other';
        const allowedCategories = ['Plans', 'Drawings', 'Photos', 'Contracts', 'Invoices', 'Other'];
        if (!allowedCategories.includes(category)) {
            res.status(400).json({ success: false, error: { message: 'Invalid document category' } });
            return;
        }

        // Create document record
        const document = await scProjectsService.uploadDocument({
            projectId,
            name: req.file.originalname,
            filePath: req.file.path,
            fileType: getFileType(req.file.mimetype),
            fileSize: req.file.size,
            category,
            uploadedBy: scId,
        });

        res.status(201).json({
            success: true,
            data: { document },
            message: 'Document uploaded successfully',
        });
    } catch (error: any) {
        console.error('Upload SC document error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to upload document' },
        });
    }
};

// Download Document
export const downloadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.projectId);
        const documentId = parseInt(req.params.documentId);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId) || isNaN(documentId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid ID' } });
            return;
        }

        // Get document
        const document = await scProjectsService.getDocumentById(documentId, projectId, scId);
        if (!document) {
            res.status(404).json({ success: false, error: { message: 'Document not found' } });
            return;
        }

        // Check if file exists
        if (!fs.existsSync(document.file_path)) {
            res.status(404).json({ success: false, error: { message: 'File not found on server' } });
            return;
        }

        // Set headers and send file
        res.setHeader('Content-Type', getContentType(document.file_type));
        res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
        res.sendFile(path.resolve(document.file_path));
    } catch (error: any) {
        console.error('Download SC document error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to download document' },
        });
    }
};

// View Document (for preview)
export const viewDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.projectId);
        const documentId = parseInt(req.params.documentId);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId) || isNaN(documentId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid ID' } });
            return;
        }

        // Get document
        const document = await scProjectsService.getDocumentById(documentId, projectId, scId);
        if (!document) {
            res.status(404).json({ success: false, error: { message: 'Document not found' } });
            return;
        }

        // Check if file exists
        if (!fs.existsSync(document.file_path)) {
            res.status(404).json({ success: false, error: { message: 'File not found on server' } });
            return;
        }

        // Set headers and send file (inline for preview)
        res.setHeader('Content-Type', getContentType(document.file_type));
        res.setHeader('Content-Disposition', `inline; filename="${document.name}"`);
        res.sendFile(path.resolve(document.file_path));
    } catch (error: any) {
        console.error('View SC document error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to view document' },
        });
    }
};

// Helper function to get content type
const getContentType = (fileType: string): string => {
    const typeMap: { [key: string]: string } = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return typeMap[fileType?.toLowerCase()] || 'application/octet-stream';
};

// ============================================
// SC PROJECT TEAM CONTROLLER
// ============================================

export const getProjectTeam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.projectId);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid project ID' } });
            return;
        }

        const team = await scProjectsService.getProjectTeam(projectId, scId);

        res.json({
            success: true,
            data: { team },
        });
    } catch (error: any) {
        console.error('Get SC project team error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to fetch team' },
        });
    }
};

export const addTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.projectId);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid project ID' } });
            return;
        }

        const { member_name, role, phone, email } = req.body;

        if (!member_name) {
            res.status(400).json({ success: false, error: { message: 'Member name is required' } });
            return;
        }

        const member = await scProjectsService.addTeamMember({
            projectId,
            memberName: member_name,
            role,
            phone,
            email,
        }, scId);

        res.status(201).json({
            success: true,
            data: { member },
            message: 'Team member added successfully',
        });
    } catch (error: any) {
        console.error('Add SC team member error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to add team member' },
        });
    }
};

export const removeTeamMember = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const scId = req.user?.id;
        const projectId = parseInt(req.params.projectId);
        const memberId = parseInt(req.params.memberId);

        if (!scId) {
            res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
            return;
        }

        if (isNaN(projectId) || isNaN(memberId)) {
            res.status(400).json({ success: false, error: { message: 'Invalid ID' } });
            return;
        }

        const removed = await scProjectsService.removeTeamMember(memberId, projectId, scId);

        if (!removed) {
            res.status(404).json({ success: false, error: { message: 'Team member not found' } });
            return;
        }

        res.json({
            success: true,
            message: 'Team member removed successfully',
        });
    } catch (error: any) {
        console.error('Remove SC team member error:', error);
        res.status(500).json({
            success: false,
            error: { message: error.message || 'Failed to remove team member' },
        });
    }
};
