
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/layout/app-logo';
import Image from 'next/image';
import { LayoutGrid, Youtube, MessageCircle, Twitter as TwitterIcon, Globe, ShieldCheck, BarChart3, LogIn, Users, Lightbulb, Target, Send, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  className?: string;
  index: number;
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
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
      }
    );

    observer.observe(currentCardRef);

    return () => {
      if (currentCardRef) {
        observer.unobserve(currentCardRef);
      }
    };
  }, []);

  const delayStyle = { transitionDelay: `${index * 100}ms` };

  return (
    <div
      ref={cardRef}
      style={delayStyle}
      className={cn(
        "transform transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
        "h-full"
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

const contactFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});
type ContactFormValues = z.infer<typeof contactFormSchema>;

export default function LandingPage() {
  const { toast } = useToast();
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });

  async function onContactSubmit(data: ContactFormValues) {
    setIsSubmittingContact(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast({
          title: "Message Sent!",
          description: "Thanks for reaching out. We'll get back to you soon.",
        });
        contactForm.reset();
      } else {
        const errorData = await response.json();
        toast({
          variant: "destructive",
          title: "Error Sending Message",
          description: errorData.error || "Something went wrong. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Could not send message. Please check your connection.",
      });
    } finally {
      setIsSubmittingContact(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background via-muted/20 to-background text-foreground">
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

      <section id="about" className="py-16 sm:py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-headline mb-4">About Insight Stream</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-10">
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold font-headline flex items-center">
                <Users className="w-7 h-7 text-primary mr-3" />
                Who We Are
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Welcome to Insight Stream. We are a passionate team of developers, analysts, and creatives dedicated to making digital monitoring smarter, simpler, and more accessible.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold font-headline flex items-center">
                <Target className="w-7 h-7 text-primary mr-3" />
                Our Mission
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Insight Stream is a powerful web and social media monitoring platform designed to decode your digital presence across major platforms like YouTube, Reddit, X (Twitter), and more. In an age where conversations move fast and attention is currency, we empower businesses, creators, and individuals to track trends, analyze sentiment, and uncover key online mentions in real time.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Our mission is to democratize digital intelligence — offering an all-in-one solution that’s easy to use, beautifully designed, and packed with deep analytics. Whether you're a growing startup, a personal brand, or a global enterprise, Insight Stream helps you stay ahead of the curve.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                With actionable dashboards, AI-powered insights, and seamless integrations, we aim to make brand reputation tracking and trend discovery not just a task — but a strategic advantage.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold font-headline flex items-center">
                <Lightbulb className="w-7 h-7 text-primary mr-3" />
                The Team Behind Insight Stream
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We’re a lean, driven, and remote-friendly team combining expertise in data science, machine learning, digital marketing, and UX design. Together, we are building a platform that continuously evolves — driven by feedback, innovation, and the dynamic nature of the digital world.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Our goal is simple: To be the go-to digital footprint tracker for the modern age.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="py-16 sm:py-20 md:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-headline mb-4">Get In Touch</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Have questions or want to learn more? We'd love to hear from you.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold font-headline">Contact Information</h3>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary" />
                <a href="tel:+917091234058" className="text-muted-foreground hover:text-primary transition-colors">+91 70912 34058</a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" />
                <a href="mailto:noreply.redditmonitoring@gmail.com" className="text-muted-foreground hover:text-primary transition-colors">noreply.redditmonitoring@gmail.com</a>
              </div>
              <div className="pt-4">
                 <h4 className="text-lg font-semibold mb-2">Office Hours</h4>
                 <p className="text-muted-foreground">Monday - Friday: 9:00 AM - 6:00 PM (IST)</p>
                 <p className="text-muted-foreground">Saturday - Sunday: Closed</p>
              </div>
            </div>
            <Card className="shadow-xl p-6 sm:p-8 border-primary/20">
              <CardHeader className="p-0 pb-6">
                <CardTitle className="text-2xl font-headline">Send us a Message</CardTitle>
                <CardDescription>Fill out the form and we'll get back to you.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Form {...contactForm}>
                  <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-6">
                    <FormField
                      control={contactForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} disabled={isSubmittingContact} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="you@example.com" {...field} disabled={isSubmittingContact} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contactForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Your message here..." {...field} rows={5} disabled={isSubmittingContact} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isSubmittingContact}>
                      {isSubmittingContact && <Send className="mr-2 h-4 w-4 animate-pulse" />}
                      {isSubmittingContact ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

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
