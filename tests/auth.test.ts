import request from 'supertest';
import app from '../src/app';

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new contractor', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Contractor',
          email: `test${Date.now()}@contractor.com`,
          password: 'Password123',
          role: 'contractor',
          phone: '1234567890',
          company: 'Test Company',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should fail with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'Password123',
          role: 'client',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      // First register
      const email = `test${Date.now()}@test.com`;
      await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email,
        password: 'Password123',
        role: 'client',
      });

      // Then login
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'WrongPassword123',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
