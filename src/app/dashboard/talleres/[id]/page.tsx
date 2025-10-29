'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Trash2, 
  UserX, 
  Loader2, 
  Users, 
  Calendar, 
  Clock, 
  MapPin,
  GraduationCap,
  Shield,
  Edit
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function WorkshopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { role, user } = useRole();
  const { toast } = useToast();
  
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [enrolledStudentsData, setEnrolledStudentsData] = useState<any[]>([]);

  const studentsQuery = useMemoFirebase(() => collection(firestore, 'students'), [firestore]);
  const { data: allStudents } = useCollection<User>(studentsQuery);

  useEffect(() => {
    const loadWorkshop = async () => {
      if (!params.id) return;
      
      try {
        const workshopRef = doc(firestore, 'workshops', params.id as string);
        const workshopDoc = await getDoc(workshopRef);
        
        if (workshopDoc.exists()) {
          setWorkshop({ id: workshopDoc.id, ...workshopDoc.data() } as Workshop);
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Taller no encontrado.',
          });
          router.push('/dashboard/talleres');
        }
      } catch (error) {
        console.error('Error loading workshop:', error);
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
  }, [params.id, firestore, toast, router]);

  const enrolledStudents = allStudents?.filter(student => 
    workshop?.participants.includes(student.id)
  ) || [];

  // Cargar datos completos de estudiantes inscritos desde users y students
  useEffect(() => {
    const loadEnrolledStudentsData = async () => {
      if (!workshop || !workshop.participants || workshop.participants.length === 0) {
        setEnrolledStudentsData([]);
        return;
      }

      try {
        const studentsData = await Promise.all(
          workshop.participants.map(async (studentId) => {
            // Cargar desde students
            const studentRef = doc(firestore, 'students', studentId);
            const studentDoc = await getDoc(studentRef);
            
            // Cargar desde users (donde están grade y section)
            const userRef = doc(firestore, 'users', studentId);
            const userDoc = await getDoc(userRef);
            
            let combinedData: any = { id: studentId };
            
            if (studentDoc.exists()) {
              combinedData = { ...combinedData, ...studentDoc.data() };
            }
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              combinedData = { ...combinedData, ...userData };
              console.log(`User ${studentId} data (grade/section):`, {
                grade: userData.grade,
                section: userData.section
              });
            }
            
            console.log(`Combined data for ${studentId}:`, combinedData);
            return combinedData;
          })
        );

        const validStudents = studentsData.filter(s => s !== null);
        console.log('All enrolled students with grade/section:', validStudents);
        setEnrolledStudentsData(validStudents);
      } catch (error) {
        console.error('Error loading students data:', error);
      }
    };

    loadEnrolledStudentsData();
  }, [workshop, firestore]);

  const handleRemoveStudent = async (studentId: string) => {
    if (!workshop) return;
    
    setRemovingStudentId(studentId);
    try {
      const workshopRef = doc(firestore, 'workshops', workshop.id);
      await updateDoc(workshopRef, {
        participants: arrayRemove(studentId)
      });
      
      // Actualizar el estado local
      setWorkshop({
        ...workshop,
        participants: workshop.participants.filter(id => id !== studentId)
      });
      
      toast({
        title: 'Estudiante Eliminado',
        description: 'El estudiante ha sido removido del taller.',
      });
    } catch (error: any) {
      console.error('Error removing student:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar al estudiante.',
      });
    } finally {
      setRemovingStudentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!workshop) {
    return null;
  }

  // Verificar permisos
  const canManage = role === 'admin';
  const canView = role === 'admin' || (role === 'teacher' && workshop.teacherId === user?.id);

  if (!canView) {
    router.push('/dashboard/talleres');
    return null;
  }

  const deadline = new Date(workshop.enrollmentDeadline);
  const isDeadlinePassed = new Date() > deadline;

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{workshop.title}</h1>
          <p className="text-muted-foreground">Gestión de Estudiantes Inscritos</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Información del Taller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {workshop.imageUrl && (
              <div className="relative h-48 w-full rounded-lg overflow-hidden">
                <Image
                  src={workshop.imageUrl}
                  alt={workshop.title}
                  layout="fill"
                  objectFit="cover"
                />
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div>
                <strong>Estado:</strong>{' '}
                <Badge variant={workshop.status === 'active' ? 'default' : 'destructive'}>
                  {workshop.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div>
                <strong>Docente:</strong> {workshop.teacherName}
              </div>
              <div>
                <strong>Horario:</strong> {workshop.schedule}
              </div>
              <div>
                <strong>Inscritos:</strong> {workshop.participants.length} / {workshop.maxParticipants}
              </div>
              <div className={isDeadlinePassed ? 'text-red-600' : ''}>
                <strong>Fecha límite:</strong>{' '}
                {deadline.toLocaleDateString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric' 
                })}
                {isDeadlinePassed && ' (Vencida)'}
              </div>
              {workshop.participants.length >= workshop.maxParticipants && (
                <Badge variant="destructive" className="w-full justify-center">
                  Cupo Lleno
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              Estudiantes Inscritos ({enrolledStudentsData.length})
            </CardTitle>
            <CardDescription>
              {canManage 
                ? 'Lista de estudiantes inscritos con su grado y sección. Puedes eliminarlos del taller.' 
                : 'Lista de estudiantes inscritos en tu taller con su grado y sección.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enrolledStudentsData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserX className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No hay estudiantes inscritos en este taller.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Grado</TableHead>
                    <TableHead>Sección</TableHead>
                    {canManage && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledStudentsData.map((student) => {
                    const studentData = student as any;
                    
                    // Los campos grade y section vienen de la colección users
                    const grade = studentData.grade || 'Sin asignar';
                    const section = studentData.section || 'Sin asignar';
                    
                    console.log(`Student ${studentData.firstName} ${studentData.lastName} - Grade: ${grade}, Section: ${section}`);
                    
                    return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {student.photoURL && student.photoURL.trim() !== '' && (
                              <AvatarImage src={student.photoURL} alt={student.name} />
                            )}
                            <AvatarFallback>
                              {student.firstName?.charAt(0)}{student.lastName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {student.firstName} {student.lastName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{grade}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{section}</Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={removingStudentId === student.id}
                              >
                                {removingStudentId === student.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar estudiante?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Estás seguro de que deseas eliminar a{' '}
                                  <strong>{student.firstName} {student.lastName}</strong> del taller{' '}
                                  <strong>{workshop.title}</strong>?
                                  <br />
                                  Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveStudent(student.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
