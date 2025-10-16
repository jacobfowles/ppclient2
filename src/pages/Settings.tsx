import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, Building2, CreditCard, Calendar, Users, Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { UserManagement } from '../components/Settings/UserManagement';
import { PlanningCenterIntegration } from '../components/Settings/PlanningCenterIntegration';
import { changePassword, getCSRFToken } from '../utils/auth';

interface ChurchData {
  id: number;
  name: string;
  plan: string;
  contact_email?: string;
  contact_phone?: string;
  multi_site: boolean;
  created_at: string;
  planning_center_client_id?: string;
  planning_center_connected_at?: string;
  planning_center_app_id?: string;
  planning_center_token_expires_at?: string;
}

export const Settings: React.FC = () => {
  const { churchId, isAdmin, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [church, setChurch] = useState<ChurchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Form states
  const [churchName, setChurchName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && churchId) {
      const loadChurchData = async () => {
        try {
          setLoading(true);

          const { data: churchData, error } = await supabase
            .from('churches')
            .select('*')
            .eq('id', churchId)
            .single();

          if (error) throw error;

          setChurch(churchData);
          setChurchName(churchData.name || '');
          setContactEmail(churchData.contact_email || '');
          setContactPhone(churchData.contact_phone || '');
        } catch {
          console.error('Error loading church data');
        } finally {
          setLoading(false);
        }
      };

      loadChurchData();
    }
  }, [authLoading, churchId]);

  // Handle URL tab parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && isAdmin && ['profile', 'password', 'users', 'billing', 'planning-center'].includes(tab)) {
      setActiveTab(tab);
    } else if (tab && !isAdmin && ['profile', 'password'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, isAdmin]);

  const handleSaveProfile = async () => {
    if (!isAdmin) {
      alert('Only administrators can modify church settings.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('churches')
        .update({
          name: churchName,
          contact_email: contactEmail,
          contact_phone: contactPhone
        })
        .eq('id', churchId);

      if (error) throw error;

      alert('Church profile updated successfully!');
      // Reload church data after saving
      if (churchId) {
        try {
          setLoading(true);

          const { data: churchData, error } = await supabase
            .from('churches')
            .select('*')
            .eq('id', churchId)
            .single();

          if (error) throw error;

          setChurch(churchData);
          setChurchName(churchData.name || '');
          setContactEmail(churchData.contact_email || '');
          setContactPhone(churchData.contact_phone || '');
        } catch {
          console.error('Error loading church data');
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error saving church profile:', error);
      alert('Unable to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    // Get CSRF token
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
      setPasswordError('Security token missing. Please refresh the page.');
      return;
    }

    try {
      setChangingPassword(true);

      const { success, error } = await changePassword(
        currentPassword,
        newPassword,
        csrfToken
      );

      if (success) {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setPasswordSuccess(false);
        }, 5000);
      } else {
        setPasswordError(error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('An unexpected error occurred. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const getPasswordStrengthColor = (password: string) => {
    if (password.length < 8) return 'bg-red-200';
    if (password.length < 12) return 'bg-yellow-200';
    return 'bg-green-200';
  };

  const getPasswordStrengthText = (password: string) => {
    if (password.length < 8) return 'Weak';
    if (password.length < 12) return 'Medium';
    return 'Strong';
  };

  const allTabs = [
    { id: 'profile', name: 'Church Profile', icon: Building2 },
    { id: 'password', name: 'My Password', icon: Lock },
    { id: 'users', name: 'Users', icon: Users },
    { id: 'billing', name: 'Billing & Subscription', icon: CreditCard },
    { id: 'planning-center', name: 'Planning Center Integration', icon: Calendar }
  ];

  // Filter tabs based on user role
  const tabs = isAdmin ? allTabs : allTabs.filter(tab => ['profile', 'password'].includes(tab.id));

  // Redirect staff users to profile tab if they try to access restricted tabs
  useEffect(() => {
    if (!isAdmin && !['profile', 'password'].includes(activeTab)) {
      setActiveTab('profile');
    }
  }, [isAdmin, activeTab]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-accent-500 text-accent-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {activeTab === 'profile' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Church Information</h3>
              <p className="text-gray-600">
                {isAdmin 
                  ? 'Basic information about your church'
                  : 'View your church information'
                }
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Church Name *
                </label>
                <input
                  type="text"
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="Enter church name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="contact@church.org"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving || !churchName.trim()}
                  className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            {!isAdmin && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Only administrators can modify church settings. Contact your church administrator to make changes.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'password' && (
          <div className="space-y-8">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Change My Password</h3>
              <p className="text-gray-600">Update your account password</p>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-6">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-800">{passwordError}</p>
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-800">Password changed successfully!</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-full rounded-full ${getPasswordStrengthColor(newPassword)}`}></div>
                      <span className="text-xs text-gray-500">{getPasswordStrengthText(newPassword)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent"
                    placeholder="Confirm new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {changingPassword ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <div className="space-y-8">
            <UserManagement churchPlan={church?.plan || 'basic'} />
          </div>
        )}

        {activeTab === 'billing' && isAdmin && (
          <div className="space-y-8">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Billing & Subscription</h3>
              <p className="text-gray-600">Manage your subscription plan and billing information</p>
            </div>

            {/* Current Plan */}
            <div className="bg-gradient-to-r from-accent-50 to-accent-100 rounded-lg p-6 border border-accent-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold text-accent-900 capitalize">{church?.plan || 'Basic'} Plan</h4>
                  <p className="text-accent-700">
                    {church?.plan === 'plus' ? 'Multi-site support with SMS delivery' : 'Perfect for single-site churches'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-accent-900">
                    ${church?.plan === 'plus' ? '44.99' : '34.99'}
                  </div>
                  <div className="text-sm text-accent-700">per month</div>
                </div>
              </div>
            </div>

            {/* Plan Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Current Plan Features</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                    <span>Unlimited assessments</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                    <span>Branded email address</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                    <span>Analytics dashboard</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                    <span>Up to 10 dashboard users</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                    <span>{church?.plan === 'plus' ? 'Single or multi-site support' : 'Single site only'}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                    <span>{church?.plan === 'plus' ? 'Email & SMS result delivery' : 'Email result delivery only'}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-500 rounded-full"></div>
                    <span>Email support</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Billing Information</h4>
                <div className="space-y-3 text-sm">
                  <div className="text-center py-4">
                    <p className="text-gray-500 font-medium">Stripe Integration Coming Soon</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Billing information will be managed through Stripe
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Billing History */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Billing & Invoices</h4>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-accent-200 rounded-xl p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Stripe Integration Coming Soon
                </h3>
                <p className="text-gray-600 mb-4">
                  We're building secure payment processing and billing management with Stripe.
                </p>
                <div className="text-sm text-gray-500">
                  Features coming soon: automated billing, invoice history, payment method management, and subscription updates.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
              <button className="px-6 py-3 text-sm font-medium text-accent-600 bg-white border border-accent-300 rounded-lg hover:bg-accent-50 transition-colors">
                Contact Support for Plan Changes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'planning-center' && isAdmin && (
          <div className="space-y-8">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">Planning Center Integration</h3>
              <p className="text-gray-600">Connect with Planning Center to sync your team data</p>
            </div>

            <PlanningCenterIntegration />
          </div>
        )}
      </div>
    </div>
  );
};