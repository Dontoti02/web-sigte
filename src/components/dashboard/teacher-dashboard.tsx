'use client';

import { useEffect, useState, useMemo } from 'react';
import { StatCard } from "@/components/dashboard/stat-card";
import { useRole } from "@/hooks/use-role";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Workshop, Attendance } from '@/lib/types';
import { 
  BookOpen, 
  Users, 
  CheckCircle, 
  Clock,
  XCircle,
  TrendingUp,
  Calendar,
  Award
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function TeacherDashboard() {
  const { user } = useRole();
  const { firestore } = useFirebase();
  const router = useRouter();
  
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    total: 0
  });
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);

  // Cargar talleres del docente
  const workshopsQuery = useMemoFirebase(() => collection(firestore, 'workshops'), [firestore]);
  const { data: allWorkshops, isLoading: isLoadingWorkshops } = useCollection<Workshop>(workshopsQuery);
  
  const teacherWorkshops = useMemo(() => {
    return allWorkshops?.filter(w => w.teacherId === user?.id) || [];
  }, [allWorkshops, user?.id]);

  const studentCount = useMemo(() => {
    return teacherWorkshops.reduce((acc, w) => acc + (w.participants?.length || 0), 0);
  }, [teacherWorkshops]);

  const activeWorkshops = useMemo(() => {
    return teacherWorkshops.filter(w => w.status === 'active').length;
  }, [teacherWorkshops]);

  // Cargar estadísticas de asistencia de los talleres del docente
  useEffect(() => {
    const loadAttendanceStats = async () => {
      if (!user?.id || teacherWorkshops.length === 0) {
        setIsLoadingAttendance(false);
        return;
      }
      
      setIsLoadingAttendance(true);
      try {
        const attendanceRef = collection(firestore, 'attendance');
        const attendanceSnapshot = await getDocs(attendanceRef);
        
        let present = 0;
        let late = 0;
        let absent = 0;
        let total = 0;

        const workshopIds = teacherWorkshops.map(w => w.id);

        attendanceSnapshot.forEach((doc) => {
          const data = doc.data() as Attendance;
          
          // Solo contar asistencias de los talleres del docente
          if (data.workshopId && workshopIds.includes(data.workshopId)) {
            data.records?.forEach(record => {
              total++;
              switch (record.status) {
                case 'present':
                  present++;
                  break;
                case 'late':
                  late++;
                  break;
                case 'absent':
                  absent++;
                  break;
              }
            });
          }
        });

        setAttendanceStats({ present, late, absent, total });
      } catch (error) {
        console.error('Error loading attendance:', error);
      } finally {
        setIsLoadingAttendance(false);
      }
    };

    loadAttendanceStats();
  }, [user?.id, teacherWorkshops, firestore]);

  // Calcular porcentaje de asistencia
  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceStats.total) * 100)
    : 0;

  if (isLoadingWorkshops || isLoadingAttendance) {
    return (
      <div>
        <Skeleton className="h-10 w-96 mb-6" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mi Dashboard</h2>
          <p className="text-muted-foreground">Bienvenido, {user?.name || 'Docente'}</p>
        </div>
      </div>

      {/* Contadores principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Talleres Asignados"
          value={teacherWorkshops.length.toString()}
          icon={<BookOpen className="h-5 w-5" />}
          description={`${activeWorkshops} activos`}
        />
        <StatCard
          title="Estudiantes a Cargo"
          value={studentCount.toString()}
          icon={<Users className="h-5 w-5" />}
          description="Total en tus talleres"
        />
        <StatCard
          title="Asistencias Registradas"
          value={attendanceStats.present.toString()}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          description={`De ${attendanceStats.total} registros`}
        />
        <StatCard
          title="Promedio de Asistencia"
          value={`${attendancePercentage}%`}
          icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
          description="En tus talleres"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfica de Asistencia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Estadísticas de Asistencia
            </CardTitle>
            <CardDescription>
              Resumen de asistencias en tus talleres
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">Promedio General</span>
              </div>
              <span className="text-2xl font-bold">{attendancePercentage}%</span>
            </div>
            
            <Progress value={attendancePercentage} className="h-3" />
            
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">Presente</span>
                </div>
                <p className="text-2xl font-bold">{attendanceStats.present}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-muted-foreground">Tarde</span>
                </div>
                <p className="text-2xl font-bold">{attendanceStats.late}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-sm text-muted-foreground">Ausente</span>
                </div>
                <p className="text-2xl font-bold">{attendanceStats.absent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mis Talleres */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Mis Talleres
            </CardTitle>
            <CardDescription>
              Talleres que impartes actualmente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teacherWorkshops.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No tienes talleres asignados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teacherWorkshops.map((workshop) => (
                  <div 
                    key={workshop.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/talleres/${workshop.id}?role=teacher`)}
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{workshop.title}</h4>
                      <p className="text-sm text-muted-foreground">{workshop.schedule}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {workshop.participants?.length || 0} estudiantes
                      </p>
                    </div>
                    <Badge 
                      variant={workshop.status === 'active' ? 'default' : 'secondary'}
                      className={workshop.status === 'active' ? 'bg-green-600' : ''}
                    >
                      {workshop.status === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accesos rápidos */}
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => router.push('/dashboard/asistencia?role=teacher')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Consultar Asistencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Revisa las asistencias de tus talleres
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => router.push('/dashboard/talleres?role=teacher')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Ver Talleres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Gestiona tus talleres y estudiantes
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => router.push('/dashboard/calendario?role=teacher')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Consulta eventos y fechas importantes
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
