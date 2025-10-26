'use client';

import { useState, useMemo } from 'react';
import { useRole } from '@/hooks/use-role';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  Check, 
  Trash2,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  Calendar,
  BookOpen,
  Users,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  targetAudience: 'all' | 'students' | 'parents' | 'teachers';
  createdAt: any;
  createdBy: string;
  active: boolean;
  read?: boolean;
  userId?: string;
}

const TIPO_ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  urgent: AlertCircle,
};

const TIPO_COLORS = {
  info: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200',
  success: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200',
  urgent: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200',
};

export default function NotificacionesPage() {
  const { user, role } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Cargar avisos (notificaciones)
  const avisosQuery = useMemoFirebase(() => collection(firestore, 'avisos'), [firestore]);
  const { data: avisos, isLoading } = useCollection<Notification>(avisosQuery);

  // Filtrar notificaciones según el rol
  const filteredNotifications = useMemo(() => {
    if (!avisos) return [];
    
    return avisos.filter(aviso => {
      // Filtrar por audiencia
      if (aviso.targetAudience === 'all') return true;
      if (role === 'teacher' && aviso.targetAudience === 'teachers') return true;
      if (role === 'student' && aviso.targetAudience === 'students') return true;
      if (role === 'parent' && aviso.targetAudience === 'parents') return true;
      return false;
    }).filter(aviso => aviso.active); // Solo mostrar activos
  }, [avisos, role]);

  // Aplicar filtro de leídas/no leídas
  const displayedNotifications = useMemo(() => {
    if (filter === 'unread') {
      return filteredNotifications.filter(n => !n.read);
    }
    return filteredNotifications;
  }, [filteredNotifications, filter]);

  const unreadCount = useMemo(() => {
    return filteredNotifications.filter(n => !n.read).length;
  }, [filteredNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // En una implementación real, esto debería actualizar un documento de usuario-notificación
      toast({
        title: 'Marcada como leída',
        description: 'La notificación ha sido marcada como leída.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo marcar la notificación.',
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      toast({
        title: 'Todas marcadas como leídas',
        description: 'Todas las notificaciones han sido marcadas como leídas.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudieron marcar las notificaciones.',
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    const Icon = TIPO_ICONS[type as keyof typeof TIPO_ICONS] || Info;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Notificaciones
          </h1>
          <p className="text-muted-foreground">
            Mantente al día con las últimas actualizaciones
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllAsRead}>
            <Check className="mr-2 h-4 w-4" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredNotifications.length}</div>
            <p className="text-xs text-muted-foreground">Notificaciones totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">No Leídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
            <p className="text-xs text-muted-foreground">Pendientes de leer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Leídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredNotifications.length - unreadCount}
            </div>
            <p className="text-xs text-muted-foreground">Ya revisadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Todas ({filteredNotifications.length})
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'outline'}
              onClick={() => setFilter('unread')}
            >
              No Leídas ({unreadCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Notificaciones */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Cargando notificaciones...</p>
            </CardContent>
          </Card>
        ) : displayedNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <p className="text-lg font-semibold">No hay notificaciones</p>
              <p className="text-sm text-muted-foreground mt-2">
                {filter === 'unread' 
                  ? 'No tienes notificaciones sin leer'
                  : 'Aún no has recibido notificaciones'}
              </p>
            </CardContent>
          </Card>
        ) : (
          displayedNotifications
            .sort((a, b) => {
              if (!a.createdAt || !b.createdAt) return 0;
              return b.createdAt.seconds - a.createdAt.seconds;
            })
            .map((notification) => {
              const Icon = TIPO_ICONS[notification.type];
              return (
                <Card 
                  key={notification.id} 
                  className={`transition-all hover:shadow-md ${!notification.read ? 'border-l-4 border-l-primary' : ''}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg border ${TIPO_COLORS[notification.type]}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{notification.title}</CardTitle>
                            {!notification.read && (
                              <Badge variant="default" className="bg-blue-600">
                                Nueva
                              </Badge>
                            )}
                            <Badge variant="outline">
                              {notification.type === 'info' && 'Info'}
                              {notification.type === 'success' && 'Éxito'}
                              {notification.type === 'warning' && 'Advertencia'}
                              {notification.type === 'urgent' && 'Urgente'}
                            </Badge>
                          </div>
                          <CardDescription>
                            {notification.createdAt && format(
                              new Date(notification.createdAt.seconds * 1000),
                              "dd 'de' MMMM 'de' yyyy 'a las' HH:mm",
                              { locale: es }
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{notification.message}</p>
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
}
