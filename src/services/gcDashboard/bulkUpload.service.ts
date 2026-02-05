import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import { config } from '../../config';
import { createProject, CreateProjectData } from './projects.service';
import fs from 'fs';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

export interface BulkUploadResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  projects: any[];
}

// Parse Excel/CSV/PDF file and extract project data
export const parseProjectFile = async (filePath: string, fileType: string): Promise<any[]> => {
  try {
    if (fileType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: dataBuffer });
      const pdfData = await parser.getText();
      await parser.destroy();

      // Basic extraction: split by lines and try to find a pattern
      // Since we give the user a "specific format", we can assume some structure
      // Let's assume one project per line, comma or pipe separated
      const lines = pdfData.text.split('\n')
        .map((l: string) => l.trim())
        .filter((line: string) => {
          if (line.length < 3) return false;
          // Skip page numbers like "Page 1", "1 of 10", "-- 1 --"
          if (/^page \d+/i.test(line)) return false;
          if (/^\d+ of \d+$/i.test(line)) return false;
          if (/^-- \d+.*--$/.test(line)) return false;
          // Skip headers if they contain our field names
          if (line.toLowerCase().includes('name') && line.toLowerCase().includes('budget')) return false;
          return true;
        });

      const projects: any[] = [];
      for (const line of lines) {
        // Try pipe separation first, then comma
        const parts = line.includes('|') ? line.split('|') : line.split(',');

        if (parts.length >= 1) {
          const name = parts[0]?.trim().replace(/\.+$/, ''); // Remove trailing dots
          if (!name || name.length < 2) continue;

          projects.push({
            name,
            location: parts[1]?.trim() || 'N/A',
            client: parts[2]?.trim() || 'N/A',
            status: parts[3]?.trim() || 'Planning',
            budget: parts[4]?.trim() || '0',
            duration: parts[5]?.trim() || '',
            description: parts[6]?.trim() || '',
          });
        }
      }
      return projects;
    } else {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      return data;
    }
  } catch (error: any) {
    throw new Error(`Failed to parse file: ${error}`);
  }
};

// Validate and normalize project data
const validateProjectData = (row: any, rowIndex: number): CreateProjectData | null => {
  const errors: string[] = [];

  // Required field: name
  if (!row.name && !row.Name && !row.project_name && !row['Project Name']) {
    errors.push('Missing required field: name');
  }

  const name = row.name || row.Name || row.project_name || row['Project Name'];
  const location = row.location || row.Location || null;
  const client = row.client || row.Client || null;
  const status = row.status || row.Status || 'Planning';
  const budget = row.budget || row.Budget || null;
  const duration = row.duration || row.Duration || null;
  const description = row.description || row.Description || null;

  // Validate status
  const validStatuses = ['Planning', 'In Progress', 'Bidding', 'Active', 'On Hold', 'Completed', 'Cancelled'];
  if (status && !validStatuses.includes(status)) {
    errors.push(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate budget (if provided)
  if (budget && isNaN(Number(budget))) {
    errors.push(`Invalid budget: ${budget}. Must be a number`);
  }

  // Validate duration (if provided)
  if (duration && isNaN(Number(duration))) {
    errors.push(`Invalid duration: ${duration}. Must be a number`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }

  return {
    gcId: 0, // Will be set by controller
    name,
    location,
    client,
    status,
    budget: budget ? Number(budget) : undefined,
    duration: duration ? Number(duration) : undefined,
    description,
  };
};

// Bulk create projects from file
export const bulkCreateProjects = async (
  gcId: number,
  filePath: string,
  fileType: string
): Promise<BulkUploadResult> => {
  const result: BulkUploadResult = {
    success: 0,
    failed: 0,
    errors: [],
    projects: [],
  };

  try {
    // Parse file
    const rows = await parseProjectFile(filePath, fileType);

    if (!rows || rows.length === 0) {
      throw new Error('No data found in file');
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because Excel rows start at 1 and first row is header

      try {
        // Validate and normalize data
        const projectData = validateProjectData(row, rowNumber);

        if (!projectData) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            error: 'Invalid data format',
            data: row,
          });
          continue;
        }

        // Set GC ID
        projectData.gcId = gcId;

        // Create project
        const project = await createProject(projectData);
        result.success++;
        result.projects.push(project);
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: error.message || 'Unknown error',
          data: row,
        });
      }
    }

    return result;
  } catch (error: any) {
    throw new Error(`Bulk upload failed: ${error.message}`);
  }
};
