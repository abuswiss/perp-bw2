'use client';

import ChatWindow from '@/components/ChatWindow';
import DocumentAnalysisWrapper from '@/components/DocumentAnalysisWrapper';
import { DocumentAnalysisProvider, useDocumentAnalysis } from '@/contexts/DocumentAnalysisContext';
import { Suspense } from 'react';

const HomeContent = () => {
  const { documentId, highlights } = useDocumentAnalysis();
  
  return (
    <DocumentAnalysisWrapper
      documentId={documentId}
      highlights={highlights}
      className="h-screen"
    >
      <ChatWindow />
    </DocumentAnalysisWrapper>
  );
};

const Home = () => {
  return (
    <DocumentAnalysisProvider>
      <Suspense>
        <HomeContent />
      </Suspense>
    </DocumentAnalysisProvider>
  );
};

export default Home;