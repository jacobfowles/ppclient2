import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';

interface Assessment {
  id: number;
  name?: string;
}

interface PcoIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessment: Assessment;
  onUpdate: (assessmentId: number, pcoId: string) => void;
  loading: boolean;
}

export const PcoIdModal: React.FC<PcoIdModalProps> = ({
  isOpen,
  onClose,
  assessment,
  onUpdate,
  loading
}) => {
  const [pcoId, setPcoId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(assessment.id, pcoId.trim());
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
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Set Planning Center ID
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
                Planning Center Person ID
              </label>
              <input
                type="text"
                value={pcoId}
                onChange={(e) => setPcoId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-transparent font-mono text-sm"
                placeholder="Enter PCO person ID (e.g., 12345)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to remove the Planning Center association
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>How to find the ID:</strong> In Planning Center People, go to the person's profile. 
                The ID is in the URL: <code className="bg-white px-2 py-1 rounded font-mono text-xs">people.planningcenteronline.com/people/XXXXX</code>
              </p>
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
                {loading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};