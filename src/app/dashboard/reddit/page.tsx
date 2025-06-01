
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { getUsers, updateUserKeywords } from '@/lib/user-service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useRouter }
from 'next/navigation';

const keywordManagementSchema = z.object({
  keywords: z.string().optional(),
});

type KeywordFormValues = z.infer<typeof keywordManagementSchema>;

export default function ManageUserKeywordsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<KeywordFormValues>({
    resolver: zodResolver(keywordManagementSchema),
    defaultValues: {
      keywords: "",
    },
  });

  // Fetch all users if current user is admin
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      setIsLoadingUsers(true);
      getUsers()
        .then(users => {
          setAllUsers(users);
        })
        .catch(error => {
          console.error("Failed to fetch users for admin dropdown:", error);
          toast({ variant: "destructive", title: "Error", description: "Failed to fetch users list." });
        })
        .finally(() => setIsLoadingUsers(false));
    } else if (!authLoading && currentUser?.role !== 'admin') {
      // If not admin, redirect them as this page is admin-only now
      toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to view this page."});
      router.replace('/dashboard');
    }
  }, [currentUser, authLoading, toast, router]);


  const handleUserSelection = (userId: string) => {
    if (userId === 'none') {
      setSelectedUser(null);
      form.reset({ keywords: "" });
      return;
    }
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setSelectedUser(user);
      form.reset({ keywords: user.assignedKeywords?.join(', ') || "" });
    } else {
      setSelectedUser(null);
      form.reset({ keywords: "" });
    }
  };

  async function onSubmitKeywords(data: KeywordFormValues) {
    if (!selectedUser) {
      toast({ variant: "destructive", title: "Error", description: "No user selected." });
      return;
    }
    setIsSubmitting(true);
    const keywordsArray = data.keywords ? data.keywords.split(',').map(k => k.trim()).filter(k => k !== "") : [];
    try {
      const result = await updateUserKeywords(selectedUser.id, keywordsArray);
      if (result.success) {
        toast({ title: "Keywords Updated", description: `Keywords for ${selectedUser.name} have been updated.` });
        // Optimistically update selectedUser state or re-fetch if necessary
        setSelectedUser(prevUser => prevUser ? { ...prevUser, assignedKeywords: keywordsArray } : null);
        // To ensure the form reflects the latest saved state accurately after an update,
        // especially if there was any transformation or filtering server-side (though not in this case for keywords)
        // one might re-fetch the user. For keywords, optimistic update is usually fine.
        // Or, re-fetch all users if you want to be absolutely sure the list is current (though potentially overkill)
        // await fetchUsers(); // Example if re-fetching all users
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not update keywords." });
      }
    } catch (error) {
      console.error(`Failed to update keywords for ${selectedUser.name}:`, error);
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || (currentUser?.role === 'admin' && isLoadingUsers && !selectedUser)) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (currentUser?.role !== 'admin') {
    // This should ideally be caught by the useEffect redirect, but as a fallback:
    return (
        <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
            <p className="text-muted-foreground">Access Denied. This page is for administrators only.</p>
        </div>
    );
  }


  return (
    <DataTableShell
      title="Manage User Keywords"
      description="Assign or update keywords for users. These keywords can be used to personalize their experience on other platform features."
    >
      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="user-select-keywords" className="text-sm font-medium mb-1 block">Select User to Manage Keywords:</Label>
          {isLoadingUsers && allUsers.length === 0 ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...
            </div>
            ) : (
            <Select
              value={selectedUser?.id || "none"}
              onValueChange={handleUserSelection}
            >
              <SelectTrigger id="user-select-keywords" className="w-full sm:w-[320px] bg-background shadow-sm">
                <SelectValue placeholder="Select a user..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select a User --</SelectItem>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedUser && (
          <div className="p-4 border rounded-md bg-card mt-4">
            <h3 className="text-lg font-semibold mb-1">Keywords for {selectedUser.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">Enter keywords separated by commas.</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitKeywords)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="keywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Keywords</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., technology, AI, startups"
                          {...field}
                          rows={4}
                          className="bg-background"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSubmitting || !selectedUser}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Keywords for {selectedUser.name}
                </Button>
              </form>
            </Form>
          </div>
        )}
        {!selectedUser && allUsers.length > 0 && (
            <p className="text-muted-foreground mt-4">Please select a user from the dropdown to manage their keywords.</p>
        )}
      </div>
    </DataTableShell>
  );
}
    