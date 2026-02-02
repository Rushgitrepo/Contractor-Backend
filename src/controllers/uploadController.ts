import { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import logger from '../utils/logger';

export const uploadImage = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Since we are using express.static('public'), we return the relative path from public
        // Example: /uploads/filename.jpg
        const fileUrl = `/uploads/${req.file.filename}`;

        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'File uploaded successfully',
            url: fileUrl
        });
    } catch (error) {
        logger.error('Upload error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Error uploading file'
        });
    }
};
