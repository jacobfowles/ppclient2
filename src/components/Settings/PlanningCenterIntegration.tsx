import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckCircle, AlertTriangle, ExternalLink, Unlink, Loader2, Shield, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface PlanningCenterCredentials {
  client_id?: string;
  connected_at?: string;
  app_id?: string;
  token_expires_at?: string;
  access_token?: string;
  refresh_token?: string;
}

export const PlanningCenterIntegration: React.FC = () => {
  const { churchId } = useAuth();
  const [credentials, setCredentials] = useState<PlanningCenterCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPlanningCenterStatus = useCallback(async () => {
    try {
      setLoading(true);
      // Session is already initialized by Settings page using useChurchSession

      const { data: churchData, error } = await supabase
        .from('churches')
        .select('planning_center_client_id, planning_center_connected_at, planning_center_app_id, planning_center_token_expires_at, planning_center_access_token, planning_center_refresh_token')
        .eq('id', churchId)
        .single();

      if (error) throw error;

      setCredentials({
        client_id: churchData?.planning_center_client_id,
        connected_at: churchData?.planning_center_connected_at,
        app_id: churchData?.planning_center_app_id,
        token_expires_at: churchData?.planning_center_token_expires_at,
        access_token: churchData?.planning_center_access_token,
        refresh_token: churchData?.planning_center_refresh_token
      });
    } catch (error) {
      console.error('Error loading Planning Center status:', error);
      setError('Failed to load Planning Center integration status');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    if (churchId) {
      loadPlanningCenterStatus();
    }
  }, [churchId, loadPlanningCenterStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    setSuccess(null);

    try {
      const clientId = import.meta.env.VITE_PLANNING_CENTER_CLIENT_ID;

      if (!clientId) {
        throw new Error('Planning Center Client ID not configured. Please contact support.');
      }

      // Build redirect URI - handle Bolt hosting and other environments
      let baseUri;

      // Check if we're on Bolt hosting or other specific environments
      const currentOrigin = window.location.origin;

      if (currentOrigin.includes('bolt.host')) {
        // For Bolt hosting, use the full origin
        baseUri = `${currentOrigin}/settings/planning-center/callback`;
      } else {
        // For other environments (localhost, custom domains)
        baseUri = `${currentOrigin}/settings/planning-center/callback`;
      }

      const redirectUri = encodeURIComponent(baseUri);
      const scope = encodeURIComponent('people services');
      const state = encodeURIComponent(`church_${churchId}_${Date.now()}`);

      // OAuth 2.0 Authorization URL
      const authUrl = `https://api.planningcenteronline.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${redirectUri}&` +
        `response_type=code&` +
        `scope=${scope}&` +
        `state=${state}`;

      // Store the state in sessionStorage for validation on return
      sessionStorage.setItem('pc_oauth_state', state);

      // Redirect to Planning Center OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating Planning Center connection:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to Planning Center');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    setSuccess(null);

    try {
      // Session is already initialized by Settings page using useChurchSession

      const { error } = await supabase
        .from('churches')
        .update({
          planning_center_client_id: null,
          planning_center_client_secret: null,
          planning_center_access_token: null,
          planning_center_refresh_token: null,
          planning_center_token_expires_at: null,
          planning_center_connected_at: null,
          planning_center_app_id: null
        })
        .eq('id', churchId);

      if (error) throw error;

      setCredentials(null);
      setSuccess('Successfully disconnected from Planning Center');

      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error('Error disconnecting from Planning Center:', error);
      setError('Failed to disconnect from Planning Center');
    } finally {
      setDisconnecting(false);
    }
  };

  // Show as connected if we have either access token or refresh token (refresh token allows automatic renewal)
  const isConnected = credentials?.client_id && credentials?.connected_at && credentials?.refresh_token;

  // Check if token will expire soon (within 5 minutes)
  const tokenExpiresSoon = credentials?.token_expires_at &&
    new Date(credentials.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000);

  const isTokenExpired = credentials?.token_expires_at && new Date(credentials.token_expires_at) < new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-accent-500" />
        <span className="ml-2 text-gray-600">Loading Planning Center integration status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Connection Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              isConnected ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Calendar className={`h-6 w-6 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Planning Center Online
              </h3>
              <p className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isConnected && (
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                tokenExpiresSoon && !isTokenExpired ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              }`}>
                {tokenExpiresSoon && !isTokenExpired ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Auto-Refreshing
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end items-center">
          <div className="text-sm text-gray-600">
            {!isConnected && (
              'Connect your Planning Center account to sync teams and people data'
            )}
          </div>

          <div className="flex space-x-3">
            {isConnected ? (
              <>
                {isTokenExpired && (
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-accent-600 bg-white border border-accent-300 rounded-lg hover:bg-accent-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {connecting ? 'Reconnecting...' : 'Reconnect'}
                  </button>
                )}
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {connecting ? 'Connecting...' : 'Connect to Planning Center'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Integration Features - Only show when not connected */}
      {!isConnected && (
        <>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-3">What You'll Get</h4>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-accent-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h5 className="font-medium text-gray-900">Team & Service Import</h5>
                  <p className="text-sm text-gray-600">
                    Import your existing Planning Center teams, service types, and ministry areas
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-accent-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h5 className="font-medium text-gray-900">People & Service Matching</h5>
                  <p className="text-sm text-gray-600">
                    Match assessment results with your Planning Center people and their service assignments
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-accent-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <h5 className="font-medium text-gray-900">Service Roster Sync</h5>
                  <p className="text-sm text-gray-600">
                    Keep service rosters and team assignments synchronized between both platforms
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Administrator Requirements Notice - Only show when not connected */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h4 className="font-medium text-amber-900">Administrator Permissions Required</h4>
            </div>
            <p className="text-sm text-amber-800 mb-2">
              To connect Planning Center, you must be logged in as a user with <strong>administrator permissions</strong> for both:
            </p>
            <ul className="text-sm text-amber-800 space-y-1 ml-4">
              <li>• <strong>Planning Center People</strong> - Admin or Editor role required</li>
              <li>• <strong>Planning Center Services</strong> - Admin or Editor role required</li>
            </ul>
            <p className="text-sm text-amber-800 mt-2">
              Regular volunteers or staff members cannot authorize the connection. Only Organization Administrators or users with admin permissions for both products can complete the OAuth authorization.
            </p>
          </div>
        </>
      )}

    </div>
  );
};