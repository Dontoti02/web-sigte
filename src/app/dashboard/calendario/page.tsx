'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Plus, Trash2, Edit, Clock, MapPin, Users } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  location?: string;
  type: 'academic' | 'holiday' | 'exam' | 'meeting' | 'event' | 'other';
  targetAudience: 'all' | 'students' | 'teachers' | 'parents';
  createdBy: string;
  createdAt: string;
  notificationSent?: boolean;
}

const eventTypeColors = {
  academic: 'bg-blue-600',
  holiday: 'bg-green-600',
  exam: 'bg-red-600',
  meeting: 'bg-purple-600',
  event: 'bg-yellow-600',
  other: 'bg-gray-600',
};

const eventTypeLabels = {
  academic: 'Académico',
  holiday: 'Feriado',
  exam: 'Examen',
  meeting: 'Reunión',
  event: 'Evento',
  other: 'Otro',
};

function EventDialog({ event, onClose, onSave }: { event?: CalendarEvent; onClose: () => void; onSave: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    date: event?.date || format(new Date(), 'yyyy-MM-dd'),
    time: event?.time || '',
    location: event?.location || '',
    type: event?.type || 'event' as CalendarEvent['type'],
    targetAudience: event?.targetAudience || 'all' as CalendarEvent['targetAudience'],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.date) {
      toast({
        variant: 'destructive',
        title: 'Campos requeridos',
        description: 'El título y la fecha son obligatorios.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (event) {
        // Actualizar evento existente
        const eventRef = doc(firestore, 'calendar_events', event.id);
        await updateDoc(eventRef, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        toast({
          title: 'Evento Actualizado',
          description: 'El evento ha sido actualizado exitosamente.',
        });
      } else {
        // Crear nuevo evento
        await addDoc(collection(firestore, 'calendar_events'), {
          ...formData,
          createdBy: user?.id || 'unknown',
          createdAt: new Date().toISOString(),
          notificationSent: false,
        });
        toast({
          title: 'Evento Creado',
          description: 'El evento ha sido creado exitosamente.',
        });
      }
      onSave();
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Ocurrió un error al guardar el evento.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Ej: Inicio de clases"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detalles del evento..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Fecha *</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Hora</Label>
          <Input
            id="time"
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Ubicación</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder="Ej: Auditorio principal"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo de Evento</Label>
          <Select value={formData.type} onValueChange={(value: CalendarEvent['type']) => setFormData({ ...formData, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="academic">Académico</SelectItem>
              <SelectItem value="holiday">Feriado</SelectItem>
              <SelectItem value="exam">Examen</SelectItem>
              <SelectItem value="meeting">Reunión</SelectItem>
              <SelectItem value="event">Evento</SelectItem>
              <SelectItem value="other">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audience">Audiencia</Label>
          <Select value={formData.targetAudience} onValueChange={(value: CalendarEvent['targetAudience']) => setFormData({ ...formData, targetAudience: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="students">Estudiantes</SelectItem>
              <SelectItem value="teachers">Docentes</SelectItem>
              <SelectItem value="parents">Padres</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : event ? 'Actualizar' : 'Crear Evento'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function CalendarioPage() {
  const { role, user } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);

  const eventsQuery = useMemoFirebase(() => collection(firestore, 'calendar_events'), [firestore]);
  const { data: allEvents, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  // Filtrar eventos por audiencia según rol
  const audienceForRole = (() => {
    if (role === 'admin') return null; // Admin ve todos los eventos
    if (role === 'teacher') return ['all', 'teachers'];
    if (role === 'parent') return ['all', 'parents'];
    return ['all', 'students'];
  })();

  const events = role === 'admin' 
    ? allEvents || []
    : allEvents?.filter(e => audienceForRole?.includes(e.targetAudience)) || [];

  // Mostrar todos los eventos en el calendario (sin filtrar por tipo)
  const calendarEvents = events;

  // Verificar y enviar notificaciones para eventos del día
  useEffect(() => {
    const checkAndSendNotifications = async () => {
      if (!allEvents || role !== 'admin') return;

      const today = format(new Date(), 'yyyy-MM-dd');
      const todayEvents = allEvents.filter(e => e.date === today && !e.notificationSent);

      for (const event of todayEvents) {
        try {
          // Crear notificación en la colección de avisos
          await addDoc(collection(firestore, 'avisos'), {
            title: `📅 Evento Hoy: ${event.title}`,
            message: `${event.description}${event.time ? ` - Hora: ${event.time}` : ''}${event.location ? ` - Lugar: ${event.location}` : ''}`,
            type: 'info',
            targetAudience: event.targetAudience,
            createdAt: new Date(),
            createdBy: 'system',
            active: true,
          });

          // Marcar notificación como enviada
          const eventRef = doc(firestore, 'calendar_events', event.id);
          await updateDoc(eventRef, { notificationSent: true });
        } catch (error) {
          console.error('Error sending notification:', error);
        }
      }
    };

    checkAndSendNotifications();
  }, [allEvents, role, firestore]);

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(firestore, 'calendar_events', eventId));
      toast({
        title: 'Evento Eliminado',
        description: 'El evento ha sido eliminado exitosamente.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el evento.',
      });
    }
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEvent(undefined);
  };

  // Generar días del calendario (incluyendo días de meses anteriores/siguientes para completar semanas)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo = 0
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const daysInMonth = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Obtener eventos de un día específico
  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter(e => e.date === dayStr);
  };

  // Eventos del día seleccionado
  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendario Escolar</h1>
          <p className="text-muted-foreground">
            {role === 'admin' ? 'Gestiona eventos y fechas importantes' : 'Consulta eventos y fechas importantes'}
          </p>
        </div>
        {role === 'admin' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingEvent(undefined)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingEvent ? 'Editar Evento' : 'Crear Nuevo Evento'}</DialogTitle>
                <DialogDescription>
                  {editingEvent ? 'Modifica los detalles del evento' : 'Agrega un nuevo evento al calendario escolar'}
                </DialogDescription>
              </DialogHeader>
              <EventDialog
                event={editingEvent}
                onClose={handleCloseDialog}
                onSave={() => {}}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        {/* Calendario */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {format(currentDate, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                <div key={day} className="text-center text-sm font-semibold text-muted-foreground p-2">
                  {day}
                </div>
              ))}
              {daysInMonth.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentDay = isToday(day);
                const isCurrentMonth = isSameMonth(day, currentDate);

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'min-h-[80px] p-2 rounded-lg border text-left transition-colors',
                      'hover:bg-accent hover:border-accent-foreground/20',
                      isSelected && 'bg-primary text-primary-foreground border-primary',
                      isCurrentDay && !isSelected && 'border-primary border-2 bg-primary/10',
                      !isCurrentMonth && 'opacity-40 bg-muted/50'
                    )}
                  >
                    <div className={cn(
                      "text-sm font-semibold mb-1",
                      isCurrentDay && !isSelected && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <div
                          key={event.id}
                          className={cn(
                            'text-xs px-1 py-0.5 rounded truncate',
                            eventTypeColors[event.type],
                            'text-white'
                          )}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 2} más
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista de eventos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: es }) : 'Próximos Eventos'}
            </CardTitle>
            <CardDescription>
              {selectedDate
                ? `${selectedDayEvents.length} evento(s) para este día`
                : 'Eventos destacados'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedDayEvents.length === 0 && selectedDate && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay eventos para este día
              </p>
            )}
            {(selectedDate ? selectedDayEvents : events.slice(0, 10)).map(event => (
              <div key={event.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={eventTypeColors[event.type]}>
                        {eventTypeLabels[event.type]}
                      </Badge>
                    </div>
                    <h4 className="font-semibold">{event.title}</h4>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    )}
                  </div>
                  {role === 'admin' && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditEvent(event)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. El evento será eliminado permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteEvent(event.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(event.date), "d 'de' MMMM, yyyy", { locale: es })}
                  </div>
                  {event.time && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.time}
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {event.targetAudience === 'all' ? 'Todos' : 
                     event.targetAudience === 'students' ? 'Estudiantes' :
                     event.targetAudience === 'teachers' ? 'Docentes' : 'Padres'}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
