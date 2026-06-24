import { sql } from '@vercel/postgres';
import crypto from 'crypto';

// Shared database utility functions

// Simple secure password hashing using Node's native crypto
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export { sql };
