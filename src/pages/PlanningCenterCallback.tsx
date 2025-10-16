import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getSession } from '../utils/auth';

export const PlanningCenterCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { churchId, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Planning Center authentication...');

  useEffect(() => {
    if (!authLoading && churchId) {
      handleOAuthCallback();
    }
  }, [authLoading, churchId, searchParams]);

  const handleOAuthCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth errors
      if (error) {
        throw new Error(errorDescription || `OAuth error: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received from Planning Center');
      }

      // Validate state parameter
      const storedState = sessionStorage.getItem('pc_oauth_state');
      if (!state || state !== storedState) {
        throw new Error('Invalid OAuth state parameter. Possible security issue.');
      }

      // Clean up stored state
      sessionStorage.removeItem('pc_oauth_state');

      // Extract church ID from state
      const stateMatch = state.match(/^church_(\d+)_\d+$/);
      if (!stateMatch || parseInt(stateMatch[1]) !== churchId) {
        throw new Error('OAuth state does not match current church');
      }

      setMessage('Exchanging authorization code for access token...');

      // Exchange the authorization code for access tokens
      await exchangeCodeForToken(code);

      setStatus('success');
      setMessage('Successfully connected to Planning Center!');

      // Trigger a page refresh to update the sidebar
      // Alternative: dispatch a custom event that the sidebar can listen to
      window.dispatchEvent(new CustomEvent('planning-center-connected'));

      // Redirect to settings after a brief delay
      setTimeout(() => {
        navigate('/settings?tab=planning-center');
      }, 2000);
    } catch (error) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const exchangeCodeForToken = async (code: string) => {
    // Build redirect URI consistently with the auth component
    const currentOrigin = window.location.origin;
    const redirectUri = `${currentOrigin}/settings/planning-center/callback`;

    // Get the user's session from custom auth system
    const session = getSession();
    if (!session || !session.user) {
      throw new Error('Authentication required');
    }

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('planning-center-oauth', {
      body: {
        code: code,
        state: searchParams.get('state'),
        redirect_uri: redirectUri,
        user_id: session.user.id,
        church_id: session.user.church_id,
      },
    });

    if (error) {
      throw new Error(error.message || 'Token exchange failed');
    }

    if (!data.success) {
      throw new Error(data.message || 'Token exchange failed');
    }

    // Success - credentials are now securely stored via Edge Function
    return data;
  };

  const handleRetry = () => {
    navigate('/settings?tab=planning-center');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-accent-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connecting to Planning Center
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connection Successful!
            </h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirecting you to settings...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={handleRetry}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 transition-colors"
            >
              Return to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
};