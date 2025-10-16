import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Edit2, Trash2, Plus, Users, Network } from 'lucide-react';
import { LeadershipLayer } from '../../lib/supabase';

interface LeadershipLayerProps {
  layers: LeadershipLayer[];
  onSave?: (data: LayerFormData) => void;
  onUpdate?: (id: number, data: LayerFormData) => void;
  onDelete?: (id: number) => void;
  loading?: boolean;
  isAdmin?: boolean;
}

interface LayerFormData {
  name: string;
  level: number;
  description?: string;
}

const schema = yup.object({
  name: yup.string().required('Level name is required').max(255, 'Name is too long'),
  level: yup.number().required('Level number is required').min(1, 'Level must be at least 1'),
  description: yup.string().max(1000, 'Description is too long'),
});

export const LeadershipLayerComponent: React.FC<LeadershipLayerProps> = ({
  layers,
  onSave,
  onUpdate,
  onDelete,
  loading = false,
  isAdmin = false,
}) => {
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<LayerFormData>({
    resolver: yupResolver(schema),
  });

  const sortedLayers = [...layers].sort((a, b) => a.level - b.level);
  const nextLevel = Math.max(...layers.map(l => l.level), 0) + 1;

  const startEditing = (layer: LeadershipLayer) => {
    if (!isAdmin) {
      alert('Only administrators can edit leadership levels.');
      return;
    }
    setEditingId(layer.id);
    reset({
      name: layer.name,
      level: layer.level,
      description: layer.description || '',
    });
  };

  const startAdding = () => {
    if (!isAdmin) {
      alert('Only administrators can add leadership levels.');
      return;
    }
    setIsAdding(true);
    reset({
      name: '',
      level: nextLevel,
      description: '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    reset();
  };

  const onSubmit = (data: LayerFormData) => {
    if (editingId) {
      onUpdate?.(editingId, data);
      setEditingId(null);
    } else {
      onSave?.(data);
      setIsAdding(false);
    }
    reset();
  };

  return (
    <div className="bg-white rounded-xl border border-[#f0f0f4] p-6">
      <div className="space-y-4">
        {isAdmin && layers.length > 0 && (
          <div className="flex justify-end mb-6">
            <button
              onClick={startAdding}
              disabled={isAdding || editingId !== null}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#1d1d1f] border border-transparent rounded-lg hover:bg-[#858587] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Level
            </button>
          </div>
        )}

        {sortedLayers.map((layer) => (
          <div key={layer.id} className="border border-[#f0f0f4] rounded-lg p-4">
            {editingId === layer.id ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1d1d1f] mb-1">
                      Level Name *
                    </label>
                    <input
                      {...register('name')}
                      type="text"
                      className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-[#932834]">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1d1d1f] mb-1">
                      Level Number *
                    </label>
                    <input
                      {...register('level', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent"
                    />
                    {errors.level && (
                      <p className="mt-1 text-sm text-[#932834]">{errors.level.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1f] mb-1">
                    Description
                  </label>
                  <input
                    {...register('description')}
                    type="text"
                    className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent"
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-3 py-2 text-sm font-medium text-[#1d1d1f] bg-white border border-[#f0f0f4] rounded-lg hover:bg-[#f0f0f4] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-2 text-sm font-medium text-white bg-[#1d1d1f] border border-transparent rounded-lg hover:bg-[#858587] disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-3">
                    <span className="bg-[#f0f0f4] text-[#1d1d1f] text-xs font-medium px-2.5 py-0.5 rounded-full">
                      Level {layer.level}
                    </span>
                    <h4 className="font-medium text-[#1d1d1f]">{layer.name}</h4>
                  </div>
                  {layer.description && (
                    <p className="text-sm text-[#858587] mt-1">{layer.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => startEditing(layer)}
                      className="p-2 text-[#858587] hover:text-[#1d1d1f] hover:bg-[#f0f0f4] rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete?.(layer.id)}
                      className="p-2 text-[#858587] hover:text-[#932834] hover:bg-[#f0f0f4] rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isAdmin && isAdding && (
          <div className="border border-[#f0f0f4] rounded-lg p-4 bg-[#f0f0f4]">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1f] mb-1">
                    Level Name *
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent"
                    placeholder="e.g., Team Leader"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-[#932834]">{errors.name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1f] mb-1">
                    Level Number *
                  </label>
                  <input
                    {...register('level', { valueAsNumber: true })}
                    type="number"
                    min="1"
                    className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent"
                  />
                  {errors.level && (
                    <p className="mt-1 text-sm text-[#932834]">{errors.level.message}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-1">
                  Description
                </label>
                <input
                  {...register('description')}
                  type="text"
                  className="w-full px-3 py-2 border border-[#f0f0f4] rounded-lg focus:ring-2 focus:ring-[#858587] focus:border-transparent"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-3 py-2 text-sm font-medium text-[#1d1d1f] bg-white border border-[#f0f0f4] rounded-lg hover:bg-[#f0f0f4] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-2 text-sm font-medium text-white bg-[#1d1d1f] border border-transparent rounded-lg hover:bg-[#858587] disabled:opacity-50 transition-colors"
                >
                  Add Level
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {layers.length === 0 && !(isAdmin && isAdding) && (
        <div className="bg-white rounded-xl border border-[#EFEFF2] p-12 text-center">
          <Network className="h-12 w-12 text-[#91999A] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#1F1F1F] mb-2">No Leadership Levels Yet</h3>
          <p className="text-[#91999A] mb-6">
            {isAdmin 
              ? 'Define your leadership hierarchy to organize your ministry structure.'
              : 'No leadership levels have been created yet. Contact your administrator to set up leadership levels.'
            }
          </p>
          {isAdmin && (
            <button
              onClick={startAdding}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#1d1d1f] border border-transparent rounded-lg hover:bg-[#858587] transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Level
            </button>
          )}
        </div>
      )}
    </div>
  );
};