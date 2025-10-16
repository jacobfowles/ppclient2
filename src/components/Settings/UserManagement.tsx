import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Users, Crown, User, AlertCircle, Key, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, canAddUser, USER_LIMITS } from '../../lib/supabase';

interface ChurchUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  created_at: string;
  last_login?: string;
}

interface UserManagementProps {
  churchPlan: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ churchPlan }) => {
  const { churchId } = useAuth();
  const [users, setUsers] = useState<ChurchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    first_name: '',
    last_name: ''
  });
  const [inviting, setInviting] = useState(false);
  const [userLimitInfo, setUserLimitInfo] = useState<{
    currentCount: number;
    limit: number;
    canAdd: boolean;
  } | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState<ChurchUser | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [adminCount, setAdminCount] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');


  useEffect(() => {
    if (churchId) {
      loadUsers();
      checkUserLimits();
    }
  }, [churchId]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Call Edge Function to list users
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'list',
          church_id: churchId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setUsers(data.users || []);

      // Count administrators
      const adminUsers = (data.users || []).filter((user: ChurchUser) => user.role === 'admin');
      setAdminCount(adminUsers.length);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserLimits = async () => {
    try {
      const limitInfo = await canAddUser(churchId);
      setUserLimitInfo(limitInfo);
    } catch (error) {
      console.error('Error checking user limits:', error);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteFormData.email.trim() || !inviteFormData.first_name.trim() || !inviteFormData.last_name.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      setInviting(true);

      // Check limits again before adding
      const limitCheck = await canAddUser(churchId);
      if (!limitCheck.canAdd) {
        alert(`Cannot add more users. Your ${limitCheck.plan} plan allows ${limitCheck.limit} users and you currently have ${limitCheck.currentCount}.`);
        return;
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Call the manage-users Edge Function
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: inviteFormData.email.trim(),
          first_name: inviteFormData.first_name.trim(),
          last_name: inviteFormData.last_name.trim(),
          church_id: churchId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setShowInviteModal(false);
      setInviteFormData({ email: '', first_name: '', last_name: '' });
      loadUsers();
      checkUserLimits();

      // Show appropriate message based on whether email was sent
      if (data.email_sent) {
        alert(`User created successfully!\n\nA welcome email with login credentials has been sent to ${inviteFormData.email}.`);
      } else if (data.temporary_password) {
        alert(`User created successfully!\n\nEmail service was unavailable.\nTemporary Password: ${data.temporary_password}\n\nPlease share this password securely with the user. They will be required to change it on first login.`);
      } else {
        alert(`User created successfully! ${data.message}`);
      }
    } catch (error: any) {
      console.error('Error inviting user:', error);
      alert(`Error: ${error.message || 'Unable to invite user. Please try again.'}`);
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    // Find the user being deleted
    const userToDelete = users.find(u => u.id === userId);

    // Prevent deleting the last admin
    if (userToDelete?.role === 'admin' && adminCount === 1) {
      alert('Cannot remove the last administrator. Each church must have at least one administrator.');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${userEmail} from your church?`)) {
      return;
    }

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Call Edge Function to delete user
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          user_id: userId,
          church_id: churchId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      loadUsers();
      checkUserLimits();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert(`Error: ${error.message || 'Unable to remove user. Please try again.'}`);
    }
  };

  const getPasswordStrengthColor = (password: string) => {
    if (password.length < 8) return 'bg-red-400';
    if (password.length < 10) return 'bg-yellow-400';
    if (password.length < 12) return 'bg-blue-400';
    return 'bg-green-400';
  };

  const getPasswordStrengthText = (password: string) => {
    if (password.length < 8) return 'Weak';
    if (password.length < 10) return 'Fair';
    if (password.length < 12) return 'Good';
    return 'Strong';
  };

  const handlePasswordReset = (user: ChurchUser) => {
    setUserToReset(user);
    setTemporaryPassword('');
    setShowTemporaryPassword(false);
    setShowPasswordResetModal(true);
  };

  const handleSavePasswordReset = async () => {
    if (!userToReset || !temporaryPassword.trim() || temporaryPassword.length < 8) {
      return;
    }

    try {
      setResettingPassword(true);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Call Edge Function to reset password
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'reset_password',
          user_id: userToReset.id,
          new_password: temporaryPassword,
          church_id: churchId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setShowPasswordResetModal(false);
      setUserToReset(null);
      setTemporaryPassword('');

      alert(`Password reset successfully for ${userToReset.email}. They will be required to change it on their next login.`);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      alert(`Error: ${error.message || 'Unable to reset password. Please try again.'}`);
    } finally {
      setResettingPassword(false);
    }
  };

  const getRoleIcon = (role: string) => {
    return role === 'admin' ? Crown : User;
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'admin' 
      ? 'bg-accent-100 text-accent-800 border-accent-200' 
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-900">Dashboard Users</h4>
          <p className="text-sm text-gray-600">
            People who can log in and manage your church's assessment data
          </p>
        </div>
        
        {userLimitInfo && (
          <div className="text-right">
            <div className="text-sm text-gray-600">
              {userLimitInfo.currentCount} of {userLimitInfo.limit} users
            </div>
            <div className="text-xs text-gray-500 capitalize">
              {churchPlan} plan
            </div>
          </div>
        )}
      </div>

      {/* Plan Limits Info */}
      {userLimitInfo && (
        <div className={`p-4 rounded-lg border ${
          userLimitInfo.canAdd 
            ? 'bg-green-50 border-green-200' 
            : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-center space-x-2">
            {userLimitInfo.canAdd ? (
              <Users className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-orange-600" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                userLimitInfo.canAdd ? 'text-green-800' : 'text-orange-800'
              }`}>
                {userLimitInfo.canAdd 
                  ? `You can add ${userLimitInfo.limit - userLimitInfo.currentCount} more user${userLimitInfo.limit - userLimitInfo.currentCount !== 1 ? 's' : ''}`
                  : 'User limit reached'
                }
              </p>
              {!userLimitInfo.canAdd && (
                <p className="text-xs text-orange-600 mt-1">
                  Upgrade to Plus plan for up to {USER_LIMITS.plus} users
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No dashboard users yet</p>
            <p className="text-sm text-gray-400 mt-1">Invite your first dashboard user to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {users.map((user) => {
              const RoleIcon = getRoleIcon(user.role);
              const displayName = user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`
                : user.email;
              
              return (
                <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <RoleIcon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{displayName}</p>
                        {user.first_name && user.last_name && (
                          <p className="text-xs text-gray-500">{user.email}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                            {user.role === 'admin' ? 'Administrator' : 'User'}
                          </span>
                          <span className="text-xs text-gray-500">
                            Added {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {user.last_login && (
                        <span className="text-xs text-gray-500">
                          Last login: {new Date(user.last_login).toLocaleDateString()}
                        </span>
                      )}
                      <button
                        onClick={() => handlePasswordReset(user)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                        title="Reset Password"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={user.role === 'admin' && adminCount === 1}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                        title={user.role === 'admin' && adminCount === 1 ? "Cannot remove the last administrator" : "Remove User"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add User Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowInviteModal(true)}
          disabled={!userLimitInfo?.canAdd}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowInviteModal(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white px-6 py-6 text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Invite Dashboard User
                </h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={inviteFormData.first_name}
                      onChange={(e) => setInviteFormData({...inviteFormData, first_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={inviteFormData.last_name}
                      onChange={(e) => setInviteFormData({...inviteFormData, last_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={inviteFormData.email}
                    onChange={(e) => setInviteFormData({...inviteFormData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    placeholder="Enter email address"
                    required
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>New User Permissions:</strong> Users can view all assessment data, assign people to teams and leadership levels, and export reports. They cannot modify church settings, manage other users, or delete assessments.
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Role: User</p>
                      <p className="text-xs text-green-700">They will receive a welcome email with login instructions and a temporary password</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInviteUser}
                  disabled={inviting || !inviteFormData.email.trim() || !inviteFormData.first_name.trim() || !inviteFormData.last_name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {inviting ? 'Sending Invitation...' : 'Send Invitation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordResetModal && userToReset && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowPasswordResetModal(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white px-6 py-6 text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Key className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Reset Password
                    </h3>
                    <p className="text-sm text-gray-600">
                      {userToReset.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordResetModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>How it works:</strong> Set a temporary password below. The user will be required to change it on their next login.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temporary Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showTemporaryPassword ? 'text' : 'password'}
                      value={temporaryPassword}
                      onChange={(e) => setTemporaryPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                      placeholder="Enter temporary password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowTemporaryPassword(!showTemporaryPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showTemporaryPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {temporaryPassword && (
                    <div className="mt-2">
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(temporaryPassword)}`}
                            style={{ width: `${Math.min((temporaryPassword.length / 12) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium">
                          {getPasswordStrengthText(temporaryPassword)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Password must be at least 8 characters long
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Security Note:</strong> Share this temporary password securely with the user. They will be forced to change it immediately upon login.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowPasswordResetModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePasswordReset}
                  disabled={resettingPassword || !temporaryPassword.trim() || temporaryPassword.length < 8}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};