'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Highlight } from '@/components/HighlightManager';

interface DocumentAnalysisContextType {
  documentId: string | null;
  highlights: Highlight[];
  isActive: boolean;
  setDocumentAnalysis: (documentId: string | null, highlights?: Highlight[]) => void;
  clearDocumentAnalysis: () => void;
  addHighlights: (highlights: Highlight[]) => void;
}

const DocumentAnalysisContext = createContext<DocumentAnalysisContextType | undefined>(undefined);

export const useDocumentAnalysis = () => {
  const context = useContext(DocumentAnalysisContext);
  if (!context) {
    throw new Error('useDocumentAnalysis must be used within a DocumentAnalysisProvider');
  }
  return context;
};

interface DocumentAnalysisProviderProps {
  children: ReactNode;
}

export const DocumentAnalysisProvider: React.FC<DocumentAnalysisProviderProps> = ({ children }) => {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const setDocumentAnalysis = (id: string | null, newHighlights: Highlight[] = []) => {
    setDocumentId(id);
    setHighlights(newHighlights);
  };

  const clearDocumentAnalysis = () => {
    setDocumentId(null);
    setHighlights([]);
  };

  const addHighlights = (newHighlights: Highlight[]) => {
    setHighlights(prev => [...prev, ...newHighlights]);
  };

  const value: DocumentAnalysisContextType = {
    documentId,
    highlights,
    isActive: !!documentId,
    setDocumentAnalysis,
    clearDocumentAnalysis,
    addHighlights
  };

  return (
    <DocumentAnalysisContext.Provider value={value}>
      {children}
    </DocumentAnalysisContext.Provider>
  );
};