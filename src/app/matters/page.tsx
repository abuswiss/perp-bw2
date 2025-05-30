'use client';

import { useMatter } from '@/contexts/MatterContext';
import { Plus, Briefcase, Calendar, User, Archive, Edit2, Trash2, MoreVertical } from 'lucide-react';
import { useState } from 'react';
import { supabaseAdmin } from '@/lib/supabase/client';

export default function MattersPage() {
  const { matters, createMatter, isLoading } = useMatter();
  const [showNewMatterForm, setShowNewMatterForm] = useState(false);
  const [newMatterData, setNewMatterData] = useState({
    name: '',
    client_name: '',
    matter_number: '',
    description: '',
    practice_area: ''
  });
  const [editingMatter, setEditingMatter] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleCreateMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatterData.name.trim()) return;

    await createMatter(newMatterData);
    setShowNewMatterForm(false);
    setNewMatterData({
      name: '',
      client_name: '',
      matter_number: '',
      description: '',
      practice_area: ''
    });
  };

  const handleDeleteMatter = async (matterId: string) => {
    try {
      const { error } = await supabaseAdmin
        .from('matters')
        .delete()
        .eq('id', matterId);
      
      if (error) throw error;
      
      // Refresh matters list
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete matter:', error);
      alert('Failed to delete matter. Please try again.');
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const handleArchiveMatter = async (matterId: string) => {
    try {
      const { error } = await supabaseAdmin
        .from('matters')
        .update({ status: 'archived' })
        .eq('id', matterId);
      
      if (error) throw error;
      
      // Refresh matters list
      window.location.reload();
    } catch (error) {
      console.error('Failed to archive matter:', error);
      alert('Failed to archive matter. Please try again.');
    }
  };

  const activeMatters = matters.filter(m => m.status === 'active');
  const archivedMatters = matters.filter(m => m.status === 'archived');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Matters</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your legal matters and cases
          </p>
        </div>
        <button
          onClick={() => setShowNewMatterForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          New Matter
        </button>
      </div>

      {showNewMatterForm && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Create New Matter</h2>
          <form onSubmit={handleCreateMatter} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Matter Name *</label>
              <input
                type="text"
                value={newMatterData.name}
                onChange={(e) => setNewMatterData({ ...newMatterData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Client Name</label>
              <input
                type="text"
                value={newMatterData.client_name}
                onChange={(e) => setNewMatterData({ ...newMatterData, client_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Matter Number</label>
              <input
                type="text"
                value={newMatterData.matter_number}
                onChange={(e) => setNewMatterData({ ...newMatterData, matter_number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Practice Area</label>
              <select
                value={newMatterData.practice_area}
                onChange={(e) => setNewMatterData({ ...newMatterData, practice_area: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="">Select...</option>
                <option value="litigation">Litigation</option>
                <option value="corporate">Corporate</option>
                <option value="ip">Intellectual Property</option>
                <option value="employment">Employment</option>
                <option value="real_estate">Real Estate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={newMatterData.description}
                onChange={(e) => setNewMatterData({ ...newMatterData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                rows={3}
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Matter
              </button>
              <button
                type="button"
                onClick={() => setShowNewMatterForm(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          <p className="mt-2 text-gray-500">Loading matters...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Matters */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="text-blue-600" />
              Active Matters ({activeMatters.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeMatters.map((matter) => (
                <div
                  key={matter.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 relative group"
                >
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingMatter(matter.id);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600"
                        title="Edit matter"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveMatter(matter.id);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-yellow-600"
                        title="Archive matter"
                      >
                        <Archive size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(matter.id);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600"
                        title="Delete matter"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-2 pr-12">{matter.name}</h3>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {matter.client_name && (
                      <p className="flex items-center gap-1">
                        <User size={14} />
                        {matter.client_name}
                      </p>
                    )}
                    {matter.matter_number && (
                      <p>Matter #: {matter.matter_number}</p>
                    )}
                    <p className="flex items-center gap-1">
                      <Calendar size={14} />
                      Created: {new Date(matter.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {matter.description && (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {matter.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Archived Matters */}
          {archivedMatters.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Archive className="text-gray-500" />
                Archived Matters ({archivedMatters.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {archivedMatters.map((matter) => (
                  <div
                    key={matter.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
                  >
                    <h3 className="font-semibold text-lg mb-2">{matter.name}</h3>
                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                      {matter.client_name && <p>{matter.client_name}</p>}
                      {matter.matter_number && <p>Matter #: {matter.matter_number}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Matter</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this matter? This action cannot be undone and will remove all associated documents and data.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMatter(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}