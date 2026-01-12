'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  Mail, 
  Send, 
  FileText, 
  Pause, 
  Archive,
  UserPlus,
  Activity,
  TrendingUp
} from 'lucide-react';

interface CompanyDetails {
  company: {
    id: string;
    name: string;
    email: string;
    logo: string;
    status: string;
    createdAt: string;
  };
  users: {
    primary: Array<{
      emailAddress: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
      profilePicture: string;
      createdAt: string;
    }>;
    secondary: Array<{
      emailAddress: string;
      firstName: string;
      lastName: string;
      phoneNumber: string;
      profilePicture: string;
      createdAt: string;
    }>;
    totalUsers: number;
  };
  contacts: {
    total: number;
    active: number;
    deleted: number;
    inactive: number;
  };
  campaigns: {
    total: number;
    active: number;
    draft: number;
    paused: number;
    archived: number;
  };
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchCompanyDetails();
    }
  }, [params.id]);

  const fetchCompanyDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/company-details/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch company details');
      
      const data = await response.json();
      setCompanyDetails(data.data);
    } catch (error) {
      console.error('Error fetching company details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!companyDetails) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900">Company not found</h2>
          <p className="text-gray-600 mt-2">The company you're looking for doesn't exist.</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            {companyDetails.company.logo && companyDetails.company.logo.trim() !== '' ? (
              <div className="relative">
                <img
                  src={companyDetails.company.logo}
                  alt={companyDetails.company.name}
                  className="h-12 w-12 rounded-lg object-cover border border-gray-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center border border-gray-200">
                  <Building2 className="h-6 w-6 text-gray-500" />
                </div>
              </div>
            ) : (
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border border-gray-200">
                <span className="text-white font-bold text-lg">
                  {companyDetails.company.name ? companyDetails.company.name.charAt(0).toUpperCase() : 'C'}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {companyDetails.company.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={companyDetails.company.status === 'ACTIVE' ? 'bg-neutral-900 text-white' : ''} variant={companyDetails.company.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {companyDetails.company.status}
                </Badge>
                <span className="text-sm text-gray-500">
                  Created {new Date(companyDetails.company.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Total Users
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {companyDetails.users.totalUsers}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      {companyDetails.users.primary.length} Primary
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      {companyDetails.users.secondary.length} Secondary
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-green-500" />
                  Total Contacts
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {companyDetails.contacts.total.toLocaleString()}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      {companyDetails.contacts.active} Active
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      {companyDetails.contacts.deleted} Deleted
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      {companyDetails.contacts.inactive} Inactive
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <Mail className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Send className="h-4 w-4 text-purple-500" />
                  Total Campaigns
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {companyDetails.campaigns.total}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      {companyDetails.campaigns.active} Active
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-gray-600 font-medium">
                      {companyDetails.campaigns.draft} Draft
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Send className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-500" />
                  Campaign Status
                </p>
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Active</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{companyDetails.campaigns.active}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Paused</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{companyDetails.campaigns.paused}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Archived</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{companyDetails.campaigns.archived}</span>
                  </div>
                </div>
              </div>
              <div className="h-14 w-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <Activity className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users and Campaigns Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Primary Users */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Primary Users
              </h4>
              {companyDetails.users.primary.length > 0 ? (
                <div className="space-y-3">
                  {companyDetails.users.primary.map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-2 border-white shadow-sm">
                            <span className="text-white font-semibold text-sm">
                              {user.firstName ? user.firstName.charAt(0).toUpperCase() : ''}{user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}
                            </span>
                          </div>
                        )}
                        <div className="hidden h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center border-2 border-white shadow-sm">
                          <UserPlus className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {user.firstName || ''} {user.lastName || ''}
                          </p>
                          <p className="text-sm text-gray-600">{user.emailAddress || ''}</p>
                          {user.phoneNumber && (
                            <p className="text-xs text-gray-500 mt-1">{user.phoneNumber}</p>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-blue-500 text-white border-blue-500">Primary</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No primary users found</p>
                </div>
              )}
            </div>

            {/* Secondary Users */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Secondary Users
              </h4>
              {companyDetails.users.secondary.length > 0 ? (
                <div className="space-y-3">
                  {companyDetails.users.secondary.map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={`${user.firstName} ${user.lastName}`}
                            className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center border-2 border-white shadow-sm">
                            <span className="text-white font-semibold text-sm">
                              {user.firstName ? user.firstName.charAt(0).toUpperCase() : ''}{user.lastName ? user.lastName.charAt(0).toUpperCase() : ''}
                            </span>
                          </div>
                        )}
                        <div className="hidden h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center border-2 border-white shadow-sm">
                          <UserPlus className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {user.firstName || ''} {user.lastName || ''}
                          </p>
                          <p className="text-sm text-gray-600">{user.emailAddress || ''}</p>
                          {user.phoneNumber && (
                            <p className="text-xs text-gray-500 mt-1">{user.phoneNumber}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">Secondary</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No secondary users found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Campaigns Overview
              </CardTitle>
              <Button 
                onClick={() => router.push(`/dashboard/campaigns?company=${companyDetails.company.id}`)}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                View Campaigns
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {companyDetails.campaigns.active}
                  </div>
                  <div className="text-sm text-green-800">Active Campaigns</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {companyDetails.campaigns.draft}
                  </div>
                  <div className="text-sm text-blue-800">Draft Campaigns</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {companyDetails.campaigns.paused}
                  </div>
                  <div className="text-sm text-yellow-800">Paused Campaigns</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">
                    {companyDetails.campaigns.archived}
                  </div>
                  <div className="text-sm text-gray-800">Archived Campaigns</div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Campaigns</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {companyDetails.campaigns.total}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ 
                        width: `${companyDetails.campaigns.total > 0 ? (companyDetails.campaigns.active / companyDetails.campaigns.total) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {companyDetails.campaigns.total > 0 ? Math.round((companyDetails.campaigns.active / companyDetails.campaigns.total) * 100) : 0}% of campaigns are active
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
