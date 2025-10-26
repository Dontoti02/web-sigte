'use client';
import { useEffect, useState } from 'react';
import { StatCard } from "@/components/dashboard/stat-card";
import { useRole } from "@/hooks/use-role";
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Workshop, Attendance } from '@/lib/types';
import { 
  BookOpen, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Calendar,
  TrendingUp,
  Award,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function StudentDashboard() {
  const { user } = useRole();
  const { firestore } = useFirebase();
  
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    justified: 0,
    total: 0
  });
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);

  // Cargar talleres inscritos
  const workshopsQuery = useMemoFirebase(() => collection(firestore, 'workshops'), [firestore]);
  const { data: allWorkshops, isLoading: isLoadingWorkshops } = useCollection<Workshop>(workshopsQuery);
  
  const enrolledWorkshops = allWorkshops?.filter(w => 
    user?.id && w.participants.includes(user.id)
  ) || [];

  // Cargar estadísticas de asistencia
  useEffect(() => {
    const loadAttendanceStats = async () => {
      if (!user?.id) return;
      
      setIsLoadingAttendance(true);
      try {
        const attendanceRef = collection(firestore, 'attendance');
        const attendanceSnapshot = await getDocs(attendanceRef);
        
        let present = 0;
        let late = 0;
        let absent = 0;
        let justified = 0;
        let total = 0;

        attendanceSnapshot.forEach((doc) => {
          const data = doc.data() as Attendance;
          const studentRecord = data.records?.find(r => r.studentId === user.id);
          
          if (studentRecord) {
            total++;
            switch (studentRecord.status) {
              case 'present':
                present++;
                break;
              case 'late':
                late++;
                break;
              case 'absent':
                absent++;
                break;
              case 'justified':
                justified++;
                break;
            }
          }
        });

        setAttendanceStats({ present, late, absent, justified, total });
      } catch (error) {
        console.error('Error loading attendance:', error);
      } finally {
        setIsLoadingAttendance(false);
      }
    };

    loadAttendanceStats();
  }, [user?.id, firestore]);

  // Calcular porcentaje de asistencia
  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round(((attendanceStats.present + attendanceStats.late) / attendanceStats.total) * 100)
    : 0;

  // Determinar estado de asistencia
  const getAttendanceStatus = () => {
    if (attendancePercentage >= 90) return { text: 'Excelente', color: 'text-green-600', icon: Award };
    if (attendancePercentage >= 75) return { text: 'Bueno', color: 'text-blue-600', icon: TrendingUp };
    if (attendancePercentage >= 60) return { text: 'Regular', color: 'text-yellow-600', icon: AlertCircle };
    return { text: 'Necesita mejorar', color: 'text-red-600', icon: XCircle };
  };

  const attendanceStatus = getAttendanceStatus();
  const StatusIcon = attendanceStatus.icon;

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
          <p className="text-muted-foreground">Bienvenido, {user?.name || 'Estudiante'}</p>
        </div>
      </div>

      {/* Contadores principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          title="Talleres Inscritos"
          value={enrolledWorkshops.length.toString()}
          icon={<BookOpen className="h-5 w-5" />}
          description="Talleres activos este ciclo"
        />
        <StatCard
          title="Asistencias"
          value={attendanceStats.present.toString()}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          description={`De ${attendanceStats.total} clases totales`}
        />
        <StatCard
          title="Tardanzas"
          value={attendanceStats.late.toString()}
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          description="Llegadas tarde registradas"
        />
        <StatCard
          title="Inasistencias"
          value={attendanceStats.absent.toString()}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          description={`${attendanceStats.justified} justificadas`}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfica de Asistencia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Resumen de Asistencia
            </CardTitle>
            <CardDescription>
              Tu rendimiento en asistencia este ciclo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${attendanceStatus.color}`} />
                <span className={`font-semibold ${attendanceStatus.color}`}>
                  {attendanceStatus.text}
                </span>
              </div>
              <span className="text-2xl font-bold">{attendancePercentage}%</span>
            </div>
            
            <Progress value={attendancePercentage} className="h-3" />
            
            <div className="grid grid-cols-2 gap-4 pt-4">
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
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="text-sm text-muted-foreground">Justificado</span>
                </div>
                <p className="text-2xl font-bold">{attendanceStats.justified}</p>
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
              Talleres en los que estás inscrito
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enrolledWorkshops.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No estás inscrito en ningún taller</p>
                <p className="text-sm mt-2">Ve a la sección de Talleres para inscribirte</p>
              </div>
            ) : (
              <div className="space-y-3">
                {enrolledWorkshops.map((workshop) => (
                  <div 
                    key={workshop.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{workshop.title}</h4>
                      <p className="text-sm text-muted-foreground">{workshop.teacherName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{workshop.schedule}</p>
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

      {/* Estadísticas adicionales */}
      <div className="grid gap-6 md:grid-cols-3 mt-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Promedio de Asistencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{attendancePercentage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {attendancePercentage >= 90 ? '¡Excelente trabajo!' : 
               attendancePercentage >= 75 ? 'Buen rendimiento' : 
               'Puedes mejorar'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Clases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{attendanceStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Clases registradas este ciclo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Participación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {attendanceStats.total > 0 ? 
                Math.round(((attendanceStats.present + attendanceStats.late + attendanceStats.justified) / attendanceStats.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Incluyendo justificaciones
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
