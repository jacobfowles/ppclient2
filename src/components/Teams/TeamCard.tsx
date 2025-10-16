import React from 'react';
import { Edit2, Trash2, Users } from 'lucide-react';
import { Team } from '../../lib/supabase';

interface TeamCardProps {
  team: Team;
  memberCount: number;
  onEdit?: (team: Team) => void;
  onDelete?: (team: Team) => void;
  showActions?: boolean;
}

export const TeamCard: React.FC<TeamCardProps> = ({ 
  team, 
  memberCount, 
  onEdit, 
  onDelete,
  showActions = true
}) => {
  return (
    <div className="bg-white rounded-xl border border-[#f0f0f4] p-6 hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[#1d1d1f] mb-2">{team.name}</h3>
          {team.description && (
            <p className="text-sm text-[#858587] mb-3">{team.description}</p>
          )}
          
          <div className="flex items-center text-sm text-[#858587]">
            <Users className="h-4 w-4 mr-1" />
            <span>{memberCount} members</span>
          </div>
        </div>
        
        {showActions && (onEdit || onDelete) && (
          <div className="flex items-center space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(team)}
                className="p-2 text-[#858587] hover:text-[#1d1d1f] hover:bg-[#f0f0f4] rounded-lg transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(team)}
                className="p-2 text-[#858587] hover:text-[#932834] hover:bg-[#f0f0f4] rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between text-xs text-[#858587]">
        <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
        {team.active && (
          <span className="bg-[#f0f0f4] text-[#1d1d1f] px-2 py-1 rounded-full font-medium">Active</span>
        )}
      </div>
    </div>
  );
};