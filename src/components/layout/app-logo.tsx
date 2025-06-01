import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function AppLogo({ size = 'medium', className }: AppLogoProps) {
  const sizeClasses = {
    small: 'text-xl',
    medium: 'text-2xl',
    large: 'text-4xl',
  };
  const iconSizeClasses = {
    small: 'h-5 w-5',
    medium: 'h-6 w-6',
    large: 'h-10 w-10',
  }

  return (
    <div className={cn("flex items-center gap-2 text-primary", className)}>
      <BarChart3 className={cn(iconSizeClasses[size], "text-accent")} />
      <h1 className={cn("font-headline font-bold tracking-tight", sizeClasses[size])}>
        Insight Stream
      </h1>
    </div>
  );
}
