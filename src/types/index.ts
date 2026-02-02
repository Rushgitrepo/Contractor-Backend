export interface RegisterRequest {
  // Common
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  workType: 'client' | 'subcontractor' | 'general-contractor' | 'supplier';

  // Company Info (Shared)
  companyName?: string;
  companySize?: string;
  address?: string; // Property Address (Client) or Business Address (Contractor)
  role?: string; // Job Role

  // General Contractor / Subcontractor
  yearsInBusiness?: number;
  projectSizeRange?: string; // GC only
  serviceArea?: string; // SC only

  // Supplier
  businessType?: string;
  deliveryRadius?: number;
  minOrderValue?: string;
  offerCreditTerms?: boolean;

  // Client
  projectType?: string;
  budgetRange?: string;
  timeline?: string;
  propertySize?: string;
  financingStatus?: string;

  // Arrays
  trades?: string[]; // Trades (Contractor) or Product Categories (Supplier) or Interests (Client)
  goals?: string[];
}

export interface User { // Maps to 'users' table
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: 'client' | 'general-contractor' | 'subcontractor' | 'supplier' | 'admin';
  phone?: string;
  company?: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: Omit<User, 'password'>;
    token: string;
  };
}
