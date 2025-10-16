import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { QUADRANT_COLORS } from '../../lib/supabase';

interface TeamBarData {
  teamName: string;
  ideas_present: number;
  people_possible: number;
  people_present: number;
  ideas_possible: number;
  total: number;
}

interface TeamBarChartProps {
  data: TeamBarData[];
  loading?: boolean;
  onTotalClick?: (teamName: string) => void;
}

export const TeamBarChart: React.FC<TeamBarChartProps> = ({ data, loading = false, onTotalClick }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-lg">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Team Composition by Quadrant</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-500"></div>
        </div>
      </div>
    );
  }

  const renderTooltip = (props: any) => {
    if (props.active && props.payload && props.payload.length) {
      const data = props.payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4">
          <p className="font-bold text-gray-900 mb-3 text-center">{data.teamName}</p>
          <div className="space-y-1">
            {props.payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between space-x-6">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {entry.dataKey.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900">{entry.value}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-2 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">Total Members</span>
                <span className="text-lg font-black text-gray-900">{data.total}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    return (
      <div className="grid grid-cols-2 lg:flex lg:justify-center gap-2 lg:gap-8 mt-6 px-2">
        {props.payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center space-x-2 lg:space-x-3 px-2 lg:px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <div 
              className="w-4 h-4 rounded-full shadow-md"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs lg:text-sm font-semibold text-gray-800 truncate">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-3 sm:space-y-0">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Team Composition by Quadrant</h3>
        </div>
        {onTotalClick && (
          <button
            onClick={() => onTotalClick('')}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-accent-500 to-accent-600 rounded-lg hover:from-accent-600 hover:to-accent-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap"
          >
            View {data.reduce((sum, team) => sum + team.total, 0)} Total →
          </button>
        )}
      </div>
      
      {data.length === 0 ? (
        <div className="h-64 sm:h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
            <p className="text-gray-500 font-medium">No team data available</p>
            <p className="text-sm text-gray-400 mt-1">Data will appear here once teams are created and members assigned</p>
          </div>
        </div>
      ) : (
        <div className="h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 10,
                left: 10,
                bottom: 40,
              }}
              barCategoryGap="15%"
              maxBarSize={50}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
              <XAxis 
                dataKey="teamName" 
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                tickLine={{ stroke: '#cbd5e1' }}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                tickLine={{ stroke: '#cbd5e1' }}
                axisLine={{ stroke: '#cbd5e1' }}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.max(5, dataMax)]}
                ticks={data.length > 0 && Math.max(...data.map(d => d.total)) <= 5 ? [0, 1, 2, 3, 4, 5] : undefined}
                type="number"
              />
              <Tooltip content={renderTooltip} />
              <Legend content={renderLegend} />
              <Bar 
                dataKey="ideas_present" 
                stackId="quadrant" 
                fill={QUADRANT_COLORS.ideas_present}
                name="Ideas Present"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="people_possible" 
                stackId="quadrant" 
                fill={QUADRANT_COLORS.people_possible}
                name="People Possible"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="people_present" 
                stackId="quadrant" 
                fill={QUADRANT_COLORS.people_present}
                name="People Present"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="ideas_possible" 
                stackId="quadrant" 
                fill={QUADRANT_COLORS.ideas_possible}
                name="Ideas Possible"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};