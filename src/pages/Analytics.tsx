import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuadrantChart } from '../components/Analytics/QuadrantChart';
import { supabase, QUADRANT_COLORS } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ChevronDown, Filter, Users, Award, Download, MapPin } from 'lucide-react';
import { exportToPDF as exportToPDFUtil } from '../utils/pdfExport';

interface QuadrantData {
  name: string;
  value: number;
  percentage: number;
  quadrant: keyof typeof QUADRANT_COLORS;
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
const getQuadrantFromProfile = (profile: string): keyof typeof QUADRANT_COLORS => {
  // Normalize profile name to handle case variations
  const normalizedProfile = profile.charAt(0).toUpperCase() + profile.slice(1).toLowerCase();
  
  const profileMap: Record<string, keyof typeof QUADRANT_COLORS> = {
    // Ideas Present (Task-focused, Present-oriented) - Blue quadrant
    'Action': 'ideas_present',
    'Efficiency': 'ideas_present',
    'Practicality': 'ideas_present',
    'Systematization': 'ideas_present',
    // People Possible (People-focused, Future-oriented) - Green quadrant
    'Collaboration': 'people_possible',
    'Enthusiasm': 'people_possible',
    'Inspiration': 'people_possible',
    'Virtue': 'people_possible',
    // People Present (People-focused, Present-oriented) - Yellow quadrant
    'Connection': 'people_present',
    'Dependability': 'people_present',
    'Passion': 'people_present',
    'Support': 'people_present',
    // Ideas Possible (Task-focused, Future-oriented) - Red quadrant
    'Determination': 'ideas_possible',
    'Energy': 'ideas_possible',
    'Knowledge': 'ideas_possible',
    'Strategy': 'ideas_possible'
  };

  return profileMap[normalizedProfile] || 'ideas_present';
};

export const Analytics: React.FC = () => {
  const { churchId, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [chartData, setChartData] = useState<QuadrantData[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leadershipLayers, setLeadershipLayers] = useState<LeadershipLayer[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['all']);
  const [selectedLeadership, setSelectedLeadership] = useState<string[]>(['all']);
  const [selectedCampus, setSelectedCampus] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(true);
  const [profileBreakdown, setProfileBreakdown] = useState<Record<string, Record<string, number>>>({});
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showLeadershipDropdown, setShowLeadershipDropdown] = useState(false);
  const [showCampusDropdown, setShowCampusDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [church, setChurch] = useState<any>(null);
  const [uniqueCampuses, setUniqueCampuses] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [includeIndividualList, setIncludeIndividualList] = useState(false);
  const [customReportTitle, setCustomReportTitle] = useState('Team Profile Report');

  useEffect(() => {
    if (!authLoading && churchId) {
      loadInitialData();
    }
  }, [authLoading, churchId]);

  useEffect(() => {
    if (!authLoading && churchId && teams.length >= 0 && leadershipLayers.length >= 0 && church !== null) {
      loadFilteredData();
    }
  }, [authLoading, selectedTeams, selectedLeadership, selectedCampus, teams, leadershipLayers, church]);

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

      setTeams(teamsData || []);
      setLeadershipLayers(layersData || []);
      setChurch(churchData);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadFilteredData = async () => {
    try {
      // Load all assessments (exclude soft-deleted)
      const { data: assessments, error: assessmentsError } = await supabase
        .from('assessments')
        .select('*, campus')
        .eq('church_id', churchId)
        .is('deleted_at', null);

      if (assessmentsError) {
        console.error('Error loading assessments:', assessmentsError);
        return;
      }

      if (!assessments || assessments.length === 0) {
        setChartData([]);
        setProfileBreakdown({});
        setLoading(false);
        return;
      }

      // Get unique campuses for filtering
      if (church?.multi_site) {
        const campuses = [...new Set(assessments?.map(a => a.campus).filter(Boolean))].sort();
        setUniqueCampuses(campuses);
      }

      // Transform assessments to include quadrant
      const transformedAssessments = assessments.map(assessment => ({
        ...assessment,
        profile: assessment.profile.charAt(0).toUpperCase() + assessment.profile.slice(1).toLowerCase(),
        quadrant: getQuadrantFromProfile(assessment.profile)
      }));

      // Load team assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('team_assignments')
        .select(`
          assessment_id,
          team_id,
          leadership_layer_id,
          teams (id, name),
          leadership_layers (id, name, level)
        `)
        .eq('active', true);

      if (assignmentsError) {
        console.error('Error loading assignments:', assignmentsError);
      }

      // Filter assessments based on selected filters
      let filteredAssessments = transformedAssessments;

      // Apply team filter
      if (!selectedTeams.includes('all') && selectedTeams.length > 0) {
        const selectedTeamIds = selectedTeams.map(id => parseInt(id));
        filteredAssessments = filteredAssessments.filter(assessment => {
          const assignment = assignments?.find(a => a.assessment_id === assessment.id);
          return assignment && assignment.team_id && selectedTeamIds.includes(assignment.team_id);
        });
      }

      // Apply leadership filter
      if (!selectedLeadership.includes('all') && selectedLeadership.length > 0) {
        const selectedLeadershipIds = selectedLeadership.map(id => parseInt(id));
        filteredAssessments = filteredAssessments.filter(assessment => {
          const assignment = assignments?.find(a => a.assessment_id === assessment.id);
          return assignment && assignment.leadership_layer_id && selectedLeadershipIds.includes(assignment.leadership_layer_id);
        });
      }

      // Apply campus filter (only for multi-site churches)
      if (church?.multi_site && !selectedCampus.includes('all') && selectedCampus.length > 0) {
        filteredAssessments = filteredAssessments.filter(assessment => {
          return assessment.campus && selectedCampus.includes(assessment.campus);
        });
      }

      // Calculate quadrant distribution
      const quadrantCounts = {
        ideas_present: 0,
        people_possible: 0,
        people_present: 0,
        ideas_possible: 0
      };

      filteredAssessments.forEach(assessment => {
        quadrantCounts[assessment.quadrant]++;
      });

      const total = filteredAssessments.length;
      const quadrants: QuadrantData[] = Object.entries(quadrantCounts).map(([quadrant, count]) => ({
        name: quadrant.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        quadrant: quadrant as keyof typeof QUADRANT_COLORS
      }));

      setChartData(quadrants);

      // Calculate profile breakdowns
      const breakdown: Record<string, Record<string, number>> = {};
      filteredAssessments.forEach(assessment => {
        const quadrant = assessment.quadrant;
        const profile = assessment.profile;
        
        if (!breakdown[quadrant]) {
          breakdown[quadrant] = {};
        }
        breakdown[quadrant][profile] = (breakdown[quadrant][profile] || 0) + 1;
      });
      setProfileBreakdown(breakdown);
    } catch (error) {
      console.error('Error loading filtered data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamChange = (teamId: string) => {
    if (teamId === 'all') {
      setSelectedTeams(['all']);
    } else {
      const newSelection = selectedTeams.includes('all') 
        ? [teamId]
        : selectedTeams.includes(teamId)
          ? selectedTeams.filter(id => id !== teamId)
          : [...selectedTeams, teamId];
      
      setSelectedTeams(newSelection.length === 0 ? ['all'] : newSelection);
    }
  };

  const handleLeadershipChange = (layerId: string) => {
    if (layerId === 'all') {
      setSelectedLeadership(['all']);
    } else {
      const newSelection = selectedLeadership.includes('all') 
        ? [layerId]
        : selectedLeadership.includes(layerId)
          ? selectedLeadership.filter(id => id !== layerId)
          : [...selectedLeadership, layerId];
      
      setSelectedLeadership(newSelection.length === 0 ? ['all'] : newSelection);
    }
  };

  const handleCampusChange = (campus: string) => {
    if (campus === 'all') {
      setSelectedCampus(['all']);
    } else {
      const newSelection = selectedCampus.includes('all') 
        ? [campus]
        : selectedCampus.includes(campus)
          ? selectedCampus.filter(c => c !== campus)
          : [...selectedCampus, campus];
      
      setSelectedCampus(newSelection.length === 0 ? ['all'] : newSelection);
    }
  };

  const getFilterTitle = () => {
    const teamText = selectedTeams.includes('all') 
      ? 'All Teams'
      : selectedTeams.length === 1
        ? teams.find(t => t.id.toString() === selectedTeams[0])?.name || 'Unknown Team'
        : `${selectedTeams.length} Teams Selected (${selectedTeams.map(id => teams.find(t => t.id.toString() === id)?.name).filter(Boolean).join(', ')})`;

    const leadershipText = selectedLeadership.includes('all')
      ? 'All Leadership Levels'
      : selectedLeadership.length === 1
        ? leadershipLayers.find(l => l.id.toString() === selectedLeadership[0])?.name || 'Unknown Level'
        : `${selectedLeadership.length} Leadership Levels Selected (${selectedLeadership.map(id => leadershipLayers.find(l => l.id.toString() === id)?.name).filter(Boolean).join(', ')})`;

    const campusText = church?.multi_site 
      ? selectedCampus.includes('all')
        ? 'All Campuses'
        : selectedCampus.length === 1
          ? selectedCampus[0]
          : `${selectedCampus.length} Campuses Selected`
      : '';

    return church?.multi_site
      ? `${teamText} | ${leadershipText} | ${campusText}`
      : `${teamText} | ${leadershipText}`;
  };

  const exportToPDF = async (includeList: boolean = false) => {
    try {
      setIsExporting(true);
      
      // Load individual assessments if including list
      let individualAssessments: any[] = [];
      if (includeList) {
        // Load all assessments with the same filters applied (exclude soft-deleted)
        const { data: assessments, error: assessmentsError } = await supabase
          .from('assessments')
          .select('*, campus')
          .eq('church_id', churchId)
          .is('deleted_at', null);

        if (assessmentsError) {
          console.error('Error loading assessments for PDF:', assessmentsError);
        } else {
          // Transform assessments to include quadrant
          const transformedAssessments = (assessments || []).map(assessment => ({
            ...assessment,
            quadrant: getQuadrantFromProfile(assessment.profile),
            name: `${assessment.first_name} ${assessment.last_name}`
          }));

          // Load team assignments
          const { data: assignments } = await supabase
            .from('team_assignments')
            .select(`
              assessment_id,
              team_id,
              leadership_layer_id,
              teams (id, name),
              leadership_layers (id, name, level)
            `)
            .eq('active', true);

          // Apply the same filters as the chart
          let filteredAssessments = transformedAssessments;

          // Apply team filter
          if (!selectedTeams.includes('all') && selectedTeams.length > 0) {
            const selectedTeamIds = selectedTeams.map(id => parseInt(id));
            filteredAssessments = filteredAssessments.filter(assessment => {
              const assignment = assignments?.find(a => a.assessment_id === assessment.id);
              return assignment && assignment.team_id && selectedTeamIds.includes(assignment.team_id);
            });
          }

          // Apply leadership filter
          if (!selectedLeadership.includes('all') && selectedLeadership.length > 0) {
            const selectedLeadershipIds = selectedLeadership.map(id => parseInt(id));
            filteredAssessments = filteredAssessments.filter(assessment => {
              const assignment = assignments?.find(a => a.assessment_id === assessment.id);
              return assignment && assignment.leadership_layer_id && selectedLeadershipIds.includes(assignment.leadership_layer_id);
            });
          }

          // Apply campus filter (only for multi-site churches)
          if (church?.multi_site && !selectedCampus.includes('all') && selectedCampus.length > 0) {
            filteredAssessments = filteredAssessments.filter(assessment => {
              return assessment.campus && selectedCampus.includes(assessment.campus);
            });
          }

          // Merge with assignments for team/leadership info
          individualAssessments = filteredAssessments.map(assessment => {
            const assignment = assignments?.find(a => a.assessment_id === assessment.id);
            return {
              ...assessment,
              teamName: assignment?.teams?.name || 'Unassigned',
              leadershipName: assignment?.leadership_layers?.name || 'Unassigned'
            };
          }).sort((a, b) => a.name.localeCompare(b.name));
        }
      }
      
      // Get user and church names
      const userName = user?.displayName || user?.email || 'User';

      const churchName = church?.name || 'Church';

      // Use the utility function
      await exportToPDFUtil(
        chartData,
        profileBreakdown,
        getFilterTitle,
        includeList,
        individualAssessments,
        userName,
        churchName,
        customReportTitle
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      // Alert disabled to allow viewing console errors
      // alert('Unable to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExportConfirm = () => {
    setShowExportModal(false);
    exportToPDF(false); // Always export without individual list
  };

  const handleNavigateToResults = () => {
    navigate('/results');
  };

  const handleQuadrantClick = (quadrant: string) => {
    // Convert display name back to internal quadrant key
    const quadrantMap: Record<string, string> = {
      'Ideas Present': 'ideas_present',
      'People Possible': 'people_possible',
      'People Present': 'people_present',
      'Ideas Possible': 'ideas_possible'
    };

    const quadrantKey = quadrantMap[quadrant] || quadrant.toLowerCase().replace(' ', '_');

    // Navigate to results with quadrant filter using the internal key
    navigate(`/results?quadrant=${quadrantKey}`);
  };
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowTeamDropdown(false);
      setShowLeadershipDropdown(false);
      setShowCampusDropdown(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-8">
      {/* Single Integrated Chart Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300">
        {/* Header */}
        <div className="p-8 pb-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Team Composition</h3>
              <p className="text-gray-600 font-medium">{getFilterTitle()}</p>
            </div>
            <div className="flex items-center space-x-3">
              {totalValue > 0 && (
                <>
                  <button
                    onClick={handleExportClick}
                    disabled={isExporting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  >
                    <Download className="h-4 w-4" />
                    <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
                  </button>
                  <button
                    onClick={handleNavigateToResults}
                    className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-accent-500 to-accent-600 rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    View {totalValue} Results →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chart and Filters Layout */}
        <div className="p-8">
          {/* Mobile Filters - Show above chart on mobile */}
          <div className="lg:hidden space-y-4 mb-8">
            <div className="text-center">
              <h4 className="text-base font-bold text-gray-900 mb-1">Filters</h4>
            </div>

            {/* Team Filter */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                <Users className="h-4 w-4 inline mr-2" />
                Teams
              </label>
              <button
                onClick={() => {
                  setShowTeamDropdown(!showTeamDropdown);
                  setShowLeadershipDropdown(false);
                  setShowCampusDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md text-left"
              >
                <span className="text-sm font-medium text-gray-700 truncate">
                  {selectedTeams.includes('all') ? 'All Teams' : `${selectedTeams.length} Selected`}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${showTeamDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showTeamDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                  <div className="p-3">
                    <label className="flex items-center space-x-3 p-2 hover:bg-accent-50 rounded-lg cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes('all')}
                        onChange={() => handleTeamChange('all')}
                        className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-semibold text-gray-900 group-hover:text-accent-700">All Teams</span>
                    </label>
                    {teams.length > 0 && <div className="border-t border-gray-100 my-2"></div>}
                    {teams.map(team => (
                      <label key={team.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                        <input
                          type="checkbox"
                          checked={selectedTeams.includes(team.id.toString()) && !selectedTeams.includes('all')}
                          onChange={() => handleTeamChange(team.id.toString())}
                          className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{team.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Leadership Filter */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                <Award className="h-4 w-4 inline mr-2" />
                Leadership
              </label>
              <button
                onClick={() => {
                  setShowLeadershipDropdown(!showLeadershipDropdown);
                  setShowTeamDropdown(false);
                  setShowCampusDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md text-left"
              >
                <span className="text-sm font-medium text-gray-700 truncate">
                  {selectedLeadership.includes('all') ? 'All Levels' : `${selectedLeadership.length} Selected`}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${showLeadershipDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showLeadershipDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                  <div className="p-3">
                    <label className="flex items-center space-x-3 p-2 hover:bg-accent-50 rounded-lg cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        checked={selectedLeadership.includes('all')}
                        onChange={() => handleLeadershipChange('all')}
                        className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-semibold text-gray-900 group-hover:text-accent-700">All Levels</span>
                    </label>
                    {leadershipLayers.length > 0 && <div className="border-t border-gray-100 my-2"></div>}
                    {leadershipLayers.map(layer => (
                      <label key={layer.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                        <input
                          type="checkbox"
                          checked={selectedLeadership.includes(layer.id.toString()) && !selectedLeadership.includes('all')}
                          onChange={() => handleLeadershipChange(layer.id.toString())}
                          className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{layer.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Campus Filter (only for multi-site churches) */}
            {church?.multi_site && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Campus
                </label>
                <button
                  onClick={() => {
                    setShowCampusDropdown(!showCampusDropdown);
                    setShowTeamDropdown(false);
                    setShowLeadershipDropdown(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md text-left"
                >
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {selectedCampus.includes('all') ? 'All Campuses' : `${selectedCampus.length} Selected`}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${showCampusDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showCampusDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                    <div className="p-3">
                      <label className="flex items-center space-x-3 p-2 hover:bg-accent-50 rounded-lg cursor-pointer transition-colors group">
                        <input
                          type="checkbox"
                          checked={selectedCampus.includes('all')}
                          onChange={() => handleCampusChange('all')}
                          className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-accent-700">All Campuses</span>
                      </label>
                      {uniqueCampuses.length > 0 && <div className="border-t border-gray-100 my-2"></div>}
                      {uniqueCampuses.map(campus => (
                        <label key={campus} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                          <input
                            type="checkbox"
                            checked={selectedCampus.includes(campus) && !selectedCampus.includes('all')}
                            onChange={() => handleCampusChange(campus)}
                            className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{campus}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start lg:items-center">
            {/* Pie Chart - Takes up 2/3 of the space */}
            <div className="lg:col-span-2" data-chart-container>
              <QuadrantChart
                data={chartData}
                title=""
                loading={loading}
                profileBreakdown={profileBreakdown}
               onQuadrantClick={handleQuadrantClick}
              />
            </div>

            {/* Desktop Filters - Takes up 1/3 of the space (legend area) */}
            <div className="hidden lg:block space-y-6">
              <div className="text-center lg:text-left hidden lg:block">
                <h4 className="text-lg font-bold text-gray-900 mb-2">Filters</h4>
                <p className="text-sm text-gray-600">Customize your view</p>
              </div>
              
              {/* Team Filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  <Users className="h-4 w-4 inline mr-2" />
                  Teams
                </label>
                <button
                  onClick={() => {
                    setShowTeamDropdown(!showTeamDropdown);
                    setShowLeadershipDropdown(false);
                    setShowCampusDropdown(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md text-left"
                >
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {selectedTeams.includes('all') ? 'All Teams' : `${selectedTeams.length} Selected`}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${showTeamDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showTeamDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
                    <div className="p-3">
                      <label className="flex items-center space-x-3 p-2 hover:bg-accent-50 rounded-lg cursor-pointer transition-colors group">
                        <input
                          type="checkbox"
                          checked={selectedTeams.includes('all')}
                          onChange={() => handleTeamChange('all')}
                          className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-accent-700">All Teams</span>
                      </label>
                      {teams.length > 0 && <div className="border-t border-gray-100 my-2"></div>}
                      {teams.map(team => (
                        <label key={team.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                          <input
                            type="checkbox"
                            checked={selectedTeams.includes(team.id.toString()) && !selectedTeams.includes('all')}
                            onChange={() => handleTeamChange(team.id.toString())}
                            className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{team.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Leadership Filter */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  <Award className="h-4 w-4 inline mr-2" />
                  Leadership
                </label>
                <button
                  onClick={() => {
                    setShowLeadershipDropdown(!showLeadershipDropdown);
                    setShowTeamDropdown(false);
                    setShowCampusDropdown(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md text-left"
                >
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {selectedLeadership.includes('all') ? 'All Levels' : `${selectedLeadership.length} Selected`}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${showLeadershipDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showLeadershipDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
                    <div className="p-3">
                      <label className="flex items-center space-x-3 p-2 hover:bg-accent-50 rounded-lg cursor-pointer transition-colors group">
                        <input
                          type="checkbox"
                          checked={selectedLeadership.includes('all')}
                          onChange={() => handleLeadershipChange('all')}
                          className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-accent-700">All Levels</span>
                      </label>
                      {leadershipLayers.length > 0 && <div className="border-t border-gray-100 my-2"></div>}
                      {leadershipLayers.map(layer => (
                        <label key={layer.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                          <input
                            type="checkbox"
                            checked={selectedLeadership.includes(layer.id.toString()) && !selectedLeadership.includes('all')}
                            onChange={() => handleLeadershipChange(layer.id.toString())}
                            className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{layer.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Campus Filter (only for multi-site churches) */}
              {church?.multi_site && (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    <MapPin className="h-4 w-4 inline mr-2" />
                    Campus
                  </label>
                  <button
                    onClick={() => {
                      setShowCampusDropdown(!showCampusDropdown);
                      setShowTeamDropdown(false);
                      setShowLeadershipDropdown(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-white hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md text-left"
                  >
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {selectedCampus.includes('all') ? 'All Campuses' : `${selectedCampus.length} Selected`}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${showCampusDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCampusDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
                      <div className="p-3">
                        <label className="flex items-center space-x-3 p-2 hover:bg-accent-50 rounded-lg cursor-pointer transition-colors group">
                          <input
                            type="checkbox"
                            checked={selectedCampus.includes('all')}
                            onChange={() => handleCampusChange('all')}
                            className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                          />
                          <span className="text-sm font-semibold text-gray-900 group-hover:text-accent-700">All Campuses</span>
                        </label>
                        {uniqueCampuses.length > 0 && <div className="border-t border-gray-100 my-2"></div>}
                        {uniqueCampuses.map(campus => (
                          <label key={campus} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group">
                            <input
                              type="checkbox"
                              checked={selectedCampus.includes(campus) && !selectedCampus.includes('all')}
                              onChange={() => handleCampusChange(campus)}
                              className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900 truncate">{campus}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export Options Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowExportModal(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white px-6 py-6 text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Export PDF Options
                </h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Customize your PDF export:
                </p>

                {/* Custom Report Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Report Title
                  </label>
                  <input
                    type="text"
                    value={customReportTitle}
                    onChange={(e) => setCustomReportTitle(e.target.value)}
                    placeholder="Team Profile Report"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-accent-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">This will appear as the main title on your PDF</p>
                </div>

              </div>
              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportConfirm}
                  disabled={isExporting}
                  className="px-4 py-2 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-lg hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};