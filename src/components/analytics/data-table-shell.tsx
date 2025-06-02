import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface DataTableShellProps {
  title: string;
  description: string;
  children: React.ReactNode; // The table itself
  // Add props for filters, search, actions if needed later
}

export function DataTableShell({ title, description, children }: DataTableShellProps) {
  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl font-headline">{title}</CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}
