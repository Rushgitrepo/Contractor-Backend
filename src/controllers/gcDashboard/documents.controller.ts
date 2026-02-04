import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as documentsService from '../../services/gcDashboard/documents.service';
import * as projectsService from '../../services/gcDashboard/projects.service';
import { updateDocumentSchema, documentQuerySchema } from '../../validators/gcDashboard.validator';
import { getFileType, deleteFile, getFilePath } from '../../services/gcDashboard/storage.service';
import path from 'path';
import fs from 'fs';

// Upload Document
export const uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
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
          message: 'You do not have permission to upload documents to this project',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get category from body or default
    const category = req.body.category || 'Other';
    const allowedCategories = ['Plans', 'Drawings', 'Photos', 'Contracts', 'Invoices', 'Other'];
    if (!allowedCategories.includes(category)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: 'Invalid document category',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }


    // Create document record
    const document = await documentsService.createDocument({
      projectId,
      name: req.file.originalname,
      filePath: req.file.path,
      fileType: getFileType(req.file.mimetype),
      fileSize: req.file.size,
      category,
      uploadedBy: gcId,
    });

    const mappedDocument = {
      id: document.id,
      name: document.name,
      size: parseInt(document.file_size),
      uploaded: document.created_at,
      uploadedAt: document.created_at,
      uploadedBy: req.user?.email || 'System', // Fallback since we don't have name
      category: document.category,
      fileType: document.file_type,
      starred: document.starred,
      shared: document.shared
    };

    res.status(201).json({
      success: true,
      data: mappedDocument,
      message: 'Document uploaded successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to upload document',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Get All Documents for Project
export const getDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Validate query params
    const validatedQuery = documentQuerySchema.parse(req.query);

    // Get documents
    const documents = await documentsService.getDocuments(projectId, validatedQuery.category);

    const mappedDocuments = documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      size: parseInt(doc.file_size),
      uploaded: doc.created_at,
      uploadedAt: doc.created_at,
      uploadedBy: doc.uploader_name || 'System',
      category: doc.category,
      fileType: doc.file_type,
      starred: doc.starred,
      shared: doc.shared,
      filePath: doc.file_path
    }));

    res.status(200).json({
      success: true,
      data: mappedDocuments,
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

    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to fetch documents',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Download Document
export const downloadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid document ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get document
    const document = await documentsService.getDocumentById(documentId);
    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: `Document with ID ${documentId} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check ownership
    if (document.gc_id !== gcId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to access this document',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(document.file_path)) {
      res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found on server',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Set headers and send file
    res.setHeader('Content-Type', getContentType(document.file_type));
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    res.sendFile(path.resolve(document.file_path));
  } catch (error: any) {
    console.error('Download document error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to download document',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// View Document (for preview)
export const viewDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid document ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Get document
    const document = await documentsService.getDocumentById(documentId);
    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: `Document with ID ${documentId} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check ownership
    if (document.gc_id !== gcId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to view this document',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(document.file_path)) {
      res.status(404).json({
        success: false,
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found on server',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Set headers and send file (inline for preview)
    res.setHeader('Content-Type', getContentType(document.file_type));
    res.setHeader('Content-Disposition', `inline; filename="${document.name}"`);
    res.sendFile(path.resolve(document.file_path));
  } catch (error: any) {
    console.error('View document error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to view document',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Update Document
export const updateDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid document ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Validate request body
    const validatedData = updateDocumentSchema.parse(req.body);

    // Check ownership
    const isOwner = await documentsService.checkDocumentOwnership(documentId, gcId);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to update this document',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Update document
    const document = await documentsService.updateDocument(documentId, validatedData);

    if (!document) {
      res.status(404).json({
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: `Document with ID ${documentId} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: document,
      message: 'Document updated successfully',
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

    console.error('Update document error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to update document',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// Delete Document
export const deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;
    const documentId = parseInt(req.params.id);

    if (isNaN(documentId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid document ID',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Check ownership
    const isOwner = await documentsService.checkDocumentOwnership(documentId, gcId);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have permission to delete this document',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Delete document
    const result = await documentsService.deleteDocument(documentId);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: `Document with ID ${documentId} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Delete file from filesystem
    if (result.filePath) {
      try {
        await deleteFile(result.filePath);
      } catch (fileError) {
        console.error('Error deleting file:', fileError);
        // Continue even if file deletion fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to delete document',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
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

  return typeMap[fileType.toLowerCase()] || 'application/octet-stream';
};



