
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface AdminAnalyticsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: string; // Tailwind class for background, e.g., "bg-gradient-to-r from-blue-500 to-blue-600"
  className?: string;
}

const AdminAnalyticsCard: React.FC<AdminAnalyticsCardProps> = ({
  title,
  value,
  change,
  changeLabel,
  icon,
  color,
  className,
}) => {
  const hasChange = typeof change === 'number';
  const isPositiveChange = hasChange && change > 0;
  const isNegativeChange = hasChange && change < 0;

  return (
    <div className={cn("rounded-xl p-5 shadow-lg text-white", color, className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="p-2 bg-white/20 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="text-4xl font-bold mb-1">{value}</div>
      {hasChange && (
        <div className="flex items-center text-sm opacity-90">
          {isPositiveChange && <ArrowUpRight className="w-4 h-4 mr-1 text-green-300" />}
          {isNegativeChange && <ArrowDownRight className="w-4 h-4 mr-1 text-red-300" />}
          <span className={cn(
            isPositiveChange && "text-green-300",
            isNegativeChange && "text-red-300"
          )}>
            {Math.abs(change!)}%
          </span>
          <span className="ml-1">{changeLabel}</span>
        </div>
      )}
      {!hasChange && changeLabel && (
         <div className="text-sm opacity-90">{changeLabel}</div>
      )}
    </div>
  );
};

export default AdminAnalyticsCard;
