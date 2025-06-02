
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode; // Changed from React.ElementType
  href?: string;
  description?: string;
  change?: number;
  changeLabel?: string;
  cardClassName?: string; // For custom card styling e.g. gradients
  className?: string; // For additional styling to the root Card element
}

export function AnalyticsCard({ 
  title, 
  value, 
  description, 
  icon, 
  href, 
  change,
  changeLabel,
  cardClassName,
  className 
}: AnalyticsCardProps) {
  const hasLink = !!href;
  const hasChangeInfo = typeof change === 'number' && changeLabel;

  return (
    <Card className={cn(
      "shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col", 
      cardClassName, 
      className
    )}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-lg font-medium font-headline">{title}</CardTitle>
          {description && !hasChangeInfo && <p className="text-xs text-muted-foreground pt-0.5">{description}</p>}
        </div>
        {icon}
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-2xl sm:text-3xl font-bold">{value}</div>
        {hasChangeInfo && (
          <div className={cn(
            "text-xs flex items-center mt-1",
            change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-muted-foreground"
          )}>
            {change !== 0 && (change > 0 ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />)}
            {change !== 0 ? `${Math.abs(change)}${typeof value === 'number' ? '' : '%'}` : ''} {changeLabel}
          </div>
        )}
        {description && hasChangeInfo && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
      </CardContent>
      {hasLink && (
        <div className="p-4 pt-0">
          <Link href={href} passHref>
            <Button variant="outline" className="w-full">
              View Details <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}
