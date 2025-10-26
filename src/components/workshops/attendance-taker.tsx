'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { useRole } from '@/hooks/use-role';
import { useToast } from '@/hooks/use-toast';
import type { Workshop, User, Attendance, AttendanceRecord, AttendanceStatus } from '@/lib/types';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  FileCheck,
  Save,
  Calendar,
  Users,
  AlertCircle,
  CheckCheck,
  History,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AttendanceTakerProps {
  workshop: Workshop;
}

interface StudentAttendance {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  registeredTime?: string;
  registeredDate?: string;
  notes?: string;
}

export function AttendanceTaker({ workshop }: AttendanceTakerProps) {
  const { firestore } = useFirebase();
  const { user } = useRole();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentTime, setCurrentTime] = useState(format(new Date(), 'HH:mm'));
  const [attendanceData, setAttendanceData] = useState<Map<string, StudentAttendance>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<Attendance | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Cargar usuarios inscritos
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<User>(usersQuery);

  const enrolledStudents = useMemo(() => {
    if (!allUsers || !workshop.participants) return [];
    return allUsers.filter(u => workshop.participants.includes(u.id));
  }, [allUsers, workshop.participants]);

  // Cargar historial de asistencias del taller
  const attendanceQuery = useMemoFirebase(
    () => query(
      collection(firestore, 'attendance'),
      where('workshopId', '==', workshop.id)
    ),
    [firestore, workshop.id]
  );
  const { data: attendanceHistory } = useCollection<Attendance>(attendanceQuery);

  // Verificar si ya existe asistencia para la fecha seleccionada
  useEffect(() => {
    const checkExistingAttendance = async () => {
      if (!selectedDate) return;
      
      setIsLoadingHistory(true);
      try {
        const attendanceRef = collection(firestore, 'attendance');
        const q = query(
          attendanceRef,
          where('workshopId', '==', workshop.id),
          where('date', '==', selectedDate)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          const existing: Attendance & { id: string } = { 
            id: snapshot.docs[0].id, 
            ...data 
          } as Attendance & { id: string };
          setExistingAttendance(existing);
          
          // Cargar datos existentes
          const newMap = new Map<string, StudentAttendance>();
          existing.records.forEach(record => {
            newMap.set(record.studentId, record);
          });
          setAttendanceData(newMap);
          
          toast({
            title: 'Asistencia Existente',
            description: 'Se ha cargado la asistencia previamente registrada para esta fecha.',
          });
        } else {
          setExistingAttendance(null);
          // Inicializar con estado 'none' para todos
          const newMap = new Map<string, StudentAttendance>();
          enrolledStudents.forEach(student => {
            newMap.set(student.id, {
              studentId: student.id,
              studentName: `${student.firstName} ${student.lastName}`,
              status: 'none',
            });
          });
          setAttendanceData(newMap);
        }
      } catch (error) {
        console.error('Error checking attendance:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    checkExistingAttendance();
  }, [selectedDate, workshop.id, firestore, enrolledStudents, toast]);

  // Inicializar asistencia cuando cambian los estudiantes
  useEffect(() => {
    if (!existingAttendance && enrolledStudents.length > 0) {
      const newMap = new Map<string, StudentAttendance>();
      enrolledStudents.forEach(student => {
        if (!attendanceData.has(student.id)) {
          newMap.set(student.id, {
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            status: 'none',
          });
        } else {
          newMap.set(student.id, attendanceData.get(student.id)!);
        }
      });
      setAttendanceData(newMap);
    }
  }, [enrolledStudents, existingAttendance]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    const student = enrolledStudents.find(s => s.id === studentId);
    if (!student) return;

    const newData = new Map(attendanceData);
    newData.set(studentId, {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      status,
      registeredTime: currentTime,
      registeredDate: selectedDate,
    });
    setAttendanceData(newData);
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const newData = new Map(attendanceData);
    enrolledStudents.forEach(student => {
      newData.set(student.id, {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        status,
        registeredTime: currentTime,
        registeredDate: selectedDate,
      });
    });
    setAttendanceData(newData);
    
    toast({
      title: 'Marcado Masivo',
      description: `Todos los estudiantes marcados como ${getStatusLabel(status)}.`,
    });
  };

  const handleSaveAttendance = async () => {
    if (!selectedDate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes seleccionar una fecha.',
      });
      return;
    }

    // Verificar que al menos un estudiante tenga estado diferente de 'none'
    const hasRecords = Array.from(attendanceData.values()).some(a => a.status !== 'none');
    if (!hasRecords) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes marcar al menos un estudiante.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const records: AttendanceRecord[] = Array.from(attendanceData.values())
        .filter(a => a.status !== 'none')
        .map(a => ({
          studentId: a.studentId,
          studentName: a.studentName,
          status: a.status,
          registeredTime: currentTime,
          registeredDate: selectedDate,
        }));

      if (existingAttendance) {
        // Actualizar asistencia existente
        const attendanceRef = doc(firestore, 'attendance', (existingAttendance as any).id);
        await updateDoc(attendanceRef, {
          records,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.id || 'unknown',
        });

        toast({
          title: 'Asistencia Actualizada',
          description: `Se ha actualizado la asistencia para ${records.length} estudiante(s).`,
        });
      } else {
        // Crear nueva asistencia
        await addDoc(collection(firestore, 'attendance'), {
          workshopId: workshop.id,
          date: selectedDate,
          records,
          createdAt: new Date().toISOString(),
          createdBy: user?.id || 'unknown',
        });

        toast({
          title: 'Asistencia Guardada',
          description: `Se ha registrado la asistencia para ${records.length} estudiante(s).`,
        });
      }

      // Recargar datos
      const attendanceRef = collection(firestore, 'attendance');
      const q = query(
        attendanceRef,
        where('workshopId', '==', workshop.id),
        where('date', '==', selectedDate)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const existing: Attendance & { id: string } = { 
          id: snapshot.docs[0].id, 
          ...data 
        } as Attendance & { id: string };
        setExistingAttendance(existing);
      }
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo guardar la asistencia.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return (
          <Badge className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Presente
          </Badge>
        );
      case 'late':
        return (
          <Badge className="bg-yellow-600">
            <Clock className="h-3 w-3 mr-1" />
            Tarde
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Ausente
          </Badge>
        );
      case 'justified':
        return (
          <Badge className="bg-blue-600">
            <FileCheck className="h-3 w-3 mr-1" />
            Justificado
          </Badge>
        );
      default:
        return <Badge variant="outline">Sin marcar</Badge>;
    }
  };

  const getStatusLabel = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return 'Presente';
      case 'late': return 'Tarde';
      case 'absent': return 'Ausente';
      case 'justified': return 'Justificado';
      default: return 'Sin marcar';
    }
  };

  // Calcular estadísticas
  const stats = useMemo(() => {
    const values = Array.from(attendanceData.values());
    return {
      present: values.filter(a => a.status === 'present').length,
      late: values.filter(a => a.status === 'late').length,
      absent: values.filter(a => a.status === 'absent').length,
      justified: values.filter(a => a.status === 'justified').length,
      unmarked: values.filter(a => a.status === 'none').length,
      total: enrolledStudents.length,
    };
  }, [attendanceData, enrolledStudents.length]);

  if (isLoadingUsers) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuración de Asistencia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Configuración de Asistencia
          </CardTitle>
          <CardDescription>
            Selecciona la fecha y hora para registrar la asistencia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha de Asistencia</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora de Registro</Label>
              <Input
                id="time"
                type="time"
                value={currentTime}
                onChange={(e) => setCurrentTime(e.target.value)}
              />
            </div>
          </div>

          {existingAttendance && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Ya existe un registro de asistencia para esta fecha. Los cambios actualizarán el registro existente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estadísticas Rápidas */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Presente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.present}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              Tarde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.late}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Ausente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.absent}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-blue-600" />
              Justificado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.justified}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.justified / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-600" />
              Sin Marcar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unmarked}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.unmarked / stats.total) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkAll('present')}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4 text-green-600" />
              Marcar Todos Presente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkAll('absent')}
              className="gap-2"
            >
              <XCircle className="h-4 w-4 text-red-600" />
              Marcar Todos Ausente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkAll('none')}
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              Limpiar Todo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Estudiantes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lista de Asistencia
              </CardTitle>
              <CardDescription>
                {enrolledStudents.length} estudiante(s) inscrito(s) • {stats.unmarked} sin marcar
              </CardDescription>
            </div>
            <Button
              onClick={handleSaveAttendance}
              disabled={isSaving || stats.unmarked === stats.total}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Asistencia
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {enrolledStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">No hay estudiantes inscritos</p>
              <p className="text-sm mt-2">
                Aún no hay estudiantes inscritos en este taller
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Grado</TableHead>
                    <TableHead>Sección</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrolledStudents.map((student, index) => {
                    const attendance = attendanceData.get(student.id);
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={student.photoURL} />
                              <AvatarFallback>
                                {student.firstName?.[0]}{student.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {student.firstName} {student.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.grade || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.section || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          {attendance && getStatusBadge(attendance.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={attendance?.status || 'none'}
                            onValueChange={(value) => handleStatusChange(student.id, value as AttendanceStatus)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  Presente
                                </div>
                              </SelectItem>
                              <SelectItem value="late">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-yellow-600" />
                                  Tarde
                                </div>
                              </SelectItem>
                              <SelectItem value="absent">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 text-red-600" />
                                  Ausente
                                </div>
                              </SelectItem>
                              <SelectItem value="justified">
                                <div className="flex items-center gap-2">
                                  <FileCheck className="h-4 w-4 text-blue-600" />
                                  Justificado
                                </div>
                              </SelectItem>
                              <SelectItem value="none">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4" />
                                  Sin marcar
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de Asistencias */}
      {attendanceHistory && attendanceHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Asistencias
            </CardTitle>
            <CardDescription>
              {attendanceHistory.length} sesión(es) registrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attendanceHistory
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5)
                .map((att) => {
                  const present = att.records.filter(r => r.status === 'present').length;
                  const total = att.records.length;
                  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

                  return (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div>
                        <p className="font-medium">
                          {format(new Date(att.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {present} de {total} estudiantes presentes
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={percentage >= 80 ? 'default' : 'secondary'}>
                          {percentage}% asistencia
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDate(att.date)}
                        >
                          Ver
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
