
'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronsUpDown,
  LogOut,
  Settings,
  Users,
  BarChart3,
  LayoutGrid,
  Book,
  Bell,
  Upload,
  BookMarked,
  Calendar,
  CalendarCheck,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRole } from '@/hooks/use-role';
import { Role } from '@/lib/types';
import Link from 'next/link';
import { Logo } from '../logo';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/firebase';
import { useStudentSession } from '@/contexts/student-session-context';

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutGrid,
    label: 'Dashboard',
    roles: ['admin', 'teacher', 'student', 'parent'],
  },
  {
    href: '/dashboard/usuarios',
    icon: Users,
    label: 'Usuarios',
    roles: ['admin'],
  },
  {
    href: '/dashboard/talleres',
    icon: Book,
    label: 'Talleres',
    roles: ['admin', 'teacher', 'student', 'parent'],
  },
  {
    href: '/dashboard/asistencia',
    icon: CalendarCheck,
    label: 'Asistencias',
    roles: ['admin', 'teacher', 'student', 'parent'],
  },
  {
    href: '/dashboard/reportes',
    icon: BarChart3,
    label: 'Reportes',
    roles: ['admin', 'teacher'],
  },
  {
    href: '/dashboard/mis-hijos',
    icon: Users,
    label: 'Mis Hijos',
    roles: ['parent'],
  },
  {
    href: '/dashboard/avisos',
    icon: Bell,
    label: 'Avisos',
    roles: ['admin', 'teacher'],
  },
  {
    href: '/dashboard/gestion-estudiantes',
    icon: Users,
    label: 'Gestión de Estudiantes',
    roles: ['admin'],
  },
  {
    href: '/dashboard/calendario',
    icon: Calendar,
    label: 'Calendario Escolar',
    roles: ['admin', 'teacher', 'student', 'parent'],
  },
];


export const AppSidebar = () => {
  const { user, isLoading, role } = useRole();
  const auth = useAuth();
  const { clearStudentSession } = useStudentSession();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();


  const handleLogout = async () => {
    // Limpiar sesión de estudiante si existe
    clearStudentSession();
    // Cerrar sesión de Firebase Auth
    await auth.signOut();
    router.push('/login');
  }

  const roleName = role ? {
    admin: 'Administrador',
    teacher: 'Docente',
    student: 'Estudiante',
    parent: 'Padre/Madre',
  }[role as Role] : '';


  return (
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* Team Switcher */}
          <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Logo className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">SIGTE</span>
                    <span className="truncate text-xs">
                      {roleName}
                    </span>
                  </div>
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {/* Team Switcher */}
        </SidebarHeader>

        <SidebarContent>
          {/* Nav Main */}
          <SidebarGroup>
            <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
            <SidebarMenu>
              {navItems
                .filter((item) => item.roles.includes(role))
                .map((item) => (
                  <Collapsible
                    key={item.href}
                    asChild
                    defaultOpen={pathname.startsWith(item.href)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton asChild tooltip={item.label} isActive={pathname === item.href}>
                           <Link href={`${item.href}?role=${role}`}>
                            {item.icon && <item.icon />}
                            <span>{item.label}</span>
                           </Link>
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                    </SidebarMenuItem>
                  </Collapsible>
                ))}
            </SidebarMenu>
          </SidebarGroup>
          {/* Nav Main */}
        </SidebarContent>
        <SidebarFooter>
          {/* Nav User */}
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                     {isLoading || !user ? (
                      <>
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </>
                    ) : (
                    <>
                    <Avatar className="h-8 w-8 rounded-lg">
                      {user.photoURL && user.photoURL.trim() !== '' && <AvatarImage src={user.photoURL} alt={user.name} />}
                      <AvatarFallback className="rounded-lg">
                        {user.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user.name}
                      </span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                    </>
                    )}
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side={isMobile ? 'bottom' : 'right'}
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                     {isLoading || !user ? (
                       <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                     ) : (
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        {user.photoURL && user.photoURL.trim() !== '' && <AvatarImage src={user.photoURL} alt={user.name} />}
                        <AvatarFallback className="rounded-lg">
                          {user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user.name}
                        </span>
                        <span className="truncate text-xs">{user.email}</span>
                      </div>
                    </div>
                     )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/perfil?role=${role}`}>
                        <Users />
                        Perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/configuracion?role=${role}`}>
                        <Settings />
                        Configuración
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/notificaciones?role=${role}`}>
                        <Bell />
                        Notificaciones
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                      <LogOut />
                      Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          {/* Nav User */}
        </SidebarFooter>
      </Sidebar>
  );
};
