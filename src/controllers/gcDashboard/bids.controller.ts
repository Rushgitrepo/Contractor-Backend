
import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as bidsService from '../../services/gcDashboard/bids.service';

export const createBid = async (req: AuthRequest, res: Response) => {
    try {
        const contractorId = req.user!.id;
        const bidData = {
            ...req.body,
            contractorId,
            contractorType: req.user!.role === 'subcontractor' ? 'sc' : 'gc'
        };

        // Validate required fields
        if (!bidData.projectId || bidData.totalPrice === undefined || bidData.totalPrice === null) {
            return res.status(400).json({ success: false, message: 'Missing required fields (projectId, totalPrice).' });
        }

        const newBid = await bidsService.createBid(bidData);
        res.status(201).json({ success: true, data: newBid });
    } catch (error: any) {
        if (error.message.includes('already created')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        console.error('Create bid error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateBidItems = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { items } = req.body;
        const contractorId = req.user!.id;

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, message: 'Invalid items array.' });
        }

        const result = await bidsService.updateBidItems(id, contractorId, { items });
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error('Update bid items error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const submitBid = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const contractorId = req.user!.id;

        const result = await bidsService.submitBid(id, contractorId);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error('Submit bid error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const withdrawBid = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const contractorId = req.user!.id;

        const result = await bidsService.withdrawBid(id, contractorId);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error('Withdraw bid error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const acceptBid = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const ownerId = req.user!.id;

        const result = await bidsService.acceptBid(id, ownerId);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error('Accept bid error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const rejectBid = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const ownerId = req.user!.id;

        const result = await bidsService.rejectBid(id, ownerId);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error('Reject bid error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const startProjectFromBid = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const ownerId = req.user!.id;

        const result = await bidsService.startProjectFromBid(id, ownerId);
        res.status(200).json({ success: true, data: result });
    } catch (error: any) {
        console.error('Start project error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getProjectBids = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const ownerId = req.user!.id;

        const bids = await bidsService.getProjectBids(projectId, ownerId);
        res.status(200).json({ success: true, data: bids });
    } catch (error: any) {
        console.error('Get project bids error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyBids = async (req: AuthRequest, res: Response) => {
    try {
        const contractorId = req.user!.id;
        const bids = await bidsService.getMyBids(contractorId);
        res.status(200).json({ success: true, data: bids });
    } catch (error: any) {
        console.error('Get my bids error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getBidDetail = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const bid = await bidsService.getBidDetail(id, userId);
        res.status(200).json({ success: true, data: bid });
    } catch (error: any) {
        console.error('Get bid detail error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteBid = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const result = await bidsService.deleteBid(id, userId);
        res.status(200).json({ success: true, message: 'Bid deleted successfully' });
    } catch (error: any) {
        console.error('Delete bid error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
