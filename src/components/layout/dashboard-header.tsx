
"use client";

import { usePathname } from "next/navigation";
import { AppLogo } from "./app-logo"; // Keep AppLogo if needed for mobile title
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu as MenuIcon } from "lucide-react"; // For a potential mobile trigger if hover nav is desktop only


const getPageTitle = (pathname: string): string => {
  if (pathname === "/dashboard") return "Overview";
  if (pathname.startsWith("/dashboard/youtube")) return "YouTube Analytics";
  if (pathname.startsWith("/dashboard/reddit")) return "Reddit Analytics";
  if (pathname.startsWith("/dashboard/twitter")) return "Twitter/X Analytics";
  if (pathname.startsWith("/dashboard/mentions")) return "Global Mentions";
  if (pathname.startsWith("/dashboard/users")) return "User Management";
  if (pathname.startsWith("/dashboard/api-management")) return "API Key Management";
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  return "Dashboard";
};

export default function DashboardHeader() {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  // Note: The hover navigation is primarily designed for desktop.
  // Mobile navigation might need a different strategy if this hover menu isn't suitable.
  // For now, the header is simplified.

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* 
        Mobile specific trigger for a drawer/sheet could be added here if hover nav isn't for mobile.
        Example:
        <Button variant="outline" size="icon" className="md:hidden">
           <MenuIcon className="h-5 w-5" />
           <span className="sr-only">Toggle menu</span>
        </Button> 
      */}
      
      <div className="flex-1 md:flex-none"> {/* Allow title to take space on mobile, fix on md+ */}
         <h1 className="text-lg md:text-xl font-semibold font-headline">{pageTitle}</h1>
      </div>
      
      {/* User avatar and other header items could go here if needed */}
      <div className="ml-auto flex items-center gap-4">
        {/* Placeholder for potential future items like notifications or user menu if not in hover nav */}
      </div>
    </header>
  );
}
