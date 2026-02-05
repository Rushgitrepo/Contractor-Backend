import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as bulkUploadService from '../../services/gcDashboard/bulkUpload.service';
import fs from 'fs';
import path from 'path';

// Bulk Upload Projects
export const bulkUploadProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gcId = req.user!.id;

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

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/pdf', // .pdf
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
      // Delete uploaded file
      fs.unlinkSync(req.file.path);

      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Process bulk upload
    const result = await bulkUploadService.bulkCreateProjects(
      gcId,
      req.file.path,
      req.file.mimetype
    );

    // Delete uploaded file after processing
    try {
      fs.unlinkSync(req.file.path);
    } catch (error: any) {
      console.error('Error deleting temp file:', error);
    }

    // Return result
    res.status(201).json({
      success: true,
      data: {
        summary: {
          total: result.success + result.failed,
          success: result.success,
          failed: result.failed,
        },
        projects: result.projects,
        errors: result.errors,
      },
      message: `Bulk upload completed. ${result.success} projects created, ${result.failed} failed`,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Bulk upload error:', error);

    // Clean up file if exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError: any) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Failed to process bulk upload',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};
