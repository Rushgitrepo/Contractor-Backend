import { z } from 'zod';

// Project Validators
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  location: z.string().max(255).optional(),
  client: z.string().max(255).optional(),
  status: z.enum(['Planning', 'In Progress', 'Bidding', 'On Hold', 'Completed', 'Cancelled']).default('Planning'),
  budget: z.number().positive().optional(),
  duration: z.number().int().positive().optional(),
  description: z.string().optional(),
  progress: z.number().int().min(0).max(100).default(0).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  location: z.string().max(255).optional(),
  client: z.string().max(255).optional(),
  status: z.enum(['Planning', 'In Progress', 'Bidding', 'On Hold', 'Completed', 'Cancelled']).optional(),
  budget: z.number().positive().optional(),
  duration: z.number().int().positive().optional(),
  description: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

export const projectQuerySchema = z.object({
  status: z.enum(['Planning', 'In Progress', 'Bidding', 'On Hold', 'Completed', 'Cancelled']).optional(),
  search: z.string().optional(),
  page: z.preprocess(
    (val) => (val === undefined || val === '' ? '1' : String(val)),
    z.string().regex(/^\d+$/).transform(Number)
  ).default(1),
  limit: z.preprocess(
    (val) => (val === undefined || val === '' ? '10' : String(val)),
    z.string().regex(/^\d+$/).transform(Number)
  ).default(10),
});

// Team Member Validators
export const createTeamMemberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  role: z.string().max(100).optional(),
  employee_id: z.string().max(100).optional(),
  type: z.enum(['Direct Employee', 'Contractor']),
  status: z.enum(['Active', 'Inactive', 'Terminated']).default('Active').optional(),
  progress: z.number().int().min(0).max(100).default(0).optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
});

export const updateTeamMemberSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  role: z.string().max(100).optional(),
  employee_id: z.string().max(100).optional(),
  type: z.enum(['Direct Employee', 'Contractor']).optional(),
  status: z.enum(['Active', 'Inactive', 'Terminated']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
});

export const assignTeamMemberSchema = z.object({
  teamMemberId: z.number().int().positive(),
  role: z.string().max(100).optional(),
});

// Document Validators
export const updateDocumentSchema = z.object({
  starred: z.boolean().optional(),
  shared: z.boolean().optional(),
  category: z.enum(['Plans', 'Drawings', 'Photos', 'Contracts', 'Invoices', 'Other']).optional(),
});

export const documentQuerySchema = z.object({
  category: z.enum(['Plans', 'Drawings', 'Photos', 'Contracts', 'Invoices', 'Other']).optional(),
});

