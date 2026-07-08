'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InspectRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/inspect/step1');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
