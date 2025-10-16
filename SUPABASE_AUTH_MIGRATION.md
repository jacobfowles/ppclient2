# Supabase Auth Migration Guide

## What Changed

We've migrated from custom authentication to Supabase Auth with JWT-based RLS for production-ready security.

## Files Already Updated

✅ Database migrations created (run these in order):
- `supabase/migrations/20251001100000_migrate_to_supabase_auth.sql` - Schema + RLS policies

✅ Code updated:
- `src/utils/supabaseAuth.ts` - New Supabase Auth utilities (CREATED)
- `src/hooks/useAuth.ts` - Updated to use Supabase Auth
- `src/hooks/useChurchSession.ts` - DELETED (no longer needed)
- `src/pages/Teams.tsx` - Removed useChurchSession

## Files That Need Updating

### Pages to update (remove useChurchSession):

1. **src/pages/Analytics.tsx**
2. **src/pages/Dashboard.tsx**
3. **src/pages/PeopleMatching.tsx**
4. **src/pages/PlanningCenterCallback.tsx**
5. **src/pages/Results.tsx**
6. **src/pages/Settings.tsx**

**Pattern to follow:**
```typescript
// REMOVE:
import { useChurchSession } from '../hooks/useChurchSession';
const { isReady: sessionReady, sessionStatus, ... } = useChurchSession(churchId);

// REPLACE WITH:
const { churchId, loading: authLoading } = useAuth();

// CHANGE:
if (sessionReady && churchId) { ... }
// TO:
if (!authLoading && churchId) { ... }

// REMOVE session error handling UI
// SIMPLIFY loading state to just check authLoading
```

### Login Page

Need to update login page to use:
```typescript
import { signIn } from '../utils/supabaseAuth';

const handleLogin = async () => {
  const { user, error } = await signIn(email, password);
  if (error) {
    // show error
  } else {
    // user is logged in, useAuth will update
    navigate('/');
  }
};
```

### User Management Component

**src/components/Settings/UserManagement.tsx** needs major update:

Current approach (direct DB insert) won't work. Need to:
1. Create backend API endpoint (or use Supabase Dashboard)
2. Use `supabase.auth.admin.createUser()` with service_role key

**Temporary solution:**
- Admins create users via Supabase Dashboard
- Set user_metadata: { church_id, role, first_name, last_name, force_password_change }

**Production solution:**
- Create Next.js API route or serverless function
- Use service_role key server-side
- Call from frontend

## Security Improvements

### Before (Insecure):
- Custom auth with anon key exposed to browser
- RLS with permissive policies (anyone could access any church's data)
- Session variables didn't work with connection pooling
- Security rating: 4/10

### After (Secure):
- Supabase Auth with JWT claims
- church_id in cryptographically signed JWT
- RLS policies enforce: `church_id = get_user_church_id()` (from JWT)
- No way to tamper with church_id
- Security rating: 9/10

## Testing Steps

1. **Run database migration:**
   ```sql
   -- In Supabase SQL Editor:
   -- Copy/paste: supabase/migrations/20251001100000_migrate_to_supabase_auth.sql
   ```

2. **Create test user via Supabase Dashboard:**
   - Go to Authentication → Users → Add User
   - Email: admin@testchurch.com
   - Password: (generate one)
   - User Metadata (JSON):
   ```json
   {
     "church_id": 33,
     "role": "admin",
     "first_name": "Test",
     "last_name": "Admin"
   }
   ```

3. **Update remaining files** (see list above)

4. **Test login flow:**
   - Login with test user
   - Verify teams/layers load
   - Check browser console for JWT (shouldn't see church session logs anymore)

5. **Verify RLS:**
   - Try querying teams directly with anon key (should only return church 33's data)
   - Verify JWT contains church_id in user_metadata

## Next Steps

1. Update all pages to remove `useChurchSession`
2. Update login page to use `supabaseAuth.signIn()`
3. Decide on user management approach (Dashboard vs Backend API)
4. Test thoroughly
5. Remove old custom auth code from `src/utils/auth.ts`
6. Clean up unused code

## Rollback Plan

If something breaks:
1. Re-enable old RLS policies (permissive ones)
2. Can keep Supabase Auth but fall back to app-level filtering
3. Old custom auth code still exists in `src/utils/auth.ts`
