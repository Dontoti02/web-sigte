'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useFirebase } from '@/firebase';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, doc, query, where, getDocs, Timestamp, addDoc, deleteDoc, getDoc, orderBy, limit, updateDoc } from 'firebase/firestore';
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  FileText,
  Shield,
  Clock,
} from 'lucide-react';
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
import type { Attendance, User, Workshop } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [schoolYear, setSchoolYear] = useState(new Date().getFullYear().toString());
  const [confirmationText, setConfirmationText] = useState('');
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('');
  const [lastClosedYear, setLastClosedYear] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Cargar datos
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);
  const attendanceQuery = useMemoFirebase(() => collection(firestore, 'attendance'), [firestore]);
  const { data: allAttendanceData } = useCollection<Attendance>(attendanceQuery);
  const workshopsQuery = useMemoFirebase(() => collection(firestore, 'workshops'), [firestore]);
  const { data: workshops } = useCollection<Workshop>(workshopsQuery);
  
  // Historial de cierres
  const historyQuery = useMemoFirebase(() => query(collection(firestore, 'school_year_history'), orderBy('closedAt', 'desc')), [firestore]);
  const { data: historyData } = useCollection<any>(historyQuery);

  useEffect(() => {
    if (historyData && historyData.length > 0) {
      setLastClosedYear(historyData[0]);
    } else {
      setLastClosedYear(null);
    }
  }, [historyData]);

  const stats = useMemo(() => {
    if (!users || !allAttendanceData || !workshops) return { 
      totalStudents: 0, 
      totalAttendanceRecords: 0, 
      totalUsers: 0, 
      activeWorkshops: 0,
      teachers: 0,
      parents: 0,
      studentsToPromote: 0,
      studentsToGraduate: 0
    };
    
    const students = users.filter(u => u.role === 'student');
    const gradePromotionMap: { [key: string]: string | null } = {
      'PRIMERO': 'SEGUNDO',
      'SEGUNDO': 'TERCERO', 
      'TERCERO': 'CUARTO',
      'CUARTO': 'QUINTO',
      'QUINTO': null // Graduados
    };
    
    const studentsToGraduate = students.filter(s => gradePromotionMap[s.grade || ''] === null).length;
    const studentsToPromote = students.filter(s => gradePromotionMap[s.grade || ''] !== null && gradePromotionMap[s.grade || ''] !== undefined).length;
    
    return {
      totalStudents: students.length,
      totalAttendanceRecords: allAttendanceData.reduce((sum, att) => sum + att.records.length, 0),
      totalUsers: users.length,
      activeWorkshops: workshops.filter(w => w.status === 'active').length,
      teachers: users.filter(u => u.role === 'teacher').length,
      parents: users.filter(u => u.role === 'parent').length,
      studentsToPromote,
      studentsToGraduate
    };
  }, [users, allAttendanceData, workshops]);

  const handleYearEnd = async () => {
    if (confirmationText !== `CERRAR AÑO ${schoolYear}`) {
      toast({ variant: 'destructive', title: 'Confirmación Incorrecta', description: 'Debes escribir exactamente el texto solicitado' });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    try {
      // Paso 1: Crear respaldo
      setCurrentStep('Creando respaldo de datos...');
      setProgress(10);
      
      const historyRef = doc(firestore, 'school_year_history', schoolYear);
      const batch = writeBatch(firestore);
      
      // Guardar metadatos del cierre
      batch.set(historyRef, { 
        year: schoolYear, 
        closedAt: Timestamp.now(), 
        statistics: stats,
        closedBy: 'admin',
        description: `Cierre automático del año escolar ${schoolYear}`
      });
      
      setProgress(20);
      
      // Paso 2: Archivar usuarios
      setCurrentStep('Archivando usuarios...');
      const usersBatch = writeBatch(firestore);
      for (const user of users || []) {
        usersBatch.set(doc(collection(historyRef, 'users'), user.id), user);
      }
      await usersBatch.commit();
      setProgress(40);

      // Paso 3: Archivar asistencias
      setCurrentStep('Archivando registros de asistencia...');
      const attendanceBatch = writeBatch(firestore);
      for (const attendance of allAttendanceData || []) {
        attendanceBatch.set(doc(collection(historyRef, 'attendance'), attendance.id || `att_${Date.now()}_${Math.random()}`), attendance);
      }
      await attendanceBatch.commit();
      setProgress(60);

      // Paso 4: Archivar talleres
      setCurrentStep('Archivando talleres...');
      const workshopsBatch = writeBatch(firestore);
      for (const workshop of workshops || []) {
        workshopsBatch.set(doc(collection(historyRef, 'workshops'), workshop.id), workshop);
      }
      await workshopsBatch.commit();
      setProgress(70);

      // Paso 5: Promover estudiantes
      setCurrentStep('Promoviendo estudiantes...');
      const promotionBatch = writeBatch(firestore);
      const gradePromotionMap: { [key: string]: string | null } = {
        'PRIMERO': 'SEGUNDO',
        'SEGUNDO': 'TERCERO', 
        'TERCERO': 'CUARTO',
        'CUARTO': 'QUINTO',
        'QUINTO': null // Graduados
      };
      
      for (const user of users || []) {
        if (user.role === 'student') {
          const currentGrade = user.grade?.toUpperCase();
          const nextGrade = currentGrade ? gradePromotionMap[currentGrade] : null;
          
          if (nextGrade === null && currentGrade === 'QUINTO') {
            // Graduados
            promotionBatch.update(doc(firestore, 'users', user.id), { 
              grade: 'GRADUADO', 
              section: '',
              graduatedYear: schoolYear
            });
          } else if (nextGrade) {
            // Promover al siguiente grado
            promotionBatch.update(doc(firestore, 'users', user.id), { 
              grade: nextGrade, 
              section: '' // Resetear sección para reasignación
            });
          }
        }
      }
      await promotionBatch.commit();
      setProgress(85);

      // Paso 6: Limpiar datos del año actual
      setCurrentStep('Limpiando datos del año actual...');
      const cleanupBatch = writeBatch(firestore);
      
      // Limpiar asistencias
      for (const attendance of allAttendanceData || []) {
        if (attendance.id) {
          cleanupBatch.delete(doc(firestore, 'attendance', attendance.id));
        }
      }
      
      // Desactivar talleres y limpiar participantes
      for (const workshop of workshops || []) {
        cleanupBatch.update(doc(firestore, 'workshops', workshop.id), { 
          status: 'inactive', 
          participants: [],
          archivedYear: schoolYear
        });
      }
      
      await cleanupBatch.commit();
      await batch.commit();
      
      setProgress(100);
      setCurrentStep('¡Cierre completado exitosamente!');
      
      toast({ 
        title: 'Cierre de Año Completado', 
        description: `El año ${schoolYear} ha sido cerrado y archivado correctamente.` 
      });
      
      setConfirmationText('');
      setSchoolYear((parseInt(schoolYear) + 1).toString());
      
    } catch (error: any) {
      console.error('Error en el cierre de año:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Error en el cierre', 
        description: error.message || 'Ocurrió un error durante el proceso de cierre' 
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  const handleRestoreYear = async () => {
    if (!lastClosedYear) return;
    if (restoreConfirmationText !== `RESTAURAR ${lastClosedYear.year}`) {
        toast({ variant: 'destructive', title: 'Confirmación Incorrecta', description: 'Debes escribir exactamente el texto solicitado' });
        return;
    }

    setIsProcessing(true);
    setProgress(0);
    setCurrentStep('Iniciando restauración...');
    
    try {
      // Esta función requiere implementación cuidadosa para evitar pérdida de datos
      toast({ 
        variant: 'destructive', 
        title: 'Función no disponible', 
        description: 'La restauración requiere implementación manual por seguridad.' 
      });
      setRestoreConfirmationText('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error en la restauración', description: error.message });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentStep('');
    }
  };

  const exportYearData = async () => {
    if (!users || !allAttendanceData || !workshops) {
      toast({ variant: 'destructive', title: 'Error', description: 'No hay datos para exportar' });
      return;
    }

    try {
      // Crear workbook de Excel
      const wb = XLSX.utils.book_new();

      // Hoja de estudiantes
      const studentsData = users
        .filter(u => u.role === 'student')
        .map(student => ({
          'Nombre Completo': student.displayName || `${student.lastName}, ${student.firstName}`,
          'Email': student.email,
          'Grado': student.grade || 'Sin asignar',
          'Sección': student.section || 'Sin asignar'
        }));
      
      const studentsWs = XLSX.utils.json_to_sheet(studentsData);
      XLSX.utils.book_append_sheet(wb, studentsWs, 'Estudiantes');

      // Hoja de talleres
      const workshopsData = workshops.map(workshop => ({
        'Título': workshop.title,
        'Docente': workshop.teacherName,
        'Estado': workshop.status === 'active' ? 'Activo' : 'Inactivo',
        'Participantes': workshop.participants.length,
        'Capacidad Máxima': workshop.maxParticipants,
        'Horario': workshop.schedule
      }));
      
      const workshopsWs = XLSX.utils.json_to_sheet(workshopsData);
      XLSX.utils.book_append_sheet(wb, workshopsWs, 'Talleres');

      // Hoja de estadísticas
      const statsData = [
        { 'Concepto': 'Total de Estudiantes', 'Cantidad': stats.totalStudents },
        { 'Concepto': 'Total de Docentes', 'Cantidad': stats.teachers },
        { 'Concepto': 'Total de Padres', 'Cantidad': stats.parents },
        { 'Concepto': 'Talleres Activos', 'Cantidad': stats.activeWorkshops },
        { 'Concepto': 'Registros de Asistencia', 'Cantidad': stats.totalAttendanceRecords },
        { 'Concepto': 'Estudiantes a Promover', 'Cantidad': stats.studentsToPromote },
        { 'Concepto': 'Estudiantes a Graduar', 'Cantidad': stats.studentsToGraduate }
      ];
      
      const statsWs = XLSX.utils.json_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, statsWs, 'Estadísticas');

      // Descargar archivo
      const fileName = `Reporte_Año_${schoolYear}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({ 
        title: 'Exportación Exitosa', 
        description: `Los datos han sido exportados a ${fileName}` 
      });
      
    } catch (error: any) {
      console.error('Error exportando datos:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Error de Exportación', 
        description: error.message || 'No se pudieron exportar los datos' 
      });
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
        <>
          {/* Estadísticas del año actual */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalStudents}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.studentsToPromote} a promover, {stats.studentsToGraduate} a graduar
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Talleres Activos</CardTitle>
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeWorkshops}</div>
                <p className="text-xs text-muted-foreground">
                  {workshops?.length || 0} talleres totales
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Registros de Asistencia</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalAttendanceRecords}</div>
                <p className="text-xs text-muted-foreground">
                  Registros del año actual
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Personal</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.teachers + stats.parents}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.teachers} docentes, {stats.parents} padres
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Acciones rápidas */}
          <div className="flex flex-wrap gap-4">
            <Button onClick={exportYearData} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar Datos del Año
            </Button>
            <Button onClick={() => setShowPreview(!showPreview)} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              {showPreview ? 'Ocultar' : 'Ver'} Vista Previa
            </Button>
          </div>

          {/* Vista previa de promociones */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle>Vista Previa de Promociones</CardTitle>
                <CardDescription>
                  Estudiantes que serán promovidos o graduados al cerrar el año
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>Grado Actual</TableHead>
                        <TableHead>Nuevo Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.filter(u => u.role === 'student').map(student => {
                        const currentGrade = student.grade?.toUpperCase();
                        const gradeMap: { [key: string]: string | null } = {
                          'PRIMERO': 'SEGUNDO',
                          'SEGUNDO': 'TERCERO',
                          'TERCERO': 'CUARTO',
                          'CUARTO': 'QUINTO',
                          'QUINTO': 'GRADUADO'
                        };
                        const nextStatus = currentGrade ? gradeMap[currentGrade] : 'Sin cambio';
                        
                        return (
                          <TableRow key={student.id}>
                            <TableCell>
                              {student.displayName || `${student.lastName}, ${student.firstName}`}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{student.grade || 'Sin asignar'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={nextStatus === 'GRADUADO' ? 'default' : 'secondary'}>
                                {nextStatus || 'Sin cambio'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Proceso de Cierre de Año</CardTitle>
                        <CardDescription>Acciones que se ejecutarán durante el cierre</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isProcessing && (
                          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              <div>
                                <p className="font-semibold">{currentStep}</p>
                                <p className="text-sm text-muted-foreground">Progreso: {progress}%</p>
                              </div>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        )}
                        
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                            <Database className="h-5 w-5"/>
                          </div>
                          <div>
                            <h3 className="font-semibold">1. Crear Respaldo</h3>
                            <p className="text-sm text-muted-foreground">Se archivan todos los datos del año actual</p>
                          </div>
                        </div>
                        
                        <Separator/>
                        
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                            <GraduationCap className="h-5 w-5"/>
                          </div>
                          <div>
                            <h3 className="font-semibold">2. Promover Estudiantes</h3>
                            <p className="text-sm text-muted-foreground">{stats.studentsToPromote} estudiantes promovidos, {stats.studentsToGraduate} graduados</p>
                          </div>
                        </div>
                        
                        <Separator/>
                        
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                            <Archive className="h-5 w-5"/>
                          </div>
                          <div>
                            <h3 className="font-semibold">3. Archivar Talleres</h3>
                            <p className="text-sm text-muted-foreground">Los talleres se desactivan y se limpian participantes</p>
                          </div>
                        </div>
                        
                        <Separator/>
                        
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                            <Trash2 className="h-5 w-5"/>
                          </div>
                          <div>
                            <h3 className="font-semibold">4. Limpiar Asistencias</h3>
                            <p className="text-sm text-muted-foreground">Se eliminan {stats.totalAttendanceRecords} registros de asistencia</p>
                          </div>
                        </div>
                    </CardContent>
                </Card>
                
                {/* Historial de cierres anteriores */}
                {historyData && historyData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Historial de Cierres</CardTitle>
                      <CardDescription>Años escolares cerrados anteriormente</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {historyData.slice(0, 5).map((history: any) => (
                          <div key={history.year} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">Año {history.year}</p>
                              <p className="text-sm text-muted-foreground">
                                Cerrado el {format(history.closedAt.toDate(), 'dd/MM/yyyy', { locale: es })}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              <History className="mr-1 h-3 w-3" />
                              Archivado
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
            </div>
            
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                      <CardTitle>Configuración</CardTitle>
                      <CardDescription>Ajusta los parámetros del cierre</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="school-year">Año Escolar a Cerrar</Label>
                          <Input 
                            id="school-year" 
                            type="number" 
                            value={schoolYear} 
                            onChange={(e) => setSchoolYear(e.target.value)} 
                            disabled={isProcessing}
                          />
                        </div>
                    </CardContent>
                </Card>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Card className="border-destructive cursor-pointer hover:bg-destructive/5 transition-colors">
                      <CardHeader>
                          <CardTitle className="text-destructive">Ejecutar Cierre de Año</CardTitle>
                          <CardDescription>Esta acción es irreversible y archivará todos los datos</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertTriangle className="h-4 w-4" />
                            Haz clic para proceder con el cierre
                          </div>
                      </CardContent>
                    </Card>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Cierre de Año {schoolYear}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción archivará todos los datos del año actual y promoverá a los estudiantes.
                        <br /><br />
                        <strong>Acciones que se ejecutarán:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>{stats.studentsToPromote} estudiantes serán promovidos</li>
                          <li>{stats.studentsToGraduate} estudiantes se graduarán</li>
                          <li>{stats.totalAttendanceRecords} registros de asistencia se archivarán</li>
                          <li>{stats.activeWorkshops} talleres se desactivarán</li>
                        </ul>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="confirmation-text">
                          Escribe <span className="font-bold text-destructive">{`CERRAR AÑO ${schoolYear}`}</span> para confirmar:
                        </Label>
                        <Input 
                          id="confirmation-text" 
                          value={confirmationText} 
                          onChange={(e) => setConfirmationText(e.target.value)} 
                          placeholder={`CERRAR AÑO ${schoolYear}`}
                          disabled={isProcessing}
                        />
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleYearEnd} 
                        disabled={isProcessing || confirmationText !== `CERRAR AÑO ${schoolYear}`}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <Archive className="mr-2 h-4 w-4" />
                            Ejecutar Cierre
                          </>
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
