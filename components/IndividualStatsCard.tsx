'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface IndividualStatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral' | string;
  color?: string;
  bgColor?: string;
  description?: string;
  progress?: number;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  children?: ReactNode;
  className?: string;
  loading?: boolean;
}

export default function IndividualStatsCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'neutral',
  color = 'text-blue-600',
  bgColor = 'bg-blue-50',
  description,
  progress,
  badge,
  badgeVariant = 'secondary',
  children,
  className,
  loading = false
}: IndividualStatsCardProps) {
  const formatChange = (change: string, type: string) => {
    const isPositive = type === 'increase';
    const isNegative = type === 'decrease';
    
    if (isPositive) {
      return (
        <div className="flex items-center text-green-600">
          <ArrowUp className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">{change}</span>
        </div>
      );
    } else if (isNegative) {
      return (
        <div className="flex items-center text-red-600">
          <ArrowDown className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">{change}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-gray-600">
          <Minus className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">{change}</span>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <Card className={cn('border-0 shadow-sm', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
          <div>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-0 shadow-sm hover:shadow-md transition-all duration-200', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-lg ${bgColor}`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <Badge variant={badgeVariant} className="text-xs">
                {badge}
              </Badge>
            )}
            {change && formatChange(change, changeType)}
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-600 mt-1">{title}</p>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
          </div>
          {progress !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
