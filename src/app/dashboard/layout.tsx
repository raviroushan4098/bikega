
"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import DashboardSidebar from '@/components/layout/dashboard-sidebar';
import DashboardHeader from '@/components/layout/dashboard-header';
import { Loader2 } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
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
    <SidebarProvider defaultOpen={true}>
      <div className={cn(
        "flex min-h-screen",
        "bg-background" 
      )}>
        <DashboardSidebar />
        <div className="flex flex-1 flex-col">
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto p-4 pt-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
