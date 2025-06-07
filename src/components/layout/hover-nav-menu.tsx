
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Youtube,
  Twitter,
  Globe,
  Users,
  Settings,
  LogOut,
  KeyRound,
  Menu as MenuIcon,
  ChevronRight,
} from 'lucide-react';
import { AppLogo } from './app-logo';
import { useAuth } from '@/contexts/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const RedditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m3.643 14.08c-.224.358-.71.465-1.065.242-.806-.507-1.82-.78-2.89-.78c-1.068 0-2.083.273-2.888.78c-.357.223-.843.116-1.067-.242c-.224-.358-.115-.843.24-1.065c1.01-.634 2.26-.975 3.588-.975c1.33 0 2.58.34 3.59.974c.354.223.462.707.24 1.066M10.15 10.495a1.492 1.492 0 0 0-1.493 1.492a1.492 1.492 0 0 0 1.493 1.493a1.492 1.492 0 0 0 1.492-1.493a1.492 1.492 0 0 0-1.492-1.492m5.194 0a1.492 1.492 0 0 0-1.492 1.492a1.492 1.492 0 0 0 1.492 1.493a1.492 1.492 0 0 0 1.493-1.493a1.492 1.492 0 0 0-1.493-1.492M12 4.516c-.46 0-.892.066-1.29.194c1.31-.62 2.72-1.02 4.22-1.02c2.31 0 4.39.95 5.92 2.52c.23.23.23.61 0 .84c-.23.23-.61.23-.84 0a7.423 7.423 0 0 0-5.08-2.15c.05.16.08.33.08.5c0 .8-.26 1.52-.71 2.11c-.25.33-.09.81.29.95c.09.03.18.05.28.05c.3 0 .57-.16.71-.42c.69-.91 1.08-2.01 1.08-3.19c0-.39-.03-.77-.09-1.14C15.74 4.7 13.98 4.52 12 4.516m-7.036 2.368a7.423 7.423 0 0 0-5.08 2.15c-.23.23-.23.61 0 .84c.23.23.61.23.84 0c1.53-1.57 3.61-2.52 5.92-2.52c1.5 0 2.91.39 4.22 1.02c-.4-.13-.83-.19-1.29-.19c-2.38 0-4.48 1.05-5.92 2.69c-.14.26-.41.42-.71.42c-.1 0-.19-.02-.28-.05c-.38-.14-.54-.62-.29-.95c-.45-.6-.71-1.32-.71-2.12c0-.17.03-.33.08-.5c.002 0 .003 0 .005 0M12 6.705c.63 0 1.23.09 1.79.26c.3.09.62-.08.71-.38c.09-.3-.08-.62-.38-.71A9.37 9.37 0 0 0 12 5.605c-.69 0-1.37.05-2.03.15c-.06.01-.11.02-.17.03c-.3.06-.5.33-.5.63c.04.32.32.53.62.52c.02 0 .03 0 .05-.01c.55-.08 1.12-.13 1.71-.13c.07 0 .13.001.19.003l.08.005a3.14 3.14 0 0 1 .07.003zm3.29 10.68c.18.14.4.21.61.21c.29 0 .57-.12.78-.35c.49-.56.43-1.39-.13-1.88c-.92-.78-2.22-1.03-3.55-.73c-.34.08-.56.4-.48.74c.08.34.4.56.74.48c.94-.22 1.89-.03 2.55.45c-.01 0-.02.01-.02.01m-8.08.11c.66-.48 1.61-.67 2.55-.45c.34-.08.66.14.74.48c.08.34-.14.66-.48.74c-1.33-.3-2.63-.05-3.55.73c-.56.49-.62 1.32-.13 1.88c.21.23.49.35.78.35c.21 0 .43-.07.61-.21l0 0c0-.01 0-.01 0-.01z"/>
  </svg>
);

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/youtube', label: 'YouTube', icon: Youtube },
  { href: '/dashboard/reddit', label: 'Reddit', icon: RedditIcon },
  { href: '/dashboard/twitter', label: 'Twitter/X', icon: Twitter },
  { href: '/dashboard/mentions', label: 'Mentions', icon: Globe },
];

const adminNavItems: NavItem[] = [
  { href: '/dashboard/users', label: 'User Management', icon: Users, adminOnly: true },
  { href: '/dashboard/api-management', label: 'API Management', icon: KeyRound, adminOnly: true },
];

const HoverNavMenu = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  let leaveTimeout: NodeJS.Timeout;

  const handleTriggerMouseEnter = () => {
    clearTimeout(leaveTimeout);
    setIsOpen(true);
  };

  const handleTriggerMouseLeave = () => {
    leaveTimeout = setTimeout(() => {
      setIsOpen(false);
    }, 150); // Small delay to allow moving to content
  };

  const handleContentMouseEnter = () => {
    clearTimeout(leaveTimeout);
    setIsOpen(true);
  };

  const handleContentMouseLeave = () => {
     leaveTimeout = setTimeout(() => { // Also use a delay here in case of brief mouse-outs
      setIsOpen(false);
    }, 150);
  };
  
  const handleLinkClick = () => {
    setIsOpen(false); // Close popover when a link is clicked
  };

  if (!user) return null;

  const renderNavItems = (items: NavItem[]) => {
    return items.map((item) => {
      if (item.adminOnly && user?.role !== 'admin') {
        return null;
      }
      const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
      return (
        <Link href={item.href} key={item.href} passHref onClick={handleLinkClick}>
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer",
              "hover:bg-accent hover:text-accent-foreground",
              isActive ? "bg-primary/10 text-primary" : "text-foreground/80"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
            <span>{item.label}</span>
          </div>
        </Link>
      );
    });
  };

  return (
    <div className="fixed top-2 left-4 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full shadow-lg w-12 h-12 bg-background hover:bg-accent"
            onMouseEnter={handleTriggerMouseEnter}
            onMouseLeave={handleTriggerMouseLeave}
            onClick={() => setIsOpen(prev => !prev)} // Allow click to toggle for touch devices
            aria-label="Open navigation menu"
          >
            <MenuIcon className="h-6 w-6 text-primary" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          className="w-64 p-0 bg-card shadow-xl border-border rounded-lg"
          onMouseEnter={handleContentMouseEnter}
          onMouseLeave={handleContentMouseLeave}
        >
          <div className="p-3">
            <AppLogo size="small" />
          </div>
          <Separator />
          <nav className="flex flex-col gap-1 p-3">
            {renderNavItems(navItems)}
            {user.role === 'admin' && adminNavItems.length > 0 && <Separator className="my-1" />}
            {user.role === 'admin' && renderNavItems(adminNavItems)}
          </nav>
          <Separator />
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.profilePictureUrl} alt={user.name} data-ai-hint="profile person" />
                <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { logout(); setIsOpen(false); }}>
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default HoverNavMenu;
