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
import { PlusCircle, MoreHorizontal, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkshopForm } from '@/components/dashboard/workshop-form';
import { Skeleton } from '@/components/ui/skeleton';
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
} from "@/components/ui/alert-dialog"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


export default function TalleresPage() {
  const { role, user } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);

  // Debug logs
  console.log('TalleresPage - user:', user);
  console.log('TalleresPage - role:', role);

  const workshopsQuery = useMemoFirebase(() => collection(firestore, 'workshops'), [firestore]);
  const { data: workshops, isLoading } = useCollection<Workshop>(workshopsQuery);

  const filteredWorkshops = useMemoFirebase(() => {
    if (!workshops) return workshops;

    // Para padres: mostrar solo talleres donde sus hijos están inscritos
    if (role === 'parent' && (user as any)?.children) {
      const childIds = (user as any).children.map((child: any) => child.id);
      return workshops.filter(workshop => 
        workshop.participants.some(participantId => childIds.includes(participantId))
      );
    }

    // Para estudiantes: filtrar talleres según restricciones
    if (role === 'student' && user) {
      const userGrade = (user as any).grade;
      const userSection = (user as any).section;

      return workshops.filter(workshop => {
        const isStudentEnrolled = user?.id ? workshop.participants.includes(user.id) : false;

        // 1. Si el estudiante ya está inscrito, mostrar siempre el taller.
        if (isStudentEnrolled) {
          return true;
        }

        // 2. Si no está inscrito, aplicar la lógica de restricciones y disponibilidad.
        // No mostrar talleres inactivos para inscribirse.
        if (workshop.status !== 'active') {
          return false;
        }
        
        // Mostrar todos los talleres activos independientemente de las restricciones
        // Las restricciones solo afectan la capacidad de inscribirse, no la visibilidad
        return true;
      });
    }

    // Para admin y teacher: mostrar todos los talleres
    return workshops;
  }, [role, user, workshops]);

  const handleEnroll = async (workshop: Workshop) => {
    if (!user || !user.id || workshop.status !== 'active') {
      console.log('Cannot enroll:', { user, userId: user?.id, status: workshop.status });
      toast({
        variant: 'destructive',
        title: 'Error de Inscripción',
        description: 'No se puede inscribir en este momento. Verifica tu sesión.',
      });
      return;
    }

    // Validar capacidad máxima
    if (workshop.participants.length >= workshop.maxParticipants) {
      toast({
        variant: 'destructive',
        title: 'Taller Lleno',
        description: `El taller "${workshop.title}" ha alcanzado su capacidad máxima de ${workshop.maxParticipants} estudiantes.`,
      });
      return;
    }

    // Validar fecha límite de inscripción
    const deadline = new Date(workshop.enrollmentDeadline);
    const now = new Date();
    if (now > deadline) {
      toast({
        variant: 'destructive',
        title: 'Inscripciones Cerradas',
        description: `La fecha límite de inscripción para "${workshop.title}" ha vencido.`,
      });
      return;
    }

    // Validar restricciones de grado y sección
    if (workshop.restrictByGradeSection) {
      const userGrade = (user as any).grade;
      const userSection = (user as any).section;
      const userRole = (user as any).role;
      
      // Debug logging
      console.log('Validando restricciones:', {
        userGrade,
        userSection,
        userRole,
        allowedGrades: workshop.allowedGrades,
        allowedSections: workshop.allowedSections,
        restrictByGradeSection: workshop.restrictByGradeSection
      });
      
      // Si el usuario es admin o teacher, permitir inscripción sin restricciones
      if (userRole === 'admin' || userRole === 'teacher') {
        console.log('Usuario admin/teacher puede inscribirse sin restricciones');
      } else {
        const hasGradeRestrictions = workshop.allowedGrades && workshop.allowedGrades.length > 0;
        const hasSectionRestrictions = workshop.allowedSections && workshop.allowedSections.length > 0;
        
        // Si no hay ninguna restricción específica pero restrictByGradeSection está activo,
        // permitir acceso (esto no debería pasar, pero por seguridad)
        if (!hasGradeRestrictions && !hasSectionRestrictions) {
          // No hay restricciones específicas, permitir inscripción
          console.log('Restricciones activas pero sin grados/secciones específicas definidas');
        } else {
          // Hay restricciones específicas, validar
          let canEnrollByGrade = !hasGradeRestrictions; // Si no hay restricción de grado, puede inscribirse
          let canEnrollBySection = !hasSectionRestrictions; // Si no hay restricción de sección, puede inscribirse
          
          // Verificar restricción de grado si existe
          if (hasGradeRestrictions) {
            if (!userGrade) {
              toast({
                variant: 'destructive',
                title: 'Perfil Incompleto',
                description: 'Tu cuenta no tiene grado asignado y este taller requiere un grado específico. Contacta al administrador.',
              });
              return;
            }
            canEnrollByGrade = workshop.allowedGrades!.includes(userGrade);
          }
          
          // Verificar restricción de sección si existe
          if (hasSectionRestrictions) {
            if (!userSection) {
              toast({
                variant: 'destructive',
                title: 'Perfil Incompleto',
                description: 'Tu cuenta no tiene sección asignada y este taller requiere una sección específica. Contacta al administrador.',
              });
              return;
            }
            canEnrollBySection = workshop.allowedSections!.includes(userSection);
          }
          
          // El usuario debe cumplir TODAS las restricciones que existan
          if (!canEnrollByGrade || !canEnrollBySection) {
            let restrictionMessages = [];
            
            if (hasGradeRestrictions && !canEnrollByGrade) {
              restrictionMessages.push(`Grados permitidos: ${workshop.allowedGrades!.join(', ')}`);
            }
            
            if (hasSectionRestrictions && !canEnrollBySection) {
              restrictionMessages.push(`Secciones permitidas: ${workshop.allowedSections!.join(', ')}`);
            }
            
            toast({
              variant: 'destructive',
              title: 'Restricciones de Acceso',
              description: `Este taller tiene restricciones activas. ${restrictionMessages.join(' y ')}. Tu grado: ${userGrade || 'No asignado'}, tu sección: ${userSection || 'No asignada'}.`,
            });
            return;
          }
        }
      }
    }
    
    try {
      console.log('Enrolling user:', user.id, 'in workshop:', workshop.id);
      const workshopRef = doc(firestore, 'workshops', workshop.id);
      await updateDoc(workshopRef, {
        participants: arrayUnion(user.id),
      });
      
      toast({
        title: 'Inscripción Exitosa',
        description: `Te has inscrito en el taller "${workshop.title}".`,
      });
    } catch (error: any) {
      console.error('Error enrolling:', error);
      toast({
        variant: 'destructive',
        title: 'Error de Inscripción',
        description: error.message || 'No se pudo completar la inscripción.',
      });
    }
  };
  
  const handleUnenroll = async (workshop: Workshop) => {
    if (!user || !user.id) {
      console.log('Cannot unenroll:', { user, userId: user?.id });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se puede cancelar la inscripción. Verifica tu sesión.',
      });
      return;
    }
    
    try {
      console.log('Unenrolling user:', user.id, 'from workshop:', workshop.id);
      const workshopRef = doc(firestore, 'workshops', workshop.id);
      await updateDoc(workshopRef, {
        participants: arrayRemove(user.id)
      });
      
      toast({
        title: "Inscripción Cancelada",
        description: `Has cancelado tu inscripción al taller "${workshop.title}".`,
      });
    } catch(error: any) {
      console.error('Error unenrolling:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo cancelar la inscripción."
      });
    }
  };
  
  const handleDelete = async (workshopId: string) => {
    try {
        await deleteDoc(doc(firestore, "workshops", workshopId));
        toast({
            title: "Taller Eliminado",
            description: "El taller ha sido eliminado exitosamente."
        })
    } catch(e) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo eliminar el taller."
        });
    }
  }
  
  const handleToggleStatus = async (workshop: Workshop) => {
    try {
        const workshopRef = doc(firestore, 'workshops', workshop.id);
        const newStatus = workshop.status === 'active' ? 'inactive' : 'active';
        await updateDoc(workshopRef, { status: newStatus });
        toast({
            title: `Taller ${newStatus === 'active' ? 'Habilitado' : 'Deshabilitado'}`,
            description: `El taller "${workshop.title}" ahora está ${newStatus === 'active' ? 'activo' : 'inactivo'}.`
        });
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo cambiar el estado del taller.'
        });
    }
  }

  const handleEdit = (workshop: Workshop) => {
    setSelectedWorkshop(workshop);
    setIsFormOpen(true);
  };
  
  const handleAddNew = () => {
    setSelectedWorkshop(null);
    setIsFormOpen(true);
  }
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedWorkshop(null);
  }

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Talleres Disponibles</h1>
        {role === 'admin' && (
           <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
               <Button onClick={handleAddNew} className="bg-accent hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear Taller
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{selectedWorkshop ? "Editar Taller" : "Crear Nuevo Taller"}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] pr-6">
                  <WorkshopForm key={selectedWorkshop?.id || 'new'} workshop={selectedWorkshop} onFinished={handleCloseForm} />
                </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
             <Card key={i} className="flex flex-col">
                <Skeleton className="h-48 w-full" />
                <CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader>
                <CardContent className="flex-grow space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-10 w-full" />
                </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {!isLoading && filteredWorkshops?.map((workshop) => {
          const isStudentEnrolled = role === 'student' && user?.id ? workshop.participants.includes(user.id) : false;
          const enrolledChildren = role === 'parent' && (user as any)?.children
            ? (user as any).children.filter((child: any) => workshop.participants.includes(child.id))
            : [];
          const isActive = workshop.status === 'active';
          const isFull = workshop.participants.length >= workshop.maxParticipants;
          const deadline = new Date(workshop.enrollmentDeadline);
          const now = new Date();
          const isDeadlinePassed = now > deadline;
          const canEnroll = isActive && !isFull && !isDeadlinePassed && user?.id && !isStudentEnrolled;
          
          return (
            <Card key={workshop.id} className="flex flex-col overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="relative h-48 w-full">
                <Image
                  src={workshop.imageUrl || 'https://picsum.photos/seed/1/600/400'}
                  alt={workshop.title}
                  layout="fill"
                  objectFit="cover"
                />
                 <div className="absolute inset-0 bg-black/30" />
                 <div className="absolute top-2 right-2">
                    {role === 'admin' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-8 w-8 bg-black/50 hover:bg-black/70 border-none text-white">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(workshop)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(workshop)}>
                                {isActive ? (
                                    <><XCircle className="mr-2 h-4 w-4" /> Deshabilitar</>
                                ) : (
                                    <><CheckCircle className="mr-2 h-4 w-4" /> Habilitar</>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive px-2 py-1.5 font-normal relative flex cursor-default select-none items-center rounded-sm text-sm outline-none transition-colors focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                                         <Trash2 className="mr-2 h-4 w-4" />
                                         Eliminar
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará permanentemente el taller.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(workshop.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                 </div>
                 <div className="absolute top-2 left-2">
                    <Badge variant={isActive ? 'default' : 'destructive'} className={cn(isActive ? 'bg-green-600' : 'bg-red-600', 'text-white border-none')}>
                        {isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                 </div>
                 <div className="absolute bottom-0 p-4">
                    <h2 className="text-2xl font-bold text-white font-headline">{workshop.title}</h2>
                 </div>
              </div>
              <CardHeader>
                <CardDescription className="line-clamp-2">{workshop.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow text-sm text-muted-foreground space-y-2">
                 <p><strong>Docente:</strong> {workshop.teacherName}</p>
                 <p><strong>Horario:</strong> {workshop.schedule}</p>
                 <p><strong>Inscritos:</strong> {workshop.participants.length} / {workshop.maxParticipants} estudiantes</p>
                 <p className={isDeadlinePassed ? 'text-red-600 font-semibold' : ''}>
                   <strong>Fecha límite:</strong> {deadline.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                   {isDeadlinePassed && ' (Vencida)'}
                 </p>
                 {workshop.restrictByGradeSection && (
                   <div className="space-y-1">
                     <Badge variant="outline" className="w-full justify-center border-blue-500 text-blue-700">
                       🎓 Restricciones Activas
                     </Badge>
                     {workshop.allowedGrades && workshop.allowedGrades.length > 0 && (
                       <p className="text-xs">
                         <strong>Grados:</strong> {workshop.allowedGrades.join(', ')}
                       </p>
                     )}
                     {workshop.allowedSections && workshop.allowedSections.length > 0 && (
                       <p className="text-xs">
                         <strong>Secciones:</strong> {workshop.allowedSections.join(', ')}
                       </p>
                     )}
                   </div>
                 )}
                 {isFull && <Badge variant="destructive" className="w-full justify-center">Cupo Lleno</Badge>}
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {role === 'student' && (
                  <>
                    {isStudentEnrolled ? (
                      <>
                        <Badge className="w-full justify-center bg-green-600 hover:bg-green-700">
                          ✓ Inscrito
                        </Badge>
                        <Button className="w-full" variant="outline" onClick={() => handleUnenroll(workshop)}>
                          Cancelar Inscripción
                        </Button>
                      </>
                    ) : (
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90" 
                        onClick={() => handleEnroll(workshop)} 
                        disabled={!canEnroll}
                      >
                        {!user?.id 
                          ? 'Inicia sesión para inscribirte' 
                          : isFull 
                          ? 'Cupo Lleno' 
                          : isDeadlinePassed 
                          ? 'Inscripciones Cerradas'
                          : !isActive 
                          ? 'No disponible' 
                          : 'Inscribirse'}
                      </Button>
                    )}
                  </>
                )}
                {role === 'parent' && (
                  <div className="w-full text-left">
                    {enrolledChildren.length > 0 ? (
                      <>
                        <p className="text-sm font-semibold mb-2 text-foreground">Hijos Inscritos:</p>
                        <div className="flex flex-wrap gap-2">
                          {enrolledChildren.map((child: { id: string; name: string }) => (
                            <Badge key={child.id} variant="secondary">{child.name}</Badge>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Ninguno de tus hijos está inscrito en este taller</p>
                    )}
                  </div>
                )}
                {role === 'admin' && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push(`/dashboard/talleres/${workshop.id}?role=${role}`)}
                  >
                    Gestionar Estudiantes
                  </Button>
                )}
                {role === 'teacher' && workshop.teacherId === user?.id && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push(`/dashboard/talleres/${workshop.id}?role=${role}`)}
                  >
                    Ver Estudiantes
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
       {!isLoading && filteredWorkshops?.length === 0 && (
            <div className="text-center py-20 text-muted-foreground rounded-lg border-2 border-dashed">
                <h3 className="text-lg font-semibold">No hay talleres disponibles</h3>
                {role === 'admin' && <p className="mt-2 text-sm">Crea el primer taller para empezar.</p>}
            </div>
        )}
    </div>
  );
}
