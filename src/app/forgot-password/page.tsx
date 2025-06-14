
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
import { Loader2, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLogo } from '@/components/layout/app-logo';
import Link from "next/link";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true);
    console.log("Password reset requested for email:", data.email);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In a real implementation, you would call an API route here:
    // const response = await fetch('/api/auth/request-password-reset', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email: data.email }),
    // });
    // const result = await response.json();
    // if (response.ok) { ... } else { ... }

    toast({
      title: "Reset Link Sent (Simulated)",
      description: `If an account with email ${data.email} exists, a password reset link has been sent.`,
    });
    setIsEmailSent(true);
    setIsLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="mb-10">
        <AppLogo size="large" />
      </div>
      <Card className="w-full max-w-md sm:max-w-lg shadow-xl border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-headline">Forgot Your Password?</CardTitle>
          <CardDescription>
            {isEmailSent 
              ? "Please check your email inbox (and spam folder) for the reset link."
              : "Enter your email address and we'll send you a link to reset your password."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEmailSent ? (
            <div className="text-center space-y-4">
              <Mail className="mx-auto h-16 w-16 text-green-500" />
              <p className="text-muted-foreground">
                The reset link is valid for a limited time.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Back to Login</Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          aria-invalid={form.formState.errors.email ? "true" : "false"}
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
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Send Reset Link
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
