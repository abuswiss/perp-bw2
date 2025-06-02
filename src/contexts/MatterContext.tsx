'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, Matter } from '@/lib/supabase/client';

interface MatterContextType {
  currentMatter: Matter | null;
  matters: Matter[];
  setCurrentMatter: (matter: Matter | null) => void;
  loadMatters: () => Promise<void>;
  createMatter: (matter: Partial<Matter>) => Promise<Matter | null>;
  updateMatter: (id: string, updates: Partial<Matter>) => Promise<Matter | null>;
  isLoading: boolean;
}

const MatterContext = createContext<MatterContextType | null>(null);

export function MatterProvider({ children }: { children: ReactNode }) {
  const [currentMatter, setCurrentMatter] = useState<Matter | null>(null);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMatters = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('matters')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading matters:', error);
        return;
      }

      setMatters(data || []);
      
      // Don't auto-select a matter - keep "General Research" as default
      // Only set a matter if it was previously selected and stored in localStorage
    } catch (error) {
      console.error('Error in loadMatters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createMatter = async (matterData: Partial<Matter>): Promise<Matter | null> => {
    try {
      const { data, error } = await supabase
        .from('matters')
        .insert({
          name: matterData.name || 'New Matter',
          description: matterData.description,
          matter_number: matterData.matter_number,
          client_name: matterData.client_name,
          practice_area: matterData.practice_area,
          status: matterData.status || 'active',
          tags: matterData.tags || [],
          metadata: matterData.metadata || {}
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating matter:', error);
        return null;
      }

      // Reload matters to update the list
      await loadMatters();
      
      // Set as current matter when explicitly created
      if (data) {
        setCurrentMatter(data);
      }

      return data;
    } catch (error) {
      console.error('Error in createMatter:', error);
      return null;
    }
  };

  const updateMatter = async (id: string, updates: Partial<Matter>): Promise<Matter | null> => {
    try {
      const { data, error } = await supabase
        .from('matters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating matter:', error);
        return null;
      }

      // Update local state
      setMatters(prev => 
        prev.map(m => m.id === id ? { ...m, ...data } : m)
      );

      // Update current matter if it's the one being updated
      if (currentMatter?.id === id) {
        setCurrentMatter(data);
      }

      return data;
    } catch (error) {
      console.error('Error in updateMatter:', error);
      return null;
    }
  };

  useEffect(() => {
    loadMatters();
  }, []);

  useEffect(() => {
    // Set up real-time subscription for matters
    const subscription = supabase
      .channel('matters-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matters' },
        (payload) => {
          console.log('Matter change:', payload);
          
          if (payload.eventType === 'INSERT') {
            setMatters(prev => [payload.new as Matter, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMatters(prev => 
              prev.map(m => m.id === payload.new.id ? payload.new as Matter : m)
            );
            if (currentMatter?.id === payload.new.id) {
              setCurrentMatter(payload.new as Matter);
            }
          } else if (payload.eventType === 'DELETE') {
            setMatters(prev => prev.filter(m => m.id !== payload.old.id));
            if (currentMatter?.id === payload.old.id) {
              setCurrentMatter(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentMatter?.id]);

  // Store current matter in localStorage for persistence
  useEffect(() => {
    if (currentMatter) {
      localStorage.setItem('currentMatterId', currentMatter.id);
    } else {
      localStorage.removeItem('currentMatterId');
    }
  }, [currentMatter]);

  // Restore current matter from localStorage on mount
  useEffect(() => {
    const storedMatterId = localStorage.getItem('currentMatterId');
    if (storedMatterId && storedMatterId !== 'null' && matters.length > 0) {
      const matter = matters.find(m => m.id === storedMatterId);
      if (matter && matter.status === 'active') {
        setCurrentMatter(matter);
      } else {
        // If stored matter not found or inactive, remove from storage
        localStorage.removeItem('currentMatterId');
      }
    }
  }, [matters]);

  return (
    <MatterContext.Provider value={{
      currentMatter,
      matters,
      setCurrentMatter,
      loadMatters,
      createMatter,
      updateMatter,
      isLoading
    }}>
      {children}
    </MatterContext.Provider>
  );
}

export const useMatter = () => {
  const context = useContext(MatterContext);
  if (!context) {
    throw new Error('useMatter must be used within MatterProvider');
  }
  return context;
};