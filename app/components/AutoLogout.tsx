'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '../lib/supabase/client';

// Configurable constants
export const IDLE_TIMEOUT_MS = process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS 
  ? parseInt(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS, 10) 
  : 30 * 60 * 1000; // Default 30 minutes

export const WARNING_THRESHOLD_MS = process.env.NEXT_PUBLIC_WARNING_THRESHOLD_MS
  ? parseInt(process.env.NEXT_PUBLIC_WARNING_THRESHOLD_MS, 10)
  : 60 * 1000; // Default 1 minute warning

const ACTIVITY_THROTTLE_MS = 2000; // Throttle to max 1 update every 2 seconds

export default function AutoLogout() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [showWarning, setShowWarning] = useState(false);
  
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isAuthenticatedRef = useRef<boolean>(false);

  // We do not run the timer on auth pages
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register');

  useEffect(() => {
    // Determine initial state
    supabase.auth.getSession().then(({ data: { session } }) => {
      isAuthenticatedRef.current = !!session;
      if (session) {
        lastActivityRef.current = Date.now();
        try {
          localStorage.setItem('last_activity', Date.now().toString());
        } catch (e) {}
      }
    });

    // Listen for Auth changes (including cross-tab signout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      isAuthenticatedRef.current = !!session;
      if (event === 'SIGNED_OUT') {
        if (!isAuthPage) {
          router.replace('/login');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router, isAuthPage]);

  const handleActivity = useCallback(() => {
    if (!isAuthenticatedRef.current || isAuthPage) return;

    const now = Date.now();
    if (now - lastActivityRef.current > ACTIVITY_THROTTLE_MS) {
      lastActivityRef.current = now;
      try {
        localStorage.setItem('last_activity', now.toString());
      } catch (e) {}
      
      if (showWarning) {
        setShowWarning(false);
      }
    }
  }, [showWarning, isAuthPage]);

  // Main Idle Check Loop
  useEffect(() => {
    if (isAuthPage) return;

    const checkIdleStatus = () => {
      if (!isAuthenticatedRef.current) return;

      const now = Date.now();
      
      // Read local storage to see if another tab was active more recently
      let lastActivity = lastActivityRef.current;
      try {
        const storedActivity = localStorage.getItem('last_activity');
        if (storedActivity) {
          const parsed = parseInt(storedActivity, 10);
          if (!isNaN(parsed) && parsed > lastActivity) {
            lastActivity = parsed;
            lastActivityRef.current = lastActivity;
            if (showWarning) setShowWarning(false);
          }
        }
      } catch (e) {}

      const timeIdle = now - lastActivity;

      if (timeIdle >= IDLE_TIMEOUT_MS) {
        // Exceeded idle timeout -> Logout
        if (timerRef.current) clearInterval(timerRef.current);
        supabase.auth.signOut().then(() => {
          router.replace('/login');
        });
      } else if (timeIdle >= IDLE_TIMEOUT_MS - WARNING_THRESHOLD_MS) {
        // Within warning threshold
        if (!showWarning) setShowWarning(true);
      }
    };

    // Run check every 1 second
    timerRef.current = setInterval(checkIdleStatus, 1000);

    // Attach activity listeners
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [handleActivity, supabase, router, isAuthPage, showWarning]);

  const handleStayLoggedIn = () => {
    handleActivity();
    setShowWarning(false);
  };

  if (!showWarning || isAuthPage) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100 p-6 space-y-4">
        <div className="text-center">
          <span className="text-4xl">⏳</span>
          <h3 className="font-bold text-gray-900 text-base mt-3">
            Sesi Hampir Habis
          </h3>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            Anda tidak terdeteksi melakukan aktivitas selama beberapa waktu. Demi keamanan, Anda akan dikeluarkan secara otomatis jika tidak ada respons.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={handleStayLoggedIn}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition shadow-sm"
          >
            Tetap Login
          </button>
        </div>
      </div>
    </div>
  );
}
