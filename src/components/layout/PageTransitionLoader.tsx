
"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageTransitionLoaderProps {
  isLoading: boolean;
}

const PageTransitionLoader: React.FC<PageTransitionLoaderProps> = ({ isLoading }) => {
  if (!isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center",
        "bg-background/80 backdrop-blur-sm",
        "transition-opacity duration-200 ease-in-out",
        isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      aria-live="assertive"
      aria-busy="true"
      role="alert"
    >
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
      <p className="text-lg font-medium text-primary">Loading page...</p>
    </div>
  );
};

export default PageTransitionLoader;
