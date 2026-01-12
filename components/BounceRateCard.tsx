'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, ExternalLink, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import React, { useState } from 'react';

interface ReputationData {
  date: string;
  bounceRate: number;
  complaintRate: number;
  totalEmails: number;
}

interface BounceRateCardProps {
  data: ReputationData[];
  currentRate: number;
  status: 'Healthy' | 'Warning' | 'Account at risk';
}

export default function BounceRateCard({ data, currentRate, status }: BounceRateCardProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const getStatusIcon = () => {
    switch (status) {
      case 'Healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'Warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'Account at risk':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'Healthy':
        return 'text-green-600';
      case 'Warning':
        return 'text-yellow-600';
      case 'Account at risk':
        return 'text-red-600';
      default:
        return 'text-green-600';
    }
  };

  // Calculate position for current rate (15% max scale)
  const currentRatePosition = Math.max(0, Math.min(100, (currentRate / 15) * 100));
  const currentRateTop = 100 - currentRatePosition; // Invert for top positioning

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setTooltipVisible(true);
    // Position tooltip relative to the graph area
    const graphRect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: e.clientX - graphRect.left + 10, // 10px offset from cursor
      y: e.clientY - graphRect.top + 10,
    });
  };

  const handleMouseLeave = () => {
    setTooltipVisible(false);
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            Bounce rate
            <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`text-sm font-medium ${getStatusColor()}`}>{status}</span>
          </div>
        </div>
        <p className="text-gray-600 text-sm mt-2">
          The percentage of emails sent from your account that resulted in a hard bounce based on a representative volume of email.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-4">
          <p className="text-gray-600 text-sm font-medium">Historic bounce rate</p>
          <p className="text-3xl font-bold text-gray-900">{currentRate.toFixed(2)}%</p>
        </div>
        
        <div 
          className="h-56 mb-6 relative bg-gray-50 rounded cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Y-axis labels */}
          <div className="absolute left-2 top-2 text-xs text-gray-500">15%</div>
          <div className="absolute left-2 top-1/4 text-xs text-gray-500">10%</div>
          <div className="absolute left-2 top-1/2 text-xs text-gray-500">5%</div>
          <div className="absolute left-2 bottom-2 text-xs text-gray-500">0%</div>
          
          {/* Horizontal grid lines */}
          <div className="absolute left-8 right-0 top-2 border-t border-gray-200"></div>
          <div className="absolute left-8 right-0 top-1/4 border-t border-gray-200"></div>
          <div className="absolute left-8 right-0 top-1/2 border-t border-gray-200"></div>
          <div className="absolute left-8 right-0 bottom-2 border-t border-gray-200"></div>
          
          {/* Warning Line (5%) */}
          <div 
            className="absolute left-8 right-0 border-t-2 border-dashed border-yellow-500"
            style={{ top: '50%' }}
          ></div>
          
          {/* Account at Risk Line (10%) */}
          <div 
            className="absolute left-8 right-0 border-t-2 border-dashed border-red-500"
            style={{ top: '25%' }}
          ></div>
          
          {/* Historic Rate Bar */}
          <div 
            className="absolute left-8 right-4 bg-blue-500 opacity-80"
            style={{ 
              top: `${currentRateTop}%`, 
              height: '2px',
              width: 'calc(100% - 32px)'
            }}
          ></div>
          
          {/* Current Rate Label */}
          <div 
            className="absolute right-2 text-sm font-bold text-blue-600 bg-white px-1 rounded"
            style={{ top: `${Math.max(0, currentRateTop - 8)}%` }}
          >
            {currentRate.toFixed(2)}%
          </div>

          {/* Tooltip */}
          {tooltipVisible && (
            <div 
              className="absolute bg-gray-900 text-white px-3 py-2 rounded shadow-lg z-10 pointer-events-none"
              style={{ 
                left: `${tooltipPosition.x}px`, 
                top: `${tooltipPosition.y}px`,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Historic bounce rate: {currentRate.toFixed(2)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Warning threshold: 5%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Account at risk: 10%</span>
                </div>
              </div>
              {/* Tooltip arrow */}
              <div 
                className="absolute w-2 h-2 bg-gray-900 transform rotate-45"
                style={{ 
                  bottom: '-4px',
                  left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)'
                }}
              ></div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span className="text-gray-600 font-medium">Historic bounce rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-yellow-500 border-t border-dashed border-yellow-500"></div>
              <span className="text-gray-600 font-medium">Warning (5%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-red-500 border-t border-dashed border-red-500"></div>
              <span className="text-gray-600 font-medium">Account at risk (10%)</span>
            </div>
          </div>
          <button className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
            View in CloudWatch
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
