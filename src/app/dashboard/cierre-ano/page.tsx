'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useFirebase } from '@/firebase';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, query, where, getDocs, Timestamp, addDoc, deleteDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Calendar,
  Database,
  Trash2,
  Users,
  GraduationCap,
  History,
  Undo,
} from 'lucide-react';
import type { Attendance, User, Workshop } from '@/lib/types';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function CierreAnoPage() {
  const { role } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear().toString());
  const [backupCreated, setBackupCreated] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('');
  const [lastClosedYear, setLastClosedYear] = useState<any | null>(null);

  // Cargar datos
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);
  const attendanceQuery = useMemoFirebase(() => collection(firestore, 'attendance'), [firestore]);
  const { data: allAttendanceData } = useCollection<Attendance>(attendanceQuery);
  const workshopsQuery = useMemoFirebase(() => collection(firestore, 'workshops'), [firestore]);
  const { data: workshops } = useCollection<Workshop>(workshopsQuery);
  
  // Historial de cierres
  const historyQuery = useMemoFirebase(() => query(collection(firestore, 'school_year_history'), orderBy('closedAt', 'desc'), limit(1)), [firestore]);
  const { data: historyData } = useCollection<any>(historyQuery);

  useEffect(() => {
    if (historyData && historyData.length > 0) {
      setLastClosedYear(historyData[0]);
    } else {
      setLastClosedYear(null);
    }
  }, [historyData]);

  const stats = useMemo(() => {
    if (!users || !allAttendanceData || !workshops) return { totalStudents: 0, totalAttendanceRecords: 0, totalUsers: 0, activeWorkshops: 0 };
    return {
      totalStudents: users.filter(u => u.role === 'student').length,
      totalAttendanceRecords: allAttendanceData.reduce((sum, att) => sum + att.records.length, 0),
      totalUsers: users.length,
      activeWorkshops: workshops.filter(w => w.status === 'active').length,
    };
  }, [users, allAttendanceData, workshops]);

  const handleYearEnd = async () => {
    if (confirmationText !== `CERRAR AÑO ${schoolYear}`) {
      toast({ variant: 'destructive', title: 'Confirmación Incorrecta' });
      return;
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const historyRef = doc(firestore, 'school_year_history', schoolYear);

      // Archivar datos
      batch.set(historyRef, { year: schoolYear, closedAt: Timestamp.now(), statistics: stats });
      for (const user of users || []) {
        batch.set(doc(historyRef, 'users', user.id), user);
      }
      for (const attendance of allAttendanceData || []) {
        batch.set(doc(historyRef, 'attendance', attendance.id), attendance);
      }
      for (const workshop of workshops || []) {
        batch.set(doc(historyRef, 'workshops', workshop.id), workshop);
      }

      // Limpiar asistencias
      for (const attendance of allAttendanceData || []) {
        batch.delete(doc(firestore, 'attendance', attendance.id));
      }

      // Promover estudiantes
      const gradePromotionMap: { [key: string]: string | null } = { 'Primero': 'Segundo', 'Segundo': 'Tercero', 'Tercero': 'Cuarto', 'Cuarto': 'Quinto', 'Quinto': 'Sexto', 'Sexto': null };
      for (const user of users || []) {
        if (user.role === 'student') {
          const currentGrade = user.grade;
          const nextGrade = currentGrade ? gradePromotionMap[currentGrade] : '';
          if (nextGrade === null) batch.update(doc(firestore, 'users', user.id), { grade: 'Egresado', section: '' });
          else if (nextGrade) batch.update(doc(firestore, 'users', user.id), { grade: nextGrade, section: '' });
        }
      }

      // Archivar talleres
      for (const workshop of workshops || []) {
        batch.update(doc(firestore, 'workshops', workshop.id), { status: 'inactive', participants: [] });
      }

      await batch.commit();
      toast({ title: 'Cierre de Año Completado' });
      setConfirmationText('');
      setSchoolYear((parseInt(schoolYear) + 1).toString());
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error en el cierre', description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreYear = async () => {
    if (!lastClosedYear) return;
    if (restoreConfirmationText !== `RESTAURAR ${lastClosedYear.year}`) {
        toast({ variant: 'destructive', title: 'Confirmación Incorrecta' });
        return;
    }

    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const historyRef = doc(firestore, 'school_year_history', lastClosedYear.year);

        // Restaurar datos desde el archivo
        const archivedUsers = await getDocs(collection(historyRef, 'users'));
        archivedUsers.forEach(userDoc => batch.set(doc(firestore, 'users', userDoc.id), userDoc.data()));

        const archivedAttendance = await getDocs(collection(historyRef, 'attendance'));
        archivedAttendance.forEach(attDoc => batch.set(doc(firestore, 'attendance', attDoc.id), attDoc.data()));

        const archivedWorkshops = await getDocs(collection(historyRef, 'workshops'));
        archivedWorkshops.forEach(wsDoc => batch.set(doc(firestore, 'workshops', wsDoc.id), wsDoc.data()));

        // Eliminar el archivo de historial
        batch.delete(historyRef);

        await batch.commit();
        toast({ title: 'Restauración Completada' });
        setRestoreConfirmationText('');
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error en la restauración', description: error.message });
    } finally {
        setIsProcessing(false);
    }
  };

  if (role !== 'admin') return <Card><CardHeader><CardTitle>Acceso Denegado</CardTitle></CardHeader></Card>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Gestión de Año Escolar</h1>
        <p className="text-muted-foreground">Administra el ciclo de vida del año escolar.</p>
      </div>

      {lastClosedYear && allAttendanceData?.length === 0 ? (
        <Card className="border-green-500">
            <CardHeader>
                <CardTitle>Restaurar Año Anterior</CardTitle>
                <CardDescription>El sistema detecta que el año {lastClosedYear.year} fue cerrado. Puedes restaurarlo si fue un error.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm"><strong>Año a restaurar:</strong> {lastClosedYear.year}</p>
                <p className="text-sm"><strong>Fecha de cierre:</strong> {format(lastClosedYear.closedAt.toDate(), 'dd/MM/yyyy HH:mm')}</p>
                <Separator />
                <Label htmlFor="restore-confirmation">Escribe <span className="font-bold text-green-600">{`RESTAURAR ${lastClosedYear.year}`}</span> para confirmar:</Label>
                <Input id="restore-confirmation" value={restoreConfirmationText} onChange={(e) => setRestoreConfirmationText(e.target.value)} />
                <Button onClick={handleRestoreYear} disabled={isProcessing || restoreConfirmationText !== `RESTAURAR ${lastClosedYear.year}`} className="w-full bg-green-600 hover:bg-green-700">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo className="mr-2 h-4 w-4" />}
                    Restaurar Año Escolar
                </Button>
            </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Paso 1: Resumen del Año a Cerrar</CardTitle>
                        <CardDescription>Verifica los datos del año escolar actual.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">Usuarios</p><p className="text-2xl font-bold">{stats.totalUsers}</p></div>
                        <div className="p-4 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">Estudiantes</p><p className="text-2xl font-bold">{stats.totalStudents}</p></div>
                        <div className="p-4 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">Talleres</p><p className="text-2xl font-bold">{stats.activeWorkshops}</p></div>
                        <div className="p-4 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">Asistencias</p><p className="text-2xl font-bold">{stats.totalAttendanceRecords}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Acciones del Proceso de Cierre</CardTitle>
                        <CardDescription>Estas son las acciones irreversibles que se ejecutarán.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-4"><div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><GraduationCap className="h-6 w-6"/></div><div><h3 className="font-semibold">Promoción de Estudiantes</h3><p className="text-sm text-muted-foreground">Los estudiantes serán promovidos al siguiente grado.</p></div></div>
                        <Separator/>
                        <div className="flex items-start gap-4"><div className="flex-shrink-0 w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center"><Archive className="h-6 w-6"/></div><div><h3 className="font-semibold">Archivo de Talleres</h3><p className="text-sm text-muted-foreground">Los talleres serán desactivados y sus participantes limpiados.</p></div></div>
                        <Separator/>
                        <div className="flex items-start gap-4"><div className="flex-shrink-0 w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center"><Trash2 className="h-6 w-6"/></div><div><h3 className="font-semibold">Limpieza de Asistencias</h3><p className="text-sm text-muted-foreground">Los registros de asistencia serán archivados y eliminados del sistema activo.</p></div></div>
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Configuración</CardTitle></CardHeader>
                    <CardContent>
                        <Label htmlFor="school-year">Año Escolar a Cerrar</Label>
                        <Input id="school-year" type="number" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} />
                    </CardContent>
                </Card>
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle>Paso 2: Confirmación Final</CardTitle>
                        <CardDescription>Esta acción archivará los datos del año actual.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="confirmation-text">Escribe <span className="font-bold text-destructive">{`CERRAR AÑO ${schoolYear}`}</span> para confirmar:</Label>
                            <Input id="confirmation-text" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} placeholder={`CERRAR AÑO ${schoolYear}`} />
                        </div>
                        <Button onClick={handleYearEnd} disabled={isProcessing || confirmationText !== `CERRAR AÑO ${schoolYear}`} className="w-full bg-destructive hover:bg-destructive/90">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                            Ejecutar Cierre de Año
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
      )}
    </div>
  );
}
