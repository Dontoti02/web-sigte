'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, arrayRemove, collection } from 'firebase/firestore';
import { useRole } from '@/hooks/use-role';
import { useToast } from '@/hooks/use-toast';
import type { Workshop, User } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  UserX, 
  Loader2, 
  Users, 
  Calendar, 
  Clock, 
  GraduationCap,
  Shield,
  Edit
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  grade: string;
  section: string;
  photoURL?: string;
}

export default function WorkshopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { role } = useRole();
  const { toast } = useToast();
  
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Cargar todos los usuarios
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers } = useCollection<User>(usersQuery);

  // Cargar taller
  useEffect(() => {
    const loadWorkshop = async () => {
      if (!params.id || typeof params.id !== 'string') return;
      
      try {
        const workshopDoc = await getDoc(doc(firestore, 'workshops', params.id));
        if (workshopDoc.exists()) {
          const data = { id: workshopDoc.id, ...workshopDoc.data() } as Workshop;
          setWorkshop(data);
        }
      } catch (error) {
        console.error('Error cargando taller:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo cargar el taller.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkshop();
  }, [params.id, firestore, toast]);

  // Cargar estudiantes inscritos
  useEffect(() => {
    const loadStudents = async () => {
      if (!workshop || !allUsers) return;
      
      setLoadingStudents(true);
      try {
        const students: EnrolledStudent[] = [];
        
        for (const participantId of workshop.participants) {
          // Buscar en users
          const userFromUsers = allUsers.find(u => u.id === participantId);
          
          if (userFromUsers) {
            students.push({
              id: participantId,
              name: userFromUsers.displayName || 
                    `${userFromUsers.lastName}, ${userFromUsers.firstName}` || 
                    userFromUsers.name || 
                    'Usuario',
              email: userFromUsers.email || 'Sin email',
              grade: userFromUsers.grade || 'No asignado',
              section: userFromUsers.section || 'No asignada',
              photoURL: userFromUsers.photoURL || '',
            });
          } else {
            // Si no está en users, buscar en students
            try {
              const studentDoc = await getDoc(doc(firestore, 'students', participantId));
              if (studentDoc.exists()) {
                const studentData = studentDoc.data();
                students.push({
                  id: participantId,
                  name: studentData.displayName || 
                        `${studentData.lastName}, ${studentData.firstName}` || 
                        'Estudiante',
                  email: studentData.email || 'Sin email',
                  grade: studentData.grade || 'No asignado',
                  section: studentData.section || 'No asignada',
                  photoURL: studentData.photoURL || '',
                });
              }
            } catch (error) {
              console.error(`Error cargando estudiante ${participantId}:`, error);
            }
          }
        }
        
        setEnrolledStudents(students);
      } catch (error) {
        console.error('Error cargando estudiantes:', error);
      } finally {
        setLoadingStudents(false);
      }
    };

    loadStudents();
  }, [workshop, allUsers, firestore]);

  // Remover estudiante
  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!workshop) return;

    try {
      await updateDoc(doc(firestore, 'workshops', workshop.id), {
        participants: arrayRemove(studentId),
      });

      // Actualizar estado local
      setWorkshop(prev => prev ? {
        ...prev,
        participants: prev.participants.filter(id => id !== studentId)
      } : null);

      setEnrolledStudents(prev => prev.filter(s => s.id !== studentId));

      toast({
        title: 'Estudiante removido',
        description: `${studentName} ha sido removido del taller.`,
      });
    } catch (error) {
      console.error('Error removiendo estudiante:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo remover al estudiante.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!workshop) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Taller no encontrado</CardTitle>
            <CardDescription>
              El taller que buscas no existe o ha sido eliminado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard/talleres')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Talleres
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deadline = new Date(workshop.enrollmentDeadline);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.push('/dashboard/talleres')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{workshop.title}</h1>
          <p className="text-muted-foreground">Detalles del taller</p>
        </div>
      </div>

      {/* Información del Taller */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle>{workshop.title}</CardTitle>
                <Badge variant={workshop.status === 'active' ? 'default' : 'secondary'}>
                  {workshop.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <CardDescription>{workshop.description}</CardDescription>
            </div>
            {workshop.imageUrl && (
              <div className="relative w-32 h-32 rounded-lg overflow-hidden ml-4">
                <Image
                  src={workshop.imageUrl}
                  alt={workshop.title}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">Participantes</p>
                <p className="text-muted-foreground">
                  {workshop.participants.length} / {workshop.maxParticipants}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">Docente</p>
                <p className="text-muted-foreground">{workshop.teacherName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">Horario</p>
                <p className="text-muted-foreground">{workshop.schedule}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">Fecha límite</p>
                <p className="text-muted-foreground">
                  {format(deadline, 'dd/MM/yyyy', { locale: es })}
                </p>
              </div>
            </div>
          </div>

          {workshop.restrictByGradeSection && workshop.allowedSections && workshop.allowedSections.length > 0 && (
            <>
              <Separator />
              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    Restricciones por Sección
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    Secciones permitidas:
                  </span>
                  <span className="ml-2 text-blue-600 dark:text-blue-400">
                    {workshop.allowedSections.join(', ')}
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Estudiantes Inscritos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Estudiantes Inscritos ({enrolledStudents.length})
          </CardTitle>
          <CardDescription>
            Lista de estudiantes registrados en este taller
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStudents ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : enrolledStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-muted-foreground">
                No hay estudiantes inscritos
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Los estudiantes inscritos aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Grado</TableHead>
                    <TableHead>Sección</TableHead>
                    {(role === 'admin' || role === 'teacher') && (
                      <TableHead className="text-right">Acciones</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {student.photoURL && (
                              <AvatarImage src={student.photoURL} alt={student.name} />
                            )}
                            <AvatarFallback>
                              {student.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{student.grade}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{student.section}</Badge>
                      </TableCell>
                      {(role === 'admin' || role === 'teacher') && (
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Remover
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover Estudiante</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Estás seguro de remover a <strong>{student.name}</strong> de este taller?
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveStudent(student.id, student.name)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
