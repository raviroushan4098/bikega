
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, ApiKey, NewApiKeyData } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getApiKeys, addApiKey } from '@/lib/api-key-service';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';

const apiKeySchema = z.object({
  serviceName: z.string().min(2, { message: "Service name must be at least 2 characters." }),
  keyValue: z.string().min(10, { message: "API key must be at least 10 characters." }),
  description: z.string().optional(),
});

type ApiKeyFormValues = z.infer<typeof apiKeySchema>;

const ApiKeyDisplay = ({ value }: { value: string }) => {
  const [showKey, setShowKey] = useState(false);
  const displayValue = showKey ? value : `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm">{displayValue}</span>
      <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)} className="h-6 w-6">
        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
};

const columns: ColumnConfig<ApiKey>[] = [
  { key: 'serviceName', header: 'Service Name', sortable: true, className: "font-medium w-[200px]" },
  { 
    key: 'keyValue', 
    header: 'API Key',
    render: (item) => <ApiKeyDisplay value={item.keyValue} />,
    className: "w-[250px]" 
  },
  { key: 'description', header: 'Description', className: "text-muted-foreground" },
  { 
    key: 'createdAt', 
    header: 'Date Added', 
    sortable: true, 
    render: (item) => new Date(item.createdAt).toLocaleDateString(),
    className: "w-[150px]"
  },
  // { key: 'addedByUserId', header: 'Added By ID', className: "text-xs text-muted-foreground w-[180px]" },
];

export default function ApiManagementPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isAddKeyDialogOpen, setIsAddKeyDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ApiKeyFormValues>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      serviceName: "",
      keyValue: "",
      description: "",
    },
  });

  const fetchApiKeys = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setIsLoadingPage(true);
    try {
      const fetchedKeys = await getApiKeys();
      setApiKeys(fetchedKeys);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch API keys." });
    } finally {
      setIsLoadingPage(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || currentUser.role !== 'admin') {
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to view this page." });
        router.replace('/dashboard');
      } else {
        fetchApiKeys();
      }
    }
  }, [currentUser, authLoading, router, fetchApiKeys, toast]);

  async function onSubmit(data: ApiKeyFormValues) {
    if (!currentUser) {
      toast({ variant: "destructive", title: "Error", description: "User not authenticated." });
      return;
    }
    setIsSubmitting(true);
    try {
      const newApiKeyData: NewApiKeyData = {
        ...data,
        addedByUserId: currentUser.id,
      };
      const result = await addApiKey(newApiKeyData);
      if ('error' in result) {
         toast({ variant: "destructive", title: "Failed to Add API Key", description: result.error });
      } else {
        toast({ title: "API Key Added", description: `${result.serviceName} key has been successfully saved.` });
        setIsAddKeyDialogOpen(false);
        form.reset();
        await fetchApiKeys(); 
      }
    } catch (error) {
      console.error("Failed to add API key:", error);
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || (isLoadingPage && !isAddKeyDialogOpen) ) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <p className="text-muted-foreground">Access Denied. You must be an admin to view this page.</p>
      </div>
    );
  }

  return (
    <DataTableShell
      title="API Key Management"
      description="Manage API keys for various services used by the platform. Be careful when handling these keys."
    >
      <div className="mb-4 flex justify-end">
        <Dialog open={isAddKeyDialogOpen} onOpenChange={setIsAddKeyDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Add New API Key</DialogTitle>
              <DialogDescription>
                Enter the details for the new API key.
                <br />
                <Badge variant="destructive" className="mt-2">Security Warning</Badge>
                <span className="text-xs ml-1 text-destructive-foreground bg-destructive p-1 rounded-sm">Keys are stored directly. For production, use a secrets manager.</span>
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="serviceName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., OpenAI, Google Maps" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="keyValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key Value</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter the API key" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Used for sentiment analysis feature" {...field} disabled={isSubmitting} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddKeyDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save API Key
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <GenericDataTable<ApiKey>
        data={apiKeys}
        columns={columns}
        caption="Stored API Keys"
      />
    </DataTableShell>
  );
}
