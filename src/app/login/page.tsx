import { LoginForm } from '@/components/auth/login-form';
import { AppLogo } from '@/components/layout/app-logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="mb-10">
        <AppLogo size="large" />
      </div>
      <Card className="w-full max-w-md sm:max-w-lg shadow-xl border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-headline">Welcome Back</CardTitle>
          <CardDescription>Sign in to access your Insight Stream dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Insight Stream. All rights reserved.
      </p>
    </div>
  );
}
