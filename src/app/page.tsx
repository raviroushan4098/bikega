
"use client"; // Using "use client" for Link component and potential future interactivity

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/layout/app-logo';
import Image from 'next/image';
import { BarChart3, DollarSign, Mail, Info, LogIn } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Header */}
      <header className="py-4 px-6 sm:px-10 md:px-16 shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <AppLogo size="medium" />
          <Link href="/login" passHref>
            <Button variant="outline" className="hidden sm:flex">
              <LogIn className="mr-2 h-4 w-4" /> Login
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex items-center justify-center py-12 sm:py-16 md:py-24">
        <div className="container mx-auto text-center px-4">
          <BarChart3 className="w-16 h-16 sm:w-20 sm:h-20 text-primary mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-headline tracking-tight text-foreground mb-6">
            Welcome to Insight Stream
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Unlock the power of social analytics. Gain valuable insights from YouTube, Reddit, and more, all in one place.
          </p>

          <div className="relative w-full max-w-3xl mx-auto aspect-video rounded-xl overflow-hidden shadow-2xl mb-12 border-4 border-primary/30">
            <Image
              src="https://placehold.co/1280x720.png"
              alt="Analytics Dashboard Preview"
              fill
              style={{ objectFit: 'cover' }}
              data-ai-hint="dashboard analytics"
              priority
            />
             <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10"></div>
          </div>
          

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <Link href="#pricing" passHref>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <DollarSign className="mr-2 h-5 w-5" /> Pricing
              </Button>
            </Link>
            <Link href="#contact" passHref>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <Mail className="mr-2 h-5 w-5" /> Contact Us
              </Button>
            </Link>
            <Link href="#about" passHref>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                <Info className="mr-2 h-5 w-5" /> About Us
              </Button>
            </Link>
            <Link href="/login" passHref>
              <Button size="lg" className="w-full sm:w-auto">
                <LogIn className="mr-2 h-5 w-5" /> Login / Get Started
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-border/50">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Insight Stream. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
