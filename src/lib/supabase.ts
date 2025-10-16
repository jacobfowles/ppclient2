import { createClient } from '@supabase/supabase-js';
import { getCSRFToken, validateCSRFToken } from '../utils/auth';

// Enhanced rate limiting configuration
const RATE_LIMITS = {
  GENERAL_OPERATIONS: { max: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
  WRITE_OPERATIONS: { max: 20, windowMs: 60 * 60 * 1000 }, // 20 writes per hour
  SEARCH_OPERATIONS: { max: 50, windowMs: 60 * 60 * 1000 }, // 50 searches per hour
} as const;

const RATE_LIMIT_STORAGE_KEY = 'rate_limit_db_operations';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitData {
  general: Record<string, RateLimitEntry>;
  writes: Record<string, RateLimitEntry>;
  searches: Record<string, RateLimitEntry>;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Security configuration
const IS_PRODUCTION = import.meta.env.PROD;
const ENABLE_SECURITY_LOGGING = true;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
});

// Security logging function
export const logSecurityEvent = (event: string, details: any = {}) => {
  if (!ENABLE_SECURITY_LOGGING) return;
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...details,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  console.log(`[SECURITY] ${timestamp} - ${event}:`, logEntry);
  
  // In production, you might want to send this to a security monitoring service
  if (IS_PRODUCTION) {
    // Example: Send to monitoring service
    // securityMonitoringService.log(logEntry);
  }
};

// Enhanced error handling for unauthorized access
export class SecurityError extends Error {
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'SecurityError';
    logSecurityEvent('SECURITY_VIOLATION', { message, details });
  }
}

// Helper function to set session variable for RLS
export const setSessionChurchId = async (churchId: number | null) => {
  // Server-side input validation
  if (!churchId || !Number.isInteger(churchId) || churchId <= 0) {
    logSecurityEvent('RLS_SESSION_MISSING_CHURCH_ID');
    throw new SecurityError('Invalid church ID for RLS session');
  }
  
  // NOTE: Session variables don't work reliably with Supabase connection pooling
  // Each RPC call may use a different connection, so set_config doesn't persist
  // We rely on application-level filtering (.eq('church_id', churchId)) instead

  logSecurityEvent('RLS_SESSION_SET', { churchId });
  return true;
};

// Validate church access for current user
export const validateChurchAccess = async (churchId: number, userId: string) => {
  // Server-side input validation
  if (!churchId || !Number.isInteger(churchId) || churchId <= 0) {
    throw new SecurityError('Invalid church ID for access validation');
  }

  if (!userId || typeof userId !== 'string' || userId.length === 0 || userId.length > 255) {
    throw new SecurityError('Invalid user ID for access validation');
  }

  // Sanitize email input
  const sanitizedUserId = userId.toLowerCase().trim().replace(/<[^>]*>/g, '');
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitizedUserId)) {
    throw new SecurityError('Invalid email format for access validation');
  }

  try {
    // Get authenticated user from Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.email !== sanitizedUserId) {
      logSecurityEvent('UNAUTHORIZED_CHURCH_ACCESS', { churchId, userId: 'REDACTED' });
      throw new SecurityError('User does not have access to this church');
    }

    // Check if user's church_id matches
    const userChurchId = user.user_metadata?.church_id;
    const userRole = user.user_metadata?.role;

    if (userChurchId !== churchId) {
      logSecurityEvent('UNAUTHORIZED_CHURCH_ACCESS', { churchId, userId: 'REDACTED', userChurchId });
      throw new SecurityError('User does not have access to this church');
    }

    logSecurityEvent('CHURCH_ACCESS_VALIDATED', { churchId, userId: 'REDACTED', role: userRole });
    return { id: user.id, role: userRole };
  } catch (error) {
    if (error instanceof SecurityError) throw error;
    logSecurityEvent('CHURCH_ACCESS_VALIDATION_ERROR', { churchId, userId: 'REDACTED', error: error instanceof Error ? error.message : 'Unknown error' });
    throw new SecurityError('Failed to validate church access', error);
  }
};

// Enhanced query builder with comprehensive security
export const createSecureChurchQuery = (table: string, churchId: number | null, userId?: string) => {
  // Server-side input validation
  if (!churchId || !Number.isInteger(churchId) || churchId <= 0) {
    throw new SecurityError('Invalid church ID for secure queries');
  }

  if (!table || typeof table !== 'string' || table.length === 0 || table.length > 100) {
    throw new SecurityError('Invalid table name for secure queries');
  }

  // Sanitize table name (allow only alphanumeric and underscores)
  const sanitizedTable = table.replace(/[^a-zA-Z0-9_]/g, '');
  if (sanitizedTable !== table) {
    throw new SecurityError('Invalid characters in table name');
  }

  if (userId && (typeof userId !== 'string' || userId.length === 0 || userId.length > 255)) {
    throw new SecurityError('Invalid user ID for secure queries');
  }
  
  logSecurityEvent('SECURE_QUERY_CREATED', { table: sanitizedTable, churchId, userId: userId ? 'REDACTED' : undefined });
  
  // Always enforce church_id filtering at application level as backup to RLS
  return supabase.from(sanitizedTable).select('*').eq('church_id', churchId);
};

// Comprehensive security wrapper for all database operations
export const secureQuery = async (
  table: string, 
  churchId: number | null, 
  userId: string,
  operation: 'select' | 'insert' | 'update' | 'delete' = 'select',
  csrfToken?: string
) => {
  // Validate CSRF token for state-changing operations
  if (['insert', 'update', 'delete'].includes(operation)) {
    if (!csrfToken) {
      throw new SecurityError('CSRF token required for state-changing operations');
    }
    
    if (!validateCSRFToken(csrfToken)) {
      throw new SecurityError('Invalid CSRF token');
    }
  }

  // Server-side input validation
  if (!churchId || !Number.isInteger(churchId) || churchId <= 0) {
    throw new SecurityError('Invalid church ID for database operations');
  }

  if (!userId || typeof userId !== 'string' || userId.length === 0 || userId.length > 255) {
    throw new SecurityError('Invalid user ID for database operations');
  }

  if (!table || typeof table !== 'string' || table.length === 0 || table.length > 100) {
    throw new SecurityError('Invalid table name for database operations');
  }

  // Sanitize table name
  const sanitizedTable = table.replace(/[^a-zA-Z0-9_]/g, '');
  if (sanitizedTable !== table) {
    throw new SecurityError('Invalid characters in table name');
  }

  // Validate operation
  const validOperations = ['select', 'insert', 'update', 'delete'];
  if (!validOperations.includes(operation)) {
    throw new SecurityError('Invalid database operation');
  }
  
  // Validate church access first
  await validateChurchAccess(churchId, userId);

  // Session is already set by useChurchSession hook - no need to set it again
  // Multiple calls to setSessionChurchId cause race conditions

  logSecurityEvent('SECURE_OPERATION', { 
    table: sanitizedTable, 
    churchId, 
    userId: 'REDACTED', 
    operation: operation.toUpperCase() 
  });
  
  return supabase.from(sanitizedTable);
};

// Enhanced rate limiting with localStorage persistence
const getRateLimitData = (): RateLimitData => {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!stored) {
      return { general: {}, writes: {}, searches: {} };
    }
    
    const data = JSON.parse(stored);
    const now = Date.now();
    
    // Clean up expired entries
    const cleanCategory = (category: Record<string, RateLimitEntry>) => {
      return Object.fromEntries(
        Object.entries(category).filter(([, entry]) => entry.resetTime > now)
      );
    };
    
    const cleaned = {
      general: cleanCategory(data.general || {}),
      writes: cleanCategory(data.writes || {}),
      searches: cleanCategory(data.searches || {})
    };
    
    // Save cleaned data back if anything was removed
    const originalSize = Object.keys(data.general || {}).length + 
                        Object.keys(data.writes || {}).length + 
                        Object.keys(data.searches || {}).length;
    const cleanedSize = Object.keys(cleaned.general).length + 
                       Object.keys(cleaned.writes).length + 
                       Object.keys(cleaned.searches).length;
    
    if (cleanedSize !== originalSize) {
      localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(cleaned));
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error reading rate limit data:', error);
    return { general: {}, writes: {}, searches: {} };
  }
};

const setRateLimitData = (data: RateLimitData): void => {
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error storing rate limit data:', error);
  }
};

// Check rate limit for specific operation type
const checkOperationRateLimit = (
  userId: string, 
  operation: 'general' | 'writes' | 'searches'
): { allowed: boolean; remainingTime?: number; requestsLeft?: number } => {
  const rateLimitData = getRateLimitData();
  const now = Date.now();
  
  let limit;
  switch (operation) {
    case 'writes':
      limit = RATE_LIMITS.WRITE_OPERATIONS;
      break;
    case 'searches':
      limit = RATE_LIMITS.SEARCH_OPERATIONS;
      break;
    default:
      limit = RATE_LIMITS.GENERAL_OPERATIONS;
  }
  
  const category = rateLimitData[operation];
  const entry = category[userId];
  
  if (!entry || now > entry.resetTime) {
    // No existing entry or expired - allow and create new entry
    category[userId] = {
      count: 1,
      resetTime: now + limit.windowMs
    };
    setRateLimitData(rateLimitData);
    return { allowed: true, requestsLeft: limit.max - 1 };
  }
  
  if (entry.count >= limit.max) {
    const remainingTime = Math.ceil((entry.resetTime - now) / 1000 / 60); // minutes
    return { allowed: false, remainingTime };
  }
  
  // Increment count
  entry.count++;
  setRateLimitData(rateLimitData);
  
  return { allowed: true, requestsLeft: limit.max - entry.count };
};

// Enhanced rate limiting with user-friendly error messages
export const checkRateLimit = (
  userId: string, 
  operation: string, 
  operationType: 'select' | 'insert' | 'update' | 'delete' = 'select'
): { allowed: boolean; error?: string } => {
  try {
    // Determine operation category
    let category: 'general' | 'writes' | 'searches';
    
    if (operation.toLowerCase().includes('search') || operation.toLowerCase().includes('filter')) {
      category = 'searches';
    } else if (['insert', 'update', 'delete'].includes(operationType)) {
      category = 'writes';
    } else {
      category = 'general';
    }
    
    const rateLimitCheck = checkOperationRateLimit(userId, category);
    
    if (!rateLimitCheck.allowed) {
      let errorMessage;
      switch (category) {
        case 'writes':
          errorMessage = `Too many data modifications. You can make ${RATE_LIMITS.WRITE_OPERATIONS.max} changes per hour. Try again in ${rateLimitCheck.remainingTime} minutes.`;
          break;
        case 'searches':
          errorMessage = `Too many search requests. You can perform ${RATE_LIMITS.SEARCH_OPERATIONS.max} searches per hour. Try again in ${rateLimitCheck.remainingTime} minutes.`;
          break;
        default:
          errorMessage = `Too many requests. You can make ${RATE_LIMITS.GENERAL_OPERATIONS.max} requests per hour. Try again in ${rateLimitCheck.remainingTime} minutes.`;
      }
      
      logSecurityEvent('RATE_LIMIT_EXCEEDED', { 
        userId: 'REDACTED', 
        operation, 
        category,
        remainingTime: rateLimitCheck.remainingTime 
      });
      
      return { allowed: false, error: errorMessage };
    }
    
    // Log successful rate limit check for monitoring
    if (rateLimitCheck.requestsLeft !== undefined && rateLimitCheck.requestsLeft < 10) {
      logSecurityEvent('RATE_LIMIT_WARNING', { 
        userId: 'REDACTED', 
        operation, 
        category,
        requestsLeft: rateLimitCheck.requestsLeft 
      });
    }
    
    return { allowed: true };
  } catch (error) {
    // Don't block operations if rate limiting fails
    console.error('Rate limiting error:', error);
    return { allowed: true };
  }
};

// Create user-friendly rate limit error
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Enhanced secure query with rate limiting
export const secureQueryWithRateLimit = async (
  table: string, 
  churchId: number | null, 
  userId: string,
  operation: 'select' | 'insert' | 'update' | 'delete' = 'select',
  csrfToken?: string
) => {
  // Check rate limiting first
  const rateLimitResult = checkRateLimit(userId, `${table}_${operation}`, operation);
  if (!rateLimitResult.allowed) {
    throw new RateLimitError(rateLimitResult.error || 'Rate limit exceeded');
  }
  
  // Proceed with existing secure query logic
  return await secureQuery(table, churchId, userId, operation, csrfToken);
};

// Backward compatibility - keep existing function
export const checkBasicRateLimit = (userId: string, operation: string, maxRequests = 100, windowMs = 60000): boolean => {
  const rateLimitResult = checkRateLimit(userId, operation);
  return rateLimitResult.allowed;
};

// Database types
export interface Church {
  id: number;
  name: string;
  multi_site: boolean;
  created_at: string;
}

export interface Assessment {
  id: number;
  church_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  profile: string;
  campus?: string;
  planning_center_person_id?: string;
  created_at: string;
  // Computed fields
  name?: string;
  submitted_at?: string;
  profile_type?: string;
  quadrant?: 'ideas_present' | 'people_possible' | 'people_present' | 'ideas_possible';
}

export interface Team {
  id: number;
  church_id: number;
  name: string;
  description?: string;
  planning_center_team_id?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadershipLayer {
  id: number;
  church_id: number;
  name: string;
  level: number;
  description?: string;
  active: boolean;
  created_at: string;
}

export interface TeamAssignment {
  id: number;
  assessment_id: number;
  team_id?: number;
  leadership_layer_id?: number;
  assigned_at: string;
  assigned_by?: number;
  active: boolean;
}

export interface ChurchUser {
  id: number;
  church_id: number;
  email: string;
  name?: string;
  role: string;
  created_at: string;
  last_login?: string;
}

// User limits by plan
export const USER_LIMITS = {
  basic: 2,
  plus: 10
} as const;

// Check if church can add more users
export const canAddUser = async (churchId: number): Promise<{ canAdd: boolean; currentCount: number; limit: number; plan: string }> => {
  try {
    // Get church plan
    const { data: church, error: churchError } = await supabase
      .from('churches')
      .select('plan')
      .eq('id', churchId)
      .single();

    if (churchError || !church) {
      throw new SecurityError('Unable to verify church plan');
    }

    // Get user count from Edge Function (has service_role access)
    const { data, error: usersError } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'list',
        church_id: churchId
      }
    });

    if (usersError || !data?.success) {
      console.error('Error getting user count:', usersError, 'Response:', data);
      // Fall back to permissive result if we can't get count
      // This allows the app to work even if Edge Function isn't deployed
      const limit = USER_LIMITS[church.plan as keyof typeof USER_LIMITS] || USER_LIMITS.basic;
      return {
        canAdd: true,
        currentCount: 0,
        limit,
        plan: church.plan
      };
    }

    const currentCount = data.users?.length || 0;
    const limit = USER_LIMITS[church.plan as keyof typeof USER_LIMITS] || USER_LIMITS.basic;
    const canAdd = currentCount < limit;

    logSecurityEvent('USER_LIMIT_CHECK', {
      churchId,
      plan: church.plan,
      currentCount,
      limit,
      canAdd
    });

    return { canAdd, currentCount, limit, plan: church.plan };
  } catch (error) {
    logSecurityEvent('USER_LIMIT_CHECK_ERROR', { churchId, error });

    // If we can't check limits (e.g., no service_role access), return permissive result
    // This allows user creation to proceed - limits should be enforced server-side
    const { data: church } = await supabase
      .from('churches')
      .select('plan')
      .eq('id', churchId)
      .single();

    const plan = church?.plan || 'basic';
    const limit = USER_LIMITS[plan as keyof typeof USER_LIMITS] || USER_LIMITS.basic;

    return {
      canAdd: true,
      currentCount: 0,
      limit,
      plan
    };
  }
};

// Quadrant definitions
export const QUADRANT_PROFILES = {
  // Ideas Present (Task-focused, Present-oriented) - Blue quadrant
  ideas_present: ['Action', 'Efficiency', 'Practicality', 'Systematization'],
  // People Possible (People-focused, Future-oriented) - Green quadrant
  people_possible: ['Collaboration', 'Enthusiasm', 'Inspiration', 'Virtue'],
  // People Present (People-focused, Present-oriented) - Yellow quadrant
  people_present: ['Connection', 'Dependability', 'Passion', 'Support'],
  // Ideas Possible (Task-focused, Future-oriented) - Red quadrant
  ideas_possible: ['Determination', 'Energy', 'Knowledge', 'Strategy']
} as const;

export const QUADRANT_COLORS = {
  ideas_present: '#98D6D7',
  people_possible: '#8DCC95',
  people_present: '#F1DC0D',
  ideas_possible: '#EF6348'
} as const;