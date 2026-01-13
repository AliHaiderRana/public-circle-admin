'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Trash2, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ADMIN_NOTIFICATION_TYPES, SOCKET_CHANNELS } from '@/lib/constants';
import { io, Socket } from 'socket.io-client';

interface AdminNotification {
  _id: string;
  type: string;
  title: string;
  description: string;
  isRead: boolean;
  readAt: string | null;
  metadata: {
    customerRequestId?: string;
    companyId?: string;
    companyName?: string;
    requestType?: string;
    requestTypeLabel?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=10');
      if (!res.ok) return;
      const data = await res.json();
      if (data.items) {
        setNotifications(data.items);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=1');
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      // Silently fail - notifications API might not be ready
    }
  }, []);

  // Initial load and setup socket connection
  useEffect(() => {
    fetchUnreadCount();

    // Setup socket connection
    const setupSocket = async () => {
      try {
        // Get the admin token from cookie (we'll get it from the API)
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          console.log('Not authenticated, skipping socket connection');
          return;
        }
        
        const data = await res.json();
        if (!data.token) {
          console.log('No token available, skipping socket connection');
          return;
        }

        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
        if (!serverUrl) {
          console.warn('NEXT_PUBLIC_SERVER_URL not configured, real-time notifications disabled');
          return;
        }

        console.log('Connecting to socket server:', serverUrl);
        
        socketRef.current = io(serverUrl, {
          query: {
            token: data.token,
            isAdmin: 'true',
          },
          transports: ['websocket', 'polling'],
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 3000,
        });

        socketRef.current.on('connect', () => {
          console.log('✅ Admin socket connected successfully');
          setSocketConnected(true);
        });

        socketRef.current.on(SOCKET_CHANNELS.ADMIN_NOTIFICATION_CREATED, (notification: AdminNotification) => {
          console.log('📬 Received admin notification:', notification);
          setNotifications((prev) => [notification, ...prev.slice(0, 9)]);
          setUnreadCount((prev) => prev + 1);
          // Also refresh the full list
          fetchNotifications();
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('Admin socket disconnected:', reason);
          setSocketConnected(false);
        });

        socketRef.current.on('connect_error', (error: Error) => {
          console.warn('Socket connection error:', error.message);
          setSocketConnected(false);
        });
      } catch (err) {
        console.warn('Failed to setup socket:', err);
      }
    };

    setupSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [fetchUnreadCount, fetchNotifications]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [isOpen, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mark notification as read
  const markAsRead = async (id: string) => {
    setMarking(id);
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    } finally {
      setMarking(null);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    setMarking('all');
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarking(null);
    }
  };

  // Handle notification click - navigate to customer request
  const handleNotificationClick = async (notification: AdminNotification) => {
    // Mark as read first
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

    // Navigate based on notification type
    if (notification.type === ADMIN_NOTIFICATION_TYPES.CUSTOMER_REQUEST_CREATED) {
      const customerRequestId = notification.metadata?.customerRequestId;
      if (customerRequestId) {
        setIsOpen(false);
        router.push(`/dashboard/customer-requests?highlight=${customerRequestId}`);
      }
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={markAllAsRead}
                disabled={marking === 'all'}
              >
                {marking === 'all' ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <CheckCheck className="h-3 w-3 mr-1" />
                )}
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-neutral-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 last:border-0 cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/50 ${
                    !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      notification.isRead ? 'bg-transparent' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {notification.title}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">
                        {notification.description}
                      </p>
                      {notification.metadata?.requestTypeLabel && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {notification.metadata.requestTypeLabel}
                        </Badge>
                      )}
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && marking !== notification._id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification._id);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    {marking === notification._id && (
                      <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-neutral-600"
                onClick={() => {
                  setIsOpen(false);
                  router.push('/dashboard/customer-requests');
                }}
              >
                View all requests
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
