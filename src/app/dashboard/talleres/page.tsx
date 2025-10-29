'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Users, 
  Calendar, 
  Clock, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  GraduationCap,
  Loader2
} from 'lucide-react';
import { useRole } from '@/hooks/use-role';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import type { Workshop } from '@/lib/types';
import {
  Dialog,
  DialogContent,
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
import { WorkshopForm } from '@/components/dashboard/workshop-form';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TalleresPage() {
  const { role, user } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cargar talleres
  const workshopsQuery = useMemoFirebase(() => collection(firestore, 'workshops'), [firestore]);
  const { data: workshops, isLoading } = useCollection<Workshop>(workshopsQuery);

  // Filtrar talleres según el rol
  const filteredWorkshops = workshops?.filter(workshop => {
    // Admin y teacher ven todos los talleres
    if (role === 'admin' || role === 'teacher') {
      return true;
    }
    
    // Estudiantes solo ven talleres activos
    if (role === 'student') {
      return workshop.status === 'active';
    }
    
    return false;
  }) || [];

  // Función para inscribirse en un taller
  const handleEnroll = async (workshop: Workshop) => {
    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes iniciar sesión para inscribirte.',
      });
      return;
    }

    // Verificar si ya está inscrito
    if (workshop.participants.includes(user.id)) {
      toast({
        variant: 'destructive',
        title: 'Ya inscrito',
        description: 'Ya estás inscrito en este taller.',
      });
      return;
    }

    // Verificar capacidad
    if (workshop.participants.length >= workshop.maxParticipants) {
      toast({
        variant: 'destructive',
        title: 'Taller lleno',
        description: 'Este taller ha alcanzado su capacidad máxima.',
      });
      return;
    }

    // Verificar fecha límite
    const deadline = new Date(workshop.enrollmentDeadline);
    if (new Date() > deadline) {
      toast({
        variant: 'destructive',
        title: 'Inscripciones cerradas',
        description: 'La fecha límite de inscripción ha pasado.',
      });
      return;
    }

    // Validar restricciones de sección (solo para estudiantes)
    if (role === 'student' && workshop.restrictByGradeSection) {
      const userSection = (user as any).section;

      // Solo validar si hay restricciones de sección Y el usuario tiene sección asignada
      if (workshop.allowedSections && workshop.allowedSections.length > 0) {
        // Si el usuario no tiene sección asignada, permitir inscripción
        if (!userSection) {
          console.log('Usuario sin sección asignada - permitiendo inscripción');
        } 
        // Si tiene sección, validar que esté en la lista permitida
        else if (!workshop.allowedSections.includes(userSection)) {
          toast({
            variant: 'destructive',
            title: 'Sección no permitida',
            description: `Este taller está restringido a las secciones: ${workshop.allowedSections.join(', ')}. Tu sección: ${userSection}`,
          });
          return;
        }
      }
    }

    // Inscribir
    try {
      await updateDoc(doc(firestore, 'workshops', workshop.id), {
        participants: arrayUnion(user.id),
      });

      toast({
        title: 'Inscripción exitosa',
        description: `Te has inscrito en "${workshop.title}"`,
      });
    } catch (error) {
      console.error('Error al inscribirse:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo completar la inscripción.',
      });
    }
  };

  // Función para desinscribirse
  const handleUnenroll = async (workshop: Workshop) => {
    if (!user?.id) return;

    try {
      await updateDoc(doc(firestore, 'workshops', workshop.id), {
        participants: arrayRemove(user.id),
      });

      toast({
        title: 'Desinscripción exitosa',
        description: `Te has desinscrito de "${workshop.title}"`,
      });
    } catch (error) {
      console.error('Error al desinscribirse:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo completar la desinscripción.',
      });
    }
  };

  // Función para eliminar taller (solo admin)
  const handleDelete = async (workshopId: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'workshops', workshopId));
      toast({
        title: 'Taller eliminado',
        description: 'El taller ha sido eliminado correctamente.',
      });
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el taller.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Función para editar taller
  const handleEdit = (workshop: Workshop) => {
    setSelectedWorkshop(workshop);
    setIsFormOpen(true);
  };

  // Función para crear nuevo taller
  const handleCreate = () => {
    setSelectedWorkshop(null);
    setIsFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Talleres</h1>
          <p className="text-muted-foreground">
            {role === 'admin' || role === 'teacher' 
              ? 'Gestiona los talleres del colegio' 
              : 'Inscríbete en los talleres disponibles'}
          </p>
        </div>
        
        {(role === 'admin' || role === 'teacher') && (
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Taller
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedWorkshop ? 'Editar Taller' : 'Crear Nuevo Taller'}
                </DialogTitle>
              </DialogHeader>
              <WorkshopForm
                workshop={selectedWorkshop}
                onFinished={() => {
                  setIsFormOpen(false);
                  setSelectedWorkshop(null);
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Talleres Grid */}
      {filteredWorkshops.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No hay talleres disponibles
            </p>
            {(role === 'admin' || role === 'teacher') && (
              <Button onClick={handleCreate} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear Primer Taller
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkshops.map((workshop) => {
            const isEnrolled = user?.id ? workshop.participants.includes(user.id) : false;
            const isFull = workshop.participants.length >= workshop.maxParticipants;
            const deadline = new Date(workshop.enrollmentDeadline);
            const isDeadlinePassed = new Date() > deadline;
            const canEnroll = !isEnrolled && !isFull && !isDeadlinePassed && workshop.status === 'active';

            return (
              <Card key={workshop.id} className="flex flex-col">
                {/* Imagen */}
                {workshop.imageUrl && (
                  <div className="relative h-48 w-full">
                    <Image
                      src={workshop.imageUrl}
                      alt={workshop.title}
                      fill
                      className="object-cover rounded-t-lg"
                    />
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-2">{workshop.title}</CardTitle>
                    <Badge variant={workshop.status === 'active' ? 'default' : 'secondary'}>
                      {workshop.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {workshop.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-3">
                  {/* Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {workshop.participants.length} / {workshop.maxParticipants} estudiantes
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GraduationCap className="h-4 w-4" />
                      <span>{workshop.teacherName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{workshop.schedule}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Hasta: {format(deadline, 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  </div>

                  {/* Restricciones por Sección */}
                  {workshop.restrictByGradeSection && workshop.allowedSections && workshop.allowedSections.length > 0 && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-xs">
                      <div className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-300 mb-1">
                        <Shield className="h-3 w-3" />
                        Secciones Permitidas
                      </div>
                      <p className="text-blue-600 dark:text-blue-400">
                        {workshop.allowedSections.join(', ')}
                      </p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex gap-2">
                  {/* Botones para estudiantes */}
                  {role === 'student' && (
                    <>
                      {isEnrolled ? (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleUnenroll(workshop)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Desinscribirse
                        </Button>
                      ) : (
                        <Button
                          className="flex-1"
                          onClick={() => handleEnroll(workshop)}
                          disabled={!canEnroll}
                        >
                          {isFull ? (
                            'Taller Lleno'
                          ) : isDeadlinePassed ? (
                            'Inscripciones Cerradas'
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Inscribirse
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/dashboard/talleres/${workshop.id}`)}
                      >
                        Ver Detalles
                      </Button>
                    </>
                  )}

                  {/* Botones para admin/teacher */}
                  {(role === 'admin' || role === 'teacher') && (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => router.push(`/dashboard/talleres/${workshop.id}`)}
                      >
                        Ver Detalles
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(workshop)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {role === 'admin' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar Taller</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Estás seguro de eliminar "{workshop.title}"? Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(workshop.id)}
                                disabled={isDeleting}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {isDeleting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Eliminando...
                                  </>
                                ) : (
                                  'Eliminar'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
