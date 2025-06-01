
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { DataTableShell } from '@/components/analytics/data-table-shell';
import { GenericDataTable } from '@/components/analytics/generic-data-table';
import type { ColumnConfig, User } from '@/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Edit } from 'lucide-react';
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
import { Textarea } from "@/components/ui/textarea"; // Added for keywords
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
import { getUsers, addUser, updateUserKeywords, NewUserDetails } from '@/lib/user-service';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';

const userSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }).optional(),
  role: z.enum(["admin", "user"], { required_error: "Role is required." }),
  assignedKeywords: z.string().optional(), // Comma-separated string
});

type UserFormValues = z.infer<typeof userSchema>;

// Schema for the edit keywords dialog
const editKeywordsSchema = z.object({
  keywords: z.string().optional(),
});
type EditKeywordsFormValues = z.infer<typeof editKeywordsSchema>;

export default function UserManagementPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditKeywordsDialogOpen, setIsEditKeywordsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addUserForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "user",
      assignedKeywords: "",
    },
  });

  const editKeywordsForm = useForm<EditKeywordsFormValues>({
    resolver: zodResolver(editKeywordsSchema),
    defaultValues: {
      keywords: "",
    },
  });

  const fetchUsersList = useCallback(async () => {
    setIsLoadingPage(true);
    try {
      const fetchedUsers = await getUsers();
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

  async function onAddUserSubmit(data: UserFormValues) {
    setIsSubmitting(true);
    try {
      // Pass data as NewUserDetails, which now includes assignedKeywords string
      const result = await addUser(data as NewUserDetails); 
      if ('error' in result) {
         toast({ variant: "destructive", title: "Failed to Add User", description: result.error });
      } else if (result && result.id) {
        toast({ title: "User Added", description: `${result.name} has been successfully added.` });
        setIsAddUserDialogOpen(false);
        addUserForm.reset();
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

  const handleOpenEditKeywordsDialog = (userToEdit: User) => {
    setEditingUser(userToEdit);
    editKeywordsForm.reset({ keywords: userToEdit.assignedKeywords?.join(', ') || "" });
    setIsEditKeywordsDialogOpen(true);
  };

  async function onEditKeywordsSubmit(data: EditKeywordsFormValues) {
    if (!editingUser) return;
    setIsSubmitting(true);
    const keywordsArray = data.keywords ? data.keywords.split(',').map(k => k.trim()).filter(k => k !== "") : [];
    try {
      const result = await updateUserKeywords(editingUser.id, keywordsArray);
      if (result.success) {
        toast({ title: "Keywords Updated", description: `Keywords for ${editingUser.name} have been updated.` });
        setIsEditKeywordsDialogOpen(false);
        setEditingUser(null);
        await fetchUsersList();
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: result.error || "Could not update keywords." });
      }
    } catch (error) {
      console.error("Failed to update keywords:", error);
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const columns: ColumnConfig<User>[] = [
    { key: 'name', header: 'Name', sortable: true, className: "font-medium" },
    { key: 'email', header: 'Email', sortable: true },
    { 
      key: 'role', 
      header: 'Role', 
      sortable: true,
      render: (item) => <Badge variant={item.role === 'admin' ? 'default' : 'secondary'}>{item.role.charAt(0).toUpperCase() + item.role.slice(1)}</Badge>
    },
    {
      key: 'assignedKeywords',
      header: 'Assigned Keywords',
      render: (item) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {item.assignedKeywords && item.assignedKeywords.length > 0 ? (
            item.assignedKeywords.map(keyword => (
              <Badge key={keyword} variant="outline" className="text-xs">{keyword}</Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          )}
        </div>
      ),
      className: "min-w-[200px]"
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <Button variant="outline" size="sm" onClick={() => handleOpenEditKeywordsDialog(item)}>
          <Edit className="mr-2 h-3 w-3" /> Edit Keywords
        </Button>
      ),
      className: "text-center w-[160px]"
    }
  ];


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
      title="User Management"
      description="View, manage user accounts, and assign keywords."
    >
      <div className="mb-4 flex justify-end">
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Enter details for the new user. Keywords are comma-separated.
              </DialogDescription>
            </DialogHeader>
            <Form {...addUserForm}>
              <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4 py-4">
                <FormField
                  control={addUserForm.control}
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
                  control={addUserForm.control}
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
                  control={addUserForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addUserForm.control}
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
                <FormField
                  control={addUserForm.control}
                  name="assignedKeywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Keywords (comma-separated)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., AI, technology, nextjs" {...field} disabled={isSubmitting} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddUserDialogOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !addUserForm.formState.isValid}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save User
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Keywords Dialog */}
      <Dialog open={isEditKeywordsDialogOpen} onOpenChange={setIsEditKeywordsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Keywords for {editingUser?.name}</DialogTitle>
            <DialogDescription>
              Manage keywords assigned to this user. Enter keywords separated by commas.
            </DialogDescription>
          </DialogHeader>
          <Form {...editKeywordsForm}>
            <form onSubmit={editKeywordsForm.handleSubmit(onEditKeywordsSubmit)} className="space-y-4 py-4">
              <FormField
                control={editKeywordsForm.control}
                name="keywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords (comma-separated)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., AI, fintech, web development" {...field} disabled={isSubmitting} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditKeywordsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Keywords
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <GenericDataTable<User>
        data={users}
        columns={columns}
        caption="Registered Users"
      />
    </DataTableShell>
  );
}
