import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { signToken } from '../middleware/auth.js';

// Generate a valid admin token for testing
const adminToken = signToken({
  userId: 'test-admin-id',
  email: 'admin@lemonlearning.com',
  role: 'admin',
  name: 'Test Admin',
});

const clientToken = signToken({
  userId: 'test-client-id',
  email: 'client@example.com',
  role: 'client',
  name: 'Test Client',
});

describe('Auth endpoints', () => {
  describe('POST /api/auth/login', () => {
    it('returns 400 when email or password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/google', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({ email: 'test@lemonlearning.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('provisions admin for @lemonlearning.com email', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({
          googleToken: 'fake-token',
          email: 'newadmin@lemonlearning.com',
          name: 'New Admin',
          googleId: 'google-id-123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.token).toBeDefined();
    });
  });

  describe('POST /api/auth/verify', () => {
    it('verifies a valid token', async () => {
      const res = await request(app)
        .post('/api/auth/verify')
        .send({ token: adminToken });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
    });

    it('rejects an invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/verify')
        .send({ token: 'invalid-token' });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
    });
  });
});

describe('Projects endpoints', () => {
  let projectId: string;

  describe('GET /api/projects', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });

    it('returns projects list for authenticated user', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/projects', () => {
    it('creates a project for admin', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Project',
          toolName: 'Salesforce',
          subdomain: 'test-project-' + Date.now(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Test Project');
      projectId = res.body.data.id;
    });

    it('rejects creation for client role', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          name: 'Client Project',
          toolName: 'Salesforce',
          subdomain: 'client-project',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns project detail', async () => {
      if (!projectId) return;
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(projectId);
    });

    it('returns 404 for unknown project', async () => {
      const res = await request(app)
        .get('/api/projects/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('deletes a project', async () => {
      if (!projectId) return;
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });
  });
});

describe('Health endpoint', () => {
  it('returns OK status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});
