export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'client' | 'contractor';
  phone?: string;
  company?: string;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ContractorProfile {
  id: number;
  user_id: number;
  license_number?: string;
  business_address?: string;
  years_experience?: string;
  specialties?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ClientProfile {
  id: number;
  user_id: number;
  project_type?: string;
  budget?: string;
  created_at: Date;
  updated_at: Date;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string; // Frontend sends this for validation
  role: 'client' | 'contractor';
  phone?: string;
  company?: string;
  // Contractor fields
  licenseNumber?: string;
  businessAddress?: string;
  yearsExperience?: string;
  specialties?: string;
  // Client fields
  projectType?: string;
  budget?: string;
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
