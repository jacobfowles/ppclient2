import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Target, Lightbulb, Users, TrendingUp } from 'lucide-react';
import { QUADRANT_COLORS } from '../../lib/supabase';

interface QuadrantData {
  name: string;
  value: number;
  quadrant: string;
  percentage: number;
}

interface QuadrantChartProps {
  data: QuadrantData[];
  title: string;
  loading?: boolean;
  profileBreakdown?: Record<string, Record<string, number>>;
  onQuadrantClick?: (quadrant: string) => void;
}

const quadrantInfo = {
  ideas_present: {
    icon: Target,
    description: 'Task-focused, Present-oriented',
    title: 'Ideas Present',
    profiles: ['Action', 'Efficiency', 'Practicality', 'Systematization']
  },
  people_possible: {
    icon: Lightbulb,
    description: 'People-focused, Future-oriented',
    title: 'People Possible',
    profiles: ['Collaboration', 'Enthusiasm', 'Inspiration', 'Virtue']
  },
  people_present: {
    icon: Users,
    description: 'People-focused, Present-oriented',
    title: 'People Present',
    profiles: ['Connection', 'Dependability', 'Passion', 'Support']
  },
  ideas_possible: {
    icon: TrendingUp,
    description: 'Task-focused, Future-oriented',
    title: 'Ideas Possible',
    profiles: ['Determination', 'Energy', 'Knowledge', 'Strategy']
  }
};

// Helper function to generate color variations
const generateProfileColors = (baseColor: string, count: number): string[] => {
  const colors: string[] = [];
  const baseHex = baseColor.replace('#', '');
  const r = parseInt(baseHex.substr(0, 2), 16);
  const g = parseInt(baseHex.substr(2, 2), 16);
  const b = parseInt(baseHex.substr(4, 2), 16);
  
  for (let i = 0; i < count; i++) {
    const factor = 0.6 + (i * 0.4 / Math.max(count - 1, 1)); // Range from 0.6 to 1.0
    const newR = Math.round(r * factor);
    const newG = Math.round(g * factor);
    const newB = Math.round(b * factor);
    colors.push(`rgb(${newR}, ${newG}, ${newB})`);
  }
  
  return colors;
};

export const QuadrantChart: React.FC<QuadrantChartProps> = ({ 
  data, 
  title, 
  loading = false,
  profileBreakdown,
  onQuadrantClick
}) => {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
        <div className="h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-500"></div>
        </div>
      </div>
    );
  }

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  // Create subdivided data when a slice is active
  const getSubdividedData = () => {
    if (activeIndex === null || activeIndex >= data.length) {
      return data;
    }
    
    const activeQuadrant = data[activeIndex];
    if (!activeQuadrant) {
      return data;
    }
    
    const subdividedData: any[] = [...data];
    
    // Replace the active quadrant with its profile segments
    const quadrantKey = activeQuadrant.quadrant as keyof typeof quadrantInfo;
    const profiles = quadrantInfo[quadrantKey]?.profiles || [];
    const quadrantProfiles = profileBreakdown?.[activeQuadrant.quadrant] || {};
    
    // Generate colors for profiles
    const baseColor = QUADRANT_COLORS[activeQuadrant.quadrant];
    const profileColors = generateProfileColors(baseColor, profiles.length);
    
    // Create profile segments to replace the active quadrant
    const profileSegments: any[] = [];
    profiles.forEach((profile, index) => {
      const profileCount = quadrantProfiles[profile] || 0;
      if (profileCount > 0) {
        profileSegments.push({
          name: profile,
          value: profileCount,
          quadrant: `${activeQuadrant.quadrant}_profile_${index}`,
          percentage: activeQuadrant.value > 0 ? (profileCount / activeQuadrant.value) * 100 : 0,
          color: profileColors[index],
          isProfile: true,
          parentQuadrant: activeQuadrant.quadrant,
          originalIndex: activeIndex
        });
      }
    });
    
    // Replace the active quadrant with profile segments
    subdividedData.splice(activeIndex, 1, ...profileSegments);
    
    return subdividedData;
  };

  const renderCustomizedLabel = (entry: any) => {
    if (entry.isProfile && entry.value > 0) {
      const RADIAN = Math.PI / 180;
      const radius = entry.outerRadius + 15; // Distance from slice
      const x = entry.cx + radius * Math.cos(-entry.midAngle * RADIAN);
      const y = entry.cy + radius * Math.sin(-entry.midAngle * RADIAN);
      
      // Calculate if label should be on left or right side
      const isRightSide = x > entry.cx;
      
      // Simple vertical adjustment for bottom labels
      let adjustedY = y;
      const normalizedAngle = ((entry.midAngle % 360) + 360) % 360;
      
      // Only adjust labels that are very close to the bottom center
      if (normalizedAngle > 250 && normalizedAngle < 290) {
        // For labels very close to bottom center, add small vertical offset
        if (normalizedAngle < 270) {
          adjustedY = y - 8; // Push slightly up
        } else {
          adjustedY = y + 8; // Push slightly down
        }
      }

      return (
        <text 
          x={x} 
          y={adjustedY} 
          fill="#1f2937"
          textAnchor={isRightSide ? 'start' : 'end'} 
          dominantBaseline="central"
          className="text-xs font-medium"
          style={{
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            letterSpacing: '0.025em',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
          }}
        >
          {entry.value > 0 ? `${entry.name}: ${entry.value}` : ''}
        </text>
      );
    }
    return null;
  };

  const renderActiveShape = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    
    // Only explode non-profile slices
    if (props.payload?.isProfile) {
      return (
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={props.payload.color || fill}
          stroke="#ffffff"
          strokeWidth={2}
        />
      );
    }
    
    // Explode the slice outward
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const explodeDistance = 15;
    const newCx = cx + explodeDistance * cos;
    const newCy = cy + explodeDistance * sin;
    
    return (
      <Sector
        cx={newCx}
        cy={newCy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="#ffffff"
        strokeWidth={3}
      />
    );
  };

  const renderCenterContent = () => {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{totalValue}</div>
          <div className="text-sm text-gray-500 uppercase tracking-wide font-medium">Total People</div>
        </div>
      </div>
    );
  };

  const renderEnhancedLegend = () => {
    // Create a complete dataset with all quadrants, filling in zeros for missing ones
    const allQuadrants = Object.keys(quadrantInfo) as (keyof typeof quadrantInfo)[];
    const completeData = allQuadrants.map(quadrantKey => {
      const existingData = data.find(d => d.quadrant === quadrantKey);
      return existingData || {
        name: quadrantInfo[quadrantKey].title,
        value: 0,
        percentage: 0,
        quadrant: quadrantKey
      };
    });

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {completeData.map((item, index) => {
          // Defensive check to prevent undefined errors
          if (!item || !item.quadrant || !(item.quadrant in quadrantInfo)) {
            return null;
          }
          
          const info = quadrantInfo[item.quadrant as keyof typeof quadrantInfo];
          const Icon = info.icon;
          const dataIndex = data.findIndex(d => d.quadrant === item.quadrant);
          const isActive = activeIndex === dataIndex;
          
          return (
            <div
              key={item.quadrant}
              className={`bg-white border-2 rounded-xl p-4 transition-all duration-300 cursor-pointer ${
                isActive 
                  ? 'border-gray-300 shadow-lg transform scale-105' 
                  : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
              }`}
              onMouseEnter={() => {
                if (dataIndex >= 0) {
                  setActiveIndex(dataIndex);
                }
              }}
              onMouseLeave={() => {
                setActiveIndex(null);
              }}
            >
              <div className="flex items-start space-x-3">
                <div 
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'transform scale-110' : ''
                  }`}
                  style={{ backgroundColor: QUADRANT_COLORS[item.quadrant] }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-gray-900 truncate">{info.title}</h4>
                    {onQuadrantClick && item.value > 0 ? (
                      <button
                        onClick={() => onQuadrantClick(item.quadrant)}
                        className="text-lg font-bold text-gray-900 ml-2 hover:text-accent-600 transition-colors underline decoration-transparent hover:decoration-accent-600 decoration-2 underline-offset-2"
                      >
                        {item.value}
                      </button>
                    ) : (
                      <span className="text-lg font-bold text-gray-900 ml-2">{item.value}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-3">{info.description}</p>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${item.percentage}%`,
                        backgroundColor: QUADRANT_COLORS[item.quadrant]
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">{item.percentage.toFixed(1)}%</span>
                    <span className="text-xs text-gray-500">of total</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const subdividedData = getSubdividedData();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 pr-2">{title}</h3>
        </div>
      </div>
      
      {totalValue === 0 ? (
        <div className="h-64 sm:h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
            <p className="text-gray-500 font-medium">No data available</p>
            <p className="text-sm text-gray-400 mt-1">Data will appear here once assessments are completed</p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative w-full aspect-square max-w-lg mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subdividedData}
                  cx="50%"
                  cy="50%"
                  innerRadius="40%"
                  outerRadius="55%"
                  dataKey="value"
                  stroke="none"
                  activeIndex={activeIndex !== null ? subdividedData.findIndex((item: any) => !item.isProfile && data.findIndex(d => d.quadrant === item.quadrant) === activeIndex) : undefined}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => {
                    const clickedItem = subdividedData[index] as any;
                    
                    if (clickedItem?.isProfile) {
                      // If clicking on a profile segment, keep the current active state
                      return;
                    } else {
                      // For regular quadrant slices, set the active index
                      setActiveIndex(index);
                    }
                  }}
                  onMouseLeave={() => {
                    setActiveIndex(null);
                  }}
                  animationBegin={0}
                  animationDuration={300}
                  labelLine={false}
                  label={renderCustomizedLabel}
                  margin={{ top: 50, right: 50, bottom: 50, left: 50 }}
                >
                  {subdividedData.map((entry: any, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isProfile ? entry.color : QUADRANT_COLORS[entry.quadrant]} 
                      stroke="#ffffff"
                      strokeWidth={entry.isProfile ? 1 : 2}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {renderCenterContent()}
          </div>
          
          {renderEnhancedLegend()}
        </>
      )}
    </div>
  );
};