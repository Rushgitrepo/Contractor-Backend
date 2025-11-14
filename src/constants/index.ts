// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Response Messages
export const MESSAGES = {
  // Success
  REGISTRATION_SUCCESS: 'User registered successfully. Please check your email to verify your account.',
  LOGIN_SUCCESS: 'Login successful',
  
  // Errors
  USER_EXISTS: 'User with this email already exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  UNAUTHORIZED: 'No token provided',
  INVALID_TOKEN: 'Invalid or expired token',
  ACCESS_DENIED: 'Access denied',
  SERVER_ERROR: 'Server error',
  VALIDATION_FAILED: 'Validation failed',
} as const;

// User Roles
export const USER_ROLES = {
  CLIENT: 'client',
  CONTRACTOR: 'contractor',
} as const;
