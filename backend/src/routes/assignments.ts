import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { demoAssignments, versions, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logRouteError } from '../services/error-logger.js';

const router = Router();

/**
 * Generates a human-readable password (8 chars, alphanumeric).
 */
function generatePassword(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Generates a unique access token.
 */
function generateAccessToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * GET /versions/:versionId/assignments
 * List all demo assignments for a version.
 */
router.get(
  '/versions/:versionId/assignments',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const version = await db
        .select()
        .from(versions)
        .where(eq(versions.id, req.params.versionId))
        .get();

      if (!version) {
        res.status(404).json({ error: 'Version not found', code: 404 });
        return;
      }

      const assignments = await db
        .select()
        .from(demoAssignments)
        .where(eq(demoAssignments.versionId, req.params.versionId))
        .all();

      // Enrich with user info
      const enriched = await Promise.all(
        assignments.map(async (assignment) => {
          const user = await db
            .select({ id: users.id, name: users.name, email: users.email, company: users.company })
            .from(users)
            .where(eq(users.id, assignment.userId))
            .get();

          return {
            ...assignment,
            passwordHash: undefined, // Never expose password hash
            user,
          };
        })
      );

      res.json({ data: enriched });
    } catch (error) {
      logRouteError(req, error, 'Error listing assignments');
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * POST /versions/:versionId/assignments
 * Create a demo assignment. Generates access_token + password.
 * If the user does not exist, creates a client user.
 */
router.post(
  '/versions/:versionId/assignments',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const version = await db
        .select()
        .from(versions)
        .where(eq(versions.id, req.params.versionId))
        .get();

      if (!version) {
        res.status(404).json({ error: 'Version not found', code: 404 });
        return;
      }

      const { userId, email, name, company, expiresInDays } = req.body;
      let targetUserId = userId;

      // If no userId provided, look up or create a client user by email
      if (!targetUserId) {
        if (!email || !name) {
          res.status(400).json({
            error: 'Either userId or email+name are required',
            code: 400,
          });
          return;
        }

        let user = await db.select().from(users).where(eq(users.email, email)).get();
        if (!user) {
          user = {
            id: uuidv4(),
            name,
            email,
            passwordHash: null,
            role: 'client',
            company: company || null,
            avatarUrl: null,
            googleId: null,
            language: 'fr',
            createdAt: new Date().toISOString(),
          };
          await db.insert(users).values(user);
        } else if (company && !user.company) {
          // Update company if not already set
          await db.update(users).set({ company }).where(eq(users.id, user.id));
        }
        targetUserId = user.id;
      }

      // Generate credentials
      const plainPassword = generatePassword();
      const accessToken = generateAccessToken();
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      // Default expiration: 2 years
      const expirationDays = expiresInDays || 730;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const assignment = {
        id: uuidv4(),
        versionId: req.params.versionId,
        userId: targetUserId,
        accessToken,
        passwordHash,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      };

      await db.insert(demoAssignments).values(assignment);

      // Return the assignment with the plain password (only time it's visible)
      res.status(201).json({
        data: {
          id: assignment.id,
          versionId: assignment.versionId,
          userId: assignment.userId,
          accessToken: assignment.accessToken,
          password: plainPassword, // Only returned at creation time
          expiresAt: assignment.expiresAt,
          createdAt: assignment.createdAt,
        },
      });
    } catch (error) {
      logRouteError(req, error, 'Error creating assignment');
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

/**
 * DELETE /assignments/:id
 * Remove a demo assignment.
 */
router.delete(
  '/assignments/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const assignment = await db
        .select()
        .from(demoAssignments)
        .where(eq(demoAssignments.id, req.params.id))
        .get();

      if (!assignment) {
        res.status(404).json({ error: 'Assignment not found', code: 404 });
        return;
      }

      await db.delete(demoAssignments).where(eq(demoAssignments.id, req.params.id));

      res.json({ data: { deleted: true, id: req.params.id } });
    } catch (error) {
      logRouteError(req, error, 'Error deleting assignment');
      res.status(500).json({ error: 'Internal server error', code: 500 });
    }
  }
);

export default router;
