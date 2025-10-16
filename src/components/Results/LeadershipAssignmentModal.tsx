import React, { useState } from 'react';
import { X, Award } from 'lucide-react';

interface Assessment {
  id: number;
  name?: string;
}

interface LeadershipLayer {
  id: number;
  name: string;
  level: number;
}

interface LeadershipAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: Assessment;
  leadershipLayers: LeadershipLayer[];
  onAssign: (assessmentId: number, leadershipId: number | null) => void;
  loading: boolean;
}

export const LeadershipAssignmentModal: React.FC<LeadershipAssignmentModalProps> = ({
  isOpen,
  onClose,
  assessment,
  leadershipLayers,
  onAssign,
  loading
}) => {
  const [selectedLeadershipId, setSelectedLeadershipId] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAssign(assessment.id, selectedLeadershipId);
  };

  if (!isOpen) return null;

  const sortedLayers = [...leadershipLayers].sort((a, b) => a.level - b.level);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white px-6 py-6 text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign Leadership Role
                </h3>
                <p className="text-sm text-gray-600">
                  {assessment.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Leadership Level
              </label>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                <label className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="radio"
                    name="leadership"
                    value=""
                    checked={selectedLeadershipId === null}
                    onChange={() => setSelectedLeadershipId(null)}
                    className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-500 italic">Unassigned</span>
                </label>
                {sortedLayers.map(layer => (
                  <label key={layer.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="radio"
                      name="leadership"
                      value={layer.id}
                      checked={selectedLeadershipId === layer.id}
                      onChange={() => setSelectedLeadershipId(layer.id)}
                      className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300"
                    />
                    <div className="flex items-center space-x-2">
                      <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
                        Level {layer.level}
                      </span>
                      <span className="text-sm text-gray-900">{layer.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 text-sm font-medium text-white bg-accent-600 border border-transparent rounded-xl hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};