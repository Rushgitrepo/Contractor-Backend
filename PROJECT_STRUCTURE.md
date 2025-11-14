# 📁 Project Structure

```
contractor-backend/
│
├── 📂 src/                          # Source code
│   ├── 📂 config/                   # Configuration files
│   │   ├── index.ts                 # Centralized config
│   │   └── database.ts              # Database connection
│   │
│   ├── 📂 constants/                # Constants & enums
│   │   └── index.ts                 # HTTP status, messages, roles
│   │
│   ├── 📂 controllers/              # Business logic
│   │   └── authController.ts        # Authentication handlers
│   │
│   ├── 📂 database/                 # Database related
│   │   ├── schema.sql               # Database schema
│   │   └── migrate.ts               # Migration script
│   │
│   ├── 📂 middleware/               # Express middleware
│   │   ├── auth.ts                  # JWT authentication
│   │   └── validator.ts             # Input validation
│   │
│   ├── 📂 routes/                   # API routes
│   │   └── authRoutes.ts            # Auth endpoints
│   │
│   ├── 📂 types/                   
│   │
│   ├── 📂 utils/                    # Utility functions
│   │   ├── jwt.ts                   # JWT helpers
│   │   └── password.ts              # Password hashing
│   │
│   ├── app.ts                       # Express app setup
│   └── server.ts                    # Server entry point
│
├── 📂 scripts/                      # Utility scripts
│   └── create-db.js                 # Database creation
│ # TypeScript types
│   │   └── index.ts                 # Type definitions
├── 📂 node_modules/                 # Dependencies
│
├── .env                             # Environment variables (gitignored)
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── package.json                     # Project dependencies
├── tsconfig.json                    # TypeScript config
├── README.md                        # Documentation
└── PROJECT_STRUCTURE.md             # This file
```

## 📋 Folder Descriptions

### `/src/config`
Centralized configuration management. All environment variables and settings are accessed through here.

### `/src/constants`
Application-wide constants like HTTP status codes, error messages, and user roles. Makes code more maintainable.

### `/src/controllers`
Business logic for handling requests. Each controller focuses on a specific domain (auth, users, etc.).

### `/src/database`
Database schema and migration scripts. Keeps database structure version-controlled.

### `/src/middleware`
Express middleware for authentication, validation, error handling, etc.

### `/src/routes`
API endpoint definitions. Routes are organized by feature/domain.

### `/src/types`
TypeScript type definitions and interfaces for type safety.

### `/src/utils`
Reusable utility functions (JWT, password hashing, etc.).

### `/scripts`
Helper scripts for development and deployment tasks.

## 🎯 Design Principles

1. **Separation of Concerns**: Each folder has a single responsibility
2. **Scalability**: Easy to add new features without restructuring
3. **Maintainability**: Clear organization makes code easy to find and update
4. **Type Safety**: TypeScript throughout for better developer experience
5. **Security**: Centralized config prevents hardcoded secrets
6. **Clean Code**: Constants and utilities reduce code duplication

## 🚀 Key Features

- ✅ Clean Architecture
- ✅ TypeScript for Type Safety
- ✅ Centralized Configuration
- ✅ Constants for Maintainability
- ✅ Modular Structure
- ✅ Easy to Scale
- ✅ Professional Standards
