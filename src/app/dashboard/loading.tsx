
"use client";

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardLoading() {
  return (
    <div className={cn(
      "flex h-[calc(100vh-10rem)] items-center justify-center", // Adjust height as needed to fill content area
      "bg-background" 
    )}>
      <Loader2 className={cn(
        "h-12 w-12 animate-spin",
        "text-primary"
      )} />
    </div>
  );
}
