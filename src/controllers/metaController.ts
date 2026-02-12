import { Request, Response } from 'express';
import pool from '../config/database';


// Get all unique services
export const getAllServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT unnest(services_offered) as service
      FROM companies
      WHERE services_offered IS NOT NULL
      ORDER BY service
    `);

    const services = result.rows.map(row => row.service);

    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching services',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all unique categories
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT professional_category as category
      FROM companies
      WHERE professional_category IS NOT NULL
      ORDER BY category
    `);

    const categories = result.rows.map(row => row.category);

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all unique zip codes
export const getAllZipCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT unnest(service_zip_codes) as zip_code
      FROM companies
      WHERE service_zip_codes IS NOT NULL
      ORDER BY zip_code
    `);

    const zipCodes = result.rows.map(row => row.zip_code).filter(zip => zip !== 'N/A');

    res.status(200).json({
      success: true,
      count: zipCodes.length,
      data: zipCodes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching zip codes',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all unique cities
export const getAllCities = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT unnest(service_cities) as city
      FROM companies
      WHERE service_cities IS NOT NULL
      ORDER BY city
    `);

    const cities = result.rows.map(row => row.city);

    res.status(200).json({
      success: true,
      count: cities.length,
      data: cities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching cities',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
