import pool from '../../config/database';
import { config } from '../../config';
import fs from 'fs';
import path from 'path';

export interface CreateDocumentData {
  projectId: number;
  name: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  category: string;
  uploadedBy: number;
}

export interface UpdateDocumentData {
  starred?: boolean;
  shared?: boolean;
  category?: string;
}

// Create Document
export const createDocument = async (data: CreateDocumentData) => {
  const result = await pool.query(
    `INSERT INTO gc_documents (project_id, name, file_path, file_type, file_size, category, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.projectId,
      data.name,
      data.filePath,
      data.fileType,
      data.fileSize,
      data.category,
      data.uploadedBy,
    ]
  );
  return result.rows[0];
};

// Get All Documents for Project
export const getDocuments = async (projectId: number, category?: string) => {
  let query = `SELECT * FROM gc_documents WHERE project_id = $1`;
  const params: any[] = [projectId];

  if (category) {
    query += ` AND category = $2`;
    params.push(category);
  }

  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

// Get Single Document
export const getDocumentById = async (documentId: number) => {
  const result = await pool.query(
    `SELECT d.*, p.gc_id 
     FROM gc_documents d
     JOIN gc_projects p ON p.id = d.project_id
     WHERE d.id = $1`,
    [documentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// Update Document
export const updateDocument = async (documentId: number, data: UpdateDocumentData) => {
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      updateFields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  });

  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }

  updateFields.push(`updated_at = NOW()`);
  values.push(documentId);

  const result = await pool.query(
    `UPDATE gc_documents 
     SET ${updateFields.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

// Delete Document
export const deleteDocument = async (documentId: number): Promise<{ success: boolean; filePath?: string }> => {
  // Get document info first
  const docResult = await pool.query(
    `SELECT file_path FROM gc_documents WHERE id = $1`,
    [documentId]
  );

  if (docResult.rows.length === 0) {
    return { success: false };
  }

  const filePath = docResult.rows[0].file_path;

  // Delete from database
  const result = await pool.query(
    `DELETE FROM gc_documents WHERE id = $1 RETURNING *`,
    [documentId]
  );

  if (result.rows.length === 0) {
    return { success: false };
  }

  return { success: true, filePath };
};

// Check Document Ownership (via project)
export const checkDocumentOwnership = async (documentId: number, gcId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT d.id 
     FROM gc_documents d
     JOIN gc_projects p ON p.id = d.project_id
     WHERE d.id = $1 AND p.gc_id = $2 AND p.deleted_at IS NULL`,
    [documentId, gcId]
  );
  return result.rows.length > 0;
};





