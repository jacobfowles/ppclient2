import { supabase } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  churchId: number;
  role: 'admin' | 'user';
  firstName?: string;
  lastName?: string;
  displayName?: string;
  forcePasswordChange?: boolean;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: 'No user data returned' };
    }

    // Get church_id from user metadata
    const churchId = data.user.user_metadata?.church_id;
    if (!churchId) {
      await supabase.auth.signOut();
      return { user: null, error: 'User is not associated with a church' };
    }

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email!,
      churchId: churchId,
      role: data.user.user_metadata?.role || 'user',
      firstName: data.user.user_metadata?.first_name,
      lastName: data.user.user_metadata?.last_name,
      displayName: data.user.user_metadata?.display_name,
      forcePasswordChange: data.user.user_metadata?.force_password_change || false,
    };

    return { user: authUser, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { user: null, error: 'An unexpected error occurred' };
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error: 'An unexpected error occurred' };
  }
}

/**
 * Get current session
 */
export async function getSession(): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.session?.user) {
      return { user: null, error: null };
    }

    const user = data.session.user;
    const churchId = user.user_metadata?.church_id;

    if (!churchId) {
      return { user: null, error: 'User is not associated with a church' };
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email!,
      churchId: churchId,
      role: user.user_metadata?.role || 'user',
      firstName: user.user_metadata?.first_name,
      lastName: user.user_metadata?.last_name,
      displayName: user.user_metadata?.display_name,
      forcePasswordChange: user.user_metadata?.force_password_change || false,
    };

    return { user: authUser, error: null };
  } catch (error) {
    console.error('Get session error:', error);
    return { user: null, error: 'An unexpected error occurred' };
  }
}

/**
 * Update user password
 */
export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error: error.message };
    }

    // Clear force_password_change flag
    await supabase.auth.updateUser({
      data: { force_password_change: false },
    });

    return { error: null };
  } catch (error) {
    console.error('Update password error:', error);
    return { error: 'An unexpected error occurred' };
  }
}

/**
 * Request password reset email
 */
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Reset password error:', error);
    return { error: 'An unexpected error occurred' };
  }
}

/**
 * Create a new user (admin only)
 * NOTE: This requires service_role key, should be done via backend API in production
 */
export async function createUser(data: {
  email: string;
  password: string;
  churchId: number;
  role: 'admin' | 'user';
  firstName?: string;
  lastName?: string;
  forcePasswordChange?: boolean;
}): Promise<{ user: any | null; error: string | null }> {
  try {
    // This would normally be done via a backend API endpoint
    // For now, users will need to be created via Supabase Dashboard or backend
    console.warn('createUser should be implemented via backend API with service_role key');

    return {
      user: null,
      error: 'User creation must be done via backend API or Supabase Dashboard'
    };
  } catch (error) {
    console.error('Create user error:', error);
    return { user: null, error: 'An unexpected error occurred' };
  }
}
