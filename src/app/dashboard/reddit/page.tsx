
"use client";

import React from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function MyKeywordsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();

  const pageTitle = "My Assigned Keywords";
  const pageDescription = currentUser?.role === 'admin'
    ? "This page displays your assigned keywords. To manage keywords for all users, please visit the 'User Management' section."
    : "These are the keywords assigned to you, which help tailor your content feeds across the platform.";

  if (authLoading) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    // This case should ideally be handled by the AuthProvider redirecting to login
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="text-muted-foreground">User not found. Please log in.</p>
      </div>
    );
  }

  const keywords = currentUser.assignedKeywords;

  return (
    <DataTableShell
      title={pageTitle}
      description={pageDescription}
    >
      <div className="space-y-6">
        {currentUser.role === 'admin' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Admin Note</AlertTitle>
            <AlertDescription>
              This page shows keywords assigned to your admin account. 
              To view or edit keywords for other users, please go to the <a href="/dashboard/users" className="font-medium text-primary hover:underline">User Management</a> page.
            </AlertDescription>
          </Alert>
        )}

        {keywords && keywords.length > 0 ? (
          <div className="flex flex-wrap gap-3 items-center">
            <h3 className="text-lg font-semibold text-foreground">Your Keywords:</h3>
            {keywords.map((keyword, index) => (
              <Badge key={index} variant="secondary" className="px-3 py-1 text-sm">
                {keyword}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-lg text-muted-foreground">
              You currently have no keywords assigned.
            </p>
            {currentUser.role === 'user' && (
                <p className="text-sm text-muted-foreground mt-2">
                    Please contact an administrator if you believe keywords should be assigned to your account.
                </p>
            )}
             {currentUser.role === 'admin' && (
                <p className="text-sm text-muted-foreground mt-2">
                    You can assign keywords to yourself or other users in the User Management section.
                </p>
            )}
          </div>
        )}
      </div>
    </DataTableShell>
  );
}
