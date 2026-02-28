import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/index.js';
import { users, demoAssignments } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { signToken, verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const router = Router();

/**
 * POST /auth/login
 * Authenticate with email + password. Returns JWT with user info.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Adresse e-mail et mot de passe requis', code: 400 });
      return;
    }

    const user = await db.select().from(users).where(eq(users.email, email)).get();

    if (!user) {
      res.status(401).json({ error: 'Identifiants invalides', code: 401 });
      return;
    }

    // Admins cannot log in with email/password (Google SSO only)
    if (user.role === 'admin') {
      res.status(401).json({ error: 'Les comptes administrateurs doivent utiliser Google SSO', code: 401 });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: 'Identifiants invalides', code: 401 });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Identifiants invalides', code: 401 });
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
    res.status(500).json({ error: 'Erreur interne du serveur', code: 500 });
  }
});

/**
 * POST /auth/google
 * Authenticate with Google id_token. Auto-provisions admin if @lemonlearning.com.
 *
 * Production: expects { idToken } — verified server-side via google-auth-library.
 * Dev mode:   accepts { devBypass: true, email, name, googleId } — skips verification.
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken, devBypass } = req.body;

    let email: string;
    let name: string;
    let googleId: string;
    let avatarUrl: string | null = null;

    if (devBypass === true && process.env.NODE_ENV !== 'production') {
      // Dev bypass — trust provided fields
      if (!req.body.email || !req.body.googleId) {
        res.status(400).json({ error: 'Email et googleId requis pour le dev bypass', code: 400 });
        return;
      }
      email = req.body.email;
      name = req.body.name || email.split('@')[0];
      googleId = req.body.googleId;
      avatarUrl = req.body.avatarUrl || null;
    } else {
      // Production — verify Google id_token
      if (!idToken) {
        res.status(400).json({ error: 'Token Google requis', code: 400 });
        return;
      }

      if (!GOOGLE_CLIENT_ID) {
        res.status(500).json({ error: 'GOOGLE_CLIENT_ID non configuré sur le serveur', code: 500 });
        return;
      }

      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          res.status(401).json({ error: 'Token Google invalide', code: 401 });
          return;
        }

        email = payload.email;
        name = payload.name || email.split('@')[0];
        googleId = payload.sub;
        avatarUrl = payload.picture || null;
      } catch (err) {
        console.error('Google token verification failed:', err);
        res.status(401).json({ error: 'Token Google invalide ou expiré', code: 401 });
        return;
      }
    }

    // Check if user already exists (by googleId first, then by email)
    let user = await db.select().from(users).where(eq(users.googleId, googleId)).get();
    if (!user) {
      user = await db.select().from(users).where(eq(users.email, email)).get() ?? null;
    }

    if (user) {
      // Update avatar, name, and googleId on each login
      const updates: Record<string, string> = {};
      if (avatarUrl && avatarUrl !== user.avatarUrl) updates.avatarUrl = avatarUrl;
      if (name && name !== user.name) updates.name = name;
      if (googleId && googleId !== user.googleId) updates.googleId = googleId;
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, user.id));
        user = { ...user, ...updates };
      }
    } else {
      // Auto-provision admin if allowed SSO domain
      const ssoDomains = ['lemonlearning.com', 'lemonlearning.fr', 'goldfuchs-software.de'];
      const isAllowedDomain = ssoDomains.some(d => email.endsWith(`@${d}`));

      if (!isAllowedDomain) {
        res.status(403).json({
          error: 'Seuls les comptes @lemonlearning.com, @lemonlearning.fr et @goldfuchs-software.de peuvent se connecter avec Google',
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
        avatarUrl,
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
    res.status(500).json({ error: 'Erreur interne du serveur', code: 500 });
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
      res.status(400).json({ error: 'Token d\'accès et mot de passe requis', code: 400 });
      return;
    }

    const assignment = await db
      .select()
      .from(demoAssignments)
      .where(eq(demoAssignments.accessToken, accessToken))
      .get();

    if (!assignment) {
      res.status(401).json({ error: 'Token d\'accès invalide', code: 401 });
      return;
    }

    // Check expiration
    if (new Date(assignment.expiresAt) < new Date()) {
      res.status(401).json({ error: 'Le token d\'accès a expiré', code: 401 });
      return;
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, assignment.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Mot de passe invalide', code: 401 });
      return;
    }

    // Get the user
    const user = await db.select().from(users).where(eq(users.id, assignment.userId)).get();
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable', code: 404 });
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
    res.status(500).json({ error: 'Erreur interne du serveur', code: 500 });
  }
});

/**
 * POST /auth/verify
 * Verifies a JWT token and returns the decoded user info.
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token, extensionVersion } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token requis', code: 400 });
      return;
    }

    const decoded = verifyToken(token);

    // Fetch full user from DB to include avatarUrl and extensionVersion
    const fullUser = await db.select().from(users).where(eq(users.id, decoded.userId)).get();

    // Update extension version if reported
    if (extensionVersion && fullUser && extensionVersion !== fullUser.extensionVersion) {
      await db.update(users).set({ extensionVersion }).where(eq(users.id, decoded.userId));
    }

    const minExtensionVersion = process.env.MIN_EXTENSION_VERSION || '0.0.0';

    res.json({
      data: {
        valid: true,
        user: {
          ...decoded,
          avatarUrl: fullUser?.avatarUrl ?? null,
          extensionVersion: extensionVersion ?? fullUser?.extensionVersion ?? null,
        },
        minExtensionVersion,
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
