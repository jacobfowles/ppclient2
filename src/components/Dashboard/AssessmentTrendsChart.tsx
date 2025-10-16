import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface TrendData {
  date: string;
  count: number;
  label: string;
}

interface AssessmentTrendsChartProps {
  data: TrendData[];
  loading?: boolean;
  timeWindow: string;
  aggregation: string;
  onTimeWindowChange: (window: string) => void;
  onAggregationChange: (aggregation: string) => void;
  onCustomDateChange: (startDate: string, endDate: string) => void;
  customStartDate: string;
  customEndDate: string;
}

const timeWindowOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' }
];

const aggregationOptions = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' }
];

export const AssessmentTrendsChart: React.FC<AssessmentTrendsChartProps> = ({
  data,
  loading = false,
  timeWindow,
  aggregation,
  onTimeWindowChange,
  onAggregationChange,
  onCustomDateChange,
  customStartDate,
  customEndDate
}) => {
  const renderTooltip = (props: any) => {
    if (props.active && props.payload && props.payload.length) {
      const data = props.payload[0].payload;
      return (
        <div className="bg-white border border-primary-200 rounded-xl shadow-lg p-4">
          <p className="font-semibold text-primary-900 mb-1">{data.label}</p>
          <p className="text-sm text-primary-600">
            {data.count} assessment{data.count !== 1 ? 's' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-primary-100 p-8 shadow-premium">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
          <h3 className="text-xl font-black text-primary-900 tracking-tight">Assessment Trends</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="w-32 h-8 bg-primary-100 rounded animate-pulse"></div>
            <div className="w-24 h-8 bg-primary-100 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-primary-100 p-4 sm:p-6 lg:p-8 shadow-premium hover:shadow-xl transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-primary-900 tracking-tight mb-2">Assessment Trends</h3>
          <p className="text-primary-600 font-medium text-sm sm:text-base">Track assessment completion over time</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm font-semibold text-primary-700 uppercase tracking-wide whitespace-nowrap">Period:</label>
            <select
              value={timeWindow}
              onChange={(e) => onTimeWindowChange(e.target.value)}
              className="px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium bg-primary-50 flex-1 sm:flex-none"
            >
              {timeWindowOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm font-semibold text-primary-700 uppercase tracking-wide whitespace-nowrap">Group by:</label>
            <select
              value={aggregation}
              onChange={(e) => onAggregationChange(e.target.value)}
              className="px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium bg-primary-50 flex-1 sm:flex-none"
            >
              {aggregationOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {timeWindow === 'custom' && (
        <div className="mb-6 p-3 sm:p-4 bg-primary-50 rounded-xl border border-primary-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <label className="text-xs sm:text-sm font-semibold text-primary-700 whitespace-nowrap">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomDateChange(e.target.value, customEndDate)}
                className="px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium flex-1 sm:flex-none"
              />
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <label className="text-xs sm:text-sm font-semibold text-primary-700 whitespace-nowrap">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomDateChange(customStartDate, e.target.value)}
                className="px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium flex-1 sm:flex-none"
              />
            </div>
          </div>
        </div>
      )}
      
      {data.length === 0 ? (
        <div className="h-64 sm:h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-primary-500 font-medium">No assessment data available</p>
            <p className="text-sm text-primary-400 mt-1">for the selected time period</p>
          </div>
        </div>
      ) : (
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 10,
                right: 10,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={{ stroke: '#cbd5e1' }}
                axisLine={{ stroke: '#cbd5e1' }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={{ stroke: '#cbd5e1' }}
                axisLine={{ stroke: '#cbd5e1' }}
                allowDecimals={false}
                width={30}
              />
              <Tooltip content={renderTooltip} />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#1e293b"
                strokeWidth={2}
                dot={{ fill: '#1e293b', strokeWidth: 1, r: 3 }}
                activeDot={{ r: 5, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};