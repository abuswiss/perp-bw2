'use client';

import React, { useState } from 'react';
import { useMatter } from '@/contexts/MatterContext';
import { 
  Briefcase, 
  Plus, 
  Check, 
  ChevronDown,
  Search,
  Archive,
  Clock
} from 'lucide-react';

export default function MatterSelector() {
  const { currentMatter, matters, setCurrentMatter, createMatter, isLoading } = useMatter();
  const [isOpen, setIsOpen] = useState(false);
  const [showNewMatterForm, setShowNewMatterForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMatterData, setNewMatterData] = useState({
    name: '',
    client_name: '',
    matter_number: '',
    description: ''
  });

  const filteredMatters = matters.filter(matter => 
    matter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    matter.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    matter.matter_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeMatters = filteredMatters.filter(m => m.status === 'active');
  const archivedMatters = filteredMatters.filter(m => m.status === 'archived');

  const handleCreateMatter = async () => {
    if (!newMatterData.name.trim()) return;

    const matter = await createMatter(newMatterData);
    if (matter) {
      setShowNewMatterForm(false);
      setNewMatterData({
        name: '',
        client_name: '',
        matter_number: '',
        description: ''
      });
      setIsOpen(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'archived':
        return <Archive className="w-3 h-3 text-gray-400" />;
      case 'closed':
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-sm bg-[#111111] border border-gray-800 rounded-lg hover:bg-[#1a1a1a] transition-colors duration-200"
      >
        <div className="flex items-center space-x-3">
          <Briefcase className="w-4 h-4 text-blue-400" />
          <div className="text-left">
            <div className="font-medium text-white">
              {currentMatter ? currentMatter.name : 'Select Matter'}
            </div>
            {currentMatter && currentMatter.client_name && (
              <div className="text-xs text-gray-400">{currentMatter.client_name}</div>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#111111] border border-gray-800 rounded-lg shadow-2xl max-h-96 overflow-hidden">
          <div className="p-3 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search matters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-64">
            {isLoading ? (
              <div className="p-4 text-center text-gray-400 text-sm">Loading matters...</div>
            ) : (
              <>
                {/* Active Matters */}
                {activeMatters.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Active Matters</div>
                    {activeMatters.map((matter) => (
                      <button
                        key={matter.id}
                        onClick={() => {
                          setCurrentMatter(matter);
                          setIsOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors ${
                          currentMatter?.id === matter.id ? 'bg-[#1a1a1a]' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 text-left">
                          {getStatusIcon(matter.status)}
                          <div>
                            <div className="text-sm font-medium text-white">{matter.name}</div>
                            <div className="text-xs text-gray-400">
                              {matter.client_name} {matter.matter_number && `• ${matter.matter_number}`}
                            </div>
                          </div>
                        </div>
                        {currentMatter?.id === matter.id && (
                          <Check className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Archived Matters */}
                {archivedMatters.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Archived</div>
                    {archivedMatters.map((matter) => (
                      <button
                        key={matter.id}
                        onClick={() => {
                          setCurrentMatter(matter);
                          setIsOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors opacity-60 ${
                          currentMatter?.id === matter.id ? 'bg-[#1a1a1a]' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 text-left">
                          {getStatusIcon(matter.status)}
                          <div>
                            <div className="text-sm font-medium text-white">{matter.name}</div>
                            <div className="text-xs text-gray-400">
                              {matter.client_name} {matter.matter_number && `• ${matter.matter_number}`}
                            </div>
                          </div>
                        </div>
                        {currentMatter?.id === matter.id && (
                          <Check className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {filteredMatters.length === 0 && (
                  <div className="p-4 text-center text-gray-400 text-sm">
                    No matters found
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-3 border-t border-gray-800">
            {!showNewMatterForm ? (
              <button
                onClick={() => setShowNewMatterForm(true)}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Matter</span>
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Matter Name *"
                  value={newMatterData.name}
                  onChange={(e) => setNewMatterData({ ...newMatterData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Client Name"
                  value={newMatterData.client_name}
                  onChange={(e) => setNewMatterData({ ...newMatterData, client_name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Matter Number"
                  value={newMatterData.matter_number}
                  onChange={(e) => setNewMatterData({ ...newMatterData, matter_number: e.target.value })}
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-md text-sm focus:outline-none focus:border-blue-500"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreateMatter}
                    disabled={!newMatterData.name.trim()}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowNewMatterForm(false);
                      setNewMatterData({
                        name: '',
                        client_name: '',
                        matter_number: '',
                        description: ''
                      });
                    }}
                    className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}