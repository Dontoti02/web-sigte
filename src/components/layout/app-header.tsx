"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, LogOut, PanelLeft, Settings, User, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRole } from "@/hooks/use-role";
import { Badge } from "../ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from "../ui/separator";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type AvisoType = 'info' | 'warning' | 'success' | 'urgent';
type Audience = 'all' | 'students' | 'parents' | 'teachers';

interface Aviso {
  id: string;
  title: string;
  message: string;
  type: AvisoType;
  targetAudience: Audience;
  createdAt?: { seconds: number; nanoseconds: number };
  createdBy?: string;
  active?: boolean;
}

export function AppHeader() {
  const { toggleSidebar } = useSidebar();
  const { user, role } = useRole();
  const { firestore } = useFirebase();
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  // Cargar tema desde localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setThemeState(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Cargar avisos en tiempo real
  const avisosQuery = useMemoFirebase(() => collection(firestore, 'avisos'), [firestore]);
  const { data: avisos } = useCollection<Aviso>(avisosQuery);

  // Filtrar por audiencia según rol y solo activos
  const audienceForRole: Audience[] = (() => {
    if (role === 'admin' || role === 'teacher') return ['all', 'teachers'];
    if (role === 'parent') return ['all', 'parents'];
    return ['all', 'students'];
  })();

  const relevantAvisos = (avisos || [])
    .filter(a => a.active !== false) // activos por defecto si no existe el campo
    .filter(a => audienceForRole.includes(a.targetAudience));

  const unreadNotifications = relevantAvisos.length; // Sin tracking de leído por ahora

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidebar}
      >
        <PanelLeft className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </Button>

      <div className="flex items-center gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-4">
        {/* Toggle de Tema */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="relative"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Cambiar tema</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 justify-center p-0 text-xs">{unreadNotifications}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Notificaciones</h4>
                <p className="text-sm text-muted-foreground">
                  {unreadNotifications > 0
                    ? `Tienes ${unreadNotifications} aviso(s) relevante(s).`
                    : 'No tienes avisos nuevos.'}
                </p>
              </div>
              <div className="grid gap-2">
                {relevantAvisos.slice(0, 6).map((a) => (
                  <div key={a.id} className="grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                    <span className={cn("flex h-2 w-2 translate-y-1 rounded-full bg-accent")} />
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.createdAt ? format(new Date(a.createdAt.seconds * 1000), "PPP 'a las' p", { locale: es }) : ''}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{a.message}</p>
                    </div>
                  </div>
                ))}
                {relevantAvisos.length === 0 && (
                  <div className="text-sm text-muted-foreground py-2">No hay avisos para tu rol.</div>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

    