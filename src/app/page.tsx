
"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/layout/app-logo';
import Image from 'next/image';
import { LayoutGrid, Youtube, MessageCircle, Twitter as TwitterIcon, Globe, ShieldCheck, BarChart3, LogIn, Users, Lightbulb, Target, Send, Phone, Mail, CheckCircle2, Star, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { ThemeToggleButton } from '@/components/layout/ThemeToggleButton';

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
        "transform transition-all duration-700 ease-out group",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
        "h-full"
      )}
    >
      <Card className={cn(
        "shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col items-center text-center h-full hover:-translate-y-1 border-t-4",
        "group-hover:shadow-primary/30",
        className
      )}>
        <CardHeader className="pb-4">
          <div className="p-3 bg-primary/10 rounded-full inline-block mb-3 transition-transform duration-300 group-hover:scale-110">
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
    className: "border-primary"
  },
  {
    icon: Youtube,
    title: "YouTube Analytics",
    description: "Track video performance with metrics like likes, comments, and shares for admin-selected channels.",
    className: "border-red-500"
  },
  {
    icon: MessageCircle,
    title: "Reddit Post Tracking",
    description: "Monitor Reddit posts based on keywords, with sortable data including title, subreddit, author, and timestamp.",
    className: "border-orange-500"
  },
  {
    icon: TwitterIcon,
    title: "X (Twitter) Monitoring",
    description: "View tweets, comments, and replies from X, filtered by keywords, and sortable by author or retweets.",
    className: "border-sky-500"
  },
  {
    icon: Globe,
    title: "Global Web Mentions",
    description: "Discover mentions from news, blogs, and forums across the web, based on your defined keywords.",
    className: "border-green-500"
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Simple and effective role-based access control to manage data visibility for admins and users.",
    className: "border-purple-500"
  },
];

const contactFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});
type ContactFormValues = z.infer<typeof contactFormSchema>;

interface PricingPlan {
  name: string;
  priceMonthlyInr: string;
  priceMonthlyUsd: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  ctaText: string;
  ctaLink: string;
  trialInfo?: string;
  highlightClass?: string;
}

const pricingPlans: PricingPlan[] = [
  {
    name: "Starter",
    priceMonthlyInr: "₹799",
    priceMonthlyUsd: "$10",
    description: "Perfect for individuals, small creators, or early-stage startups.",
    features: [
      "Monitor up to 2 platforms (e.g., Reddit + X)",
      "2 keywords/mentions",
      "Daily updates",
      "Basic sentiment analysis",
      "7-day data history",
      "1 user seat",
    ],
    ctaText: "Start Free Trial",
    ctaLink: "#",
    trialInfo: "Free 7-day trial available",
  },
  {
    name: "Growth",
    priceMonthlyInr: "₹2,499",
    priceMonthlyUsd: "$30",
    description: "Designed for growing teams and personal brands who need deeper insights.",
    features: [
      "Monitor up to 4 platforms",
      "10 keywords/mentions",
      "Near real-time updates (every 2–3 hours)",
      "Advanced sentiment & trend analysis",
      "30-day data history",
      "3 user seats",
      "CSV/Excel data export",
    ],
    isPopular: true,
    ctaText: "Choose Growth Plan",
    ctaLink: "#",
    highlightClass: "border-primary shadow-primary/20",
  },
  {
    name: "Pro",
    priceMonthlyInr: "₹6,499",
    priceMonthlyUsd: "$75",
    description: "Ideal for agencies, marketers, and brand managers.",
    features: [
      "Monitor all available platforms",
      "50+ keywords/mentions",
      "Real-time updates",
      "AI-driven insights & competitor monitoring",
      "90-day data history",
      "10 user seats",
      "Team collaboration features",
      "Email + Slack alerts",
      "API access",
    ],
    ctaText: "Choose Pro Plan",
    ctaLink: "#",
  },
  {
    name: "Enterprise",
    priceMonthlyInr: "Custom",
    priceMonthlyUsd: "Custom",
    description: "For large-scale teams, enterprises, or niche use-cases.",
    features: [
      "Unlimited platforms & keywords",
      "Dedicated account manager",
      "Custom dashboards & reporting",
      "On-premise or private cloud options",
      "White-labeling available",
      "SLA & compliance support",
    ],
    ctaText: "Schedule a Demo",
    ctaLink: "#contact",
  },
];

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
            <ThemeToggleButton />
            <Link href="/login" passHref>
              <Button variant="default" size="sm" className="ml-2">
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex-grow flex items-center justify-center py-16 sm:py-20 md:py-28 bg-gradient-to-b from-primary/5 via-transparent to-transparent">
        <div className="container mx-auto text-center px-4">
          <BarChart3 className="w-16 h-16 sm:w-20 sm:h-20 text-primary mx-auto mb-6 animate-hero-icon-bounce" />
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-headline tracking-tight mb-6">
            <span className="bg-gradient-to-r from-accent via-primary to-blue-400 bg-clip-text text-transparent">
              Welcome to Insight Stream
            </span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-10">
             Insight Stream empowers you to understand your digital footprint. We provide a unified platform to track, analyze, and act on social media trends and web mentions from YouTube, Reddit, X (Twitter), and beyond. Make data-driven decisions, monitor brand reputation, and discover key conversations effortlessly.
          </p>
          <div className="relative w-full max-w-3xl mx-auto aspect-video rounded-xl overflow-hidden shadow-2xl mb-12 border-4 border-primary/20 group">
            <video
              src="/videos/hero-video.mp4"
              autoPlay
              muted
              loop
              playsInline
              poster="https://placehold.co/1280x720.png"
              className="absolute top-0 left-0 w-full h-full object-cover"
              data-ai-hint="product showcase technology"
            >
              Your browser does not support the video tag.
            </video>
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
                className={cn(feature.className, "group-hover:shadow-lg")}
                index={idx}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 sm:py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-headline mb-4">Flexible Pricing for Every Need</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that's right for you and start gaining valuable insights today.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {pricingPlans.map((plan, idx) => (
              <Card key={plan.name} className={cn(
                "shadow-lg flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group",
                plan.isPopular ? "border-2 border-primary shadow-primary/20 lg:scale-105 hover:shadow-primary/30" : cn("hover:shadow-accent/20", plan.highlightClass),
                idx === 1 && !plan.isPopular ? "lg:transform lg:scale-105" : ""
              )}>
                {plan.isPopular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold tracking-wider uppercase transform translate-x-1/3 -translate-y-1/3 rotate-45">
                     <Star className="w-3 h-3 inline-block -mt-0.5 mr-1" /> Popular
                  </div>
                )}
                <CardHeader className="pb-4 text-center">
                   <Zap className={cn("w-10 h-10 mx-auto mb-3 transition-transform duration-300 group-hover:scale-110", plan.isPopular ? "text-primary" : "text-accent")} />
                  <CardTitle className="text-xl font-headline">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold text-foreground mt-2">
                    {plan.priceMonthlyInr} <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">({plan.priceMonthlyUsd}/month USD)</p>
                  <CardDescription className="text-sm mt-2 h-12 line-clamp-2">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow pt-2 pb-6">
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="mt-auto p-6 pt-0">
                  <Button asChild className={cn("w-full transition-transform duration-200 hover:scale-105", plan.isPopular ? "bg-primary hover:bg-primary/90" : "bg-accent hover:bg-accent/90 text-accent-foreground")}>
                    <Link href={plan.ctaLink}>{plan.ctaText}</Link>
                  </Button>
                </CardFooter>
                {plan.trialInfo && !plan.isPopular && (
                  <p className="text-xs text-center text-muted-foreground pb-4 px-6 -mt-2">{plan.trialInfo}</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-16 sm:py-20 md:py-28 bg-background">
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

      <section id="contact" className="py-16 sm:py-20 md:py-28 bg-muted/30">
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
            <Card className="shadow-xl p-6 sm:p-8 border-primary/20 bg-background">
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
        .animate-hero-icon-bounce {
          animation: hero-icon-bounce 2s infinite;
        }
        @keyframes hero-icon-bounce {
          0%, 100% {
            transform: translateY(-8%);
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
