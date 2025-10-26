'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useFirebase } from '@/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { StatCard } from "@/components/dashboard/stat-card";
import { BookOpen, CheckCircle, AlertTriangle, Users, UserPlus, TrendingUp, Award } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Child {
  id: string;
  name: string;
}

interface Workshop {
  id: string;
  name: string;
  title?: string;
  participants: string[];
}

interface Attendance {
  id: string;
  records: { studentId: string; status: string; }[];
}

export function ParentDashboard() {
  const { user } = useRole();
  const { firestore } = useFirebase();
  const [children, setChildren] = useState<Child[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !firestore) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch children
        const userRef = doc(firestore, 'users', user.id);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        const childRefs = userData?.children || [];
        
        if (!childRefs || childRefs.length === 0) {
          setChildren([]);
          setWorkshops([]);
          setAttendance([]);
          setIsLoading(false);
          return;
        }
        
        setChildren(childRefs);

        const childIds = childRefs.map((c: Child) => c.id);

        // Fetch workshops for all children
        const workshopsQuery = query(
          collection(firestore, 'workshops'),
          where('participants', 'array-contains-any', childIds)
        );
        const workshopSnapshot = await getDocs(workshopsQuery);
        const fetchedWorkshops = workshopSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workshop));
        setWorkshops(fetchedWorkshops);

        // Fetch attendance for all children
        const attendanceQuery = query(
          collection(firestore, 'attendance')
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        const fetchedAttendance = attendanceSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(att => {
            if (att.records && Array.isArray(att.records)) {
              return att.records.some((r: any) => childIds.includes(r.studentId));
            }
            return false;
          });
        setAttendance(fetchedAttendance);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching parent data:", error);
        setError("Error al cargar los datos. Por favor, intenta de nuevo.");
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id, firestore]);

  const getChildWorkshops = (childId: string) => {
    return workshops.filter(w => w.participants.includes(childId));
  };

  const getChildAttendance = (childId: string) => {
    return attendance.filter(a => a.records && a.records.some((r: any) => r.studentId === childId));
  };

  const childIds = children.map(c => c.id);
  const workshopsEnrolled = workshops.filter(w => w.participants.some(p => childIds.includes(p)));
  const totalWorkshops = new Set(workshopsEnrolled.map(w => w.id)).size;

  const allAttendanceRecords = attendance
    .flatMap(a => a.records || [])
    .filter(r => childIds.includes(r.studentId));
  const totalPresents = allAttendanceRecords.filter(r => r.status === 'present').length;
  const totalLates = allAttendanceRecords.filter(r => r.status === 'late').length;
  const totalAbsents = allAttendanceRecords.filter(r => r.status === 'absent').length;
  const totalJustified = allAttendanceRecords.filter(r => r.status === 'justified').length;
  
  const totalAttendanceEvents = totalPresents + totalLates + totalAbsents + totalJustified;
  const attendancePercentage = totalAttendanceEvents > 0 
    ? Math.round(((totalPresents + totalLates) / totalAttendanceEvents) * 100) 
    : 0;

  const chartData = children.map(child => ({
    name: child.name.split(' ')[0],
    talleres: getChildWorkshops(child.id).length,
  }));

  const attendanceChartData = [
    { name: 'Asistencias', value: totalPresents, color: '#10b981' },
    { name: 'Retardos', value: totalLates, color: '#3b82f6' },
    { name: 'Inasistencias', value: totalAbsents, color: '#ef4444' },
    { name: 'Justificadas', value: totalJustified, color: '#f59e0b' },
  ].filter(item => item.value > 0);

  const attendanceByChildData = children.map(child => {
    const childAttendance = getChildAttendance(child.id);
    const childRecords = childAttendance.flatMap(a => a.records || []);
    const presents = childRecords.filter(r => r.status === 'present').length;
    const lates = childRecords.filter(r => r.status === 'late').length;
    const absents = childRecords.filter(r => r.status === 'absent').length;
    const justified = childRecords.filter(r => r.status === 'justified').length;
    const total = childRecords.length;
    const percentage = total > 0 ? Math.round(((presents + lates) / total) * 100) : 0;
    
    return {
      name: child.name.split(' ')[0],
      asistencias: presents,
      retardos: lates,
      inasistencias: absents,
      justificadas: justified,
      porcentaje: percentage,
    };
  });

  // Estadísticas por hijo
  const childrenStats = children.map(child => {
    const childWorkshops = getChildWorkshops(child.id);
    const childAttendance = getChildAttendance(child.id);
    const childRecords = childAttendance.flatMap(a => a.records || []);
    const presents = childRecords.filter(r => r.status === 'present').length;
    const lates = childRecords.filter(r => r.status === 'late').length;
    const total = childRecords.length;
    const percentage = total > 0 ? Math.round(((presents + lates) / total) * 100) : 0;

    return {
      id: child.id,
      name: child.name,
      workshops: childWorkshops.length,
      attendance: percentage,
      totalRecords: total,
    };
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="mt-4 text-muted-foreground">Cargando datos del dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700 text-center">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full mt-4"
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold">No hay hijos vinculados</p>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Agrega un hijo para ver el dashboard
              </p>
              <Link href="/dashboard/mis-hijos?role=parent" passHref>
                <Button className="w-full">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Agregar Hijo
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Padre/Madre</h2>
        <Link href="/dashboard/mis-hijos?role=parent" passHref>
          <Button variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Gestionar Mis Hijos
          </Button>
        </Link>
      </div>

      {/* Contadores principales mejorados */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Hijos Vinculados"
          value={children.length.toString()}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          description="Total de hijos gestionados."
        />
        <StatCard
          title="Talleres Inscritos"
          value={totalWorkshops.toString()}
          icon={<BookOpen className="h-5 w-5 text-purple-500" />}
          description="Total de talleres únicos."
        />
        <StatCard
          title="% de Asistencia General"
          value={`${attendancePercentage}%`}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          description="Promedio de todos los hijos."
        />
        <StatCard
          title="Registros Totales"
          value={totalAttendanceEvents.toString()}
          icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
          description="Eventos de asistencia registrados."
        />
      </div>

      {/* Gráficas principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Gráfica de Talleres por Hijo */}
        <Card>
          <CardHeader>
            <CardTitle>Talleres por Hijo</CardTitle>
            <CardDescription>Cantidad de talleres en los que cada hijo está inscrito.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 && chartData.some(d => d.talleres > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="talleres" fill="#8884d8" name="Nro. de Talleres" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay datos de talleres disponibles
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gr��fica de Distribución de Asistencias */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Asistencias</CardTitle>
            <CardDescription>Estado general de asistencias de todos los hijos.</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={attendanceChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {attendanceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No hay registros de asistencia disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfica de Asistencia por Hijo */}
      <div className="grid grid-cols-1 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Asistencia Detallada por Hijo</CardTitle>
            <CardDescription>Comparativa completa de asistencias, retardos e inasistencias.</CardDescription>
          </CardHeader>
          <CardContent>
            {attendanceByChildData.length > 0 && attendanceByChildData.some(d => d.asistencias > 0 || d.retardos > 0 || d.inasistencias > 0) ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={attendanceByChildData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="asistencias" fill="#10b981" name="Asistencias" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="retardos" fill="#3b82f6" name="Retardos" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="inasistencias" fill="#ef4444" name="Inasistencias" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="justificadas" fill="#f59e0b" name="Justificadas" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                No hay datos de asistencia disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Estadísticas por Hijo */}
      <div className="grid grid-cols-1 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Estadísticas por Hijo</CardTitle>
            <CardDescription>Información consolidada de cada hijo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {childrenStats.map(child => (
                <div key={child.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg">{child.name}</h4>
                    <div className="flex gap-2">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Talleres</p>
                        <p className="text-2xl font-bold text-purple-600">{child.workshops}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Asistencia</p>
                        <p className={`text-2xl font-bold ${child.attendance >= 80 ? 'text-green-600' : child.attendance >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {child.attendance}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Registros</p>
                        <p className="text-2xl font-bold text-blue-600">{child.totalRecords}</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        child.attendance >= 80
                          ? 'bg-green-600'
                          : child.attendance >= 60
                          ? 'bg-yellow-600'
                          : 'bg-red-600'
                      }`}
                      style={{ width: `${child.attendance}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Talleres por Hijo */}
      <div className="grid grid-cols-1 gap-8 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Talleres Inscritos por Hijo</CardTitle>
            <CardDescription>Detalle de los talleres en los que cada hijo está inscrito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {children.length > 0 ? (
              children.map(child => (
                <div key={child.id} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">{child.name}</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {getChildWorkshops(child.id).map(w => (
                      <li key={w.id}>{w.title || w.name}</li>
                    ))}
                    {getChildWorkshops(child.id).length === 0 && (
                      <li>No está inscrito en talleres.</li>
                    )}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay hijos vinculados. Agrega un hijo para ver sus talleres.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
