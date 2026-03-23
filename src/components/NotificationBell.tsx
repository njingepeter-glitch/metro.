import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Bell, CheckCircle2, Trash2, Clock, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { format, isToday, isYesterday } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate, useLocation } from "react-router-dom";
import { useOverlayClose } from "@/components/OverlayCloseContext";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const NOTIFICATION_SOUND_URL = "/audio/notification.mp3";

const categorizeNotifications = (notifications: Notification[]) => {
  const groups: Record<string, Notification[]> = {};
  notifications.forEach(notification => {
    const date = new Date(notification.created_at);
    let category: string;
    if (isToday(date)) category = 'Today';
    else if (isYesterday(date)) category = 'Yesterday';
    else category = format(date, 'MMMM dd, yyyy');

    if (!groups[category]) groups[category] = [];
    groups[category].push(notification);
  });
  return Object.keys(groups).map(title => ({ title, notifications: groups[title] }));
};

export const NotificationBell = ({ forceDark = false }: { forceDark?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { subscribe } = useOverlayClose();

  useEffect(() => {
    return subscribe(() => setIsOpen(false));
  }, [subscribe]);

  const isIndexPage = location.pathname === '/';

  const headerIconStyles = `
    h-11 w-11 rounded-2xl flex items-center justify-center transition-all duration-200 
    active:scale-90 relative group overflow-visible
    bg-transparent text-white md:shadow-sm md:border md:border-slate-200
    ${forceDark ? 'text-foreground bg-transparent' : isIndexPage ? 'md:text-slate-800 md:bg-white/90 md:hover:bg-white' : 'md:text-slate-700 md:bg-slate-50 md:hover:bg-slate-100'}
  `;

  const getNotificationDeepLink = useCallback((notification: Notification): string | null => {
    const { type, data } = notification;
    switch (type) {
      case 'host_verification': return '/verification-status';
      case 'payment_verification': return '/account';
      case 'withdrawal_success':
      case 'withdrawal_failed':
        return '/payment';
      case 'new_booking':
        if (data?.item_id && data?.booking_type) return `/host-bookings/${data.booking_type}/${data.item_id}`;
        return '/host-bookings';
      case 'payment_confirmed': return '/bookings';
      case 'new_referral': return '/payment';
      case 'item_status':
      case 'item_hidden':
      case 'item_unhidden':
        if (data?.item_id && data?.item_type) return `/host-bookings/${data.item_type}/${data.item_id}`;
        return '/my-listing';
      default: return null;
    }
  }, []);

  const handleNotificationClick = useCallback((notification: Notification) => {
    markAsRead(notification.id);
    const deepLink = getNotificationDeepLink(notification);
    if (deepLink) {
      setIsOpen(false);
      navigate(deepLink);
    }
  }, [getNotificationDeepLink, navigate]);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;
    return () => { audioRef.current = null; };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }
  }, []);

  const showInAppNotification = useCallback((notification: Notification) => {
    toast({ title: notification.title, description: notification.message });
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) {
      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const channel = supabase.channel('notifications-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, 
        (payload) => {
          playNotificationSound();
          if (payload.new) showInAppNotification(payload.new as Notification);
          fetchNotifications();
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchNotifications)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, playNotificationSound, showInAppNotification]);

  const markAsRead = async (notificationId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (!error) {
      fetchNotifications();
      toast({ title: "CLEARED!", description: "All notifications marked as read." });
    }
  };

  const categorizedNotifications = useMemo(() => categorizeNotifications(notifications), [notifications]);

  return (
    <div className="relative overflow-visible z-20">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <button 
            className={headerIconStyles} 
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 stroke-[2.5px] transition-transform group-hover:rotate-12" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center border-2 border-white text-[10px] font-black z-[50]"
                style={{ 
                  backgroundColor: COLORS.RED, 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  pointerEvents: 'none'
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </button>
        </SheetTrigger>
        
        <SheetContent className="w-full sm:max-w-md p-0 pb-24 border-none bg-background [&>button]:hidden">
          <div className="p-6 bg-white border-b border-slate-100">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-[#FF7F50] uppercase tracking-[0.2em] mb-1">Stay Updated</p>
                  <SheetTitle className="text-2xl font-black uppercase tracking-tighter" style={{ color: COLORS.TEAL }}>
                    Inbox
                  </SheetTitle>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#008080] hover:bg-[#008080]/10"
                    >
                      Clear All
                    </Button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </SheetHeader>
          </div>

          <ScrollArea className="h-[calc(100vh-100px)] p-6">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="bg-white p-6 rounded-[28px] shadow-sm mb-4">
                  <Bell className="h-10 w-10 text-slate-200" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-8">
                {categorizedNotifications.map(group => (
                  <div key={group.title} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap">
                        {group.title}
                      </h3>
                      <div className="h-[1px] w-full bg-slate-100" />
                    </div>
                    
                    <div className="space-y-3">
                      {group.notifications.map((notification) => {
                        const hasDeepLink = !!getNotificationDeepLink(notification);
                        return (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full text-left p-5 rounded-[24px] border transition-all duration-300 group relative overflow-hidden ${
                              notification.is_read
                                ? "bg-white border-slate-100 hover:border-[#008080]/30"
                                : "bg-white border-transparent shadow-md"
                            }`}
                          >
                            {!notification.is_read && (
                              <div 
                                className="absolute top-0 left-0 w-1.5 h-full" 
                                style={{ background: `linear-gradient(to bottom, ${COLORS.CORAL}, ${COLORS.RED})` }}
                              />
                            )}
                            
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1">
                                <h4 className={`text-sm font-black uppercase tracking-tight ${notification.is_read ? 'text-slate-600' : 'text-[#008080]'}`}>
                                  {notification.title}
                                </h4>
                                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                  {notification.message}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter whitespace-nowrap">
                                  {format(new Date(notification.created_at), 'h:mm a')}
                                </span>
                                {!notification.is_read ? (
                                  <div className="p-1.5 rounded-lg bg-[#FF7F50]/10 text-[#FF7F50]">
                                    <Clock className="h-3 w-3" />
                                  </div>
                                ) : hasDeepLink && (
                                  <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-[#008080]/10 group-hover:text-[#008080] transition-colors">
                                    <ChevronRight className="h-3 w-3" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};