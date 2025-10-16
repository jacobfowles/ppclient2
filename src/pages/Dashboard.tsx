import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, Calendar, UserX } from 'lucide-react';
import { Calendar as PlanningCenterIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { StatCard } from '../components/Dashboard/StatCard';
import { RecentActivity } from '../components/Dashboard/RecentActivity';
import { AssessmentTrendsChart } from '../components/Dashboard/AssessmentTrendsChart';
import { Assessment, Team, LeadershipLayer, supabase, secureQuery, logSecurityEvent } from '../lib/supabase';
import { 
  subDays, 
  startOfMonth, 
  startOfYear, 
  startOfWeek, 
  endOfWeek, 
  endOfMonth, 
  endOfYear,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfDay,
  endOfDay,
  startOfWeek as startOfWeekFn
} from 'date-fns';

interface TrendData {
  date: string;
  count: number;
  label: string;
}

export const Dashboard: React.FC = () => {
  const { churchId, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [layers, setLayers] = useState<LeadershipLayer[]>([]);
  const [stats, setStats] = useState({
    totalAssessments: 0,
    monthlyAssessments: 0,
    recentAssessments: 0,
    unassignedMembers: 0,
  });
  const [recentAssessments, setRecentAssessments] = useState<Assessment[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [timeWindow, setTimeWindow] = useState('this_year');
  const [aggregation, setAggregation] = useState('weeks');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [recentActivityTimeRange, setRecentActivityTimeRange] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [planningCenterConnected, setPlanningCenterConnected] = useState<boolean>(false);
  const [matchedToPlanningCenter, setMatchedToPlanningCenter] = useState(0);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && churchId) {
      loadInitialData();
      checkPlanningCenterConnection();
    }
  }, [authLoading, churchId]);

  useEffect(() => {
    if (!authLoading && churchId && initialDataLoaded) {
      loadDashboardStats();
      loadTrendData();
    }
  }, [authLoading, churchId, initialDataLoaded, timeWindow, aggregation, customStartDate, customEndDate]);

  useEffect(() => {
    if (!authLoading && churchId && initialDataLoaded) {
      loadRecentActivity();
    }
  }, [authLoading, churchId, initialDataLoaded, recentActivityTimeRange]);

  const loadInitialData = async () => {
    try {
      if (!user?.email) {
        throw new Error('User email is required');
      }

      logSecurityEvent('DASHBOARD_INITIAL_LOAD', { churchId, userId: user.email });
      
      // Use secure query wrapper
      const teamsSupabase = await secureQuery('teams', churchId, user.email, 'select');
      
      // Load teams
      const { data: teamsData, error: teamsError } = await teamsSupabase
        .select('*')
        .eq('church_id', churchId)
        .eq('active', true)
        .order('name');
      

      if (teamsError) {
        logSecurityEvent('DASHBOARD_TEAMS_ERROR', { churchId, error: teamsError.message });
      }

      // Load leadership layers
      const layersSupabase = await secureQuery('leadership_layers', churchId, user.email, 'select');
      const { data: layersData, error: layersError } = await layersSupabase
        .select('*')
        .eq('church_id', churchId)
        .eq('active', true)
        .order('level');

      if (layersError) {
        logSecurityEvent('DASHBOARD_LAYERS_ERROR', { churchId, error: layersError.message });
      }

      logSecurityEvent('DASHBOARD_DATA_LOADED', { 
        churchId, 
        teamsCount: teamsData?.length || 0,
        layersCount: layersData?.length || 0 
      });
      
      setTeams(teamsData || []);
      setLayers(layersData || []);
      setInitialDataLoaded(true);
    } catch (error) {
      logSecurityEvent('DASHBOARD_INITIAL_ERROR', { 
        churchId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      setLoading(false);
    }
  };

  const checkPlanningCenterConnection = async () => {
    try {
      const { data: churchData, error } = await supabase
        .from('churches')
        .select('planning_center_client_id, planning_center_connected_at, planning_center_access_token')
        .eq('id', churchId)
        .single();

      if (error) {
        console.error('Error checking Planning Center connection:', error);
        return;
      }

      const isConnected = churchData?.planning_center_client_id &&
                         churchData?.planning_center_connected_at &&
                         churchData?.planning_center_access_token;
      
      setPlanningCenterConnected(!!isConnected);

      if (isConnected) {
        loadMatchedCount();
      }
    } catch (error) {
      console.error('Error checking Planning Center connection:', error);
    }
  };

  const loadMatchedCount = async () => {
    try {
      const { data: matchedAssessments, error } = await supabase
        .from('assessments')
        .select('id')
        .eq('church_id', churchId)
        .is('deleted_at', null)
        .not('planning_center_person_id', 'is', null);

      if (error) {
        console.error('Error loading matched count:', error);
        return;
      }

      setMatchedToPlanningCenter(matchedAssessments?.length || 0);
    } catch (error) {
      console.error('Error loading matched count:', error);
    }
  };

  const getDateRange = (window: string, customStart?: string, customEnd?: string) => {
    const now = new Date();

    switch (window) {
      case 'last_7_days':
        return {
          start: subDays(now, 7),
          end: now
        };
      case 'last_30_days':
        return {
          start: subDays(now, 30),
          end: now
        };
      case 'last_90_days':
        return {
          start: subDays(now, 90),
          end: now
        };
      case 'this_week':
        return {
          start: startOfWeek(now),
          end: now
        };
      case 'this_month':
        return {
          start: startOfMonth(now),
          end: now
        };
      case 'last_month':
        const lastMonth = subDays(startOfMonth(now), 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth)
        };
      case 'this_year':
        return {
          start: startOfYear(now),
          end: now
        };
      case 'last_year':
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        return {
          start: startOfYear(lastYear),
          end: endOfYear(lastYear)
        };
      case 'all_time':
        return {
          start: new Date(2000, 0, 1), // Far enough back to capture all assessments
          end: now
        };
      case 'custom':
        return {
          start: customStart ? new Date(customStart) : startOfMonth(now),
          end: customEnd ? Math.min(new Date(customEnd), now) : now
        };
      default:
        return {
          start: startOfMonth(now),
          end: now
        };
    }
  };

  const loadTrendData = async () => {
    try {
      setTrendsLoading(true);
      
      if (!user?.email) {
        throw new Error('User email is required');
      }
      
      const { start, end } = getDateRange(timeWindow, customStartDate, customEndDate);
      

      // Optimized query - only select what we need and filter at database level
      const { data: assessments, error } = await supabase
        .from('assessments')
        .select('created_at')
        .eq('church_id', churchId)
        .is('deleted_at', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logSecurityEvent('TRENDS_DATA_ERROR', { churchId, error: error.message });
        console.error('Error loading trend data:', error);
        return;
      }
      

      // Pre-calculate intervals more efficiently
      let intervals: Date[] = [];
      const maxIntervals = 100; // Limit to prevent performance issues
      
      switch (aggregation) {
        case 'days':
          intervals = eachDayOfInterval({ start, end })
            .filter(date => date <= new Date())
            .slice(-maxIntervals); // Only show last N intervals
          break;
        case 'weeks':
          intervals = eachWeekOfInterval({ start, end })
            .filter(date => date <= new Date())
            .slice(-maxIntervals);
          break;
        case 'months':
          intervals = eachMonthOfInterval({ start, end })
            .filter(date => date <= new Date())
            .slice(-maxIntervals);
          break;
      }

      // More efficient counting using Map for O(1) lookups
      const assessmentsByDate = new Map<string, number>();
      
      // Pre-process assessments into date buckets
      assessments?.forEach(assessment => {
        const assessmentDate = new Date(assessment.created_at);
        let bucketKey: string;
        
        switch (aggregation) {
          case 'days':
            bucketKey = startOfDay(assessmentDate).toISOString();
            break;
          case 'weeks':
            bucketKey = startOfWeek(assessmentDate).toISOString();
            break;
          case 'months':
            bucketKey = startOfMonth(assessmentDate).toISOString();
            break;
          default:
            bucketKey = startOfDay(assessmentDate).toISOString();
        }
        
        assessmentsByDate.set(bucketKey, (assessmentsByDate.get(bucketKey) || 0) + 1);
      });

      // Generate trend data using pre-processed counts
      const trendData: TrendData[] = intervals.map(intervalStart => {
        let label: string;
        let bucketKey: string;
        
        switch (aggregation) {
          case 'days':
            label = format(intervalStart, 'MMM d');
            bucketKey = intervalStart.toISOString();
            break;
          case 'weeks':
            label = format(intervalStart, 'MMM d');
            bucketKey = intervalStart.toISOString();
            break;
          case 'months':
            label = format(intervalStart, 'MMM yyyy');
            bucketKey = intervalStart.toISOString();
            break;
          default:
            label = format(intervalStart, 'MMM d');
            bucketKey = intervalStart.toISOString();
        }

        const count = assessmentsByDate.get(bucketKey) || 0;

        return {
          date: intervalStart.toISOString(),
          count,
          label
        };
      });

      setTrendData(trendData);
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setTrendsLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { start } = getDateRange(recentActivityTimeRange);
      
      const { data: recent, error: recentError } = await supabase
        .from('assessments')
        .select('id, first_name, last_name, email, profile, created_at')
        .eq('church_id', churchId)
        .is('deleted_at', null)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentError) {
        console.error('Error loading recent assessments:', recentError);
        return;
      }

      // Transform recent assessments
      const transformedRecent = (recent || []).map(assessment => ({
        ...assessment,
        name: `${assessment.first_name} ${assessment.last_name}`,
        submitted_at: assessment.created_at,
        profile_type: assessment.profile.charAt(0).toUpperCase() + assessment.profile.slice(1).toLowerCase(),
        quadrant: getQuadrantFromProfile(assessment.profile)
      }));

      setRecentAssessments(transformedRecent);
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const loadDashboardStats = async () => {
    try {

      const now = new Date();
      const monthStart = startOfMonth(now);
      const yearStart = startOfYear(now);

      // Optimized: Load all assessments with minimal data in one query
      const { data: allAssessments, error: totalError } = await supabase
        .from('assessments')
        .select('id, created_at')
        .eq('church_id', churchId)
        .is('deleted_at', null);

      if (totalError) {
        console.error('Error loading total assessments:', totalError);
        return;
      }

      // Filter in memory instead of multiple database queries
      const monthlyAssessments = allAssessments?.filter(a => 
        new Date(a.created_at) >= monthStart
      ) || [];
      
      const yearlyAssessments = allAssessments?.filter(a => 
        new Date(a.created_at) >= yearStart
      ) || [];

      // Load team assignments - use same logic as Results page
      const assessmentIds = (allAssessments || []).map(a => a.id);
      let assignments: any[] = [];
      
      if (assessmentIds.length > 0) {
        // Optimized: Only select what we need for counting
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('team_assignments')
          .select('assessment_id, team_id')
          .in('assessment_id', assessmentIds)
          .eq('active', true);
        
        if (assignmentsError) {
          console.error('Error loading assignments:', assignmentsError);
        } else {
          assignments = assignmentsData || [];
        }
      }
      
      // Count assigned/unassigned using exact same logic as Results page
      const assessmentsWithAssignments = (allAssessments || []).map(assessment => {
        const assignment = assignments.find(a => a.assessment_id === assessment.id);
        return {
          ...assessment,
          team_assignments: assignment ? [assignment] : []
        };
      });
      
      // Filter for unassigned (same logic as Results page)
      const unassignedAssessments = assessmentsWithAssignments.filter(a => 
        !a.team_assignments || a.team_assignments.length === 0 || !a.team_assignments[0]?.team_id
      );
      
      // Filter for assigned
      const assignedAssessments = assessmentsWithAssignments.filter(a => 
        a.team_assignments && a.team_assignments.length > 0 && a.team_assignments[0]?.team_id
      );

      // Update state
      const newStats = {
        totalAssessments: allAssessments?.length || 0,
        monthlyAssessments: monthlyAssessments?.length || 0,
        recentAssessments: monthlyAssessments?.length || 0,
        assignedMembers: assignedAssessments.length,
        unassignedMembers: unassignedAssessments.length,
      };

      setStats(newStats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine quadrant from profile
  const getQuadrantFromProfile = (profile: string): 'ideas_present' | 'people_possible' | 'people_present' | 'ideas_possible' => {
    // Normalize profile name to handle case variations
    const normalizedProfile = profile.charAt(0).toUpperCase() + profile.slice(1).toLowerCase();
    
    const profileMap: Record<string, 'ideas_present' | 'people_possible' | 'people_present' | 'ideas_possible'> = {
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
  const handleCustomDateChange = (startDate: string, endDate: string) => {
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
  };

  const handleStatCardClick = (cardType: 'total' | 'recent' | 'assigned' | 'unassigned') => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    
    switch (cardType) {
      case 'total':
        // Show all assessments
        navigate('/results');
        break;
      case 'recent':
        // Show assessments from this month
        navigate(`/results?dateFrom=${monthStart.toISOString().split('T')[0]}`);
        break;
      case 'assigned':
        // Show only assigned members (will need to be handled in Results page)
        navigate('/results?assignment=assigned');
        break;
      case 'unassigned':
        // Show only unassigned members
        navigate('/results?assignment=unassigned');
        break;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-navy-200 rounded-2xl animate-pulse"></div>
          ))}
        </div>
        <div className="h-96 bg-navy-200 rounded-2xl animate-pulse"></div>
        <div className="h-64 bg-navy-200 rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${planningCenterConnected ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <StatCard
          title="Total Assessments"
          value={stats.totalAssessments}
          icon={BarChart3}
          color="purple"
          onClick={() => handleStatCardClick('total')}
          clickable={true}
        />
        <StatCard
          title="Assessments this Month"
          value={stats.recentAssessments}
          icon={Calendar}
          color="purple"
          onClick={() => handleStatCardClick('recent')}
          clickable={true}
        />
        {planningCenterConnected && (
          <StatCard
            title="Matched to Planning Center"
            value={matchedToPlanningCenter}
            icon={PlanningCenterIcon}
            color="blue"
            onClick={() => navigate('/people-matching')}
            clickable={true}
          />
        )}
        <StatCard
          title="Tagged to a Team"
          value={stats.assignedMembers || 0}
          icon={Users}
          color="green"
          onClick={() => handleStatCardClick('assigned')}
          clickable={true}
        />
      </div>

      {/* Assessment Trends Chart */}
      <AssessmentTrendsChart
        data={trendData}
        loading={trendsLoading}
        timeWindow={timeWindow}
        aggregation={aggregation}
        onTimeWindowChange={setTimeWindow}
        onAggregationChange={setAggregation}
        onCustomDateChange={handleCustomDateChange}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
      />

      {/* Recent Activity */}
      <RecentActivity 
        assessments={recentAssessments} 
        loading={loading}
        timeRange={recentActivityTimeRange}
        onTimeRangeChange={setRecentActivityTimeRange}
      />
    </div>
  );
};