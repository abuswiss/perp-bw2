'use client';

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface TooltipPortalProps {
  children: React.ReactNode;
}

const TooltipPortal: React.FC<TooltipPortalProps> = ({ children }) => {
  const [mounted, setMounted] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setPortalRoot(document.getElementById('tooltip-portal-root'));
    return () => setMounted(false);
  }, []);

  if (!mounted || !portalRoot) {
    return null;
  }

  return ReactDOM.createPortal(children, portalRoot);
};

export default TooltipPortal; 