'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Highlight {
  id: string;
  startPos: number;
  endPos: number;
  text: string;
  type: 'reference' | 'selection' | 'search' | 'active';
  color: string;
  metadata?: {
    messageId?: string;
    referenceIndex?: number;
    searchTerm?: string;
  };
}

interface HighlightContextType {
  highlights: Highlight[];
  activeHighlight: string | null;
  addHighlight: (highlight: Omit<Highlight, 'id'>) => string;
  removeHighlight: (id: string) => void;
  updateHighlight: (id: string, updates: Partial<Highlight>) => void;
  clearHighlights: (type?: Highlight['type']) => void;
  setActiveHighlight: (id: string | null) => void;
  getHighlightsByType: (type: Highlight['type']) => Highlight[];
  findHighlightsInRange: (startPos: number, endPos: number) => Highlight[];
  mergeOverlappingHighlights: () => void;
}

const HighlightContext = createContext<HighlightContextType | undefined>(undefined);

export const useHighlights = () => {
  const context = useContext(HighlightContext);
  if (!context) {
    throw new Error('useHighlights must be used within a HighlightProvider');
  }
  return context;
};

interface HighlightProviderProps {
  children: ReactNode;
}

export const HighlightProvider: React.FC<HighlightProviderProps> = ({ children }) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  // Generate unique highlight ID
  const generateId = () => `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add a new highlight
  const addHighlight = useCallback((highlight: Omit<Highlight, 'id'>): string => {
    const id = generateId();
    const newHighlight: Highlight = { ...highlight, id };
    
    setHighlights(prev => {
      // Check for overlaps and merge if necessary
      const overlapping = prev.filter(h => 
        (newHighlight.startPos <= h.endPos && newHighlight.endPos >= h.startPos) &&
        h.type === newHighlight.type
      );

      if (overlapping.length > 0) {
        // Merge overlapping highlights of the same type
        const merged: Highlight = {
          ...newHighlight,
          startPos: Math.min(newHighlight.startPos, ...overlapping.map(h => h.startPos)),
          endPos: Math.max(newHighlight.endPos, ...overlapping.map(h => h.endPos)),
          text: '', // Will be recalculated when rendering
        };

        // Remove overlapping highlights and add merged one
        const filtered = prev.filter(h => !overlapping.includes(h));
        return [...filtered, merged].sort((a, b) => a.startPos - b.startPos);
      }

      // No overlap, just add the new highlight
      return [...prev, newHighlight].sort((a, b) => a.startPos - b.startPos);
    });

    return id;
  }, []);

  // Remove a highlight
  const removeHighlight = useCallback((id: string) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
    if (activeHighlight === id) {
      setActiveHighlight(null);
    }
  }, [activeHighlight]);

  // Update a highlight
  const updateHighlight = useCallback((id: string, updates: Partial<Highlight>) => {
    setHighlights(prev => prev.map(h => 
      h.id === id ? { ...h, ...updates } : h
    ));
  }, []);

  // Clear highlights by type
  const clearHighlights = useCallback((type?: Highlight['type']) => {
    if (type) {
      setHighlights(prev => prev.filter(h => h.type !== type));
    } else {
      setHighlights([]);
    }
    setActiveHighlight(null);
  }, []);

  // Get highlights by type
  const getHighlightsByType = useCallback((type: Highlight['type']) => {
    return highlights.filter(h => h.type === type);
  }, [highlights]);

  // Find highlights in a specific range
  const findHighlightsInRange = useCallback((startPos: number, endPos: number) => {
    return highlights.filter(h => 
      (h.startPos <= endPos && h.endPos >= startPos)
    );
  }, [highlights]);

  // Merge overlapping highlights
  const mergeOverlappingHighlights = useCallback(() => {
    setHighlights(prev => {
      const grouped = prev.reduce((acc, highlight) => {
        if (!acc[highlight.type]) {
          acc[highlight.type] = [];
        }
        acc[highlight.type].push(highlight);
        return acc;
      }, {} as Record<string, Highlight[]>);

      const merged: Highlight[] = [];

      Object.values(grouped).forEach(typeHighlights => {
        const sorted = typeHighlights.sort((a, b) => a.startPos - b.startPos);
        const mergedType: Highlight[] = [];

        sorted.forEach(current => {
          const last = mergedType[mergedType.length - 1];

          if (last && last.endPos >= current.startPos) {
            // Overlap detected, merge
            last.endPos = Math.max(last.endPos, current.endPos);
            last.text = ''; // Will be recalculated when rendering
          } else {
            // No overlap, add as new highlight
            mergedType.push({ ...current });
          }
        });

        merged.push(...mergedType);
      });

      return merged.sort((a, b) => a.startPos - b.startPos);
    });
  }, []);

  const value: HighlightContextType = {
    highlights,
    activeHighlight,
    addHighlight,
    removeHighlight,
    updateHighlight,
    clearHighlights,
    setActiveHighlight,
    getHighlightsByType,
    findHighlightsInRange,
    mergeOverlappingHighlights
  };

  return (
    <HighlightContext.Provider value={value}>
      {children}
    </HighlightContext.Provider>
  );
};

// Utility functions for working with highlights

export const highlightColors = {
  reference: '#ffeb3b',     // Yellow - for AI references
  selection: '#e3f2fd',     // Light blue - for user selections
  search: '#ff9800',        // Orange - for search results
  active: '#f44336',        // Red - for currently active highlight
} as const;

export const getHighlightColor = (type: Highlight['type'], isActive = false): string => {
  if (isActive) return highlightColors.active;
  return highlightColors[type] || highlightColors.reference;
};

// Helper to extract text from document content at specific positions
export const extractHighlightText = (
  documentContent: string, 
  startPos: number, 
  endPos: number
): string => {
  return documentContent.substring(startPos, endPos);
};

// Helper to find the best highlight color based on priority
export const getHighlightPriority = (type: Highlight['type']): number => {
  const priorities = {
    active: 4,
    selection: 3,
    reference: 2,
    search: 1,
  };
  return priorities[type] || 0;
};

// Helper to resolve overlapping highlights by priority
export const resolveHighlightConflicts = (highlights: Highlight[]): Highlight[] => {
  // Sort by position first, then by priority
  const sorted = highlights.sort((a, b) => {
    if (a.startPos !== b.startPos) return a.startPos - b.startPos;
    return getHighlightPriority(b.type) - getHighlightPriority(a.type);
  });

  const resolved: Highlight[] = [];
  
  sorted.forEach(highlight => {
    const overlapping = resolved.filter(existing => 
      highlight.startPos < existing.endPos && highlight.endPos > existing.startPos
    );

    if (overlapping.length === 0) {
      // No overlap, add as is
      resolved.push(highlight);
    } else {
      // Handle overlap based on priority
      const highestPriority = Math.max(...overlapping.map(h => getHighlightPriority(h.type)));
      const currentPriority = getHighlightPriority(highlight.type);

      if (currentPriority > highestPriority) {
        // Current highlight has higher priority, remove overlapping ones
        const filtered = resolved.filter(existing => 
          !(highlight.startPos < existing.endPos && highlight.endPos > existing.startPos)
        );
        filtered.push(highlight);
        resolved.splice(0, resolved.length, ...filtered);
      }
      // If current has lower priority, it's ignored (not added)
    }
  });

  return resolved.sort((a, b) => a.startPos - b.startPos);
};