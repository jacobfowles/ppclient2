import React from 'react';
import { ChevronDown } from 'lucide-react';

interface Assessment {
  id: number;
  name?: string;
}

interface LeadershipLayer {
  id: number;
  name: string;
  level: number;
}

interface LeadershipAssignmentCellProps {
  assessment: Assessment;
  currentLeadership?: string;
  leadershipLayers: LeadershipLayer[];
  onAssign: (assessmentId: number, leadershipId: number | null) => void;
  isAdmin: boolean;
}

export const LeadershipAssignmentCell: React.FC<LeadershipAssignmentCellProps> = ({
  assessment,
  currentLeadership,
  leadershipLayers,
  onAssign,
  isAdmin
}) => {
  if (!isAdmin) {
    return (
      <span className="text-sm text-gray-900">
        {currentLeadership || (
          <span className="text-gray-400 italic">Unassigned</span>
        )}
      </span>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={() => {
          // This will be handled by the parent component to open a modal
          const event = new CustomEvent('openLeadershipModal', { 
            detail: { assessment } 
          });
          window.dispatchEvent(event);
        }}
        className="text-left w-full px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between group"
      >
        <span>
          {currentLeadership || (
            <span className="text-gray-400 italic">Unassigned</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
};