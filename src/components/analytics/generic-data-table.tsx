
"use client";

import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import type { ColumnConfig } from '@/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface GenericDataTableProps<T extends { id: string, thumbnailUrl?: string, dataAiHint?: string, authorAvatarUrl?: string }> {
  data: T[];
  columns: ColumnConfig<T>[];
  caption?: string;
  filterFunction?: (item: T, filter: string) => boolean;
}

export function GenericDataTable<T extends { id: string, thumbnailUrl?: string, dataAiHint?: string, authorAvatarUrl?: string }>({ data, columns, caption }: GenericDataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: keyof T | string; direction: 'ascending' | 'descending' } | null>(null);

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        // Add more type handling if needed (e.g. dates)
        if (sortConfig.key === 'timestamp' && typeof aValue === 'string' && typeof bValue === 'string') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          return sortConfig.direction === 'ascending' ? dateA - dateB : dateB - dateA;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const requestSort = (key: keyof T | string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No data available.</p>;
  }

  return (
    <div className="rounded-md border overflow-hidden overflow-y-auto max-h-[calc(100vh-29rem)]"> {/* Adjusted for screen fit */}
      <Table>
        {caption && <caption className="mt-4 text-sm text-muted-foreground sticky bottom-0 bg-background py-1">{caption}</caption>}
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow className="bg-muted/50">
            {columns.map((column) => (
              <TableHead key={String(column.key)} className={cn("font-semibold", column.className)}>
                {column.sortable ? (
                  <Button
                    variant="ghost"
                    onClick={() => requestSort(column.key as keyof T)}
                    className="px-1 py-0.5 -ml-1 h-auto hover:bg-accent/50"
                  >
                    {column.header}
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((item, index) => ( // 'index' here is from the array map, should be 0, 1, 2...
            <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
              {columns.map((column) => (
                <TableCell key={String(column.key)} className={cn("py-3", column.className)}>
                  {/* Ensure this 'index' is passed to column.render */}
                  {column.render ? column.render(item, index) : String(item[column.key as keyof T] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Helper for rendering thumbnail or avatar
export const renderImageCell = (item: { thumbnailUrl?: string, dataAiHint?: string, authorAvatarUrl?: string }, type: 'thumbnail' | 'avatar') => {
  const url = type === 'thumbnail' ? item.thumbnailUrl : item.authorAvatarUrl;
  const altText = type === 'thumbnail' ? 'Video thumbnail' : 'Author avatar';
  const size = type === 'thumbnail' ? { width: 80, height: 45 } : { width: 32, height: 32 };
  const roundedClass = type === 'avatar' ? 'rounded-full' : 'rounded-sm';

  if (url) {
    return (
      <Image
        src={url}
        alt={altText}
        width={size.width}
        height={size.height}
        className={cn("object-cover", roundedClass)}
        data-ai-hint={item.dataAiHint || (type === 'avatar' ? 'person avatar' : 'media content')}
      />
    );
  }
  return <div style={{ width: size.width, height: size.height }} className={cn("bg-muted", roundedClass)} />;
};

