
"use client";

import React, { useEffect, useState, useRef } from 'react'; // Added useRef
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import DashboardHeader from '@/components/layout/dashboard-header';
import HoverNavMenu from '@/components/layout/hover-nav-menu';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PageTransitionLoader from '@/components/layout/PageTransitionLoader';
import dynamic from 'next/dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [isPageLoading, setIsPageLoading] = useState(false);

  // Dynamically import PageTransitionLoader with ssr: false
  const DynamicPageTransitionLoader = dynamic(() => import('@/components/layout/PageTransitionLoader'), {
    ssr: false,
  });
  const previousPathnameRef = useRef(pathname); // Store previous pathname

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [user, authLoading, isAuthenticated, router]);

  useEffect(() => {
    // Show loader if pathname changes to another dashboard route
    if (previousPathnameRef.current !== pathname && pathname.startsWith('/dashboard')) {
      setIsPageLoading(true);
    }
    // Update ref after checking, so it's correct for the next render
    previousPathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    // Effect to hide the loader after a delay
    let timer: NodeJS.Timeout;
    if (isPageLoading) {
      timer = setTimeout(() => {
        setIsPageLoading(false);
      }, 800); // Adjusted duration, can be fine-tuned
    }
    return () => {
      clearTimeout(timer); // Cleanup timer
    };
  }, [isPageLoading]);


  if (authLoading || (!isAuthenticated && pathname !== '/login')) {
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
      <HoverNavMenu />
      <div className="flex flex-1 flex-col">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-6 md:p-8">
          {children}
        </main>
      </div>
      <DynamicPageTransitionLoader isLoading={isPageLoading} />
    </div>
  );
}
