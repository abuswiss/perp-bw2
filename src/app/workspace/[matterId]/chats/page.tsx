'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { MessageSquare, Clock, Calendar, ExternalLink, Search, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

interface ChatSession {
  id: string;
  title: string;
  focus_mode: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
}

const WorkspaceChats = () => {
  const params = useParams();
  const matterId = params.matterId as string;
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadChats();
  }, [matterId]);

  const loadChats = async () => {
    try {
      // Load chats for this matter
      const { data: chatData, error: chatError } = await supabase
        .from('legal_chats')
        .select('*')
        .eq('matter_id', matterId)
        .order('updated_at', { ascending: false });

      if (chatError) throw chatError;

      // Load message counts for each chat
      const chatsWithCounts = await Promise.all(
        (chatData || []).map(async (chat) => {
          const { count } = await supabase
            .from('legal_messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chat.id);

          // Get the last message
          const { data: lastMessage } = await supabase
            .from('legal_messages')
            .select('content')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...chat,
            message_count: count || 0,
            last_message: lastMessage?.content || '',
          };
        })
      );

      setChats(chatsWithCounts);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFocusModeLabel = (focusMode: string) => {
    const labels: { [key: string]: string } = {
      'legalResearch': 'Legal Research',
      'briefWriting': 'Document Drafting',
      'discovery': 'Discovery Review',
      'contractAnalysis': 'Contract Analysis',
      'webSearch': 'Web Search',
    };
    return labels[focusMode] || focusMode;
  };

  const getFocusModeColor = (focusMode: string) => {
    const colors: { [key: string]: string } = {
      'legalResearch': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'briefWriting': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'discovery': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'contractAnalysis': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'webSearch': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    };
    return colors[focusMode] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) {
        return `${diffInDays}d ago`;
      } else {
        return date.toLocaleDateString();
      }
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.last_message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getFocusModeLabel(chat.focus_mode).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Chat Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Research and conversation history for this matter
          </p>
        </div>
        <Link
          href={`/?matterId=${matterId}`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search chat sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Chat Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <MessageSquare className="h-5 w-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sessions</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">{chats.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-green-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {chats.filter(chat => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(chat.created_at) > weekAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-purple-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Messages</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {chats.reduce((sum, chat) => sum + (chat.message_count || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Sessions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchQuery ? 'No chat sessions found matching your search' : 'No chat sessions for this matter yet'}
          </p>
          {!searchQuery && (
            <Link
              href={`/?matterId=${matterId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Your First Chat
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {chat.title || 'Untitled Chat'}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFocusModeColor(chat.focus_mode)}`}>
                      {getFocusModeLabel(chat.focus_mode)}
                    </span>
                  </div>
                  
                  {chat.last_message && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                      {chat.last_message.length > 150 
                        ? `${chat.last_message.substring(0, 150)}...` 
                        : chat.last_message
                      }
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>{chat.message_count || 0} messages</span>
                    <span>Created {formatTimeAgo(chat.created_at)}</span>
                    <span>Updated {formatTimeAgo(chat.updated_at)}</span>
                  </div>
                </div>
                
                <Link
                  href={`/c/${chat.id}`}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors ml-4"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Chat
                </Link>
              </div>
              
              {/* Chat Preview/Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Focus:</span>
                    <p className="text-gray-600 dark:text-gray-400">{getFocusModeLabel(chat.focus_mode)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Messages:</span>
                    <p className="text-gray-600 dark:text-gray-400">{chat.message_count || 0}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Created:</span>
                    <p className="text-gray-600 dark:text-gray-400">
                      {new Date(chat.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Last Active:</span>
                    <p className="text-gray-600 dark:text-gray-400">
                      {formatTimeAgo(chat.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkspaceChats;