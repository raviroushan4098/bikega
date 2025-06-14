
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
import { Loader2, Mail, KeyRound } from "lucide-react"; // Added KeyRound
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
    setIsEmailSent(false); // Reset this in case of re-submission attempt

    try {
      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Check Your Email",
          description: "If an account with this email exists, an OTP has been sent. It's valid for 10 minutes.", 
        });
        setIsEmailSent(true); 
      } else {
        toast({
          variant: "destructive",
          title: "Request Failed",
          description: result.error || "Could not process your request. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Something went wrong. Please try again later.",
      });
      console.error("Forgot password error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="mb-10">
        <AppLogo size="large" />
      </div>
      <Card className="w-full max-w-md sm:max-w-lg shadow-xl border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-headline">Reset Your Password</CardTitle>
          <CardDescription>
            {isEmailSent
              ? "An OTP has been sent to your email. Please check your inbox (and spam folder). It may take a few minutes to arrive and is valid for 10 minutes."
              : "Enter your email address and we'll send you an OTP to reset your password."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEmailSent ? (
            <div className="text-center space-y-4">
              <Mail className="mx-auto h-16 w-16 text-green-500" />
              <p className="text-muted-foreground">
                Once you receive your OTP, please proceed to the Reset Password page to set your new password.
              </p>
              <Button asChild className="w-full" variant="default">
                <Link href="/reset-password">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Proceed to Reset Password
                </Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
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
                  Send OTP
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
