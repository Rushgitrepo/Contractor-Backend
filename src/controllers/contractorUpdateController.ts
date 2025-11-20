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
      'company_name', 'tagline', 'description', 'phone', 'email', 
      'address', 'website', 'image_url', 'image_url_2', 'image_url_3',
      'license_number', 'budget_range', 'years_in_business', 
      'employees_count', 'languages', 'services_offered', 'specialties', 
      'service_cities', 'service_zip_codes', 'awards', 'certifications'
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
    
    updateFields.push(`last_updated_by_contractor = NOW()`);
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
