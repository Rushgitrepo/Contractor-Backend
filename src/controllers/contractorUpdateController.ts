import { Request, Response } from 'express';
import pool from '../config/database';


// Get contractor profile by token
export const getContractorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM companies 
       WHERE update_token = $1 
       AND token_expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Invalid or expired link'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update contractor profile
export const updateContractorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const updates = req.body;
    
    // Verify token
    const checkResult = await pool.query(
      `SELECT id FROM companies 
       WHERE update_token = $1 
       AND token_expires_at > NOW()`,
      [token]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Invalid or expired link'
      });
      return;
    }

    const companyId = checkResult.rows[0].id;
    
    // Build update query
    const allowedFields = [
      'company_name', 'contact_name', 'tagline', 'description', 'phone', 'email', 
      'address', 'website', 'video_call_link', 'image_url', 'image_url_2', 'image_url_3',
      'license_number', 'budget_range', 'years_in_business', 
      'employees_count', 'languages', 'services_offered', 'specialties', 
      'service_areas', 'service_cities', 'service_zip_codes', 'awards', 'certifications',
      'clients', 'reviews', 'verified_hires', 'reviews_count', 'rating',
      'verified_business', 'responds_quickly', 'hired_on_platform',
      'family_owned', 'eco_friendly', 'locally_owned', 'offers_custom_work',
      'provides_3d_visualization', 'professional_category',
      'featured_reviewer_name', 'featured_review_text', 'featured_review_rating'
    ];
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        
        // Convert reviews to JSONB if it's the reviews field
        if (field === 'reviews' && updates[field]) {
          values.push(JSON.stringify(updates[field]));
        } else {
          values.push(updates[field]);
        }
        
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
    values.push(companyId);
    
    const query = `
      UPDATE companies 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
