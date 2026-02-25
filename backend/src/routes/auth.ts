import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { users, demoAssignments } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { signToken, verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /auth/login
 * Authenticate with email + password. Returns JWT with user info.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required', code: 400 });
      return;
    }

    const user = await db.select().from(users).where(eq(users.email, email)).get();

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials', code: 401 });
      return;
    }

    // Admins cannot log in with email/password (Google SSO only)
    if (user.role === 'admin') {
      res.status(401).json({ error: 'Admin accounts must use Google SSO', code: 401 });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials', code: 401 });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials', code: 401 });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'client',
      name: user.name,
    });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          language: user.language,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /auth/google
 * Authenticate with Google token. Auto-provisions admin if @lemonlearning.com.
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { googleToken, email, name, googleId, avatarUrl } = req.body;

    if (!email || !googleId) {
      res.status(400).json({ error: 'Google authentication data is required', code: 400 });
      return;
    }

    // Check if user already exists
    let user = await db.select().from(users).where(eq(users.googleId, googleId)).get();

    if (!user) {
      // Auto-provision admin if @lemonlearning.com
      const isLemonLearning = email.endsWith('@lemonlearning.com');

      if (!isLemonLearning) {
        res.status(403).json({
          error: 'Only @lemonlearning.com accounts can sign in with Google',
          code: 403,
        });
        return;
      }

      // Create new admin user
      const newUser = {
        id: uuidv4(),
        name: name || email.split('@')[0],
        email,
        passwordHash: null,
        role: 'admin' as const,
        avatarUrl: avatarUrl || null,
        googleId,
        language: 'fr',
        createdAt: new Date().toISOString(),
      };

      await db.insert(users).values(newUser);
      user = newUser;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'client',
      name: user.name,
    });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          language: user.language,
        },
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /auth/demo-access
 * Authenticate a prospect using access_token + password.
 */
router.post('/demo-access', async (req: Request, res: Response) => {
  try {
    const { accessToken, password } = req.body;

    if (!accessToken || !password) {
      res.status(400).json({ error: 'Access token and password are required', code: 400 });
      return;
    }

    const assignment = await db
      .select()
      .from(demoAssignments)
      .where(eq(demoAssignments.accessToken, accessToken))
      .get();

    if (!assignment) {
      res.status(401).json({ error: 'Invalid access token', code: 401 });
      return;
    }

    // Check expiration
    if (new Date(assignment.expiresAt) < new Date()) {
      res.status(401).json({ error: 'Access token has expired', code: 401 });
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, assignment.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid password', code: 401 });
      return;
    }

    // Get the user
    const user = await db.select().from(users).where(eq(users.id, assignment.userId)).get();
    if (!user) {
      res.status(404).json({ error: 'User not found', code: 404 });
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: 'client',
      name: user.name,
    });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        versionId: assignment.versionId,
        expiresAt: assignment.expiresAt,
      },
    });
  } catch (error) {
    console.error('Demo access error:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /auth/verify
 * Verifies a JWT token and returns the decoded user info.
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token is required', code: 400 });
      return;
    }

    const decoded = verifyToken(token);

    res.json({
      data: {
        valid: true,
        user: decoded,
      },
    });
  } catch {
    res.json({
      data: {
        valid: false,
        user: null,
      },
    });
  }
});

export default router;
