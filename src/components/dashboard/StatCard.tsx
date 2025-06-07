
"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | React.ReactNode;
  icon: React.ElementType;
  iconBgClass: string; // e.g., 'bg-pink-600'
  iconClass?: string; // e.g., 'text-white'
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconBgClass,
  iconClass = 'text-white',
  className,
}) => {
  return (
    <Card className={cn("shadow-md overflow-hidden", className)}>
      <CardContent className="p-0 flex items-stretch h-full">
        <div className={cn("w-16 h-full flex items-center justify-center p-3", iconBgClass)}>
          <Icon className={cn("h-6 w-6", iconClass)} />
        </div>
        <div className="flex flex-col justify-center p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
          {typeof value === 'string' ? (
            <p className="text-xl font-bold text-card-foreground">{value}</p>
          ) : (
            value 
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
