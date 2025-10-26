'use client';

import { useEffect, useState } from 'react';
import { useRole } from '@/hooks/use-role';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Attendance, AttendanceRecord } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  FileCheck,
  Calendar,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AttendanceWithDate extends AttendanceRecord {
  date: string;
  workshopName?: string;
}

export function StudentAttendanceView() {
  const { user } = useRole();
  const { firestore } = useFirebase();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceWithDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    present: 0,
    late: 0,
    absent: 0,
    justified: 0,
    total: 0
  });

  useEffect(() => {
    const loadAttendance = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const attendanceRef = collection(firestore, 'attendance');
        const attendanceSnapshot = await getDocs(attendanceRef);

        const records: AttendanceWithDate[] = [];
        let present = 0;
        let late = 0;
        let absent = 0;
        let justified = 0;

        attendanceSnapshot.forEach((doc) => {
          const data = doc.data() as Attendance;
          const studentRecord = data.records?.find(r => r.studentId === user.id);

          if (studentRecord) {
            records.push({
              ...studentRecord,
              date: data.date,
              workshopName: data.workshopId || `Grado ${data.grade} - Sección ${data.section}`
            });

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

        // Ordenar por fecha (más reciente primero)
        records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setAttendanceRecords(records);
        setStats({
          present,
          late,
          absent,
          justified,
          total: records.length
        });
      } catch (error) {
        console.error('Error loading attendance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAttendance();
  }, [user?.id, firestore]);

  const getStatusBadge = (status: string) => {
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
        return <Badge variant="outline">Sin registro</Badge>;
    }
  };

  const attendancePercentage = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas Resumidas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              Tardanzas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.late}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Ausencias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.absent}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Asistencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendancePercentage}%</div>
            <p className="text-xs text-muted-foreground">
              Promedio general
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Asistencias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Asistencias
          </CardTitle>
          <CardDescription>
            Registro completo de tus asistencias a clases y talleres
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">No hay registros de asistencia</p>
              <p className="text-sm mt-2">
                Tus asistencias aparecerán aquí cuando el administrador las registre
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Clase/Taller</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Hora de Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record, index) => (
                    <TableRow key={`${record.date}-${index}`}>
                      <TableCell className="font-medium">
                        {format(new Date(record.date), "dd 'de' MMMM, yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>{record.workshopName || 'Clase Regular'}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.registeredTime || '-'}
                      </TableCell>
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
