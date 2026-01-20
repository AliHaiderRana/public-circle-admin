'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, ExternalLink, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface ReputationData {
  date: string;
  bounceRate: number;
  complaintRate: number;
  totalEmails: number;
}

interface ComplaintRateCardProps {
  data: ReputationData[];
  currentRate: number;
  status: 'Healthy' | 'Warning' | 'Account at risk';
}

export default function ComplaintRateCard({ data, currentRate, status }: ComplaintRateCardProps) {
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

  // Generate chart data - use actual data or create sample data
  const chartData = data && data.length > 0
    ? data.map(d => ({
        date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        complaintRate: d.complaintRate,
      }))
    : [
        { date: 'Now', complaintRate: currentRate },
      ];

  // If only one data point, duplicate it to show a line
  const displayData = chartData.length === 1
    ? [{ ...chartData[0], date: 'Previous' }, chartData[0]]
    : chartData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
          <p className="font-medium">{label}</p>
          <p className="text-blue-300">Complaint Rate: {payload[0].value.toFixed(3)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            Complaint rate
            <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
          </CardTitle>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`text-sm font-medium ${getStatusColor()}`}>{status}</span>
          </div>
        </div>
        <p className="text-gray-600 text-sm mt-2">
          The percentage of emails sent from your account that resulted in recipients reporting them as spam based on a representative volume of email.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-4">
          <p className="text-gray-600 text-sm font-medium">Historic complaint rate</p>
          <p className="text-3xl font-bold text-gray-900">{currentRate.toFixed(3)}%</p>
        </div>

        <div className="h-56 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={displayData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="complaintGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                domain={[0, 0.8]}
                ticks={[0, 0.1, 0.5, 0.8]}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* Warning threshold line (0.1%) */}
              <ReferenceLine
                y={0.1}
                stroke="#EAB308"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: 'Warning (0.1%)',
                  position: 'right',
                  fill: '#EAB308',
                  fontSize: 11,
                }}
              />

              {/* Account at risk line (0.5%) */}
              <ReferenceLine
                y={0.5}
                stroke="#EF4444"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: 'Risk (0.5%)',
                  position: 'right',
                  fill: '#EF4444',
                  fontSize: 11,
                }}
              />

              <Area
                type="monotone"
                dataKey="complaintRate"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#complaintGradient)"
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span className="text-gray-600 font-medium">Complaint rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 border-t-2 border-dashed border-yellow-500"></div>
              <span className="text-gray-600 font-medium">Warning (0.1%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 border-t-2 border-dashed border-red-500"></div>
              <span className="text-gray-600 font-medium">Risk (0.5%)</span>
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
