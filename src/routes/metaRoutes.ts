import { Router } from 'express';
import {
  getAllServices,
  getAllCategories,
  getAllZipCodes
} from '../controllers/metaController';

const router = Router();

/**
 * @swagger
 * /api/contractors/meta/services:
 *   get:
 *     summary: Get all unique services
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: List of all services
 */
router.get('/services', getAllServices);

/**
 * @swagger
 * /api/contractors/meta/categories:
 *   get:
 *     summary: Get all unique categories
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: List of all categories
 */
router.get('/categories', getAllCategories);

/**
 * @swagger
 * /api/contractors/meta/zipcodes:
 *   get:
 *     summary: Get all unique zip codes
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: List of all zip codes
 */
router.get('/zipcodes', getAllZipCodes);

export default router;
