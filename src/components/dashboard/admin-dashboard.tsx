'use client';
import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  CheckCircle,
  Bell,
  ArrowUp,
  RefreshCw,
  ArrowRight,
  GraduationCap,
  UserCheck,
  UserX,
  Clock,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { User, Attendance } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: string;
  trendColor?: string;
}

function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  trendColor = 'text-green-500',
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className={`text-xs flex items-center mt-1 ${trendColor}`}>
            <ArrowUp className="h-3 w-3 mr-1" />
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface Aviso {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  targetAudience: 'all' | 'students' | 'parents' | 'teachers';
  createdAt?: { seconds: number; nanoseconds: number };
  createdBy?: string;
  active?: boolean;
}

export function AdminDashboard() {
  const { firestore } = useFirebase();

  // Cargar datos de Firebase
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  const attendanceQuery = useMemoFirebase(() => collection(firestore, 'attendance'), [firestore]);
  const { data: allAttendanceData } = useCollection<Attendance>(attendanceQuery);

  const avisosQuery = useMemoFirebase(() => collection(firestore, 'avisos'), [firestore]);
  const { data: avisos } = useCollection<Aviso>(avisosQuery);

  // Calcular estadísticas
  const stats = useMemo(() => {
    const students = users?.filter(u => u.role === 'student') || [];
    const teachers = users?.filter(u => u.role === 'teacher') || [];
    const parents = users?.filter(u => u.role === 'parent') || [];
    
    const totalRecords = allAttendanceData?.reduce((sum, att) => sum + att.records.length, 0) || 0;
    const presentCount = allAttendanceData?.reduce((sum, att) => 
      sum + att.records.filter(r => r.status === 'present').length, 0
    ) || 0;
    const lateCount = allAttendanceData?.reduce((sum, att) => 
      sum + att.records.filter(r => r.status === 'late').length, 0
    ) || 0;
    const absentCount = allAttendanceData?.reduce((sum, att) => 
      sum + att.records.filter(r => r.status === 'absent').length, 0
    ) || 0;
    const justifiedCount = allAttendanceData?.reduce((sum, att) => 
      sum + att.records.filter(r => r.status === 'justified').length, 0
    ) || 0;

    const attendanceRate = totalRecords > 0 
      ? ((presentCount + lateCount) / totalRecords * 100).toFixed(1)
      : '0';

    const activeAvisos = avisos?.filter(a => a.active !== false).length || 0;

    return {
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalParents: parents.length,
      attendanceRate,
      presentCount,
      lateCount,
      absentCount,
      justifiedCount,
      totalRecords,
      activeAvisos,
    };
  }, [users, allAttendanceData, avisos]);

  // Datos para gráfico de asistencia
  const attendanceChartData = useMemo(() => {
    if (stats.totalRecords === 0) return [];
    
    return [
      { name: 'Presentes', value: stats.presentCount, fill: '#10b981' },
      { name: 'Tardanzas', value: stats.lateCount, fill: '#f59e0b' },
      { name: 'Ausentes', value: stats.absentCount, fill: '#ef4444' },
      { name: 'Justificadas', value: stats.justifiedCount, fill: '#3b82f6' },
    ].filter(item => item.value > 0);
  }, [stats]);

  // Datos para gráfico de usuarios
  const usersChartData = useMemo(() => [
    { name: 'Estudiantes', value: stats.totalStudents, fill: '#8b5cf6' },
    { name: 'Profesores', value: stats.totalTeachers, fill: '#3b82f6' },
    { name: 'Padres', value: stats.totalParents, fill: '#10b981' },
  ], [stats]);

  // Avisos recientes (últimos 3)
  const recentAvisos = useMemo(() => {
    if (!avisos) return [];
    
    return avisos
      .filter(a => a.active !== false)
      .sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.seconds - a.createdAt.seconds;
      })
      .slice(0, 3);
  }, [avisos]);

  // Asistencias por grado (últimos 7 días)
  const gradeAttendanceData = useMemo(() => {
    if (!allAttendanceData || !users) return [];

    const gradeOrder = ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto'];
    const students = users.filter(u => u.role === 'student');
    const uniqueGrades = Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[];
    const sortedGrades = uniqueGrades.sort((a, b) => {
      const indexA = gradeOrder.indexOf(a.toLowerCase());
      const indexB = gradeOrder.indexOf(b.toLowerCase());
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      return a.localeCompare(b);
    });

    return sortedGrades.map(grade => {
      const gradeAttendances = allAttendanceData.filter(a => a.grade === grade);
      const total = gradeAttendances.reduce((sum, att) => sum + att.records.length, 0);
      const present = gradeAttendances.reduce((sum, att) => 
        sum + att.records.filter(r => r.status === 'present').length, 0
      );
      const rate = total > 0 ? ((present / total) * 100).toFixed(0) : 0;

      return {
        name: grade,
        asistencia: Number(rate),
      };
    });
  }, [allAttendanceData, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Panel de Administración
          </h1>
          <p className="text-muted-foreground">Resumen general del sistema</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Estadísticas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Estudiantes"
          value={stats.totalStudents}
          icon={<Users className="h-5 w-5" />}
          description="Estudiantes registrados"
        />
        <StatCard
          title="Tasa de Asistencia"
          value={`${stats.attendanceRate}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          description="Promedio general"
          trend={`${stats.totalRecords} registros`}
          trendColor="text-blue-500"
        />
        <StatCard
          title="Profesores"
          value={stats.totalTeachers}
          icon={<GraduationCap className="h-5 w-5" />}
          description="Docentes activos"
        />
        <StatCard
          title="Avisos Activos"
          value={stats.activeAvisos}
          icon={<Bell className="h-5 w-5" />}
          description="Anuncios publicados"
        />
      </div>

      {/* Resumen rápido de asistencia */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              Presentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.presentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Tardanzas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lateCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-500" />
              Ausentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              Justificadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.justifiedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Estadísticas</CardTitle>
            <CardDescription>Visualización de datos del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="asistencia">
              <div className="flex justify-center">
                <TabsList>
                  <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
                  <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
                  <TabsTrigger value="grados">Por Grado</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="asistencia" className="mt-6">
                <h3 className="text-center font-semibold text-lg mb-4">
                  Distribución de Asistencia
                </h3>
                {attendanceChartData.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <PieChart>
                        <Tooltip />
                        <Pie
                          data={attendanceChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {attendanceChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    No hay datos de asistencia registrados
                  </div>
                )}
              </TabsContent>

              <TabsContent value="usuarios" className="mt-6">
                <h3 className="text-center font-semibold text-lg mb-4">
                  Distribución de Usuarios
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Tooltip />
                      <Pie
                        data={usersChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {usersChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              <TabsContent value="grados" className="mt-6">
                <h3 className="text-center font-semibold text-lg mb-4">
                  Tasa de Asistencia por Grado
                </h3>
                {gradeAttendanceData.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer>
                      <BarChart data={gradeAttendanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis unit="%" />
                        <Tooltip />
                        <Bar dataKey="asistencia" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    No hay datos suficientes
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Avisos recientes */}
        <Card>
          <CardHeader>
            <CardTitle>Avisos Recientes</CardTitle>
            <CardDescription>Últimos anuncios publicados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {recentAvisos.length > 0 ? (
              recentAvisos.map((aviso) => (
                <div key={aviso.id}>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm line-clamp-2">{aviso.title}</h4>
                    {aviso.createdAt && (
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(aviso.createdAt.seconds * 1000), 'dd/MM/yy')}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {aviso.message}
                  </p>
                  <Link href="/dashboard/avisos">
                    <Button variant="link" className="p-0 h-auto text-accent mt-2">
                      Ver todos <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No hay avisos publicados
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
