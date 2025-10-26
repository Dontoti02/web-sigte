'use client';

import { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { ParentOnboarding } from '@/components/parent/parent-onboarding';
import { useRole } from '@/hooks/use-role';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, role, isLoading } = useRole();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    
    // Verificar si es padre sin hijos
    if (role === 'parent') {
      const children = (user as any)?.children || [];
      setNeedsOnboarding(children.length === 0);
    } else {
      setNeedsOnboarding(false);
    }
    
    setIsChecking(false);
  }, [user, role, isLoading]);

  // Mostrar loading mientras se verifica
  if (isLoading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si es padre sin hijos, mostrar onboarding
  if (needsOnboarding && role === 'parent') {
    return (
      <ParentOnboarding
        parentId={user?.id || ''}
        parentName={user?.name || 'Padre/Madre'}
        onComplete={() => {
          // Recargar la página para actualizar el estado
          window.location.reload();
        }}
      />
    );
  }

  // Layout normal
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="p-4 sm:p-6 lg:p-8 bg-background/80 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
