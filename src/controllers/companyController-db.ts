import { Request, Response } from 'express';
import pool from '../config/database';


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

// Get the company for the current logged in user
export const getMyCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;

    if (role === 'general-contractor') {
      const result = await pool.query(
        'SELECT * FROM general_contractor_profiles WHERE user_id = $1',
        [userId]
      );

      const profile = result.rows[0];
      if (!profile) {
        res.status(200).json({
          success: true,
          data: null,
          message: 'Profile not found',
          profile_metadata: { profile_completed: false, last_reminder_at: null }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: profile,
        profile_metadata: {
          profile_completed: profile.profile_completed,
          last_reminder_at: profile.last_reminder_at
        }
      });
      return;
    }

    // Default: Check companies table for legacy/other roles
    const result = await pool.query(
      'SELECT * FROM companies WHERE user_id = $1',
      [userId]
    );

    res.status(200).json({
      success: true,
      data: result.rows[0] || null,
      profile_metadata: { profile_completed: true, last_reminder_at: null } // Non-GCs don't have this ritual yet
    });
  } catch (error) {
    console.error('Get my company error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update or create the company for the current logged in user
export const updateMyCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const role = (req as any).user.role;
    const updates = req.body;

    if (role === 'general-contractor') {
      // Check if profile exists
      const checkResult = await pool.query('SELECT id FROM general_contractor_profiles WHERE user_id = $1', [userId]);

      if (checkResult.rows.length === 0) {
        // This shouldn't happen but let's handle it
        await pool.query('INSERT INTO general_contractor_profiles (user_id) VALUES ($1)', [userId]);
      }

      // Prepare fields for update
      const allowedFields = [
        'company_name', 'tagline', 'description', 'website', 'address',
        'license_number', 'verified_business', 'responds_quickly', 'family_owned',
        'eco_friendly', 'locally_owned', 'offers_custom_work', 'provides_3d_visualization',
        'professional_category', 'budget_range', 'years_in_business', 'employees_count',
        'languages', 'services_offered', 'specialties', 'service_areas', 'service_cities',
        'service_zip_codes', 'awards', 'certifications', 'licenses', 'featured_reviewer_name',
        'featured_review_text', 'featured_review_rating'
      ];

      const updateFields: string[] = [];
      const queryValues: any[] = [];
      let paramCount = 1;

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          let value = updates[field];

          // Ensure object arrays are converted to string arrays for TEXT[] columns
          if ((field === 'licenses' || field === 'certifications') && Array.isArray(value)) {
            value = value.map((item: any) => {
              if (typeof item === 'object' && item !== null) {
                return JSON.stringify(item);
              }
              return String(item);
            });
          }

          updateFields.push(`${field} = $${paramCount}`);
          queryValues.push(value);
          paramCount++;
        }
      }

      // Special handling for image mapping
      // We combine 'images' array with individual 'image_url' fields if provided
      if (updates.images !== undefined || updates.image_url !== undefined || updates.image_url_2 !== undefined || updates.image_url_3 !== undefined) {
        let imagesArray = Array.isArray(updates.images) ? [...updates.images] : [];

        if (updates.image_url !== undefined) imagesArray[0] = updates.image_url;
        if (updates.image_url_2 !== undefined) imagesArray[1] = updates.image_url_2;
        if (updates.image_url_3 !== undefined) imagesArray[2] = updates.image_url_3;

        // Ensure we don't have holes if only image_url_2 was provided
        const maxIndex = Math.max(
          imagesArray.length,
          updates.image_url !== undefined ? 1 : 0,
          updates.image_url_2 !== undefined ? 2 : 0,
          updates.image_url_3 !== undefined ? 3 : 0
        );

        for (let i = 0; i < maxIndex; i++) {
          if (imagesArray[i] === undefined) imagesArray[i] = null;
        }

        updateFields.push(`images = $${paramCount}`);
        queryValues.push(imagesArray);
        paramCount++;
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = NOW()`);
        queryValues.push(userId);

        const query = `
          UPDATE general_contractor_profiles 
          SET ${updateFields.join(', ')}
          WHERE user_id = $${paramCount}
          RETURNING *
        `;
        const result = await pool.query(query, queryValues);

        // Calculate completion
        const profileData = result.rows[0];
        const isCompleted = !!(profileData.tagline && profileData.description && profileData.website && profileData.license_number);

        if (isCompleted) {
          await pool.query(
            'UPDATE general_contractor_profiles SET profile_completed = true, updated_at = NOW() WHERE user_id = $1',
            [userId]
          );
        }

        res.status(200).json({
          success: true,
          message: 'Profile updated successfully',
          data: profileData,
          profile_completed: isCompleted
        });
      } else {
        const currentProfile = await pool.query('SELECT * FROM general_contractor_profiles WHERE user_id = $1', [userId]);
        res.status(200).json({
          success: true,
          message: 'No changes provided',
          data: currentProfile.rows[0]
        });
      }
      return;
    }

    // Default: companies table for others
    const checkResult = await pool.query('SELECT id FROM companies WHERE user_id = $1', [userId]);

    let result;
    if (checkResult.rows.length === 0) {
      // Create logic for others...
      result = await pool.query(`
        INSERT INTO companies (company_name, user_id, tagline, description, website, address)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
      `, [updates.company_name, userId, updates.tagline, updates.description, updates.website, updates.address]);
    } else {
      // Update logic for others...
      result = await pool.query(`
        UPDATE companies SET tagline = $1, description = $2, website = $3, address = $4, updated_at = NOW()
        WHERE user_id = $5 RETURNING *
      `, [updates.tagline, updates.description, updates.website, updates.address, userId]);
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update my company error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating your profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Skip the profile completion reminder
export const skipProfileReminder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    await pool.query(
      'UPDATE general_contractor_profiles SET last_reminder_at = NOW(), updated_at = NOW() WHERE user_id = $1',
      [userId]
    );

    res.status(200).json({
      success: true,
      message: 'Reminder skipped'
    });
  } catch (error) {
    console.error('Skip reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Error skipping reminder',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
