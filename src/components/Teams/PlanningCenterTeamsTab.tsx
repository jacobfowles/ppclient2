import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Users, AlertTriangle, CheckCircle, Loader2, Download, Upload } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { getSession } from '../../utils/auth';

interface PlanningCenterCredentials {
  client_id?: string;
  connected_at?: string;
  app_id?: string;
}

interface PlanningCenterTeam {
  id: string;
  name: string;
  sequence: number;
  service_type_id: string | null;
  service_type_name: string;
  already_imported: boolean;
}

interface PlanningCenterServiceType {
  id: string;
  name: string;
  sequence: number;
}

export const PlanningCenterTeamsTab: React.FC = () => {
  const { churchId } = useAuth();
  const [credentials, setCredentials] = useState<PlanningCenterCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchingTeams, setFetchingTeams] = useState(false);
  const [importingTeams, setImportingTeams] = useState(false);
  const [teams, setTeams] = useState<PlanningCenterTeam[]>([]);
  const [serviceTypes, setServiceTypes] = useState<PlanningCenterServiceType[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [showTeamsList, setShowTeamsList] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedServiceTypeFilter, setSelectedServiceTypeFilter] = useState<string>('all');

  const loadPlanningCenterStatus = useCallback(async () => {
    try {
      setLoading(true);
      // Session is already initialized by Teams page using useChurchSession

      const { data: churchData, error } = await supabase
        .from('churches')
        .select('planning_center_client_id, planning_center_connected_at, planning_center_app_id')
        .eq('id', churchId)
        .single();

      if (error) throw error;

      setCredentials({
        client_id: churchData?.planning_center_client_id,
        connected_at: churchData?.planning_center_connected_at,
        app_id: churchData?.planning_center_app_id
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

  const isConnected = credentials?.client_id && credentials?.connected_at;

  const fetchTeamsFromPlanningCenter = async () => {
    try {
      setFetchingTeams(true);
      setError(null);
      setSuccess(null);

      const session = getSession();
      if (!session || !session.user) {
        throw new Error('Authentication required');
      }

      const requestBody = {
        action: 'fetch-teams',
        user_id: session.user.id,
        church_id: session.user.church_id,
      };

      console.log('Sending request to planning-center-teams:', requestBody);

      const { data, error } = await supabase.functions.invoke('planning-center-teams', {
        body: requestBody,
      });

      if (error) {
        throw new Error(error.message || 'Failed to fetch teams');
      }

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch teams');
      }

      setTeams(data.teams);
      setServiceTypes(data.service_types || []);
      setShowTeamsList(true);
      setSelectedTeams(new Set());
      setSelectedServiceTypeFilter('all');

      // Show info about pagination if there were multiple pages
      if (data.fetched_count !== data.total_count) {
        console.log(`Fetched ${data.fetched_count} teams across multiple pages (total: ${data.total_count})`);
      }

    } catch (error) {
      console.error('Error fetching teams:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch teams from Planning Center');
    } finally {
      setFetchingTeams(false);
    }
  };

  const handleTeamSelection = (teamId: string, selected: boolean) => {
    const newSelectedTeams = new Set(selectedTeams);
    if (selected) {
      newSelectedTeams.add(teamId);
    } else {
      newSelectedTeams.delete(teamId);
    }
    setSelectedTeams(newSelectedTeams);
  };

  // Filter teams based on selected service type
  const filteredTeams = selectedServiceTypeFilter === 'all'
    ? teams
    : teams.filter(team => team.service_type_id === selectedServiceTypeFilter);

  const handleSelectAll = () => {
    const availableTeams = filteredTeams.filter(team => !team.already_imported);
    if (selectedTeams.size === availableTeams.length) {
      // Deselect all
      setSelectedTeams(new Set());
    } else {
      // Select all available teams (only filtered ones)
      setSelectedTeams(new Set(availableTeams.map(team => team.id)));
    }
  };

  const handleServiceTypeFilterChange = (serviceTypeId: string) => {
    setSelectedServiceTypeFilter(serviceTypeId);
    // Clear selections when filter changes
    setSelectedTeams(new Set());
  };

  const importSelectedTeams = async () => {
    try {
      setImportingTeams(true);
      setError(null);
      setSuccess(null);

      const session = getSession();
      if (!session || !session.user) {
        throw new Error('Authentication required');
      }

      const teamsToImport = teams
        .filter(team => selectedTeams.has(team.id))
        .map(team => ({
          planning_center_id: team.id,
          name: team.name,
        }));

      if (teamsToImport.length === 0) {
        throw new Error('Please select at least one team to import');
      }

      const requestBody = {
        action: 'import-teams',
        user_id: session.user.id,
        church_id: session.user.church_id,
        selected_teams: teamsToImport,
      };

      console.log('Sending import request to planning-center-teams:', requestBody);

      const { data, error } = await supabase.functions.invoke('planning-center-teams', {
        body: requestBody,
      });

      if (error) {
        throw new Error(error.message || 'Failed to import teams');
      }

      if (!data.success) {
        throw new Error(data.message || 'Failed to import teams');
      }

      setSuccess(`Successfully imported ${teamsToImport.length} teams!`);
      setSelectedTeams(new Set());

      // Refresh the teams list to show updated import status
      setTimeout(() => {
        fetchTeamsFromPlanningCenter();
      }, 1000);

    } catch (error) {
      console.error('Error importing teams:', error);
      setError(error instanceof Error ? error.message : 'Failed to import teams');
    } finally {
      setImportingTeams(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading Planning Center Teams...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
            <Calendar className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-900">
              Planning Center Not Connected
            </h3>
            <p className="text-amber-700">
              Connect your Planning Center account to import teams.
            </p>
          </div>
        </div>

        <a
          href="/settings"
          className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 transition-colors"
        >
          Go to Settings to Connect
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Connected to Planning Center</h3>
            <p className="text-sm text-green-700">
              Connected since {credentials.connected_at ? new Date(credentials.connected_at).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* Import Teams Section */}
      {!showTeamsList ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-lg bg-accent-100 flex items-center justify-center mx-auto mb-4">
              <Download className="h-8 w-8 text-accent-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Import Teams from Planning Center
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Import your existing Planning Center teams to use them alongside your assessment data.
              You can select which teams to import and they'll be added to your My Teams tab.
            </p>

            <button
              onClick={fetchTeamsFromPlanningCenter}
              disabled={fetchingTeams}
              className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {fetchingTeams ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching Teams...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import your teams from Planning Center
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Teams List with Checkboxes */
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Available Teams</h3>
              <p className="text-sm text-gray-600">
                Select the teams you want to import. Teams already imported are shown with a checkmark.
              </p>
            </div>
            <button
              onClick={() => setShowTeamsList(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Back to Import
            </button>
          </div>

          {/* Service Type Filter */}
          {serviceTypes.length > 0 && (
            <div className="mb-6 pb-4 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Service Type
              </label>
              <select
                value={selectedServiceTypeFilter}
                onChange={(e) => handleServiceTypeFilterChange(e.target.value)}
                className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm"
              >
                <option value="all">All Service Types</option>
                {serviceTypes.map((serviceType) => (
                  <option key={serviceType.id} value={serviceType.id}>
                    {serviceType.name}
                  </option>
                ))}
              </select>
              {selectedServiceTypeFilter !== 'all' && (
                <p className="text-xs text-gray-500 mt-1">
                  Showing {filteredTeams.length} teams for {serviceTypes.find(st => st.id === selectedServiceTypeFilter)?.name}
                </p>
              )}
            </div>
          )}

          {filteredTeams.length > 0 && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={selectedTeams.size > 0 && selectedTeams.size === filteredTeams.filter(t => !t.already_imported).length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All Available Teams ({filteredTeams.filter(t => !t.already_imported).length})
                </span>
              </label>
            </div>
          )}

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredTeams.map((team) => (
              <div
                key={team.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border ${
                  team.already_imported
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-200 hover:border-accent-300'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={team.already_imported}
                  checked={team.already_imported || selectedTeams.has(team.id)}
                  onChange={(e) => handleTeamSelection(team.id, e.target.checked)}
                  className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className={`font-medium ${team.already_imported ? 'text-gray-500' : 'text-gray-900'}`}>
                      {team.name}
                    </span>
                    {team.already_imported && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Already Imported
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`text-xs ${team.already_imported ? 'text-gray-400' : 'text-gray-500'}`}>
                      Service Type: {team.service_type_name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedTeams.size > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedTeams.size} team{selectedTeams.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={importSelectedTeams}
                disabled={importingTeams}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importingTeams ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Selected Teams
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};