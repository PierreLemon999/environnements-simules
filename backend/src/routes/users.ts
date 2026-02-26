import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();

/**
 * GET /users
 * List all users.
 */
router.get('/', authenticate, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const allUsers = await db.select().from(users).all();

    // Never expose password hashes
    const sanitized = allUsers.map((user) => ({
      ...user,
      passwordHash: undefined,
    }));

    res.json({ data: sanitized });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * POST /users
 * Create a new user.
 */
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, language, company } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required', code: 400 });
      return;
    }

    // Check email uniqueness
    const existing = await db.select().from(users).where(eq(users.email, email)).get();
    if (existing) {
      res.status(409).json({ error: 'Email already in use', code: 409 });
      return;
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const user = {
      id: uuidv4(),
      name,
      email,
      passwordHash,
      role: role || 'client',
      company: company || null,
      avatarUrl: null,
      googleId: null,
      language: language || 'fr',
      createdAt: new Date().toISOString(),
    };

    await db.insert(users).values(user);

    res.status(201).json({
      data: {
        ...user,
        passwordHash: undefined,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * GET /users/:id
 * Get user detail.
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.id))
      .get();

    if (!user) {
      res.status(404).json({ error: 'User not found', code: 404 });
      return;
    }

    res.json({
      data: {
        ...user,
        passwordHash: undefined,
      },
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error', code: 500 });
  }
});

/**
 * PUT /users/:id
 * Update a user.
 */
router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, req.params.id))
        .get();

      if (!user) {
        res.status(404).json({ error: 'User not found', code: 404 });
        return;
      }

      const { name, email, password, role, language, avatarUrl, company } = req.body;

      // Check email uniqueness if changing
      if (email && email !== user.email) {
        const existing = await db.select().from(users).where(eq(users.email, email)).get();
        if (existing) {
          res.status(409).json({ error: 'Email already in use', code: 409 });
          return;
        }
      }

      const updated: Record<string, unknown> = {};
      if (name !== undefined) updated.name = name;
      if (email !== undefined) updated.email = email;
      if (role !== undefined) updated.role = role;
      if (language !== undefined) updated.language = language;
      if (avatarUrl !== undefined) updated.avatarUrl = avatarUrl;
      if (company !== undefined) updated.company = company;
      if (password) updated.passwordHash = await bcrypt.hash(password, 10);

      await db.update(users).set(updated).where(eq(users.id, req.params.id));

      res.json({
        data: {
          ...user,
          ...updated,
          passwordHash: undefined,
        },
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * DELETE /users/:id
 * Delete a user.
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, req.params.id))
        .get();

      if (!user) {
        res.status(404).json({ error: 'User not found', code: 404 });
        return;
      }

      // Prevent deleting yourself
      if (req.user!.userId === req.params.id) {
        res.status(400).json({ error: 'Cannot delete your own account', code: 400 });
        return;
      }

      await db.delete(users).where(eq(users.id, req.params.id));

      res.json({ data: { deleted: true, id: req.params.id } });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

export default router;
