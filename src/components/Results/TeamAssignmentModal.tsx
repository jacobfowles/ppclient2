import React, { useState } from 'react';
import { X, Users, Search } from 'lucide-react';

interface Assessment {
  id: number;
  name?: string;
}

interface Team {
  id: number;
  name: string;
}

interface TeamAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: Assessment;
  teams: Team[];
  onAssign: (assessmentId: number, teamId: number | null) => void;
  loading: boolean;
}

export const TeamAssignmentModal: React.FC<TeamAssignmentModalProps> = ({
  isOpen,
  onClose,
  assessment,
  teams,
  onAssign,
  loading
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter teams based on search query
  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAssign(assessment.id, selectedTeamId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white px-6 py-6 text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign to Team
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
                Select Team
              </label>
              
              {/* Search Box */}
              {teams.length > 5 && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search teams..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent text-sm"
                  />
                </div>
              )}
              
              <div className="space-y-1 max-h-64 overflow-y-auto">
                <label className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="radio"
                    name="team"
                    value=""
                    checked={selectedTeamId === null}
                    onChange={() => setSelectedTeamId(null)}
                    className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-500 italic">Unassigned</span>
                </label>
                {filteredTeams.map(team => (
                  <label key={team.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="radio"
                      name="team"
                      value={team.id}
                      checked={selectedTeamId === team.id}
                      onChange={() => setSelectedTeamId(team.id)}
                      className="h-4 w-4 text-accent-600 focus:ring-accent-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-900">{team.name}</span>
                  </label>
                ))}
                
                {/* No results message */}
                {searchQuery && filteredTeams.length === 0 && (
                  <div className="p-3 text-center text-sm text-gray-500 italic">
                    No teams found matching "{searchQuery}"
                  </div>
                )}
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