import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { uploadImage } from '../controllers/uploadController';

const router = Router();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // Increased to 10MB
    },
    fileFilter: (req, file, cb) => {
        // Allow images and documents
        const allowedTypes = /jpeg|jpg|png|webp|pdf|doc|docx|xls|xlsx|csv|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
        // Mime type check can be tricky for some docs, trusting extension + generic types for now or relax it
        // Simpler: check extension only or broader mime types

        if (extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and documents (pdf, doc, docx, xls, xlsx, csv, txt) are allowed'));
        }
    }
});

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload an image
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, upload.single('image'), uploadImage);

export default router;
