import React, { useEffect, useState } from 'react';
import { Plus, AlertCircle, Users, Calendar, Shield, RotateCcw, RefreshCw } from 'lucide-react';
import { TeamCard } from '../components/Teams/TeamCard';
import { TeamModal } from '../components/Teams/TeamModal';
import { LeadershipLayerComponent } from '../components/Teams/LeadershipLayer';
import { Team, LeadershipLayer, supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PlanningCenterTeamsTab } from '../components/Teams/PlanningCenterTeamsTab';

interface TeamFormData {
  name: string;
  description?: string;
}

interface LayerFormData {
  name: string;
  level: number;
  description?: string;
}

export const Teams: React.FC = () => {
  const { churchId, isAdmin, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [layers, setLayers] = useState<LeadershipLayer[]>([]);
  const [teamCounts, setTeamCounts] = useState<Record<number, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Team | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'planning-center' | 'leadership' | 'reset'>('teams');

  // Load data when auth is ready
  useEffect(() => {
    if (!authLoading && churchId) {
      loadData();
    }
  }, [authLoading, churchId]);

  const loadData = async () => {
    if (!churchId) {
      console.log('[Teams] loadData aborted - no churchId');
      return;
    }

    try {
      setDataLoading(true);
      console.log('[Teams] Starting to load teams and layers for church:', churchId);

      // Load teams - query already filtered by church_id in WHERE clause, session ensures RLS context
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('church_id', churchId)
        .eq('active', true)
        .order('name');

      console.log('[Teams] Teams query result:', { teamsData, teamsError });

      if (teamsError) {
        console.error('Error loading teams:', teamsError);
        throw teamsError;
      }

      // Load leadership layers - query already filtered by church_id in WHERE clause, session ensures RLS context
      const { data: layersData, error: layersError } = await supabase
        .from('leadership_layers')
        .select('*')
        .eq('church_id', churchId)
        .eq('active', true)
        .order('level');

      console.log('[Teams] Leadership layers query result:', { layersData, layersError });

      if (layersError) {
        console.error('Error loading leadership layers:', layersError);
        throw layersError;
      }

      // Load team member counts - only for this church's teams
      const teamIds = teamsData?.map(t => t.id) || [];
      let assignments: any[] = [];

      console.log('[Teams] Loading assignments for team IDs:', teamIds);

      if (teamIds.length > 0) {
        const { data: assignmentsData, error: assignError } = await supabase
          .from('team_assignments')
          .select('team_id')
          .in('team_id', teamIds)
          .eq('active', true);

        console.log('[Teams] Assignments query result:', { assignmentsData, assignError });
        assignments = assignmentsData || [];
      }


      const counts: Record<number, number> = {};
      assignments?.forEach(assignment => {
        if (assignment.team_id) {
          counts[assignment.team_id] = (counts[assignment.team_id] || 0) + 1;
        }
      });

      console.log('[Teams] Setting state:', {
        teamsCount: teamsData?.length || 0,
        layersCount: layersData?.length || 0,
        countsKeys: Object.keys(counts).length
      });

      setTeams(teamsData || []);
      setLayers(layersData || []);
      setTeamCounts(counts);
      setInitialLoadComplete(true);

      console.log('[Teams] Data load complete');

    } catch (error) {
      console.error('Error loading teams data:', error);
      alert('Unable to load teams data. Please try refreshing the page.');
    } finally {
      setDataLoading(false);
    }
  };

  const handleSaveTeam = async (data: TeamFormData) => {
    if (!isAdmin) {
      alert('Only administrators can create or edit teams.');
      return;
    }

    // Get CSRF token for security
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
      alert('Security token missing. Please refresh the page.');
      return;
    }

    try {
      setSaving(true);

      if (editingTeam) {
        const { error } = await supabase
          .from('teams')
          .update({
            name: data.name,
            description: data.description,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTeam.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('teams')
          .insert({
            church_id: churchId,
            name: data.name,
            description: data.description
          });

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingTeam(null);
      // Reload data after successful save
      await loadData();
    } catch (error) {
      console.error('Error saving team:', error);
      alert('Unable to save team. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSaveTeams = async (teams: TeamFormData[]) => {
    if (!isAdmin) {
      alert('Only administrators can create teams.');
      return;
    }

    if (teams.length === 0) {
      alert('No teams to import.');
      return;
    }

    if (teams.length > 50) {
      alert('Too many teams. Maximum 50 teams per import.');
      return;
    }

    // Get CSRF token for security
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
      alert('Security token missing. Please refresh the page.');
      return;
    }

    try {
      setSaving(true);

      // Prepare teams for insertion
      const teamsToInsert = teams.map(team => ({
        church_id: churchId,
        name: team.name,
        description: team.description || null
      }));

      const { error } = await supabase
        .from('teams')
        .insert(teamsToInsert);

      if (error) throw error;

      setIsModalOpen(false);
      // Reload data after successful save
      await loadData();
      
      alert(`Successfully imported ${teams.length} teams!`);
    } catch (error) {
      console.error('Error importing teams:', error);
      alert('Unable to import teams. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!isAdmin) {
      alert('Only administrators can delete teams.');
      return;
    }

    const memberCount = teamCounts[team.id] || 0;
    
    if (memberCount > 0) {
      const confirmed = window.confirm(
        `Deleting '${team.name}' will move ${memberCount} assigned members back to 'Unassigned'. This action cannot be undone. Continue?`
      );
      if (!confirmed) return;
    }

    try {
      // First, remove team assignments
      const { error: assignError } = await supabase
        .from('team_assignments')
        .update({ team_id: null })
        .eq('team_id', team.id);

      if (assignError) throw assignError;

      // Then deactivate the team
      const { error } = await supabase
        .from('teams')
        .update({ active: false })
        .eq('id', team.id);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Unable to delete team. Please try again.');
    }
  };

  const handleSaveLayer = async (data: LayerFormData) => {
    if (!isAdmin) {
      alert('Only administrators can create leadership levels.');
      return;
    }

    try {
      const { error } = await supabase
        .from('leadership_layers')
        .insert({
          church_id: churchId,
          name: data.name,
          level: data.level,
          description: data.description
        });

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error saving layer:', error);
      alert('Unable to save leadership level. Please try again.');
    }
  };

  const handleUpdateLayer = async (id: number, data: LayerFormData) => {
    if (!isAdmin) {
      alert('Only administrators can edit leadership levels.');
      return;
    }

    try {
      const { error } = await supabase
        .from('leadership_layers')
        .update({
          name: data.name,
          level: data.level,
          description: data.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error updating layer:', error);
      alert('Unable to update leadership level. Please try again.');
    }
  };

  const handleDeleteLayer = async (id: number) => {
    if (!isAdmin) {
      alert('Only administrators can delete leadership levels.');
      return;
    }

    try {
      const { error } = await supabase
        .from('leadership_layers')
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error deleting layer:', error);
      alert('Unable to delete leadership level. Please try again.');
    }
  };

  const handleResetAll = async () => {
    if (!isAdmin) {
      alert('Only administrators can reset teams and leadership.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete ALL teams and leadership levels? This will also remove all team assignments. This action cannot be undone.'
    );
    
    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'This will permanently delete all your team structure. Are you absolutely sure?'
    );
    
    if (!doubleConfirm) return;

    try {
      setSaving(true);

      // First, get all assignments that belong to this church's teams or leadership layers
      const churchTeamIds = teams.map(t => t.id);
      const churchLayerIds = layers.map(l => l.id);
      
      // Remove team assignments for this church's teams and leadership layers
      if (churchTeamIds.length > 0 || churchLayerIds.length > 0) {
        let query = supabase
          .from('team_assignments')
          .update({ active: false })
          .eq('active', true);
        
        // Add conditions for team_id or leadership_layer_id
        if (churchTeamIds.length > 0 && churchLayerIds.length > 0) {
          query = query.or(`team_id.in.(${churchTeamIds.join(',')}),leadership_layer_id.in.(${churchLayerIds.join(',')})`);
        } else if (churchTeamIds.length > 0) {
          query = query.in('team_id', churchTeamIds);
        } else if (churchLayerIds.length > 0) {
          query = query.in('leadership_layer_id', churchLayerIds);
        }
        
        const { error: assignError } = await query;
        if (assignError) throw assignError;
      }
      
      // Then deactivate all teams for this church
      const { error: teamsError } = await supabase
        .from('teams')
        .update({ active: false })
        .eq('church_id', churchId)
        .eq('active', true);

      if (teamsError) throw teamsError;

      // Finally deactivate all leadership layers
      const { error: layersError } = await supabase
        .from('leadership_layers')
        .update({ active: false })
        .eq('church_id', churchId)
        .eq('active', true);

      if (layersError) throw layersError;

      // Reload data to reflect changes
      await loadData();
      
      alert('All teams and leadership levels have been reset successfully.');
    } catch (error) {
      console.error('Error resetting teams and leadership:', error);
      alert('Unable to reset teams and leadership. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Show loading state
  if (authLoading || (churchId && !initialLoadComplete)) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header with Tabs */}
      <div className="border-b border-gray-200">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Teams and Roles</h1>
          <p className="text-gray-600 mt-1">Manage your ministry teams and organizational structure</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'teams'
                ? 'border-accent-500 text-accent-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            My Teams
          </button>
          <button
            onClick={() => setActiveTab('planning-center')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'planning-center'
                ? 'border-accent-500 text-accent-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Planning Center Teams
          </button>
          <button
            onClick={() => setActiveTab('leadership')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'leadership'
                ? 'border-accent-500 text-accent-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="h-4 w-4 inline mr-2" />
            Leadership Roles
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('reset')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reset'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <RotateCcw className="h-4 w-4 inline mr-2" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'teams' ? (
        /* Teams Section */
        <div>
        {teams.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#EFEFF2] p-12 text-center">
            <Users className="h-12 w-12 text-[#91999A] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#1F1F1F] mb-2">No Teams Yet</h3>
            <p className="text-[#91999A] mb-6">
              {isAdmin 
                ? 'Start organizing your ministry by creating your first team.'
                : 'No teams have been created yet. Contact your administrator to set up teams.'
              }
            </p>
            {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#1d1d1f] border border-transparent rounded-lg hover:bg-[#858587] transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Team
              </button>
            )}
          </div>
        ) : (
          <>
            {isAdmin && (
              <div className="flex items-center justify-end mb-6">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#1d1d1f] border border-transparent rounded-lg hover:bg-[#858587] transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  memberCount={teamCounts[team.id] || 0}
                  onEdit={isAdmin ? (team) => {
                    setEditingTeam(team);
                    setIsModalOpen(true);
                  } : undefined}
                  onDelete={isAdmin ? handleDeleteTeam : undefined}
                  showActions={isAdmin}
                />
              ))}
            </div>
          </>
        )}
      </div>
      ) : activeTab === 'planning-center' ? (
        /* Planning Center Teams Tab */
        <PlanningCenterTeamsTab />
      ) : activeTab === 'leadership' ? (
        /* Leadership Roles Tab */
        <div className="space-y-8">
          {/* Leadership Levels Section */}
          <LeadershipLayerComponent
            layers={layers}
            onSave={isAdmin ? handleSaveLayer : undefined}
            onUpdate={isAdmin ? handleUpdateLayer : undefined}
            onDelete={isAdmin ? handleDeleteLayer : undefined}
            loading={saving}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
        /* Reset Tab */
        <div className="space-y-8">
          <div className="bg-white border border-gray-200 rounded-lg p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-lg bg-red-100 flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Reset Teams and Leadership Data
              </h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                This action will permanently delete all teams, leadership levels, and team assignments.
                Use this if you want to start fresh with your organizational structure.
              </p>
            </div>

            {teams.length > 0 || layers.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-red-900 mb-2">Warning: This Action Cannot Be Undone</h4>
                    <div className="text-sm text-red-800 mb-4 space-y-2">
                      <p><strong>This will permanently delete:</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        {teams.length > 0 && <li>{teams.length} team{teams.length !== 1 ? 's' : ''}</li>}
                        {layers.length > 0 && <li>{layers.length} leadership level{layers.length !== 1 ? 's' : ''}</li>}
                        <li>All team assignments and member associations</li>
                      </ul>
                      <p className="mt-3">
                        <strong>Assessment data will not be affected</strong> - only the organizational structure will be reset.
                      </p>
                    </div>
                    <button
                      onClick={handleResetAll}
                      disabled={saving}
                      className="px-6 py-3 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Resetting All Data...' : 'Reset All Teams & Leadership'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-gray-400" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Data to Reset</h4>
                <p className="text-gray-600">
                  You don't have any teams or leadership levels to reset. Create some organizational structure first.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team Modal */}
      {isAdmin && (
        <TeamModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTeam(null);
          }}
          onSave={handleSaveTeam}
          onBulkSave={handleBulkSaveTeams}
          team={editingTeam}
          loading={saving}
        />
      )}
    </div>
  );
};