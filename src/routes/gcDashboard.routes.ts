import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as projectsController from '../controllers/gcDashboard/projects.controller';
import * as teamController from '../controllers/gcDashboard/team.controller';
import * as documentsController from '../controllers/gcDashboard/documents.controller';
import { upload } from '../services/gcDashboard/storage.service';

const router = Router();

// All routes require authentication and GC role
router.use(authenticate);
router.use(authorize('general-contractor'));

// ============================================
// PROJECTS ROUTES
// ============================================

/**
 * @swagger
 * /api/gc-dashboard/projects:
 *   get:
 *     summary: Get all projects
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Planning, In Progress, Bidding, On Hold, Completed, Cancelled]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 */
router.get('/projects', projectsController.getProjects);

/**
 * @swagger
 * /api/gc-dashboard/projects/{id}:
 *   get:
 *     summary: Get single project
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/projects/:id', projectsController.getProjectById);

/**
 * @swagger
 * /api/gc-dashboard/projects:
 *   post:
 *     summary: Create new project
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.post('/projects', projectsController.createProject);

/**
 * @swagger
 * /api/gc-dashboard/projects/{id}:
 *   put:
 *     summary: Update project
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.put('/projects/:id', projectsController.updateProject);

/**
 * @swagger
 * /api/gc-dashboard/projects/{id}:
 *   delete:
 *     summary: Delete project (soft delete)
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/projects/:id', projectsController.deleteProject);

// ============================================
// TEAM MEMBERS ROUTES
// ============================================

/**
 * @swagger
 * /api/gc-dashboard/team-members:
 *   get:
 *     summary: Get all team members
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 */
router.get('/team-members', teamController.getTeamMembers);

/**
 * @swagger
 * /api/gc-dashboard/team-members/{id}:
 *   get:
 *     summary: Get single team member
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/team-members/:id', teamController.getTeamMemberById);

/**
 * @swagger
 * /api/gc-dashboard/team-members:
 *   post:
 *     summary: Create new team member
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.post('/team-members', teamController.createTeamMember);

/**
 * @swagger
 * /api/gc-dashboard/team-members/{id}:
 *   put:
 *     summary: Update team member
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.put('/team-members/:id', teamController.updateTeamMember);

/**
 * @swagger
 * /api/gc-dashboard/team-members/{id}:
 *   delete:
 *     summary: Delete team member
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/team-members/:id', teamController.deleteTeamMember);

// ============================================
// PROJECT TEAM ASSIGNMENTS ROUTES
// ============================================

/**
 * @swagger
 * /api/gc-dashboard/projects/{projectId}/team:
 *   post:
 *     summary: Assign team member to project
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.post('/projects/:projectId/team', teamController.assignTeamMemberToProject);

/**
 * @swagger
 * /api/gc-dashboard/projects/{projectId}/team/{teamMemberId}:
 *   delete:
 *     summary: Remove team member from project
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/projects/:projectId/team/:teamMemberId', teamController.removeTeamMemberFromProject);

// ============================================
// DOCUMENTS ROUTES
// ============================================

/**
 * @swagger
 * /api/gc-dashboard/projects/{projectId}/documents:
 *   get:
 *     summary: Get all documents for project
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Plans, Drawings, Photos, Contracts, Invoices, Other]
 */
router.get('/projects/:projectId/documents', documentsController.getDocuments);

/**
 * @swagger
 * /api/gc-dashboard/projects/{projectId}/documents:
 *   post:
 *     summary: Upload document
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *       - in: formData
 *         name: category
 *         type: string
 *         enum: [Plans, Drawings, Photos, Contracts, Invoices, Other]
 */
router.post('/projects/:projectId/documents', upload.single('file'), documentsController.uploadDocument);

/**
 * @swagger
 * /api/gc-dashboard/documents/{id}/download:
 *   get:
 *     summary: Download document
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/documents/:id/download', documentsController.downloadDocument);

/**
 * @swagger
 * /api/gc-dashboard/documents/{id}/view:
 *   get:
 *     summary: View document (preview)
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/documents/:id/view', documentsController.viewDocument);

/**
 * @swagger
 * /api/gc-dashboard/documents/{id}:
 *   put:
 *     summary: Update document (star, share, category)
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.put('/documents/:id', documentsController.updateDocument);

/**
 * @swagger
 * /api/gc-dashboard/documents/{id}:
 *   delete:
 *     summary: Delete document
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/documents/:id', documentsController.deleteDocument);

export default router;


