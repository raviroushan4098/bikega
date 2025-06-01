"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Youtube,
  Reddit,
  Twitter,
  Globe,
  Users,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight
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
import React from 'react';


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
  { href: '/dashboard/reddit', label: 'Reddit', icon: Reddit },
  { href: '/dashboard/twitter', label: 'Twitter/X', icon: Twitter },
  { href: '/dashboard/mentions', label: 'Mentions', icon: Globe },
  // { href: '/dashboard/users', label: 'User Management', icon: Users, adminOnly: true },
  // { href: '/dashboard/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const renderNavItems = (items: NavItem[], isSubmenu = false) => {
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
              {renderNavItems(item.subItems, true)}
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
          {renderNavItems(navItems)}
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
