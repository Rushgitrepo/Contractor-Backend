import { Request, Response } from 'express';
import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
});

// Get all companies from database
export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM companies');
    const totalCompanies = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCompanies / limit);

    const result = await pool.query(`
      SELECT * FROM companies 
      ORDER BY rating DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        totalItems: totalCompanies,
        totalPages: totalPages,
        currentPage: page,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching companies',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get company by ID
export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM companies WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create new company
export const createCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      company_name,
      tagline,
      description,
      phone,
      email,
      address,
      website,
      image_url,
      image_url_2,
      image_url_3,
      license_number,
      verified_business,
      responds_quickly,
      hired_on_platform,
      family_owned,
      eco_friendly,
      locally_owned,
      offers_custom_work,
      provides_3d_visualization,
      professional_category,
      budget_range,
      years_in_business,
      employees_count,
      languages,
      services_offered,
      specialties,
      service_areas,
      service_cities,
      service_zip_codes,
      awards,
      certifications,
      featured_reviewer_name,
      featured_review_text,
      featured_review_rating
    } = req.body;

    // Validate required fields
    if (!company_name) {
      res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
      return;
    }

    // Generate unique token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry

    const result = await pool.query(`
      INSERT INTO companies (
        company_name, tagline, description, phone, email, address, website,
        image_url, image_url_2, image_url_3, license_number,
        verified_business, responds_quickly, hired_on_platform,
        family_owned, eco_friendly, locally_owned, offers_custom_work,
        provides_3d_visualization, professional_category, budget_range,
        years_in_business, employees_count, languages,
        services_offered, specialties, service_areas, service_cities,
        service_zip_codes, awards, certifications,
        featured_reviewer_name, featured_review_text, featured_review_rating,
        update_token, token_expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
      )
      RETURNING *
    `, [
      company_name, tagline, description, phone, email, address, website,
      image_url, image_url_2, image_url_3, license_number,
      verified_business || false, responds_quickly || false, hired_on_platform || false,
      family_owned || false, eco_friendly || false, locally_owned || false,
      offers_custom_work || false, provides_3d_visualization || false,
      professional_category, budget_range, years_in_business, employees_count,
      languages, services_offered, specialties, service_areas, service_cities,
      service_zip_codes, awards, certifications,
      featured_reviewer_name, featured_review_text, featured_review_rating,
      token, expiresAt
    ]);

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: result.rows[0],
      update_link: `http://localhost:3000/contractor/update/${token}`
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update company
export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if company exists
    const checkResult = await pool.query('SELECT id FROM companies WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    // Build update query
    const allowedFields = [
      'company_name', 'tagline', 'description', 'phone', 'email', 'address', 'website',
      'image_url', 'image_url_2', 'image_url_3', 'license_number',
      'verified_business', 'responds_quickly', 'hired_on_platform',
      'family_owned', 'eco_friendly', 'locally_owned', 'offers_custom_work',
      'provides_3d_visualization', 'professional_category', 'budget_range',
      'years_in_business', 'employees_count', 'languages',
      'services_offered', 'specialties', 'service_areas', 'service_cities',
      'service_zip_codes', 'awards', 'certifications',
      'featured_reviewer_name', 'featured_review_text', 'featured_review_rating'
    ];

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
      return;
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE companies 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    res.status(200).json({
      success: true,
      message: 'Company updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating company',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete company
export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM companies WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Company deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting company',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Search companies
export const searchCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      zip,
      service,
      city,
      rating,
      verified_license,
      responds_quickly,
      family_owned,
      eco_friendly,
      hired_on_platform,
      locally_owned,
      offers_custom_work,
      provides_3d_visualization,
      budget,
      language,
      professional_category
    } = req.query;

    let query = 'SELECT * FROM companies WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    // Search by zip code
    if (zip) {
      query += ` AND $${paramCount} = ANY(service_zip_codes)`;
      params.push(zip);
      paramCount++;
    }

    // Search by service
    if (service) {
      query += ` AND EXISTS (
        SELECT 1 FROM unnest(services_offered) AS s
        WHERE s ILIKE $${paramCount}
      )`;
      params.push(`%${service}%`);
      paramCount++;
    }

    // Search by city
    if (city) {
      query += ` AND EXISTS (
        SELECT 1 FROM unnest(service_cities) AS c
        WHERE c ILIKE $${paramCount}
      )`;
      params.push(`%${city}%`);
      paramCount++;
    }

    // Filter by rating
    if (rating) {
      query += ` AND rating >= $${paramCount}`;
      params.push(rating);
      paramCount++;
    }

    // Filter by verified business
    if (verified_license === 'true') {
      query += ` AND verified_business = true`;
    }

    // Filter by responds quickly
    if (responds_quickly === 'true') {
      query += ` AND responds_quickly = true`;
    }

    // Filter by hired on platform
    if (hired_on_platform === 'true') {
      query += ` AND hired_on_platform = true`;
    }

    // Filter by family owned
    if (family_owned === 'true') {
      query += ` AND family_owned = true`;
    }

    // Filter by eco friendly
    if (eco_friendly === 'true') {
      query += ` AND eco_friendly = true`;
    }

    // Filter by locally owned
    if (locally_owned === 'true') {
      query += ` AND locally_owned = true`;
    }

    // Filter by offers custom work
    if (offers_custom_work === 'true') {
      query += ` AND offers_custom_work = true`;
    }

    // Filter by provides 3d visualization
    if (provides_3d_visualization === 'true') {
      query += ` AND provides_3d_visualization = true`;
    }

    // Filter by budget
    if (budget) {
      query += ` AND budget_range = $${paramCount}`;
      params.push(budget);
      paramCount++;
    }

    // Filter by language
    if (language) {
      query += ` AND $${paramCount} = ANY(languages)`;
      params.push(language);
      paramCount++;
    }

    // Filter by professional category
    if (professional_category) {
      query += ` AND professional_category ILIKE $${paramCount}`;
      params.push(`%${professional_category}%`);
      paramCount++;
    }

    query += ` ORDER BY rating DESC NULLS LAST`;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = query.replace('SELECT * FROM', 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
    const countResult = await pool.query(countQuery, params);
    const totalCompanies = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCompanies / limit);

    // Add pagination
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        totalItems: totalCompanies,
        totalPages: totalPages,
        currentPage: page,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching companies',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
