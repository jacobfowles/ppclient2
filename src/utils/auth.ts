import { supabase } from '../lib/supabase';
import bcrypt from 'bcryptjs';

// Rate limiting configuration
const RATE_LIMITS = {
  LOGIN_ATTEMPTS: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  LOGIN_LOCKOUT: { baseMs: 15 * 60 * 1000, maxMs: 2 * 60 * 60 * 1000 }, // 15 min to 2 hours
} as const;

// Rate limiting storage keys
const RATE_LIMIT_KEYS = {
  LOGIN_ATTEMPTS: 'rate_limit_login_attempts',
  LOGIN_LOCKOUT: 'rate_limit_login_lockout',
} as const;

interface RateLimitEntry {
  count: number;
  resetTime: number;
  violations: number; // Track repeated violations for exponential backoff
}

interface LoginLockout {
  lockedUntil: number;
  violations: number;
}

// Enhanced rate limiting with localStorage persistence
const getRateLimitData = (key: string): Record<string, RateLimitEntry> => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return {};
    
    const data = JSON.parse(stored);
    const now = Date.now();
    
    // Clean up expired entries
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, entry]: [string, any]) => 
        entry.resetTime > now
      )
    );
    
    // Save cleaned data back
    if (Object.keys(cleaned).length !== Object.keys(data).length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error reading rate limit data:', error);
    return {};
  }
};

const setRateLimitData = (key: string, data: Record<string, RateLimitEntry>): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error storing rate limit data:', error);
  }
};

const getLoginLockoutData = (): Record<string, LoginLockout> => {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEYS.LOGIN_LOCKOUT);
    if (!stored) return {};
    
    const data = JSON.parse(stored);
    const now = Date.now();
    
    // Clean up expired lockouts
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, lockout]: [string, any]) => 
        lockout.lockedUntil > now
      )
    );
    
    // Save cleaned data back
    if (Object.keys(cleaned).length !== Object.keys(data).length) {
      localStorage.setItem(RATE_LIMIT_KEYS.LOGIN_LOCKOUT, JSON.stringify(cleaned));
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error reading lockout data:', error);
    return {};
  }
};

const setLoginLockoutData = (data: Record<string, LoginLockout>): void => {
  try {
    localStorage.setItem(RATE_LIMIT_KEYS.LOGIN_LOCKOUT, JSON.stringify(data));
  } catch (error) {
    console.error('Error storing lockout data:', error);
  }
};

// Check if email is currently locked out
const isEmailLockedOut = (email: string): { locked: boolean; remainingTime?: number } => {
  const lockouts = getLoginLockoutData();
  const lockout = lockouts[email];
  
  if (!lockout) return { locked: false };
  
  const now = Date.now();
  if (lockout.lockedUntil <= now) {
    // Lockout expired, clean it up
    delete lockouts[email];
    setLoginLockoutData(lockouts);
    return { locked: false };
  }
  
  return { 
    locked: true, 
    remainingTime: Math.ceil((lockout.lockedUntil - now) / 1000 / 60) // minutes
  };
};

// Check and update login attempt rate limiting
const checkLoginRateLimit = (email: string): { allowed: boolean; remainingTime?: number; attemptsLeft?: number } => {
  const rateLimitData = getRateLimitData(RATE_LIMIT_KEYS.LOGIN_ATTEMPTS);
  const now = Date.now();
  const limit = RATE_LIMITS.LOGIN_ATTEMPTS;
  
  const entry = rateLimitData[email];
  
  if (!entry || now > entry.resetTime) {
    // No existing entry or expired - allow and create new entry
    rateLimitData[email] = {
      count: 1,
      resetTime: now + limit.windowMs,
      violations: entry?.violations || 0
    };
    setRateLimitData(RATE_LIMIT_KEYS.LOGIN_ATTEMPTS, rateLimitData);
    return { allowed: true, attemptsLeft: limit.max - 1 };
  }
  
  if (entry.count >= limit.max) {
    const remainingTime = Math.ceil((entry.resetTime - now) / 1000 / 60); // minutes
    return { allowed: false, remainingTime };
  }
  
  // Increment count
  entry.count++;
  setRateLimitData(RATE_LIMIT_KEYS.LOGIN_ATTEMPTS, rateLimitData);
  
  return { allowed: true, attemptsLeft: limit.max - entry.count };
};

// Handle failed login attempt - may trigger lockout
const handleFailedLogin = (email: string): void => {
  const rateLimitData = getRateLimitData(RATE_LIMIT_KEYS.LOGIN_ATTEMPTS);
  const entry = rateLimitData[email];
  
  if (entry && entry.count >= RATE_LIMITS.LOGIN_ATTEMPTS.max) {
    // Trigger lockout with exponential backoff
    const lockouts = getLoginLockoutData();
    const existingLockout = lockouts[email];
    const violations = (existingLockout?.violations || 0) + 1;
    
    // Exponential backoff: base time * 2^(violations-1), capped at max
    const lockoutDuration = Math.min(
      RATE_LIMITS.LOGIN_LOCKOUT.baseMs * Math.pow(2, violations - 1),
      RATE_LIMITS.LOGIN_LOCKOUT.maxMs
    );
    
    lockouts[email] = {
      lockedUntil: Date.now() + lockoutDuration,
      violations
    };
    
    setLoginLockoutData(lockouts);
    
    // Update rate limit entry to track violations
    if (entry) {
      entry.violations = violations;
      setRateLimitData(RATE_LIMIT_KEYS.LOGIN_ATTEMPTS, rateLimitData);
    }
  }
};

// Clear successful login attempts (reset on successful auth)
const clearLoginAttempts = (email: string): void => {
  const rateLimitData = getRateLimitData(RATE_LIMIT_KEYS.LOGIN_ATTEMPTS);
  const lockouts = getLoginLockoutData();
  
  delete rateLimitData[email];
  delete lockouts[email];
  
  setRateLimitData(RATE_LIMIT_KEYS.LOGIN_ATTEMPTS, rateLimitData);
  setLoginLockoutData(lockouts);
};

// Input validation functions
const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

const validatePasswordLength = (password: string): boolean => {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8 && password.length <= 128;
};

const validateName = (name: string): boolean => {
  if (!name || typeof name !== 'string') return false;
  return name.length <= 100;
};

const validateChurchId = (churchId: any): boolean => {
  return Number.isInteger(churchId) && churchId > 0;
};

const sanitizeString = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input.trim().replace(/<[^>]*>/g, ''); // Remove HTML tags
};

const sanitizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim().replace(/<[^>]*>/g, '');
};

export interface User {
  id: string;
  email: string;
  church_id: number;
  role: string;
  first_name?: string;
  last_name?: string;
  force_password_change?: boolean;
}

export interface Session {
  user: User;
  expires_at: number;
  force_password_change?: boolean;
}

// Session storage key
const SESSION_STORAGE_KEY = 'auth_session';

// Salt rounds for bcrypt (12 is recommended for good security/performance balance)
const SALT_ROUNDS = 12;

// Password validation requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true
};

// Validate password strength
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }
  
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Hash password using bcrypt with proper salting
export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Password hashing failed:', error);
    throw new Error('Password hashing failed');
  }
}

// Verify password against bcrypt hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

// Sign in user with Supabase Auth
export async function signIn(email: string, password: string, csrfToken?: string): Promise<{ user: User | null; error: string | null }> {
  try {
    // Validate CSRF token for additional security
    if (csrfToken && !validateCSRFToken(csrfToken)) {
      return { user: null, error: 'Invalid security token. Please refresh the page.' };
    }

    // Server-side input validation
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return { user: null, error: 'Invalid input: Email and password are required' };
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = password.trim();

    // Validate email format and length
    if (!validateEmail(sanitizedEmail)) {
      return { user: null, error: 'Invalid email format or email too long' };
    }

    // Validate password requirements
    if (!validatePasswordLength(sanitizedPassword)) {
      return { user: null, error: 'Password must be between 8 and 128 characters' };
    }

    // Additional security: Check for suspicious patterns
    const suspiciousPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /<script/i,
      /javascript:/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(sanitizedEmail) || pattern.test(sanitizedPassword))) {
      return { user: null, error: 'Invalid input detected' };
    }

    // Check if email is locked out
    const lockoutCheck = isEmailLockedOut(sanitizedEmail);
    if (lockoutCheck.locked) {
      return {
        user: null,
        error: `Account temporarily locked due to too many failed attempts. Try again in ${lockoutCheck.remainingTime} minutes.`
      };
    }

    // Check rate limiting for login attempts
    const rateLimitCheck = checkLoginRateLimit(sanitizedEmail);
    if (!rateLimitCheck.allowed) {
      return { user: null, error: `Too many login attempts. Try again in ${rateLimitCheck.remainingTime} minutes.` };
    }

    // Use Supabase Auth for authentication
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password: sanitizedPassword
    });

    if (authError || !authData.user) {
      handleFailedLogin(sanitizedEmail);
      return { user: null, error: 'Invalid email or password' };
    }

    // Get user metadata from auth.users
    const churchId = authData.user.user_metadata?.church_id;
    const role = authData.user.user_metadata?.role;
    const firstName = authData.user.user_metadata?.first_name;
    const lastName = authData.user.user_metadata?.last_name;
    const forcePasswordChange = authData.user.user_metadata?.force_password_change;

    // Validate church_id from metadata
    if (!validateChurchId(churchId)) {
      handleFailedLogin(sanitizedEmail);
      await supabase.auth.signOut();
      return { user: null, error: 'Invalid church association' };
    }

    // Validate role
    if (!['admin', 'user'].includes(role)) {
      handleFailedLogin(sanitizedEmail);
      await supabase.auth.signOut();
      return { user: null, error: 'Invalid user role' };
    }

    // Sanitize user data before creating session
    const sanitizedFirstName = firstName ? sanitizeString(firstName) : undefined;
    const sanitizedLastName = lastName ? sanitizeString(lastName) : undefined;

    // Create user object (excluding sensitive data)
    const user: User = {
      id: authData.user.id,
      email: sanitizedEmail,
      church_id: churchId,
      role: role,
      first_name: sanitizedFirstName,
      last_name: sanitizedLastName,
      force_password_change: forcePasswordChange
    };

    // Validate user object before creating session
    if (!user.id || !user.email || !validateChurchId(user.church_id) || !user.role) {
      handleFailedLogin(sanitizedEmail);
      await supabase.auth.signOut();
      return { user: null, error: 'Invalid user data' };
    }

    // Create session
    const session: Session = {
      user,
      expires_at: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      force_password_change: forcePasswordChange
    };

    // Store session
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (storageError) {
      console.error('Failed to store session');
      return { user: null, error: 'Failed to create session' };
    }

    // Clear failed attempts on successful login
    clearLoginAttempts(sanitizedEmail);

    return { user, error: null };
  } catch (error) {
    // Log error without sensitive data
    console.error('Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
    return { user: null, error: 'Authentication failed' };
  }
}

// Sign out user
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  localStorage.removeItem(SESSION_STORAGE_KEY);
  window.location.reload();
}

// Get current session
export function getSession(): Session | null {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;

    const session: Session = JSON.parse(stored);
    
    if (session.expires_at <= Date.now()) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Error reading session');
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

// Get current user
export function getCurrentUser(): User | null {
  const session = getSession();
  return session?.user || null;
}

// Check if user is admin
export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

// CSRF Protection Functions

// Generate CSRF token
export const generateCSRFToken = (): string => {
  return crypto.randomUUID();
};

// Store CSRF token
export const setCSRFToken = (token: string): void => {
  try {
    sessionStorage.setItem('csrf_token', token);
  } catch (error) {
    console.error('Failed to store CSRF token');
  }
};

// Get CSRF token
export const getCSRFToken = (): string | null => {
  try {
    return sessionStorage.getItem('csrf_token');
  } catch (error) {
    console.error('Failed to retrieve CSRF token');
    return null;
  }
};

// Validate CSRF token
export const validateCSRFToken = (token: string): boolean => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  const storedToken = getCSRFToken();
  return storedToken === token && token !== null && storedToken !== null;
};

// Initialize CSRF token for new sessions
export const initializeCSRFToken = (): string => {
  let token = getCSRFToken();
  if (!token) {
    token = generateCSRFToken();
    setCSRFToken(token);
  }
  return token;
}

// Change user password - Uses Supabase Auth
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  csrfToken?: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Validate CSRF token
    if (csrfToken && !validateCSRFToken(csrfToken)) {
      return { success: false, error: 'Invalid security token. Please refresh the page.' };
    }

    // Get current user
    const user = getCurrentUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Validate inputs
    const sanitizedNewPassword = newPassword.trim();

    if (!validatePasswordLength(sanitizedNewPassword)) {
      return { success: false, error: 'Password must be between 8 and 128 characters' };
    }

    // Validate new password strength
    const passwordValidation = validatePassword(sanitizedNewPassword);
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.errors.join('. ') };
    }

    // Use Supabase Auth to update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: sanitizedNewPassword
    });

    if (updateError) {
      return { success: false, error: updateError.message || 'Failed to update password' };
    }

    // Update user metadata to clear force_password_change flag
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { force_password_change: false }
    });

    if (metadataError) {
      console.error('Failed to update force_password_change flag:', metadataError);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Password change failed:', error instanceof Error ? error.message : 'Unknown error');
    return { success: false, error: 'Password change failed' };
  }
}

// Admin reset user password - Now handled by Edge Function
// This function is deprecated and should use the manage-users Edge Function instead
export async function resetUserPassword(
  targetUserId: string,
  temporaryPassword: string,
  csrfToken?: string
): Promise<{ success: boolean; error: string | null }> {
  console.warn('resetUserPassword is deprecated. Use manage-users Edge Function instead.');
  return {
    success: false,
    error: 'Password reset is now handled by the manage-users Edge Function. Please use UserManagement component.'
  };
}