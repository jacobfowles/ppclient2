import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Filter, Download, Users, UserX, Calendar, MapPin, X, ChevronDown, Trash2, Eye, EyeOff, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase, QUADRANT_COLORS, secureQuery } from '../lib/supabase';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfExport';
import { getCSRFToken } from '../utils/auth';
import { TeamAssignmentCell } from '../components/Results/TeamAssignmentCell';
import { LeadershipAssignmentCell } from '../components/Results/LeadershipAssignmentCell';
import { PcoIdCell } from '../components/Results/PcoIdCell';
import { TeamAssignmentModal } from '../components/Results/TeamAssignmentModal';
import { LeadershipAssignmentModal } from '../components/Results/LeadershipAssignmentModal';
import { PcoIdModal } from '../components/Results/PcoIdModal';

interface Assessment {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  profile: string;
  campus?: string;
  created_at: string;
  planning_center_person_id?: string;
  deleted_at?: string;
  // Computed fields
  name?: string;
  quadrant?: 'ideas_present' | 'people_possible' | 'people_present' | 'ideas_possible';
  team_assignments?: Array<{
    team_id?: number;
    leadership_layer_id?: number;
    teams?: { name: string };
    leadership_layers?: { name: string };
  }>;
}

interface Team {
  id: number;
  name: string;
}

interface LeadershipLayer {
  id: number;
  name: string;
  level: number;
}

// Helper function to determine quadrant from profile
const getQuadrantFromProfile = (profile: string): 'ideas_present' | 'people_possible' | 'people_present' | 'ideas_possible' => {
  const normalizedProfile = profile.charAt(0).toUpperCase() + profile.slice(1).toLowerCase();
  
  const profileMap: Record<string, 'ideas_present' | 'people_possible' | 'people_present' | 'ideas_possible'> = {
    'Action': 'ideas_present',
    'Efficiency': 'ideas_present',
    'Practicality': 'ideas_present',
    'Systematization': 'ideas_present',
    'Collaboration': 'people_possible',
    'Enthusiasm': 'people_possible',
    'Inspiration': 'people_possible',
    'Virtue': 'people_possible',
    'Connection': 'people_present',
    'Dependability': 'people_present',
    'Passion': 'people_present',
    'Support': 'people_present',
    'Determination': 'ideas_possible',
    'Energy': 'ideas_possible',
    'Knowledge': 'ideas_possible',
    'Strategy': 'ideas_possible'
  };

  return profileMap[normalizedProfile] || 'ideas_present';
};

export const Results: React.FC = () => {
  const { churchId, isAdmin, user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leadershipLayers, setLeadershipLayers] = useState<LeadershipLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<string>('all');
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [selectedLeadershipLayers, setSelectedLeadershipLayers] = useState<number[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [pcoMatchStatus, setPcoMatchStatus] = useState<string>('all'); // 'all', 'matched', 'not_matched'
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Keep old single-select states for backward compatibility with URL params
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedLeadership, setSelectedLeadership] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [church, setChurch] = useState<any>(null);
  const [uniqueCampuses, setUniqueCampuses] = useState<string[]>([]);
  const [showDeletedAssessments, setShowDeletedAssessments] = useState(false);
  const [deletingAssessments, setDeletingAssessments] = useState<Set<number>>(new Set());
  const [sortField, setSortField] = useState<string | null>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage] = useState(25);

  // Inline editing state
  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [editingLeadership, setEditingLeadership] = useState<number | null>(null);
  const [editingPcoId, setEditingPcoId] = useState<number | null>(null);
  const [pcoIdInput, setPcoIdInput] = useState('');
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  
  // Modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showLeadershipModal, setShowLeadershipModal] = useState(false);
  const [showPcoModal, setShowPcoModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);

  // Load initial data
  useEffect(() => {
    if (!authLoading && churchId) {
      loadInitialData();
    }
  }, [authLoading, churchId]);

  // Apply filters when data or filter parameters change
  useEffect(() => {
    applyFilters();
  }, [assessments, searchQuery, selectedQuadrant, selectedProfile, selectedTeams, selectedLeadershipLayers, selectedCampus, selectedAssignment, showDeletedAssessments, pcoMatchStatus, dateFrom, dateTo]);

  // Handle URL parameters
  useEffect(() => {
    const quadrant = searchParams.get('quadrant');
    const team = searchParams.get('team');
    const search = searchParams.get('search');
    const assignment = searchParams.get('assignment');
    const dateFrom = searchParams.get('dateFrom');

    if (quadrant && quadrant !== selectedQuadrant) {
      setSelectedQuadrant(quadrant);
    }
    if (team && team !== selectedTeam) {
      setSelectedTeam(team);
    }
    if (search && search !== searchQuery) {
      setSearchQuery(search);
    }
    if (assignment && assignment !== selectedAssignment) {
      setSelectedAssignment(assignment);
    }
  }, [searchParams]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load church info
      const { data: churchData, error: churchError } = await supabase
        .from('churches')
        .select('*')
        .eq('id', churchId)
        .single();

      if (churchError) {
        console.error('Error loading church:', churchError);
      }

      // Load teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('church_id', churchId)
        .eq('active', true)
        .order('name');

      if (teamsError) {
        console.error('Error loading teams:', teamsError);
        return;
      }

      // Load leadership layers
      const { data: layersData, error: layersError } = await supabase
        .from('leadership_layers')
        .select('id, name, level')
        .eq('church_id', churchId)
        .eq('active', true)
        .order('level');

      if (layersError) {
        console.error('Error loading leadership layers:', layersError);
        return;
      }

      // Load assessments with team assignments
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('assessments')
        .select(`
          *,
          team_assignments (
            team_id,
            leadership_layer_id,
            active,
            teams (name),
            leadership_layers (name)
          )
        `)
        .eq('church_id', churchId);

      if (assessmentsError) {
        console.error('Error loading assessments:', assessmentsError);
        return;
      }

      // Transform assessments
      const transformedAssessments = (assessmentsData || []).map(assessment => ({
        ...assessment,
        name: `${assessment.first_name} ${assessment.last_name}`,
        quadrant: getQuadrantFromProfile(assessment.profile)
      }));

      setTeams(teamsData || []);
      setLeadershipLayers(layersData || []);
      setAssessments(transformedAssessments);
      setChurch(churchData);

      // Get unique campuses for filtering
      if (churchData?.multi_site) {
        const campuses = [...new Set(transformedAssessments?.map(a => a.campus).filter(Boolean))].sort();
        setUniqueCampuses(campuses);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...assessments];

    // Filter by deleted status
    if (showDeletedAssessments) {
      filtered = filtered.filter(a => a.deleted_at);
    } else {
      filtered = filtered.filter(a => !a.deleted_at);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(assessment =>
        assessment.name?.toLowerCase().includes(query) ||
        assessment.email?.toLowerCase().includes(query) ||
        assessment.profile.toLowerCase().includes(query) ||
        assessment.campus?.toLowerCase().includes(query)
      );
    }

    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(assessment => {
        const assessmentDate = new Date(assessment.created_at);
        assessmentDate.setHours(0, 0, 0, 0);
        return assessmentDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(assessment => {
        const assessmentDate = new Date(assessment.created_at);
        return assessmentDate <= toDate;
      });
    }

    // Apply quadrant filter
    if (selectedQuadrant !== 'all') {
      filtered = filtered.filter(assessment => assessment.quadrant === selectedQuadrant);
    }

    // Apply profile filter
    if (selectedProfile !== 'all') {
      filtered = filtered.filter(assessment => assessment.profile === selectedProfile);
    }

    // Apply multi-select team filter
    if (selectedTeams.length > 0) {
      filtered = filtered.filter(assessment => {
        const activeAssignments = assessment.team_assignments?.filter(ta => ta.active) || [];
        // Check if assessment has any of the selected teams OR if "no team" is selected and assessment is unassigned
        const hasSelectedTeam = activeAssignments.some(ta => ta.team_id && selectedTeams.includes(ta.team_id));
        const isUnassignedAndNoTeamSelected = selectedTeams.includes(-1) && !activeAssignments.some(ta => ta.team_id);
        return hasSelectedTeam || isUnassignedAndNoTeamSelected;
      });
    }

    // Apply multi-select leadership filter
    if (selectedLeadershipLayers.length > 0) {
      filtered = filtered.filter(assessment => {
        const activeAssignments = assessment.team_assignments?.filter(ta => ta.active) || [];
        return activeAssignments.some(ta => ta.leadership_layer_id && selectedLeadershipLayers.includes(ta.leadership_layer_id));
      });
    }

    // Apply campus filter (only for multi-site churches)
    if (church?.multi_site && selectedCampus !== 'all') {
      filtered = filtered.filter(assessment => assessment.campus === selectedCampus);
    }

    // Apply assignment filter (legacy - kept for backward compatibility)
    if (selectedAssignment !== 'all') {
      if (selectedAssignment === 'assigned') {
        filtered = filtered.filter(assessment => {
          const activeAssignments = assessment.team_assignments?.filter(ta => ta.active) || [];
          return activeAssignments.some(ta => ta.team_id);
        });
      } else if (selectedAssignment === 'unassigned') {
        filtered = filtered.filter(assessment => {
          const activeAssignments = assessment.team_assignments?.filter(ta => ta.active) || [];
          return !activeAssignments.some(ta => ta.team_id);
        });
      }
    }

    // Apply PCO match status filter
    if (pcoMatchStatus !== 'all') {
      if (pcoMatchStatus === 'matched') {
        filtered = filtered.filter(assessment => assessment.planning_center_person_id);
      } else if (pcoMatchStatus === 'not_matched') {
        filtered = filtered.filter(assessment => !assessment.planning_center_person_id);
      }
    }

    setFilteredAssessments(filtered);
  }, [assessments, searchQuery, selectedQuadrant, selectedProfile, selectedTeams, selectedLeadershipLayers, selectedCampus, selectedAssignment, church, showDeletedAssessments, pcoMatchStatus, dateFrom, dateTo]);

  // Apply sorting to filtered assessments
  const sortedAssessments = React.useMemo(() => {
    if (!sortField) return filteredAssessments;

    const sorted = [...filteredAssessments].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'profile':
          aValue = a.profile.toLowerCase();
          bValue = b.profile.toLowerCase();
          break;
        case 'team':
          const aTeamAssignment = a.team_assignments?.filter(ta => ta.active)?.find(ta => ta.team_id);
          const bTeamAssignment = b.team_assignments?.filter(ta => ta.active)?.find(ta => ta.team_id);
          aValue = aTeamAssignment?.teams?.name?.toLowerCase() || 'zzz_unassigned';
          bValue = bTeamAssignment?.teams?.name?.toLowerCase() || 'zzz_unassigned';
          break;
        case 'leadership':
          const aLeadershipAssignment = a.team_assignments?.filter(ta => ta.active)?.find(ta => ta.leadership_layer_id);
          const bLeadershipAssignment = b.team_assignments?.filter(ta => ta.active)?.find(ta => ta.leadership_layer_id);
          aValue = aLeadershipAssignment?.leadership_layers?.name?.toLowerCase() || 'zzz_unassigned';
          bValue = bLeadershipAssignment?.leadership_layers?.name?.toLowerCase() || 'zzz_unassigned';
          break;
        case 'campus':
          aValue = a.campus?.toLowerCase() || 'zzz_not_specified';
          bValue = b.campus?.toLowerCase() || 'zzz_not_specified';
          break;
        case 'pco_id':
          aValue = a.planning_center_person_id || 'zzz_not_matched';
          bValue = b.planning_center_person_id || 'zzz_not_matched';
          break;
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredAssessments, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedAssessments.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const paginatedAssessments = sortedAssessments.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedQuadrant, selectedProfile, selectedTeams, selectedLeadershipLayers, selectedCampus, selectedAssignment, pcoMatchStatus, dateFrom, dateTo]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New field, start with descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? <ChevronDown className="h-4 w-4 ml-1" /> : <ChevronUp className="h-4 w-4 ml-1" />;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedQuadrant('all');
    setSelectedProfile('all');
    setSelectedTeams([]);
    setSelectedLeadershipLayers([]);
    setSelectedTeam('all');
    setSelectedLeadership('all');
    setSelectedCampus('all');
    setSelectedAssignment('all');
    setPcoMatchStatus('all');
    setDateFrom('');
    setDateTo('');
    setSearchParams({});
    setSortField(null);
    setSortDirection('desc');
  };

  // Assignment handlers
  const handleTeamAssignment = async (assessmentId: number, teamId: number | null) => {
    try {
      setAssignmentLoading(true);
      setShowTeamModal(false);

      // First, deactivate any existing team assignments for this assessment
      const { error: deactivateError } = await supabase
        .from('team_assignments')
        .update({ active: false })
        .eq('assessment_id', assessmentId);

      if (deactivateError) {
        console.error('Error deactivating existing team assignments:', deactivateError);
        throw deactivateError;
      }

      if (teamId) {
        // Create new team assignment
        const { error } = await supabase
          .from('team_assignments')
          .insert({
            assessment_id: assessmentId,
            team_id: teamId,
            active: true
          });

        if (error) throw error;
      }

      // Reload data to reflect changes
      loadInitialData();
      setEditingTeam(null);
    } catch (error) {
      console.error('Error updating team assignment:', error);
      alert('Unable to update team assignment. Please try again.');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleLeadershipAssignment = async (assessmentId: number, leadershipLayerId: number | null) => {
    try {
      setAssignmentLoading(true);
      setShowLeadershipModal(false);

      // First, deactivate any existing leadership assignments for this assessment
      const { error: deactivateError } = await supabase
        .from('team_assignments')
        .update({ active: false })
        .eq('assessment_id', assessmentId);

      if (deactivateError) {
        console.error('Error deactivating existing leadership assignments:', deactivateError);
        throw deactivateError;
      }

      if (leadershipLayerId) {
        // Create new leadership assignment
        const { error } = await supabase
          .from('team_assignments')
          .insert({
            assessment_id: assessmentId,
            leadership_layer_id: leadershipLayerId,
            active: true
          });

        if (error) throw error;
      }

      // Reload data to reflect changes
      loadInitialData();
      setEditingLeadership(null);
    } catch (error) {
      console.error('Error updating leadership assignment:', error);
      alert('Unable to update leadership assignment. Please try again.');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handlePcoIdUpdate = async (assessmentId: number, pcoId: string) => {
    try {
      setAssignmentLoading(true);
      setShowPcoModal(false);

      const { error } = await supabase
        .from('assessments')
        .update({ planning_center_person_id: pcoId.trim() || null })
        .eq('id', assessmentId);

      if (error) throw error;

      // Reload data to reflect changes
      loadInitialData();
      setEditingPcoId(null);
      setPcoIdInput('');
    } catch (error) {
      console.error('Error updating PCO ID:', error);
      alert('Unable to update PCO ID. Please try again.');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const openTeamModal = (assessment: Assessment) => {
    if (!isAdmin) return;
    setSelectedAssessment(assessment);
    setShowTeamModal(true);
  };

  const openLeadershipModal = (assessment: Assessment) => {
    if (!isAdmin) return;
    setSelectedAssessment(assessment);
    setShowLeadershipModal(true);
  };

  const openPcoModal = (assessment: Assessment) => {
    if (!isAdmin) return;
    setSelectedAssessment(assessment);
    setPcoIdInput(assessment.planning_center_person_id || '');
    setShowPcoModal(true);
  };
  // Add phone number formatting utility
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format US phone numbers (10 or 11 digits)
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    // For other formats, return as-is with basic formatting
    return phone;
  };

  const exportToPDF = async () => {
    try {
      setIsExporting(true);
      
      // Use the utility function with current filtered data
      await exportToPDFUtil(
        [], // No chart data needed for results export
        {},
        () => `Results Export - ${filteredAssessments.length} people`,
        true, // Include individual list
        filteredAssessments.map(assessment => {
          const activeAssignments = assessment.team_assignments?.filter(ta => ta.active) || [];
          const teamAssignment = activeAssignments.find(ta => ta.team_id);
          const leadershipAssignment = activeAssignments.find(ta => ta.leadership_layer_id);
          
          return {
            ...assessment,
            teamName: teamAssignment?.teams?.name || 'Unassigned',
            leadershipName: leadershipAssignment?.leadership_layers?.name || 'Unassigned'
          };
        })
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Unable to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSoftDelete = async (assessmentId: number) => {
    if (!isAdmin) {
      alert('Only administrators can delete assessments.');
      return;
    }

    if (!confirm('Are you sure you want to delete this assessment? This action can be undone.')) {
      return;
    }

    try {
      setDeletingAssessments(prev => new Set(prev).add(assessmentId));

      const { error } = await supabase
        .from('assessments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', assessmentId)
        .eq('church_id', churchId);

      if (error) throw error;

      // Reload data to reflect changes
      loadInitialData();
    } catch (error) {
      console.error('Error deleting assessment:', error);
      alert('Unable to delete assessment. Please try again.');
    } finally {
      setDeletingAssessments(prev => {
        const newSet = new Set(prev);
        newSet.delete(assessmentId);
        return newSet;
      });
    }
  };

  const handleRestore = async (assessmentId: number) => {
    if (!isAdmin) {
      alert('Only administrators can restore assessments.');
      return;
    }

    try {
      const { error } = await supabase
        .from('assessments')
        .update({ deleted_at: null })
        .eq('id', assessmentId)
        .eq('church_id', churchId);

      if (error) throw error;

      // Reload data to reflect changes
      loadInitialData();
    } catch (error) {
      console.error('Error restoring assessment:', error);
      alert('Unable to restore assessment. Please try again.');
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedQuadrant !== 'all') count++;
    if (selectedProfile !== 'all') count++;
    if (selectedTeams.length > 0) count++;
    if (selectedLeadershipLayers.length > 0) count++;
    if (selectedTeam !== 'all') count++;
    if (selectedLeadership !== 'all') count++;
    if (selectedCampus !== 'all') count++;
    if (selectedAssignment !== 'all') count++;
    if (pcoMatchStatus !== 'all') count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {showDeletedAssessments ? 'Deleted Assessments' : 'Assessment Results'}
          </h1>
          <p className="text-gray-600 mt-1">
            {showDeletedAssessments 
              ? `${filteredAssessments.length} deleted assessment${filteredAssessments.length !== 1 ? 's' : ''}`
              : `${filteredAssessments.length} assessment result${filteredAssessments.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Toggle for deleted assessments (admin only) */}
          {isAdmin && (
            <button
              onClick={() => setShowDeletedAssessments(!showDeletedAssessments)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                showDeletedAssessments
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showDeletedAssessments ? (
                <>
                  <Eye className="h-4 w-4 mr-2 inline" />
                  Show Active
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2 inline" />
                  Show Deleted
                </>
              )}
            </button>
          )}

          {!showDeletedAssessments && filteredAssessments.length > 0 && (
            <button
              onClick={exportToPDF}
              disabled={isExporting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
            </button>
          )}
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 ${
              showFilters || activeFiltersCount > 0
                ? 'bg-accent-100 text-accent-700 hover:bg-accent-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-accent-500 text-white text-xs rounded-full px-2 py-1 min-w-[1.25rem] h-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xl hover:shadow-2xl transition-all duration-300">
        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, profile, or campus..."
            className="w-full pl-12 pr-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition-all duration-200 bg-gray-50 focus:bg-white shadow-sm focus:shadow-lg placeholder-gray-500"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-6 pt-6 border-t-2 border-gray-200">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Start Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm font-medium bg-gray-50 focus:bg-white shadow-sm focus:shadow-lg transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">End Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm font-medium bg-gray-50 focus:bg-white shadow-sm focus:shadow-lg transition-all duration-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Quadrant Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Quadrant</label>
                <select
                  value={selectedQuadrant}
                  onChange={(e) => setSelectedQuadrant(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm font-medium bg-gray-50 focus:bg-white shadow-sm focus:shadow-lg transition-all duration-200"
                >
                  <option value="all">All Quadrants</option>
                  <option value="ideas_present">Ideas Present</option>
                  <option value="people_possible">People Possible</option>
                  <option value="people_present">People Present</option>
                  <option value="ideas_possible">Ideas Possible</option>
                </select>
              </div>

              {/* Profile Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Profile</label>
                <select
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm font-medium bg-gray-50 focus:bg-white shadow-sm focus:shadow-lg transition-all duration-200"
                >
                  <option value="all">All Profiles</option>
                  <option value="Action">Action</option>
                  <option value="Efficiency">Efficiency</option>
                  <option value="Practicality">Practicality</option>
                  <option value="Systematization">Systematization</option>
                  <option value="Collaboration">Collaboration</option>
                  <option value="Enthusiasm">Enthusiasm</option>
                  <option value="Inspiration">Inspiration</option>
                  <option value="Virtue">Virtue</option>
                  <option value="Connection">Connection</option>
                  <option value="Dependability">Dependability</option>
                  <option value="Passion">Passion</option>
                  <option value="Support">Support</option>
                  <option value="Determination">Determination</option>
                  <option value="Energy">Energy</option>
                  <option value="Knowledge">Knowledge</option>
                  <option value="Strategy">Strategy</option>
                </select>
              </div>

              {/* PCO Match Status */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">PCO Status</label>
                <select
                  value={pcoMatchStatus}
                  onChange={(e) => setPcoMatchStatus(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm font-medium bg-gray-50 focus:bg-white shadow-sm focus:shadow-lg transition-all duration-200"
                >
                  <option value="all">All</option>
                  <option value="matched">Matched</option>
                  <option value="not_matched">Not Matched</option>
                </select>
              </div>

              {/* Campus Filter (only for multi-site churches) */}
              {church?.multi_site && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Campus</label>
                  <select
                    value={selectedCampus}
                    onChange={(e) => setSelectedCampus(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm font-medium bg-gray-50 focus:bg-white shadow-sm focus:shadow-lg transition-all duration-200"
                  >
                    <option value="all">All Campuses</option>
                    {uniqueCampuses.map(campus => (
                      <option key={campus} value={campus}>{campus}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Multi-select Team Filter */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Teams (Multi-select)</label>
              <div className="border-2 border-gray-300 rounded-xl p-4 bg-gray-50 max-h-48 overflow-y-auto">
                <label className="flex items-center space-x-3 mb-2 hover:bg-gray-100 p-2 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTeams.includes(-1)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTeams([...selectedTeams, -1]);
                      } else {
                        setSelectedTeams(selectedTeams.filter(id => id !== -1));
                      }
                    }}
                    className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">No Team Assigned</span>
                </label>
                {teams.map(team => (
                  <label key={team.id} className="flex items-center space-x-3 mb-2 hover:bg-gray-100 p-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(team.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTeams([...selectedTeams, team.id]);
                        } else {
                          setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                        }
                      }}
                      className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">{team.name}</span>
                  </label>
                ))}
              </div>
              {selectedTeams.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">{selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>

            {/* Multi-select Leadership Filter */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Leadership Layers (Multi-select)</label>
              <div className="border-2 border-gray-300 rounded-xl p-4 bg-gray-50 max-h-48 overflow-y-auto">
                {leadershipLayers.map(layer => (
                  <label key={layer.id} className="flex items-center space-x-3 mb-2 hover:bg-gray-100 p-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLeadershipLayers.includes(layer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeadershipLayers([...selectedLeadershipLayers, layer.id]);
                        } else {
                          setSelectedLeadershipLayers(selectedLeadershipLayers.filter(id => id !== layer.id));
                        }
                      }}
                      className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">{layer.name}</span>
                  </label>
                ))}
              </div>
              {selectedLeadershipLayers.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">{selectedLeadershipLayers.length} layer{selectedLeadershipLayers.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <div className="flex justify-end pt-4">
                <button
                  onClick={clearFilters}
                  className="px-6 py-3 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all duration-200 flex items-center space-x-2 border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md"
                >
                  <X className="h-4 w-4" />
                  <span>Clear all filters</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
        {filteredAssessments.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Users className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {showDeletedAssessments ? 'No deleted assessments' : 'No results found'}
            </h3>
            <p className="text-lg text-gray-500 max-w-md mx-auto">
              {activeFiltersCount > 0 
                ? 'Try adjusting your filters to see more results'
                : showDeletedAssessments 
                  ? 'No assessments have been deleted'
                  : 'Assessment results will appear here once people complete their assessments'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th 
                    className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all duration-200 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all duration-200 select-none"
                    onClick={() => handleSort('profile')}
                  >
                    <div className="flex items-center">
                      Profile
                      {getSortIcon('profile')}
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Quadrant
                  </th>
                  <th 
                    className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all duration-200 select-none"
                    onClick={() => handleSort('team')}
                  >
                    <div className="flex items-center">
                      Team
                      {getSortIcon('team')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all duration-200 select-none"
                    onClick={() => handleSort('leadership')}
                  >
                    <div className="flex items-center">
                      Leadership
                      {getSortIcon('leadership')}
                    </div>
                  </th>
                  {church?.multi_site && (
                    <th 
                      className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all duration-200 select-none"
                      onClick={() => handleSort('campus')}
                    >
                      <div className="flex items-center">
                        Campus
                        {getSortIcon('campus')}
                      </div>
                    </th>
                  )}
                  <th 
                    className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all duration-200 select-none"
                    onClick={() => handleSort('pco_id')}
                  >
                    <div className="flex items-center">
                      PCO ID
                      {getSortIcon('pco_id')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-all duration-200 select-none"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      Date
                      {getSortIcon('date')}
                    </div>
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-5 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginatedAssessments.map((assessment) => {
                  const activeAssignments = assessment.team_assignments?.filter(ta => ta.active) || [];
                  const teamAssignment = activeAssignments.find(ta => ta.team_id);
                  const leadershipAssignment = activeAssignments.find(ta => ta.leadership_layer_id);
                  const isDeleting = deletingAssessments.has(assessment.id);
                  
                  return (
                    <tr 
                      key={assessment.id} 
                      className={`hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-200 ${
                        assessment.deleted_at ? 'opacity-60' : ''
                      } ${isDeleting ? 'opacity-50' : ''}`}
                    >
                      <td className="px-6 py-6 whitespace-nowrap">
                        <div>
                          <div className="text-base font-bold text-gray-900 mb-1">
                            {assessment.name}
                          </div>
                          {assessment.email && (
                            <div className="text-sm text-gray-600 font-medium">{assessment.email}</div>
                          )}
                          {assessment.phone && (
                            <div className="text-sm text-gray-600">{formatPhoneNumber(assessment.phone)}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <div className="space-y-1">
                          <span 
                            className="inline-flex px-4 py-2 text-sm font-bold rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                            style={{ backgroundColor: QUADRANT_COLORS[assessment.quadrant!] }}
                          >
                            {assessment.profile}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <span 
                          className="inline-flex px-4 py-2 text-sm font-bold rounded-xl text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                          style={{ backgroundColor: QUADRANT_COLORS[assessment.quadrant!] }}
                        >
                          {assessment.quadrant?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <button
                          onClick={() => openTeamModal(assessment)}
                          disabled={!isAdmin}
                          className={`text-left w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                            isAdmin 
                              ? 'hover:bg-gray-50 cursor-pointer' 
                              : 'cursor-default'
                          }`}
                        >
                          <span className={teamAssignment?.teams?.name ? 'text-gray-900 font-medium' : 'text-gray-500 italic'}>
                            {teamAssignment?.teams?.name || 'Unassigned'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap">
                        <button
                          onClick={() => openLeadershipModal(assessment)}
                          disabled={!isAdmin}
                          className={`text-left w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                            isAdmin 
                              ? 'hover:bg-gray-50 cursor-pointer' 
                              : 'cursor-default'
                          }`}
                        >
                          <span className={leadershipAssignment?.leadership_layers?.name ? 'text-gray-900 font-medium' : 'text-gray-500 italic'}>
                            {leadershipAssignment?.leadership_layers?.name || 'Unassigned'}
                          </span>
                        </button>
                      </td>
                      {church?.multi_site && (
                        <td className="px-6 py-6 whitespace-nowrap text-sm font-medium text-gray-900">
                          {assessment.campus || (
                            <span className="text-gray-500 italic">Not specified</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-6 whitespace-nowrap">
                        <button
                          onClick={() => openPcoModal(assessment)}
                          disabled={!isAdmin}
                          className={`text-left w-full px-3 py-2 text-sm font-mono rounded-lg transition-colors ${
                            isAdmin 
                              ? 'hover:bg-gray-50 cursor-pointer' 
                              : 'cursor-default'
                          }`}
                        >
                          <span className={assessment.planning_center_person_id ? 'text-gray-900 font-medium' : 'text-gray-500 italic'}>
                            {assessment.planning_center_person_id || 'Not matched'}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-6 whitespace-nowrap text-sm font-medium text-gray-600">
                        {new Date(assessment.created_at).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-500">
                          {assessment.deleted_at ? (
                            <button
                              onClick={() => handleRestore(assessment.id)}
                              className="px-3 py-2 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all duration-200"
                              title="Restore assessment"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSoftDelete(assessment.id)}
                              disabled={isDeleting}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50"
                              title="Delete assessment"
                            >
                              {isDeleting ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                              ) : (
                                <Trash2 className="h-5 w-5" />
                              )}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!showDeletedAssessments && filteredAssessments.length > 0 && totalPages > 1 && (
          <div className="px-8 py-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(endIndex, sortedAssessments.length)} of {sortedAssessments.length} results
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage = page === 1 ||
                                     page === totalPages ||
                                     (page >= currentPage - 1 && page <= currentPage + 1);

                    const showEllipsis = (page === 2 && currentPage > 3) ||
                                        (page === totalPages - 1 && currentPage < totalPages - 2);

                    if (showEllipsis) {
                      return <span key={page} className="px-2 text-gray-500">...</span>;
                    }

                    if (!showPage) return null;

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-accent-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Assignment Modal */}
      {selectedAssessment && (
        <TeamAssignmentModal
          isOpen={showTeamModal}
          onClose={() => {
            setShowTeamModal(false);
            setSelectedAssessment(null);
          }}
          assessment={selectedAssessment}
          teams={teams}
          onAssign={handleTeamAssignment}
          loading={assignmentLoading}
        />
      )}

      {/* Leadership Assignment Modal */}
      {selectedAssessment && (
        <LeadershipAssignmentModal
          isOpen={showLeadershipModal}
          onClose={() => {
            setShowLeadershipModal(false);
            setSelectedAssessment(null);
          }}
          assessment={selectedAssessment}
          leadershipLayers={leadershipLayers}
          onAssign={handleLeadershipAssignment}
          loading={assignmentLoading}
        />
      )}

      {/* PCO ID Modal */}
      {selectedAssessment && (
        <PcoIdModal
          isOpen={showPcoModal}
          onClose={() => {
            setShowPcoModal(false);
            setSelectedAssessment(null);
            setPcoIdInput('');
          }}
          assessment={selectedAssessment}
          onUpdate={(assessmentId, pcoId) => {
            handlePcoIdUpdate(assessmentId, pcoId);
          }}
          loading={assignmentLoading}
        />
      )}

    </div>
  );
};