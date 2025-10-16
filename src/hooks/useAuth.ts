import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser, getSession, signOut as authSignOut } from '../utils/supabaseAuth';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    getSession().then(({ user }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const churchId = session.user.user_metadata?.church_id;
        if (churchId) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            churchId: churchId,
            role: session.user.user_metadata?.role || 'user',
            firstName: session.user.user_metadata?.first_name,
            lastName: session.user.user_metadata?.last_name,
            displayName: session.user.user_metadata?.display_name,
            forcePasswordChange: session.user.user_metadata?.force_password_change || false,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await authSignOut();
    setUser(null);
  };

  return {
    user,
    churchId: user?.churchId || null,
    isAdmin: user?.role === 'admin',
    isUser: user?.role === 'user',
    forcePasswordChange: user?.forcePasswordChange || false,
    loading,
    signOut
  };
}
