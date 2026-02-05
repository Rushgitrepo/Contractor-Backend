
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as projectsController from '../controllers/gcDashboard/projects.controller';
import * as teamController from '../controllers/gcDashboard/team.controller';
import * as documentsController from '../controllers/gcDashboard/documents.controller';
import * as bulkUploadController from '../controllers/gcDashboard/bulkUpload.controller';
import * as invitationController from '../controllers/gcDashboard/invitation.controller';
import * as bidsController from '../controllers/gcDashboard/bids.controller';
import { upload } from '../services/gcDashboard/storage.service';

const router = Router();

// ============================================
// BIDS MANAGEMENT ROUTES
// ============================================
// These routes handle bid creation, submission, and management
// Note: These routes are placed BEFORE the global GC restriction because
// they may need to be accessed by Subcontractors as well (e.g. creating/submitting bids)
// Each route handles its own authorization.

/**
 * @swagger
 * /api/gc-dashboard/bids:
 *   get:
 *     summary: Get all bids by current user (contractor)
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.get(
    '/bids',
    authenticate,
    authorize('general-contractor', 'subcontractor'),
    bidsController.getMyBids
);

/**
 * @swagger
 * /api/gc-dashboard/bids:
 *   post:
 *     summary: Create a new bid (draft)
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.post(
    '/bids',
    authenticate,
    authorize('general-contractor', 'subcontractor'),
    bidsController.createBid
);

/**
 * @swagger
 * /api/gc-dashboard/bids/{id}:
 *   get:
 *     summary: Get bid details
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.get(
    '/bids/:id',
    authenticate,
    bidsController.getBidDetail
);

/**
 * @swagger
 * /api/gc-dashboard/bids/{id}/items:
 *   put:
 *     summary: Update bid items (draft only)
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.put(
    '/bids/:id/items',
    authenticate,
    authorize('general-contractor', 'subcontractor'),
    bidsController.updateBidItems
);

/**
 * @swagger
 * /api/gc-dashboard/bids/{id}/submit:
 *   post:
 *     summary: Submit a bid
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.post(
    '/bids/:id/submit',
    authenticate,
    authorize('general-contractor', 'subcontractor'),
    bidsController.submitBid
);

/**
 * @swagger
 * /api/gc-dashboard/bids/{id}/withdraw:
 *   post:
 *     summary: Withdraw a bid
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.post(
    '/bids/:id/withdraw',
    authenticate,
    authorize('general-contractor', 'subcontractor'),
    bidsController.withdrawBid
);

// Owner/GC Actions on Bids (Accept/Reject)
/**
 * @swagger
 * /api/gc-dashboard/bids/{id}/accept:
 *   post:
 *     summary: Accept a bid (Project Owner only)
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.post(
    '/bids/:id/accept',
    authenticate,
    authorize('client', 'general-contractor'), // Assuming GC can accept bids from SCs
    bidsController.acceptBid
);

/**
 * @swagger
 * /api/gc-dashboard/bids/{id}/reject:
 *   post:
 *     summary: Reject a bid (Project Owner only)
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.post(
    '/bids/:id/reject',
    authenticate,
    authorize('client', 'general-contractor'),
    bidsController.rejectBid
);

router.post(
    '/bids/:id/start',
    authenticate,
    authorize('client', 'general-contractor'),
    bidsController.startProjectFromBid
);

router.delete(
    '/bids/:id',
    authenticate,
    bidsController.deleteBid
);

/**
 * @swagger
 * /api/gc-dashboard/projects/{projectId}/bids:
 *   get:
 *     summary: Get all bids for a project (Owner only)
 *     tags: [Bids Management]
 *     security:
 *       - bearerAuth: []
 */
router.get(
    '/projects/:projectId/bids',
    authenticate,
    authorize('client', 'general-contractor'),
    bidsController.getProjectBids
);


// ============================================
// MARKETPLACE / PUBLIC ROUTES
// ============================================

/**
 * @swagger
 * /api/gc-dashboard/project-discovery:
 *   get:
 *     summary: Discover subcontractors and suppliers (or Marketplace Projects)
 *     tags: [Marketplace]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 */
router.get('/project-discovery', projectsController.getProjectDiscovery);

// ============================================
// GENERAL DASHBOARD ROUTES (GC Restricted)
// ============================================

// Apply Global Authentication and GC Authorization for subsequent routes
router.use(authenticate);
router.use(authorize('general-contractor'));

// ============================================
// DASHBOARD OVERVIEW ROUTES
// ============================================

/**
 * @swagger
 * /api/gc-dashboard/overview:
 *   get:
 *     summary: Get dashboard overview stats
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/overview', projectsController.getOverview);

/**
 * @swagger
 * /api/gc-dashboard/recent-projects:
 *   get:
 *     summary: Get recent projects for overview
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 3
 */
router.get('/recent-projects', projectsController.getRecentProjects);

/**
 * @swagger
 * /api/gc-dashboard/sent-invitations:
 *   get:
 *     summary: Get all project invitations sent by GC
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/sent-invitations', projectsController.getSentInvitations);



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
 * /api/gc-dashboard/projects/bulk-upload:
 *   post:
 *     summary: Bulk upload projects from Excel/CSV file
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
 *         description: Excel (.xlsx, .xls) or CSV file with project data
 */
router.post('/projects/bulk-upload', upload.single('file'), bulkUploadController.bulkUploadProjects);

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
 *     summary: Delete project (permanent removal)
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

/**
 * @swagger
 * /api/gc-dashboard/team-members/{id}/send-reminder:
 *   post:
 *     summary: Send reminder email to team member
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.post('/team-members/:id/send-reminder', teamController.sendTeamMemberReminder);

// ============================================
// PROJECT TEAM ASSIGNMENTS ROUTES
// ============================================

/**
 * @swagger
 * /api/gc-dashboard/projects/{projectId}/team:
 *   get:
 *     summary: Get team members assigned to project
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/projects/:projectId/team', teamController.getProjectTeamMembers);

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
// TEAM INVITATION ROUTES
// ============================================

/**
 * @swagger
 * /api/gc-dashboard/projects/{projectId}/invite-team:
 *   post:
 *     summary: Invite team member via email/SMS
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.post('/projects/:projectId/invite-team', invitationController.inviteTeamMember);

/**
 * @swagger
 * /api/gc-dashboard/projects/{projectId}/invitations:
 *   get:
 *     summary: Get all invitations for project
 *     tags: [GC Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/projects/:projectId/invitations', invitationController.getProjectInvitations);

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
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
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
