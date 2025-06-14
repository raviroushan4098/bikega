
"use client";

import { Globe, Sparkles, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function GlobalMentionsComingSoonPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] p-4 sm:p-6 md:p-8 text-center">
      <Card className="w-full max-w-2xl shadow-2xl overflow-hidden border-primary/20">
        <CardHeader className="bg-gradient-to-br from-primary/5 via-background to-background p-8">
          <div className="flex justify-center items-center mb-6">
            <Globe className="h-16 w-16 text-primary animate-pulse" />
            <Sparkles className={cn("h-10 w-10 text-accent ml-2 opacity-75 animate-ping", "animation-delay-500")} />
          </div>
          <CardTitle className="text-3xl sm:text-4xl font-headline tracking-tight text-primary">
            Global Mentions Tracker - Coming Soon!
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground mt-2">
            We're refining our Global Mentions feature to bring you even more comprehensive insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center space-y-3 text-muted-foreground">
            <Settings2 className="h-12 w-12 text-accent/80 mb-2 animate-spin animation-duration-3000" />
            <p className="text-base">
              Our enhanced Global Mentions Tracker is currently under development. Soon, you'll be able to monitor your keywords across a wider range of news outlets, blogs, forums, and general web content with improved accuracy and deeper analytics.
            </p>
            <p className="text-sm">
              Thank you for your patience. We're excited to launch this upgrade!
            </p>
          </div>
          <Separator className="my-6" />
          <div className="text-xs text-muted-foreground/70">
            The current mock data and Hacker News integration will be replaced by a more robust system.
          </div>
        </CardContent>
      </Card>
       <style jsx global>{`
        .animation-delay-500 {
          animation-delay: 0.5s;
        }
        .animation-duration-3000 {
            animation-duration: 3000ms;
        }
      `}</style>
    </div>
  );
}
