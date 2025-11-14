import { Router } from 'express';
import {
  getAllCompanies,
  getCompanyByName,
  searchCompanies,
  getServicesByZip
} from '../controllers/companyController';

const router = Router();

/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: Get all companies
 *     tags: [Companies]
 *     responses:
 *       200:
 *         description: List of all companies
 */
router.get('/', getAllCompanies);

/**
 * @swagger
 * /api/companies/search:
 *   get:
 *     summary: Search companies by zip, service, city, or rating
 *     tags: [Companies]
 *     parameters:
 *       - in: query
 *         name: zip
 *         schema:
 *           type: string
 *         description: Filter by zip code
 *       - in: query
 *         name: service
 *         schema:
 *           type: string
 *         description: Filter by service
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *         description: Filter by minimum rating
 *     responses:
 *       200:
 *         description: Filtered list of companies
 */
router.get('/search', searchCompanies);

/**
 * @swagger
 * /api/companies/zip/{zip}:
 *   get:
 *     summary: Get all services available in a zip code
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: zip
 *         required: true
 *         schema:
 *           type: string
 *         description: Zip code
 *     responses:
 *       200:
 *         description: Services and companies in zip code
 *       404:
 *         description: No companies found
 */
router.get('/zip/:zip', getServicesByZip);

/**
 * @swagger
 * /api/companies/{name}:
 *   get:
 *     summary: Get company by name
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Company name
 *     responses:
 *       200:
 *         description: Company details
 *       404:
 *         description: Company not found
 */
router.get('/:name', getCompanyByName);

export default router;
