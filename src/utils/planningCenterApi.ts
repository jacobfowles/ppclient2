import { supabase } from '../lib/supabase';

interface PlanningCenterTokens {
  access_token: string;
  token_expires_at: string;
  refresh_token: string;
}

/**
 * Get Planning Center access token, automatically refreshing if expired
 */
export async function getPlanningCenterAccessToken(churchId: number): Promise<string | null> {
  try {
    // Get current tokens from database
    const { data: church, error } = await supabase
      .from('churches')
      .select('planning_center_access_token, planning_center_token_expires_at, planning_center_refresh_token')
      .eq('id', churchId)
      .single();

    if (error || !church) {
      console.error('Failed to get church Planning Center credentials');
      return null;
    }

    if (!church.planning_center_access_token) {
      console.error('No Planning Center access token found');
      return null;
    }

    // Check if token is expired or will expire in the next 5 minutes
    const expiresAt = new Date(church.planning_center_token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt > fiveMinutesFromNow) {
      // Token is still valid
      return church.planning_center_access_token;
    }

    // Token is expired or about to expire - refresh it
    console.log('Planning Center token expired or expiring soon, refreshing...');

    const { data: refreshData, error: refreshError } = await supabase.functions.invoke('planning-center-refresh', {
      body: { church_id: churchId }
    });

    if (refreshError || !refreshData?.success) {
      console.error('Failed to refresh Planning Center token:', refreshError || refreshData?.error);

      // If needs reconnect, return null so UI can show reconnect message
      if (refreshData?.needs_reconnect) {
        throw new Error('NEEDS_RECONNECT');
      }

      return null;
    }

    console.log('Planning Center token refreshed successfully');
    return refreshData.access_token;

  } catch (error) {
    console.error('Error getting Planning Center access token:', error);
    throw error;
  }
}

/**
 * Make an authenticated request to Planning Center API with automatic token refresh
 */
export async function fetchPlanningCenterApi(
  churchId: number,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const accessToken = await getPlanningCenterAccessToken(churchId);

    if (!accessToken) {
      throw new Error('No valid Planning Center access token available');
    }

    // Make the API request with the access token
    const response = await fetch(`https://api.planningcenteronline.com${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // If we get a 401, the token might have expired between our check and the request
    // Try refreshing one more time
    if (response.status === 401) {
      console.log('Got 401 from Planning Center, attempting token refresh...');

      const { data: refreshData, error: refreshError } = await supabase.functions.invoke('planning-center-refresh', {
        body: { church_id: churchId }
      });

      if (refreshError || !refreshData?.success) {
        throw new Error('Failed to refresh expired token');
      }

      // Retry the request with the new token
      return await fetch(`https://api.planningcenteronline.com${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${refreshData.access_token}`,
          'Content-Type': 'application/json',
        },
      });
    }

    return response;

  } catch (error) {
    console.error('Planning Center API request failed:', error);
    throw error;
  }
}

/**
 * Check if Planning Center needs to be reconnected
 */
export async function needsPlanningCenterReconnect(churchId: number): Promise<boolean> {
  try {
    await getPlanningCenterAccessToken(churchId);
    return false;
  } catch (error) {
    if (error instanceof Error && error.message === 'NEEDS_RECONNECT') {
      return true;
    }
    return false;
  }
}
