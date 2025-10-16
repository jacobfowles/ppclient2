import React from 'react';
import { format } from 'date-fns';
import { Assessment, QUADRANT_COLORS } from '../../lib/supabase';
import { Clock } from 'lucide-react';

interface RecentActivityProps {
  assessments: Assessment[];
  loading: boolean;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

const timeRangeOptions = [
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' }
];

export const RecentActivity: React.FC<RecentActivityProps> = ({ 
  assessments, 
  loading, 
  timeRange, 
  onTimeRangeChange 
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-navy-100 p-4 sm:p-6 lg:p-8 shadow-premium">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <h3 className="text-xl font-black text-navy-900 tracking-tight">Recent Activity</h3>
          <div className="w-32 h-8 bg-navy-100 rounded animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-4 animate-pulse">
              <div className="w-12 h-12 bg-navy-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-navy-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-navy-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-4 sm:p-6 lg:p-8 shadow-premium hover:shadow-xl transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-primary-900 tracking-tight mb-2">Recent Activity</h3>
          <p className="text-primary-600 font-medium text-sm sm:text-base">Latest assessment completions</p>
        </div>
        
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Clock className="h-4 w-4 text-primary-400" />
          <select
            value={timeRange}
            onChange={(e) => onTimeRangeChange(e.target.value)}
            className="px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium bg-primary-50 flex-1 sm:flex-none"
          >
            {timeRangeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      
      {assessments.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-primary-400" />
          </div>
          <p className="text-primary-500 font-medium">No recent assessments</p>
          <p className="text-sm text-primary-400 mt-1">for the selected time period</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {assessments.map((assessment) => (
            <div key={assessment.id} className="flex items-center space-x-3 sm:space-x-4 p-3 sm:p-4 hover:bg-primary-50 rounded-xl transition-all duration-200 border border-transparent hover:border-primary-100">
              <div 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-md flex-shrink-0"
                style={{ backgroundColor: QUADRANT_COLORS[assessment.quadrant] }}
              >
                {assessment.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm sm:text-base font-bold text-primary-900 truncate">
                  {assessment.name}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mt-1">
                  <span className="text-xs sm:text-sm text-primary-500 font-medium truncate">
                    {assessment.profile_type}
                  </span>
                  <span className="hidden sm:inline text-xs text-primary-300">•</span>
                  <span className="text-xs sm:text-sm text-primary-500 font-medium">
                    {format(new Date(assessment.submitted_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div 
                  className="inline-flex px-2 sm:px-3 py-1 text-xs font-bold rounded-full text-white shadow-sm"
                  style={{ backgroundColor: QUADRANT_COLORS[assessment.quadrant] }}
                >
                  <span className="hidden sm:inline">
                    {assessment.quadrant.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                  <span className="sm:hidden">
                    {assessment.quadrant.split('_').map(word => word[0].toUpperCase()).join('')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};