
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/layout/app-logo';
import Image from 'next/image';
import { LayoutGrid, Youtube, MessageCircle, Twitter as TwitterIcon, Globe, ShieldCheck, BarChart3, LogIn } from 'lucide-react'; // Removed DollarSign, Mail, Info as they are not directly used for icons in buttons now
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  className?: string;
  index: number; // For staggered animation
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: Icon, title, description, className, index }) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentCardRef = cardRef.current;
    if (!currentCardRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target); // Stop observing once visible
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the card is visible
      }
    );

    observer.observe(currentCardRef);

    return () => {
      observer.unobserve(currentCardRef); // Cleanup on unmount
    };
  }, []); // Runs once after initial render

  const delayStyle = { transitionDelay: `${index * 100}ms` };

  return (
    <div
      ref={cardRef}
      style={delayStyle}
      className={cn(
        "transform transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
        "h-full" // Ensure the div takes full height for card layout
      )}
    >
      <Card className={cn("shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center h-full", className)}>
        <CardHeader className="pb-4">
          <div className="p-3 bg-primary/10 rounded-full inline-block mb-3">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-lg font-headline">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardContent>
      </Card>
    </div>
  );
};

const features = [
  {
    icon: LayoutGrid,
    title: "Unified Analytics Dashboard",
    description: "Aggregate data from YouTube, Reddit, Twitter/X, and global mentions into one seamless dashboard.",
    className: "border-t-4 border-primary"
  },
  {
    icon: Youtube,
    title: "YouTube Analytics",
    description: "Track video performance with metrics like likes, comments, and shares for admin-selected channels.",
    className: "border-t-4 border-red-500"
  },
  {
    icon: MessageCircle,
    title: "Reddit Post Tracking",
    description: "Monitor Reddit posts based on keywords, with sortable data including title, subreddit, author, and timestamp.",
    className: "border-t-4 border-orange-500"
  },
  {
    icon: TwitterIcon,
    title: "X (Twitter) Monitoring",
    description: "View tweets, comments, and replies from X, filtered by keywords, and sortable by author or retweets.",
    className: "border-t-4 border-sky-500"
  },
  {
    icon: Globe,
    title: "Global Web Mentions",
    description: "Discover mentions from news, blogs, and forums across the web, based on your defined keywords.",
    className: "border-t-4 border-green-500"
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Simple and effective role-based access control to manage data visibility for admins and users.",
    className: "border-t-4 border-purple-500"
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-muted/20 to-background text-foreground">
      {/* Header */}
      <header className="py-4 px-6 sm:px-10 md:px-16 shadow-sm bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto flex justify-between items-center">
          <AppLogo size="medium" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="#pricing" passHref>
              <Button variant="ghost" size="sm">Pricing</Button>
            </Link>
            <Link href="#contact" passHref>
              <Button variant="ghost" size="sm">Contact Us</Button>
            </Link>
            <Link href="#about" passHref>
              <Button variant="ghost" size="sm">About</Button>
            </Link>
            <Link href="/login" passHref>
              <Button variant="default" size="sm">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-grow flex items-center justify-center py-16 sm:py-20 md:py-28 bg-gradient-to-b from-primary/5 via-transparent to-transparent">
        <div className="container mx-auto text-center px-4">
          <BarChart3 className="w-16 h-16 sm:w-20 sm:h-20 text-primary mx-auto mb-6 animate-bounce" />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-headline tracking-tight mb-6">
            <span className="bg-gradient-to-r from-accent via-primary to-blue-400 bg-clip-text text-transparent">
              Welcome to Insight Stream
            </span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
             Insight Stream empowers you to understand your digital footprint. We provide a unified platform to track, analyze, and act on social media trends and web mentions from YouTube, Reddit, X (Twitter), and beyond. Make data-driven decisions, monitor brand reputation, and discover key conversations effortlessly.
          </p>

          <div className="relative w-full max-w-3xl mx-auto aspect-video rounded-xl overflow-hidden shadow-2xl mb-12 border-4 border-primary/20 group">
            <Image
              src="https://placehold.co/1280x720.png"
              alt="Analytics Dashboard Preview"
              fill
              style={{ objectFit: 'cover' }}
              data-ai-hint="dashboard analytics"
              priority
              className="transform transition-transform duration-500 group-hover:scale-105"
            />
             <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/5 transition-opacity duration-500 group-hover:opacity-70"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-headline mb-4">Powerful Features, Effortless Insights</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Insight Stream provides a comprehensive suite of tools to monitor and analyze your online presence.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                className={feature.className}
                index={idx} 
              />
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 text-center border-t border-border/30 bg-card/50">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Insight Stream. All rights reserved. Built with Firebase Studio.
        </p>
      </footer>
       <style jsx global>{`
        .animation-delay-500 {
          animation-delay: 0.5s;
        }
        .animate-bounce {
          animation: bounce 1.5s infinite;
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(-10%);
            animation-timing-function: cubic-bezier(0.8,0,1,1);
          }
          50% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0,0,0.2,1);
          }
        }
      `}</style>
    </div>
  );
}
