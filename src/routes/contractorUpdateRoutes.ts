import express from 'express';
import {
  getContractorProfile,
  updateContractorProfile
} from '../controllers/contractorUpdateController';

const router = express.Router();

// Get contractor profile by token
router.get('/profile/:token', getContractorProfile);

// Update contractor profile
router.put('/profile/:token', updateContractorProfile);

export default router;
