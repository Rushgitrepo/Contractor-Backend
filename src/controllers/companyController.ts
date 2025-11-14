import { Request, Response } from 'express';
import { CompanyData } from '../types/company';
import companiesData from '../data/companies.json';

const companies: CompanyData[] = companiesData as CompanyData[];

export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching companies',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getCompanyByName = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const company = companies.find(c => 
      c.company.name.toLowerCase() === name.toLowerCase()
    );

    if (!company) {
      res.status(404).json({
        success: false,
        message: 'Company not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const searchCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      zip, 
      service, 
      city, 
      rating,
      location,
      distance,
      verified_license,
      responds_quickly,
      hired_on_platform,
      professional_category,
      budget,
      provides_3d,
      eco_friendly,
      family_owned,
      locally_owned,
      offers_custom_work,
      language,
      min_rating
    } = req.query;

    let filteredCompanies = [...companies];

    // Filter by location (state/city)
    if (location) {
      const locationTerm = (location as string).toLowerCase();
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.address.toLowerCase().includes(locationTerm) ||
        c.company.details.service_areas.some(area => 
          area.city.toLowerCase().includes(locationTerm)
        )
      );
    }

    // Filter by zip code
    if (zip) {
      const zipCode = (zip as string).trim();
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.service_areas.some(area => 
          area.zip_code === zipCode || area.zip === zipCode
        )
      );
    }

    // Filter by service
    if (service) {
      const serviceTerm = (service as string).toLowerCase();
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.services_offered.some(s => 
          s.toLowerCase().includes(serviceTerm)
        )
      );
    }

    // Filter by city
    if (city) {
      const cityTerm = (city as string).toLowerCase();
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.service_areas.some(area => 
          area.city.toLowerCase().includes(cityTerm)
        )
      );
    }

    // Filter by verified license
    if (verified_license === 'true') {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.verified_business === true &&
        c.company.details.license_number !== ''
      );
    }

    // Filter by responds quickly
    if (responds_quickly === 'true') {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.responds_quickly === true
      );
    }

    // Filter by hired on platform
    if (hired_on_platform === 'true') {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.hired_on_platform === true
      );
    }

    // Filter by professional category
    if (professional_category) {
      const category = (professional_category as string).toLowerCase();
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.professional_category?.toLowerCase().includes(category)
      );
    }

    // Filter by budget
    if (budget) {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.budget_range === budget
      );
    }

    // Filter by 3D visualization
    if (provides_3d === 'true') {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.provides_3d_visualization === true
      );
    }

    // Filter by eco-friendly
    if (eco_friendly === 'true') {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.eco_friendly === true
      );
    }

    // Filter by family owned
    if (family_owned === 'true') {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.family_owned === true
      );
    }

    // Filter by locally owned
    if (locally_owned === 'true') {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.locally_owned === true
      );
    }

    // Filter by offers custom work
    if (offers_custom_work === 'true') {
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.offers_custom_work === true
      );
    }

    // Filter by language
    if (language) {
      const lang = (language as string).toLowerCase();
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.details.languages?.some(l => 
          l.toLowerCase().includes(lang)
        )
      );
    }

    // Filter by minimum rating
    if (rating) {
      const minRating = parseFloat(rating as string);
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.rating >= minRating
      );
    }

    // Filter by min_rating (alternative parameter)
    if (min_rating) {
      const minRating = parseFloat(min_rating as string);
      filteredCompanies = filteredCompanies.filter(c =>
        c.company.rating >= minRating
      );
    }

    res.status(200).json({
      success: true,
      count: filteredCompanies.length,
      data: filteredCompanies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching companies',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getServicesByZip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { zip } = req.params;

    const companiesInZip = companies.filter(c =>
      c.company.details.service_areas.some(area => 
        area.zip_code === zip || area.zip === zip
      )
    );

    if (companiesInZip.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No companies found for this zip code'
      });
      return;
    }

    // Extract all unique services
    const allServices = new Set<string>();
    companiesInZip.forEach(c => {
      c.company.details.services_offered.forEach(service => {
        allServices.add(service);
      });
    });

    res.status(200).json({
      success: true,
      zip_code: zip,
      companies_count: companiesInZip.length,
      services: Array.from(allServices).sort(),
      companies: companiesInZip
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching services by zip',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
