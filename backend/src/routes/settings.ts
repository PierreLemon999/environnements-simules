import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import crypto from 'crypto';

const router = Router();

// In-memory encrypted storage for API key (in production, use a secrets manager)
let encryptedApiKey: string | null = null;
let apiKeyPreview: string | null = null;

// Use a derived key from JWT_SECRET for encrypting the API key at rest
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.JWT_SECRET || 'dev-secret-change-in-production')
  .digest();

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function maskKey(key: string): string {
  if (!key || key.length < 10) return '••••••••';
  return key.slice(0, 7) + '••••••••••••' + key.slice(-4);
}

// Check if API key from env is available on startup
const envApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
if (envApiKey) {
  encryptedApiKey = encrypt(envApiKey);
  apiKeyPreview = maskKey(envApiKey);
}

/**
 * GET /settings/api-key-status
 * Returns whether an API key is configured and a masked preview.
 */
router.get('/api-key-status', authenticate, requireRole('admin'), (_req: Request, res: Response) => {
  res.json({
    data: {
      configured: encryptedApiKey !== null,
      preview: apiKeyPreview || '',
    },
  });
});

/**
 * POST /settings/api-key
 * Stores a new API key (encrypted in memory).
 */
router.post('/api-key', authenticate, requireRole('admin'), (req: Request, res: Response) => {
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    res.status(400).json({ error: 'Clé API requise', code: 400 });
    return;
  }

  const trimmed = apiKey.trim();
  encryptedApiKey = encrypt(trimmed);
  apiKeyPreview = maskKey(trimmed);

  res.json({
    data: {
      configured: true,
      preview: apiKeyPreview,
    },
  });
});

export default router;
