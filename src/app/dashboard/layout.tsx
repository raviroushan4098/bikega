
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import DashboardHeader from '@/components/layout/dashboard-header';
import HoverNavMenu from '@/components/layout/hover-nav-menu'; // New component
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [user, loading, isAuthenticated, router]);


  if (loading || !isAuthenticated) {
    return (
      <div className={cn(
        "flex h-screen items-center justify-center",
        "bg-background" 
      )}>
        <Loader2 className={cn(
          "h-12 w-12 animate-spin",
          "text-primary"
        )} />
      </div>
    );
  }

  return (
    <div className={cn(
      "flex min-h-screen",
      "bg-background" 
    )}>
      <HoverNavMenu /> {/* New Navigation */}
      <div className="flex flex-1 flex-col">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
