export interface ServiceArea {
  city: string;
  zip_code?: string;
  zip?: string;
}

export interface Review {
  reviewer: string;
  location?: string;
  date?: string;
  project?: string;
  review_text: string;
}

export interface ClientReviews {
  average_rating: number;
  total_reviews: number;
  highlights: string;
  reviews: Review[];
}

export interface CompanyDetails {
  address: string;
  verified_business: boolean;
  description: string;
  years_in_business: number;
  license_number: string;
  certifications: string[];
  awards: string[];
  services_offered: string[];
  specialties: string[];
  service_areas: ServiceArea[];
  responds_quickly?: boolean;
  hired_on_platform?: boolean;
  provides_3d_visualization?: boolean;
  eco_friendly?: boolean;
  family_owned?: boolean;
  locally_owned?: boolean;
  offers_custom_work?: boolean;
  languages?: string[];
  budget_range?: string;
  professional_category?: string;
}

export interface FeaturedReview {
  reviewer: string;
  review_text: string;
}

export interface Company {
  name: string;
  rating: number;
  reviews_count: number;
  verified_hires: number;
  tagline: string;
  featured_review: FeaturedReview;
  details: CompanyDetails;
  client_reviews: ClientReviews;
}

export interface CompanyData {
  company: Company;
}
