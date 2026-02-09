import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as scProjectsController from '../controllers/scDashboard/projects.controller';
import { upload } from '../services/gcDashboard/storage.service';

const router = Router();

// ============================================
// SC DASHBOARD ROUTES
// ============================================

// All routes require authentication
router.use(authenticate);

// ============================================
// SC PROJECTS ROUTES
// ============================================

// Dashboard Overview
router.get('/overview', scProjectsController.getOverview);

// Projects CRUD
router.get('/projects', scProjectsController.getProjects);
router.get('/projects/recent', scProjectsController.getRecentProjects);
router.post('/projects', scProjectsController.createProject);
router.get('/projects/:id', scProjectsController.getProjectById);
router.put('/projects/:id', scProjectsController.updateProject);
router.delete('/projects/:id', scProjectsController.deleteProject);

// Project Documents
router.get('/projects/:projectId/documents', scProjectsController.getProjectDocuments);
router.post('/projects/:projectId/documents', upload.single('file'), scProjectsController.uploadDocument);
router.get('/projects/:projectId/documents/:documentId/download', scProjectsController.downloadDocument);
router.get('/projects/:projectId/documents/:documentId/view', scProjectsController.viewDocument);
router.delete('/projects/:projectId/documents/:documentId', scProjectsController.deleteDocument);

// Project Team
router.get('/projects/:projectId/team', scProjectsController.getProjectTeam);
router.post('/projects/:projectId/team', scProjectsController.addTeamMember);
router.delete('/projects/:projectId/team/:memberId', scProjectsController.removeTeamMember);

export default router;
