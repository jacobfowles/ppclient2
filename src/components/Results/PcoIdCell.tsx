import React from 'react';
import { CreditCard as Edit2 } from 'lucide-react';

interface Assessment {
  id: number;
  name?: string;
}

interface PcoIdCellProps {
  assessment: Assessment;
  currentPcoId?: string;
  onUpdate: (assessmentId: number, pcoId: string) => void;
  isAdmin: boolean;
}

export const PcoIdCell: React.FC<PcoIdCellProps> = ({
  assessment,
  currentPcoId,
  onUpdate,
  isAdmin
}) => {
  if (!isAdmin) {
    return (
      <span className="text-sm text-gray-900 font-mono">
        {currentPcoId || (
          <span className="text-gray-400 italic">Not matched</span>
        )}
      </span>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={() => {
          // This will be handled by the parent component to open a modal
          const event = new CustomEvent('openPcoModal', { 
            detail: { assessment } 
          });
          window.dispatchEvent(event);
        }}
        className="text-left w-full px-3 py-2 text-sm text-gray-900 font-mono hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between group"
      >
        <span>
          {currentPcoId || (
            <span className="text-gray-400 italic">Not matched</span>
          )}
        </span>
        <Edit2 className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
};