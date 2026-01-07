const Joi = require('joi');

// Mock Joi schema matching joiValidator.ts
const registerSchema = Joi.object({
    // Core Identity
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    phone: Joi.string().pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im).required(),
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

    trades: Joi.array().items(Joi.string()).optional(),
    goals: Joi.array().items(Joi.string()).optional(),
});

// Payload from user logs
const payload = {
  "firstName": "Haris",
  "lastName": "Rashid",
  "email": "haris.rashidch@gmail.com",
  "password": "Haris.exe123",
  "workType": "client",
  "phone": "03214385757",
  "companyName": "gf",
  "companySize": "",
  "address": "F7JF+MV9",
  "role": "",
  "yearsInBusiness": 0,
  "projectSizeRange": "",
  "serviceArea": "",
  "businessType": "",
  "deliveryRadius": 0,
  "minOrderValue": "",
  "offerCreditTerms": false,
  "projectType": "residential",
  "budgetRange": "over-1m",
  "timeline": "",
  "propertySize": "",
  "financingStatus": "",
  "trades": [
    "Renovation"
  ],
  "goals": [
    "Complete my project on time"
  ]
};

const { error } = registerSchema.validate(payload, { abortEarly: false, stripUnknown: true });

if (error) {
  console.log('Validation Failed:', JSON.stringify(error.details, null, 2));
} else {
  console.log('Validation Successful!');
}
