import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { HTTP_STATUS } from '../constants';

// Generic middleware function to validate request body against a Joi schema
export const validateRequest = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        console.log('Incoming Register Payload:', JSON.stringify(req.body, null, 2));
        const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

        if (error) {
            console.log('JOI Validation Error:', JSON.stringify(error.details, null, 2));
            const errors = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/['"]/g, ''),
            }));

            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Validation Error',
                errors,
            });
        }

        next();
    };
};

// Registration Schema
export const registerSchema = Joi.object({
    // Core Identity
    firstName: Joi.string().min(2).max(50).required().messages({
        'string.empty': 'First name is required',
        'string.min': 'First name must be at least 2 characters',
    }),
    lastName: Joi.string().min(2).max(50).required().messages({
        'string.empty': 'Last name is required',
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
    }),
    password: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        }),
    phone: Joi.string().pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im).required().messages({
        'string.pattern.base': 'Please provide a valid phone number',
    }),
    workType: Joi.string().valid('client', 'general-contractor', 'subcontractor', 'supplier').required(),

    // Role - Common for companies
    role: Joi.string().when('workType', {
        is: Joi.valid('general-contractor', 'subcontractor', 'supplier'),
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),

    // Company Details (GC, Sub, Supplier)
    companyName: Joi.string().when('workType', {
        is: Joi.valid('general-contractor', 'subcontractor', 'supplier'),
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    companySize: Joi.string().when('workType', {
        is: Joi.valid('general-contractor', 'subcontractor', 'supplier'),
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    address: Joi.string().when('workType', {
        is: Joi.valid('general-contractor', 'subcontractor', 'supplier', 'client'),
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    yearsInBusiness: Joi.number().when('workType', {
        is: Joi.valid('general-contractor', 'subcontractor', 'supplier'),
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),

    // Specific: General Contractor
    projectSizeRange: Joi.string().when('workType', {
        is: 'general-contractor',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),

    // Specific: Subcontractor
    serviceArea: Joi.string().when('workType', {
        is: 'subcontractor',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),

    // Specific: Supplier
    businessType: Joi.string().when('workType', {
        is: 'supplier',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    deliveryRadius: Joi.number().when('workType', {
        is: 'supplier',
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
    minOrderValue: Joi.string().when('workType', {
        is: 'supplier',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    offerCreditTerms: Joi.boolean().when('workType', {
        is: 'supplier',
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),

    // Specific: Client
    projectType: Joi.string().when('workType', {
        is: 'client',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    budgetRange: Joi.string().when('workType', {
        is: 'client',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    timeline: Joi.string().when('workType', {
        is: 'client',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    propertySize: Joi.string().when('workType', {
        is: 'client',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),
    financingStatus: Joi.string().when('workType', {
        is: 'client',
        then: Joi.required().allow(''),
        otherwise: Joi.optional().allow(''),
    }),

    // Arrays
    trades: Joi.array().items(Joi.string()).optional(), // used by GC, Sub, Client (interests)
    goals: Joi.array().items(Joi.string()).optional(),
});
