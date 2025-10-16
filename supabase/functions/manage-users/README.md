# Manage Users Edge Function

This Supabase Edge Function handles user management operations for the church dashboard, including creating, deleting, listing users, and resetting passwords.

## Features

- **Create User**: Creates a new Supabase Auth user with church metadata
- **Delete User**: Removes a user (with last admin protection)
- **List Users**: Returns all users for a specific church
- **Reset Password**: Updates a user's password and forces password change on next login

## Security

- Requires authenticated admin user
- Validates church_id matches requesting user's church
- Prevents deletion of last administrator
- Uses service_role key server-side only

## Deployment

### Prerequisites

1. Install Supabase CLI: `npm install -g supabase`
2. Login to Supabase: `supabase login`
3. Link to your project: `supabase link --project-ref YOUR_PROJECT_REF`

### Deploy the Function

```bash
supabase functions deploy manage-users
```

### Set Environment Variables

The function requires these environment variables (automatically set by Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (has admin privileges)
- `SUPABASE_ANON_KEY` - Anon key for client verification

## API Reference

### Create User

```json
{
  "action": "create",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "church_id": 123
}
```

Response:
```json
{
  "success": true,
  "user": { ... },
  "temporary_password": "randomly-generated-password",
  "message": "User created successfully..."
}
```

### Delete User

```json
{
  "action": "delete",
  "user_id": "uuid-here",
  "church_id": 123
}
```

### List Users

```json
{
  "action": "list",
  "church_id": 123
}
```

### Reset Password

```json
{
  "action": "reset_password",
  "user_id": "uuid-here",
  "new_password": "newPassword123",
  "church_id": 123
}
```

## Testing

You can test the function locally using:

```bash
supabase functions serve manage-users
```

Then make requests to `http://localhost:54321/functions/v1/manage-users`

## Notes

- Temporary passwords are returned in the response (in production, send via email)
- All users are created with `force_password_change: true`
- Default role for new users is 'user' (not admin)
