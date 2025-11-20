import { Router } from 'express';
import {
  getAllCompanies,
  getCompanyById,
  searchCompanies,
  createCompany,
  updateCompany,
  deleteCompany
} from '../controllers/companyController-db';

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
 * /api/companies/{id}:
 *   get:
 *     summary: Get company by ID
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company details
 *       404:
 *         description: Company not found
 */
router.get('/:id', getCompanyById);

/**
 * @swagger
 * /api/companies:
 *   post:
 *     summary: Create a new company
 *     tags: [Companies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - company_name
 *             properties:
 *               company_name:
 *                 type: string
 *               tagline:
 *                 type: string
 *               description:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Company created successfully
 */
router.post('/', createCompany);

/**
 * @swagger
 * /api/companies/{id}:
 *   put:
 *     summary: Update company by ID
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Company updated successfully
 */
router.put('/:id', updateCompany);

/**
 * @swagger
 * /api/companies/{id}:
 *   delete:
 *     summary: Delete company by ID
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Company deleted successfully
 */
router.delete('/:id', deleteCompany);

export default router;
