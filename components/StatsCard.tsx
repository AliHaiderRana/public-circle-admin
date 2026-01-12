'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { LucideIcon, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';

interface StatsCardProps {
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
}

export default function StatsCard({
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
  className
}: StatsCardProps) {
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

  return (
    <Card className={cn('border-0 shadow-sm hover:shadow-md transition-all duration-200', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
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
      </CardHeader>
      <CardContent className="pt-0">
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
