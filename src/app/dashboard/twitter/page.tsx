
"use client";

import { Twitter, Sparkles, Settings2 } from 'lucide-react'; // Added Settings2 as a construction-like icon
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function TwitterAnalyticsComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-4 sm:p-6 md:p-8 text-center">
      <Card className="w-full max-w-2xl shadow-2xl overflow-hidden border-primary/20">
        <CardHeader className="bg-gradient-to-br from-primary/5 via-background to-background p-8">
          <div className="flex justify-center items-center mb-6">
            <Twitter className="h-16 w-16 text-primary animate-pulse" />
            <Sparkles className="h-10 w-10 text-accent ml-2 opacity-75 animate-ping animation-delay-500" />
          </div>
          <CardTitle className="text-3xl sm:text-4xl font-headline tracking-tight text-primary">
            Twitter/X Analytics - Coming Soon!
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            We're hard at work building powerful Twitter/X analytics for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center space-y-3 text-muted-foreground">
            <Settings2 className="h-12 w-12 text-accent/80 mb-2" />
            <p className="text-base">
              This exciting new feature will harness the power of the official Twitter/X API to bring you deep insights into tweet performance, keyword tracking, and audience engagement.
            </p>
            <p className="text-sm">
              Stay tuned for updates! We're aiming to launch this as soon as possible.
            </p>
          </div>
          <Separator className="my-6" />
          <div className="text-xs text-muted-foreground/70">
            Live data integration will require setup with the Twitter/X API.
          </div>
        </CardContent>
      </Card>
       <style jsx global>{`
        .animation-delay-500 {
          animation-delay: 0.5s;
        }
      `}</style>
    </div>
  );
}
