# User Management Update Summary

## What Changed

The user management system has been migrated from the old `church_users` table to Supabase Auth with a secure Edge Function backend.

## New Architecture

### Before (Old System)
- Users stored in `church_users` table
- Direct database queries from client
- Custom password hashing in client
- CSRF tokens for security

### After (New System)
- Users in Supabase Auth (`auth.users`)
- Edge Function with service_role key for admin operations
- Built-in Supabase Auth security
- Church metadata stored in JWT user_metadata

## Files Modified

### Frontend
1. **src/components/Settings/UserManagement.tsx**
   - Removed CSRF token logic
   - Updated to call Edge Function instead of direct DB queries
   - Now uses `supabase.functions.invoke('manage-users', ...)`

2. **src/lib/supabase.ts**
   - Updated `canAddUser()` to query Supabase Auth users
   - Filters by church_id in user_metadata

### Backend
3. **supabase/functions/manage-users/index.ts** (NEW)
   - Handles create, delete, list, reset_password actions
   - Verifies requesting user is admin
   - Enforces church-level data isolation
   - Prevents deletion of last admin

### Database
4. **supabase/migrations/20251001110000_cleanup_old_auth.sql**
   - Dropped `church_users` table
   - Removed old RPC functions

## Deployment Steps

1. **Deploy the Edge Function:**
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy manage-users
   ```

2. **Push code changes to your repo:**
   - All modified files listed above
   - Migration file
   - Edge Function files

3. **Test the functionality:**
   - Login as admin
   - Go to Settings → Users
   - Try creating a new user
   - Try resetting a password
   - Try deleting a user

## User Workflow

### Creating a User
1. Admin clicks "Invite User" in Settings → Users
2. Fills in email, first name, last name
3. Edge Function creates user with random temp password
4. Admin receives temp password in alert (share with user securely)
5. User logs in with temp password
6. User is forced to change password on first login

### Resetting Password
1. Admin clicks reset password icon next to user
2. Sets temporary password (min 8 characters)
3. Edge Function updates password and sets force_password_change flag
4. Admin shares new password with user securely
5. User must change password on next login

### Deleting User
1. Admin clicks delete icon next to user
2. Confirms deletion
3. Edge Function verifies not last admin
4. User is removed from Supabase Auth

## Security Improvements

✅ Service role key never exposed to client
✅ All admin operations verified server-side
✅ Church-level data isolation enforced
✅ Cannot delete last administrator
✅ Cannot manage users from other churches
✅ JWT-based authentication (no custom tokens)

## Testing Checklist

- [ ] Deploy Edge Function to Supabase
- [ ] Login as admin user
- [ ] Create a new test user
- [ ] Verify temp password is shown
- [ ] Login as new user with temp password
- [ ] Verify forced password change works
- [ ] Reset password for test user
- [ ] Delete test user
- [ ] Verify last admin cannot be deleted

## Rollback Plan

If issues occur:
1. Edge Function can be undeployed via Supabase dashboard
2. UserManagement.tsx changes can be reverted
3. The old `church_users` table is gone - would need to recreate from backup

## Future Enhancements

- Email delivery for temp passwords (instead of showing in alert)
- Welcome email template
- Password strength requirements
- Role management (promote user to admin)
- Audit log for user management actions
