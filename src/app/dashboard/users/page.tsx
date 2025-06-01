
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, User } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getUsers, addUser, NewUserDetails } from '@/lib/user-service'; // Updated import
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';

const userSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }).optional(), // Password is not directly used by Firestore in this simple setup
  role: z.enum(["admin", "user"], { required_error: "Role is required." }),
});

type UserFormValues = z.infer<typeof userSchema>;

const columns: ColumnConfig<User>[] = [
  { key: 'name', header: 'Name', sortable: true, className: "font-medium" },
  { key: 'email', header: 'Email', sortable: true },
  { 
    key: 'role', 
    header: 'Role', 
    sortable: true,
    render: (item) => <Badge variant={item.role === 'admin' ? 'default' : 'secondary'}>{item.role.charAt(0).toUpperCase() + item.role.slice(1)}</Badge>
  },
  // Add other columns as needed, e.g., 'createdAt' if you store it
];

export default function UserManagementPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "", // Still collected but not used for Firestore auth in this version
      role: "user",
    },
  });

  const fetchUsersList = useCallback(async () => {
    setIsLoadingPage(true);
    try {
      const fetchedUsers = await getUsers(); // Fetches from Firestore
      setUsers(fetchedUsers);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch users from Firestore." });
    } finally {
      setIsLoadingPage(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || currentUser.role !== 'admin') {
        toast({ variant: "destructive", title: "Access Denied", description: "You do not have permission to view this page." });
        router.replace('/dashboard');
      } else {
        fetchUsersList();
      }
    }
  }, [currentUser, authLoading, router, fetchUsersList, toast]);

  async function onSubmit(data: UserFormValues) {
    setIsSubmitting(true);
    try {
      const result = await addUser(data as NewUserDetails); 
      if ('error' in result) {
         toast({ variant: "destructive", title: "Failed to Add User", description: result.error });
      } else if (result && result.id) { // Check for result.id for successful Firestore add
        toast({ title: "User Added", description: `${result.name} has been successfully added to Firestore.` });
        setIsAddUserDialogOpen(false);
        form.reset();
        await fetchUsersList(); 
      } else {
        toast({ variant: "destructive", title: "Failed to Add User", description: "An unknown error occurred." });
      }
    } catch (error) {
      console.error("Failed to add user:", error);
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred while adding the user." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoadingPage) {
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
      title="User Management (Firestore)"
      description="View and manage user accounts stored in Firestore. Ensure your Firebase project is configured."
    >
      <div className="mb-4 flex justify-end">
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User to Firestore</DialogTitle>
              <DialogDescription>
                Enter the details for the new user account. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="user@example.com" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (for reference, not secure auth)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddUserDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save User
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <GenericDataTable<User>
        data={users}
        columns={columns}
        caption="Registered Users (from Firestore)"
      />
    </DataTableShell>
  );
}
