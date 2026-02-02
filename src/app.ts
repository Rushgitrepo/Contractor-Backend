import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import tokenRoutes from './routes/tokenRoutes';
import companyRoutes from './routes/companyRoutes';
import metaRoutes from './routes/metaRoutes';
import contractorUpdateRoutes from './routes/contractorUpdateRoutes';
import { config } from './config';
import { apiLimiter } from './middleware/rateLimiter';
import { setupSwagger } from './swagger';

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Logging
app.use(morgan('dev'));

// Cookie parser middleware
app.use(cookieParser());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all routes
app.use('/api/', apiLimiter);

// Serve static files
app.use(express.static(path.join(process.cwd(), 'public')));


// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Setup Swagger documentation
setupSwagger(app);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/contractors/meta', metaRoutes);
app.use('/api/contractor', contractorUpdateRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

export default app;
