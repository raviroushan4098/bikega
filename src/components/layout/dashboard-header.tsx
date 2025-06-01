"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePathname } from "next/navigation";
import { AppLogo } from "./app-logo";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

const getPageTitle = (pathname: string): string => {
  if (pathname === "/dashboard") return "Overview";
  if (pathname.startsWith("/dashboard/youtube")) return "YouTube Analytics";
  if (pathname.startsWith("/dashboard/reddit")) return "Reddit Analytics";
  if (pathname.startsWith("/dashboard/twitter")) return "Twitter/X Analytics";
  if (pathname.startsWith("/dashboard/mentions")) return "Global Mentions";
  if (pathname.startsWith("/dashboard/users")) return "User Management";
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  return "Dashboard";
};

export default function DashboardHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);
  const { isMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      {isMobile && <SidebarTrigger />}
      
      <div className="hidden md:block">
         <h1 className="text-xl font-semibold font-headline">{pageTitle}</h1>
      </div>
      {isMobile && (
        <div className="flex-1 text-center">
           <AppLogo size="small"/>
        </div>
      )}

      <div className="ml-auto flex items-center gap-4">
        {/* Search can be re-added if needed
        <form className="relative hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search analytics..."
            className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px] bg-background"
          />
        </form>
        */}
        {/* User avatar and dropdown is in sidebar footer */}
      </div>
    </header>
  );
}
