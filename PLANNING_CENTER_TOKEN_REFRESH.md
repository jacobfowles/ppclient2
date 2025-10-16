# Planning Center Automatic Token Refresh

## Problem
Planning Center OAuth tokens expire after 2 hours. Previously, users had to manually reconnect every time the token expired, which was a poor user experience.

## Solution
Automatic token refresh using refresh tokens. Once a church connects to Planning Center, the integration stays active indefinitely without requiring manual reconnection.

## How It Works

### 1. **Edge Function: `planning-center-refresh`**
   - Location: `supabase/functions/planning-center-refresh/index.ts`
   - Uses the stored `refresh_token` to get a new `access_token`
   - Updates the database with new tokens
   - Handles expired refresh tokens by clearing the connection

### 2. **Helper Utility: `planningCenterApi.ts`**
   - Location: `src/utils/planningCenterApi.ts`
   - Provides wrapper functions for Planning Center API calls
   - Automatically checks if token is expired before each request
   - Refreshes token if needed (within 5 minutes of expiration)
   - Retries failed requests with refreshed token

### 3. **Key Functions**

#### `getPlanningCenterAccessToken(churchId: number)`
- Gets the current access token
- Checks if it's expired or expiring soon (within 5 minutes)
- Automatically refreshes if needed
- Returns valid access token or throws error

#### `fetchPlanningCenterApi(churchId: number, endpoint: string, options?: RequestInit)`
- Wrapper for Planning Center API requests
- Automatically includes authentication
- Handles 401 responses by refreshing token and retrying
- Example usage:
  ```typescript
  const response = await fetchPlanningCenterApi(
    churchId,
    '/people/v2/people',
    { method: 'GET' }
  );
  ```

#### `needsPlanningCenterReconnect(churchId: number)`
- Checks if Planning Center needs to be reconnected
- Returns `true` if refresh token is invalid/expired
- Use this to show "Reconnect" UI

## Implementation Steps

### Step 1: Deploy Edge Function
```bash
# In Supabase Dashboard:
# Edge Functions → Create new function
# Name: planning-center-refresh
# Paste code from supabase/functions/planning-center-refresh/index.ts
# Deploy
```

### Step 2: Add Environment Variables
Make sure these are set in Supabase Edge Function secrets:
- `PLANNING_CENTER_CLIENT_ID`
- `PLANNING_CENTER_CLIENT_SECRET`

### Step 3: Update Existing Code
Replace direct Planning Center API calls with the helper function:

**Before:**
```typescript
const response = await fetch(
  `https://api.planningcenteronline.com/people/v2/people`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  }
);
```

**After:**
```typescript
import { fetchPlanningCenterApi } from '@/utils/planningCenterApi';

const response = await fetchPlanningCenterApi(
  churchId,
  '/people/v2/people'
);
```

## Files Changed

### New Files:
1. `supabase/functions/planning-center-refresh/index.ts` - Token refresh Edge Function
2. `src/utils/planningCenterApi.ts` - Helper utilities

### Files to Update:
These files make Planning Center API calls and should be updated to use the new helper:
- `src/components/Teams/PlanningCenterTeamsTab.tsx`
- `src/pages/PeopleMatching.tsx`
- `src/pages/Dashboard.tsx`
- Any other files making Planning Center API requests

## Token Lifecycle

```
┌─────────────────────────────────────────────────┐
│ User connects Planning Center                    │
│ - Gets access_token (expires in 2 hours)        │
│ - Gets refresh_token (long-lived)               │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ App makes Planning Center API call              │
│ - Checks if token expired (or expiring soon)    │
└─────────────────────────────────────────────────┘
                    │
            ┌───────┴───────┐
            │               │
         Valid          Expired/Soon
            │               │
            ▼               ▼
    ┌─────────────┐  ┌──────────────────┐
    │ Use current │  │ Call refresh     │
    │ token       │  │ Edge Function    │
    └─────────────┘  └──────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ Get new tokens   │
                     │ Update database  │
                     └──────────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │ Use new token    │
                     └──────────────────┘
```

## Error Handling

### Scenario 1: Refresh Token is Valid
- Automatic refresh happens silently
- User never notices
- Connection stays active

### Scenario 2: Refresh Token is Invalid/Expired
- Edge Function detects invalid refresh token
- Clears all Planning Center data from database
- Returns `needs_reconnect: true`
- UI should show "Reconnect Planning Center" button

### Scenario 3: Network Error
- Request fails, error is logged
- User can retry or reconnect manually

## Benefits

✅ **No manual reconnection needed** - Tokens refresh automatically
✅ **Seamless user experience** - Users don't notice token expiration
✅ **Proactive refresh** - Refreshes 5 minutes before expiration
✅ **Retry logic** - Handles race conditions where token expires mid-request
✅ **Graceful degradation** - If refresh fails, prompts for reconnection
✅ **Single source of truth** - All Planning Center API calls go through one helper

## Testing

1. **Test automatic refresh:**
   - Connect Planning Center
   - Wait 2 hours (or manually set `planning_center_token_expires_at` to a past date in database)
   - Try to sync teams or load Planning Center data
   - Should work automatically without reconnecting

2. **Test invalid refresh token:**
   - Connect Planning Center
   - Revoke access in Planning Center dashboard
   - Try to use Planning Center features
   - Should show "Reconnect" message

3. **Test token expiring soon:**
   - Set `planning_center_token_expires_at` to 3 minutes from now
   - Make a Planning Center API call
   - Token should refresh proactively
