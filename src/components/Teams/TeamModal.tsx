import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { X, Upload, FileText } from 'lucide-react';
import { Team } from '../../lib/supabase';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TeamFormData) => void;
  onBulkSave?: (teams: TeamFormData[]) => void;
  team?: Team | null;
  loading?: boolean;
}

interface TeamFormData {
  name: string;
  description?: string;
}

const schema = yup.object({
  name: yup.string().required('Team name is required').max(255, 'Name is too long'),
  description: yup.string().max(1000, 'Description is too long'),
});

export const TeamModal: React.FC<TeamModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onBulkSave,
  team,
  loading = false,
}) => {
  const [importMode, setImportMode] = React.useState<'single' | 'bulk'>('single');
  const [bulkTeamsText, setBulkTeamsText] = React.useState('');
  const [bulkTeams, setBulkTeams] = React.useState<TeamFormData[]>([]);
  const [bulkError, setBulkError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TeamFormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: team?.name || '',
      description: team?.description || '',
    },
  });

  React.useEffect(() => {
    if (isOpen && team) {
      setImportMode('single');
      reset({
        name: team.name,
        description: team.description || '',
      });
    } else if (isOpen && !team) {
      setImportMode('single');
      reset({ name: '', description: '' });
      setBulkTeamsText('');
      setBulkTeams([]);
      setBulkError(null);
    }
  }, [isOpen, team, reset]);

  const parseBulkTeams = (text: string): TeamFormData[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const teams: TeamFormData[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Support formats: "Team Name" or "Team Name | Description"
      const parts = trimmedLine.split('|').map(part => part.trim());
      const name = parts[0];
      const description = parts[1] || '';
      
      if (name && name.length <= 255) {
        teams.push({ name, description });
      }
    }
    
    return teams;
  };

  const handleBulkTextChange = (text: string) => {
    setBulkTeamsText(text);
    setBulkError(null);
    
    if (text.trim()) {
      try {
        const parsed = parseBulkTeams(text);
        setBulkTeams(parsed);
        
        if (parsed.length === 0) {
          setBulkError('No valid teams found. Make sure each line contains a team name.');
        } else if (parsed.length > 50) {
          setBulkError('Too many teams. Maximum 50 teams per import.');
        }
      } catch (error) {
        setBulkError('Error parsing teams. Please check the format.');
      }
    } else {
      setBulkTeams([]);
    }
  };
  const onSubmit = (data: TeamFormData) => {
    if (importMode === 'single') {
      onSave(data);
    }
  };

  const handleBulkSubmit = () => {
    if (bulkTeams.length === 0) {
      setBulkError('Please enter at least one team.');
      return;
    }
    
    if (bulkTeams.length > 50) {
      setBulkError('Too many teams. Maximum 50 teams per import.');
      return;
    }
    
    if (onBulkSave) {
      onBulkSave(bulkTeams);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white px-6 py-6 text-left shadow-xl transition-all sm:w-full sm:max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[#1d1d1f]">
              {team ? 'Edit Team' : importMode === 'bulk' ? 'Import Teams' : 'Create New Team'}
            </h3>
            <button
              onClick={onClose}
              className="text-[#858587] hover:text-[#1d1d1f] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode Toggle - Only show for new teams */}
          {!team && (
            <div className="flex items-center space-x-4 mb-6 p-3 bg-gray-50 rounded-lg">
              <button
                type="button"
                onClick={() => setImportMode('single')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${importMode === 'single' ? 'bg-[#1d1d1f] text-white' : 'text-[#1d1d1f] hover:bg-gray-200'}`}
              >
                <FileText className="h-4 w-4" />
                <span>Single Team</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('bulk')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${importMode === 'bulk' ? 'bg-[#1d1d1f] text-white' : 'text-[#1d1d1f] hover:bg-gray-200'}`}
              >
                <Upload className="h-4 w-4" />
                <span>Bulk Import</span>
              </button>
            </div>
          )}

          {importMode === 'single' ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                Team Name *
              </label>
              <input
                {...register('name')}
                type="text"
                className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent"
                placeholder="Enter team name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-[#932834]">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent"
                placeholder="Enter team description (optional)"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-[#932834]">{errors.description.message}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#1d1d1f] bg-white border border-[#f0f0f4] rounded-lg hover:bg-[#f0f0f4] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1d1d1f] border border-transparent rounded-lg hover:bg-[#858587] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : (team ? 'Update Team' : 'Create Team')}
              </button>
            </div>
          </form>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Bulk Import Format</h4>
                <p className="text-sm text-blue-800 mb-3">Enter one team per line. You can optionally include descriptions using the pipe (|) character:</p>
                <div className="bg-white border border-blue-200 rounded p-3 font-mono text-sm text-gray-700">
                  <div>Worship Team</div>
                  <div>Children's Ministry | Ministry to children and families</div>
                  <div>Youth Ministry | Ministry to teenagers</div>
                  <div>Small Groups</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  Teams to Import
                </label>
                <textarea
                  value={bulkTeamsText}
                  onChange={(e) => handleBulkTextChange(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent font-mono text-sm"
                  placeholder="Enter team names, one per line..."
                />
                {bulkError && (
                  <p className="mt-1 text-sm text-[#932834]">{bulkError}</p>
                )}
              </div>

              {bulkTeams.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-green-900 mb-2">
                    Preview ({bulkTeams.length} teams)
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {bulkTeams.slice(0, 10).map((team, index) => (
                      <div key={index} className="text-sm text-green-800">
                        <span className="font-medium">{team.name}</span>
                        {team.description && (
                          <span className="text-green-600"> - {team.description}</span>
                        )}
                      </div>
                    ))}
                    {bulkTeams.length > 10 && (
                      <div className="text-sm text-green-600 italic">
                        ... and {bulkTeams.length - 10} more teams
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-[#1d1d1f] bg-white border border-[#f0f0f4] rounded-lg hover:bg-[#f0f0f4] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSubmit}
                  disabled={loading || bulkTeams.length === 0 || !!bulkError}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1d1d1f] border border-transparent rounded-lg hover:bg-[#858587] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Importing...' : `Import ${bulkTeams.length} Teams`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};