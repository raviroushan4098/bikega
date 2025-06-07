
"use client";

import { usePathname } from "next/navigation";
import { AppLogo } from "./app-logo"; 
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu as MenuIcon } from "lucide-react"; 
import { ThemeToggleButton } from './ThemeToggleButton';


const getPageTitle = (pathname: string): string => {
  if (pathname === "/dashboard") return "Overview";
  if (pathname.startsWith("/dashboard/youtube")) return "YouTube Analytics";
  if (pathname.startsWith("/dashboard/reddit/analyze-external")) return "External Reddit User Analyzer";
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


  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 pl-20 pr-4 backdrop-blur-md md:pl-24 md:pr-6">
      
      <div className="flex-1 md:flex-none"> 
         <h1 className="text-lg md:text-xl font-semibold font-headline">{pageTitle}</h1> 
      </div>
      
      
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggleButton />
        
      </div>
    </header>
  );
}
