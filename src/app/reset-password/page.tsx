
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2, KeyRound, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLogo } from '@/components/layout/app-logo';
import Link from "next/link";

const resetPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  otp: z.string().length(6, { message: "OTP must be 6 digits." }).regex(/^\d{6}$/, { message: "OTP must be 6 digits." }),
  newPassword: z.string().min(6, { message: "New password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Confirm password must be at least 6 characters." }),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"], // path to field that will display the error
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
      otp: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ResetPasswordFormValues) {
    setIsLoading(true);
    // In a real app, this would call an API endpoint:
    // POST /api/auth/verify-otp-and-reset-password with { email, otp, newPassword }
    console.log("Reset password data submitted:", data);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate success for now
    toast({
      title: "Password Reset Successful (Simulated)",
      description: "Your password has been updated. You can now log in with your new password.",
    });
    setIsPasswordReset(true);
    form.reset(); // Clear the form

    // Simulate error (uncomment to test error handling)
    // toast({
    //   variant: "destructive",
    //   title: "Reset Failed (Simulated)",
    //   description: "Invalid OTP or an error occurred. Please try again.",
    // });

    setIsLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="mb-10">
        <AppLogo size="large" />
      </div>
      <Card className="w-full max-w-md sm:max-w-lg shadow-xl border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-headline">Set New Password</CardTitle>
          <CardDescription>
            {isPasswordReset 
              ? "Your password has been successfully reset. You can now log in."
              : "Enter your email, the OTP you received, and your new password."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPasswordReset ? (
             <div className="text-center space-y-4">
              <Lock className="mx-auto h-16 w-16 text-green-500" />
              <p className="text-muted-foreground">
                Your new password is set.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Proceed to Login</Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>One-Time Password (OTP)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-4 w-4" />
                  )}
                  Reset Password
                </Button>
                <div className="text-center">
                  <Button variant="link" className="text-sm px-0" asChild>
                    <Link href="/login">Back to Login</Link>
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
       <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Insight Stream. All rights reserved.
      </p>
    </div>
  );
}

    