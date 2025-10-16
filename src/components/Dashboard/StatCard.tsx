import React from 'react';
import { DivideIcon as LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon: LucideIcon;
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple';
  onClick?: () => void;
  clickable?: boolean;
}

const colorClasses = {
  blue: {
    bg: 'bg-accent-500',
    light: 'bg-gradient-to-br from-accent-50 to-accent-100',
    text: 'text-accent-500',
    change: 'text-accent-500'
  },
  green: {
    bg: 'bg-success-500',
    light: 'bg-gradient-to-br from-success-50 to-success-100',
    text: 'text-success-600',
    change: 'text-success-600'
  },
  red: {
    bg: 'bg-error-500',
    light: 'bg-gradient-to-br from-error-50 to-error-100',
    text: 'text-error-500',
    change: 'text-error-500'
  },
  orange: {
    bg: 'bg-brown-500',
    light: 'bg-gradient-to-br from-brown-50 to-brown-100',
    text: 'text-brown-500',
    change: 'text-brown-500'
  },
  purple: {
    bg: 'bg-gray-500',
    light: 'bg-gradient-to-br from-gray-50 to-gray-100',
    text: 'text-gray-500',
    change: 'text-gray-500'
  }
};

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color,
  onClick,
  clickable = false
}) => {
  const colors = colorClasses[color];

  const cardContent = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">{title}</p>
          <p className="text-4xl font-black text-primary-500 mb-3 tracking-tight">{value}</p>
          
          {change && (
            <div className="flex items-center space-x-2">
              {change.type === 'increase' ? (
                <TrendingUp className={`h-5 w-5 ${colors.change}`} />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              <span className={`text-sm font-semibold ${
                change.type === 'increase' ? colors.change : 'text-red-500'
              }`}>
                {change.value > 0 ? '+' : ''}{change.value}%
              </span>
              <span className="text-sm text-gray-500 font-medium">{change.period}</span>
            </div>
          )}
        </div>
        
        <div className={`${colors.light} p-4 rounded-2xl shadow-md`}>
          <Icon className={`h-8 w-8 ${colors.text}`} />
        </div>
      </div>
    </>
  );

  if (clickable && onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 shadow-lg hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 shadow-lg">
      {cardContent}
    </div>
  );
};