
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import {
  LayoutDashboard,
  Youtube,
  Twitter,
  Globe,
  Users,
  Settings,
  LogOut,
  ShieldCheck, // New icon for Admin Dashboard
} from 'lucide-react';
import { AppLogo } from './app-logo';
import { useAuth } from '@/contexts/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator
} from '@/components/ui/sidebar';
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
  subItems?: NavItem[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/youtube', label: 'YouTube', icon: Youtube },
  { href: '/dashboard/reddit', label: 'Reddit', icon: RedditIcon },
  { href: '/dashboard/twitter', label: 'Twitter/X', icon: Twitter },
  { href: '/dashboard/mentions', label: 'Mentions', icon: Globe },
];

const adminNavItems: NavItem[] = [
  { href: '/dashboard/admin', label: 'Admin Panel', icon: ShieldCheck, adminOnly: true },
  { href: '/dashboard/users', label: 'User Management', icon: Users, adminOnly: true },
  // { href: '/dashboard/settings', label: 'Settings', icon: Settings, adminOnly: true }, // Can be re-added if needed
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const renderNavItemsRecursive = (items: NavItem[], isSubmenu = false) => {
    return items.map((item) => {
      if (item.adminOnly && user?.role !== 'admin') {
        return null;
      }
      const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
      
      const MenuButtonComponent = isSubmenu ? SidebarMenuSubButton : SidebarMenuButton;

      return (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <MenuButtonComponent
              className={cn(isActive && "bg-primary/10 text-primary hover:bg-primary/20")}
              isActive={isActive}
              tooltip={item.label}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground group-hover/menu-button:text-primary")} />
              <span className="truncate">{item.label}</span>
            </MenuButtonComponent>
          </Link>
          {item.subItems && item.subItems.length > 0 && (
            <SidebarMenuSub>
              {renderNavItemsRecursive(item.subItems, true)}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      );
    });
  };


  if (!user) return null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <AppLogo />
      </SidebarHeader>
      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          {renderNavItemsRecursive(navItems)}
          {user.role === 'admin' && adminNavItems.length > 0 && <SidebarSeparator className="my-2"/>}
          {user.role === 'admin' && renderNavItemsRecursive(adminNavItems)}
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start p-2 h-auto">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.profilePictureUrl} alt={user.name} data-ai-hint="profile person" />
                  <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-left group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-56">
            <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </DropdownMenuItem> */}
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
