'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated } from '../lib/authService';
import BottomNav from './BottomNav';
import OfflineBanner from './OfflineBanner';
import { InspectionProvider } from '../context/InspectionContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const checkAuth = () => {
    try {
      console.log('ClientLayout: Checking auth status for path:', pathname);
      const authed = isAuthenticated();
      setIsAuthed(authed);
      setAuthChecked(true);

      if (authed) {
        if (pathname === '/') {
          console.log('ClientLayout: User is authenticated, redirecting to /dashboard');
          router.push('/dashboard');
        }
      } else {
        if (pathname !== '/') {
          console.log('ClientLayout: User is not authenticated, redirecting to login page /');
          router.push('/');
        }
      }
    } catch (error) {
      console.error('ClientLayout: Error during checkAuth:', error);
      // Ensure we clear the loading screen even if an error occurs
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    checkAuth();

    // Listen to custom auth changes
    window.addEventListener('auth-status-change', checkAuth);

    return () => {
      window.removeEventListener('auth-status-change', checkAuth);
    };
  }, [pathname]);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered successfully with scope:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }
  }, []);


  if (!authChecked) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-text-secondary">Loading Vanilla Monitor...</span>
        </div>
      </div>
    );
  }

  // If not authenticated
  if (!isAuthed) {
    if (pathname === '/') {
      return <>{children}</>;
    }
    // We are redirecting to '/' so render loader
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-text-secondary">Redirecting to login...</span>
        </div>
      </div>
    );
  }

  // If authenticated
  const hasOwnFooterNav = pathname?.startsWith('/inspect') || pathname?.startsWith('/add-plant');

  return (
    <InspectionProvider>
      <div className={`flex min-h-screen flex-col bg-surface ${hasOwnFooterNav ? '' : 'pb-16'}`}>
        <OfflineBanner />
        <main className="flex-1 w-full max-w-md mx-auto bg-white shadow-sm min-h-[calc(100vh-4rem)] relative pb-6 border-x border-border-light">
          {children}
        </main>
        {!hasOwnFooterNav && <BottomNav />}
      </div>
    </InspectionProvider>
  );
}
