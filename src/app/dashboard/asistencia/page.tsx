
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { workshops as allWorkshopsData, students as allStudents, attendance as initialAttendance } from '@/lib/data';
import type { AttendanceRecord, AttendanceStatus, Workshop, Student, User, Attendance } from '@/lib/types';
import { useRole } from '@/hooks/use-role';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Loader2, Search, Calendar, Clock, Filter as FilterIcon, Trash2, AlertCircle, CheckCheck, BookMarked, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkAttendanceUploadProps {
  onUploadComplete: () => void;
  selectedGrade: string;
  selectedSection: string;
}

function BulkAttendanceUpload({ onUploadComplete, selectedGrade, selectedSection }: BulkAttendanceUploadProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingAttendanceData, setPendingAttendanceData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedGrade || !selectedSection) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debes seleccionar un grado y sección primero.',
      });
      return;
    }

    setIsProcessing(true);
    setUploadedCount(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const allStudents = users?.filter((user) => user.role === 'student' && user.grade === selectedGrade && user.section === selectedSection);

      if (!allStudents || allStudents.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No hay estudiantes registrados en este grado y sección.',
        });
        setIsProcessing(false);
        return;
      }

      const attendanceRecords: AttendanceRecord[] = [];
      let processedCount = 0;

      // Procesar cada fila del Excel
      for (const row of jsonData as any[]) {
        const apellidos = row['Apellidos']?.toString().trim().toLowerCase();
        const nombres = row['Nombres']?.toString().trim().toLowerCase();
        const fecha = row['Fecha']?.toString().trim();
        const hora = row['Hora']?.toString().trim();

        if (!apellidos || !nombres) continue;

        // Buscar estudiante en la base de datos
        const student = allStudents.find(s => {
          const studentLastName = (s.lastName || s.apellidoPaterno || '').toLowerCase();
          const studentFirstName = (s.firstName || '').toLowerCase();
          
          return studentLastName.includes(apellidos) || apellidos.includes(studentLastName) ||
                 studentFirstName.includes(nombres) || nombres.includes(studentFirstName);
        });

        if (student) {
          // Si tiene fecha y hora, está presente
          const status: AttendanceStatus = (fecha && hora) ? 'present' : 'none';
          
          attendanceRecords.push({
            studentId: student.id,
            studentName: student.displayName || `${student.lastName}, ${student.firstName}` || student.name,
            status: status,
            registeredDate: fecha || '',
            registeredTime: hora || '',
          });
          
          if (status === 'present') {
            processedCount++;
          }
        }
      }

      // Validar que se haya encontrado al menos un estudiante
      if (processedCount === 0 && attendanceRecords.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No se encontraron estudiantes',
          description: `No se encontró ningún estudiante del Excel en ${selectedGrade} - ${selectedSection}. Verifica que el archivo corresponda al grado y sección correctos.`,
        });
        setIsProcessing(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Obtener hora actual para los ausentes
      const currentTime = format(new Date(), 'HH:mm');
      
      // Agregar estudiantes que no están en el Excel con estado 'absent' (Faltó)
      for (const student of allStudents) {
        const existsInRecords = attendanceRecords.find(r => r.studentId === student.id);
        if (!existsInRecords) {
          attendanceRecords.push({
            studentId: student.id,
            studentName: student.displayName || `${student.lastName}, ${student.firstName}` || student.name,
            status: 'absent',
            registeredDate: '',
            registeredTime: currentTime, // Hora del momento en que se guarda
          });
        }
      }

      // Ordenar por nombre
      attendanceRecords.sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));

      // Determinar la fecha a usar (primera fecha encontrada en el Excel o hoy)
      let attendanceDate = format(new Date(), 'yyyy-MM-dd');
      let attendanceDateFormatted = '';
      const firstRecordWithDate = attendanceRecords.find(r => r.registeredDate);
      if (firstRecordWithDate && firstRecordWithDate.registeredDate) {
        try {
          // Intentar parsear la fecha del Excel
          const excelDate = firstRecordWithDate.registeredDate;
          attendanceDateFormatted = excelDate; // Guardar formato original para mostrar
          // Asumir formato dd/mm/yyyy o similar
          const dateParts = excelDate.split('/');
          if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const month = dateParts[1].padStart(2, '0');
            const year = dateParts[2];
            attendanceDate = `${year}-${month}-${day}`;
          }
        } catch (error) {
          // Si falla el parseo, usar fecha actual
          attendanceDate = format(new Date(), 'yyyy-MM-dd');
          attendanceDateFormatted = format(new Date(), 'dd/MM/yyyy');
        }
      } else {
        attendanceDateFormatted = format(new Date(), 'dd/MM/yyyy');
      }

      // Actualizar todos los registros con la misma fecha de asistencia
      attendanceRecords.forEach(record => {
        // Si no tiene fecha (ausentes), asignarles la fecha del día
        if (!record.registeredDate) {
          record.registeredDate = attendanceDateFormatted;
        }
      });

      const absentCount = allStudents.length - processedCount;
      setUploadedCount(processedCount);
      
      // Guardar datos pendientes y mostrar confirmación
      setPendingAttendanceData({
        attendanceRecords,
        attendanceDate,
        attendanceDateFormatted,
        processedCount,
        absentCount,
        totalStudents: allStudents.length
      });
      
      setShowConfirmation(true);
      setIsProcessing(false);

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al procesar archivo',
        description: error.message || 'Ocurrió un error al procesar el archivo Excel.',
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmSave = async () => {
    if (!pendingAttendanceData) return;

    try {
      const attendanceDocId = `${selectedGrade}_${selectedSection}_${pendingAttendanceData.attendanceDate}`;
      const attendanceRef = doc(firestore, 'attendance', attendanceDocId);
      
      await setDoc(attendanceRef, {
        date: pendingAttendanceData.attendanceDate,
        grade: selectedGrade,
        section: selectedSection,
        records: pendingAttendanceData.attendanceRecords,
      });

      toast({
        title: 'Asistencia Guardada',
        description: `${pendingAttendanceData.processedCount} estudiantes presentes • ${pendingAttendanceData.absentCount} estudiantes marcados como ausentes`,
      });

      setShowConfirmation(false);
      setPendingAttendanceData(null);
      setIsOpen(false);
      onUploadComplete();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error.message || 'No se pudo guardar la asistencia.',
      });
    }
  };

  const handleCancelSave = () => {
    toast({
      title: 'Importación Cancelada',
      description: 'No se guardó la asistencia en la base de datos.',
    });
    setShowConfirmation(false);
    setPendingAttendanceData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!selectedGrade || !selectedSection}>
          <Upload className="mr-2 h-4 w-4" />
          Importar Asistencia desde Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Importar Asistencia Masiva</DialogTitle>
          <DialogDescription>
            Importando para: <strong>{selectedGrade} - Sección {selectedSection}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>¡Importante!</strong> Los estudiantes se importarán para <strong>{selectedGrade} - Sección {selectedSection}</strong>. 
              Verifica que sea el grado y sección correctos antes de continuar.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label>Archivo Excel</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Seleccionar archivo Excel
                  </>
                )}
              </Button>
            </div>
          </div>

          {uploadedCount > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ {uploadedCount} estudiantes registrados como presentes
              </p>
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-semibold">Formato del Excel:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Columna "Apellidos": Apellidos del estudiante</li>
              <li>Columna "Nombres": Nombres del estudiante</li>
              <li>Columna "Fecha": Fecha de asistencia (opcional)</li>
              <li>Columna "Hora": Hora de asistencia (opcional)</li>
            </ul>
            <p className="text-xs mt-2 font-semibold text-primary">
              ✓ Estudiantes con Fecha y Hora → Marcados como "Presente"
            </p>
            <p className="text-xs text-destructive font-semibold">
              ✗ Estudiantes NO listados en el Excel → Marcados como "Faltó"
            </p>
            <p className="text-xs mt-2">
              La fecha de asistencia será la misma que aparece en el Excel.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Diálogo de Confirmación */}
    <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Guardar Asistencia?</AlertDialogTitle>
          <AlertDialogDescription>
            Revisa el resumen antes de guardar en la base de datos
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {pendingAttendanceData && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Grado y Sección</p>
                <p className="text-2xl font-bold">{selectedGrade} - {selectedSection}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Fecha</p>
                <p className="text-2xl font-bold">{pendingAttendanceData.attendanceDateFormatted}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium">Presentes</p>
                <p className="text-3xl font-bold text-green-600">{pendingAttendanceData.processedCount}</p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-medium">Ausentes</p>
                <p className="text-3xl font-bold text-red-600">{pendingAttendanceData.absentCount}</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700 font-medium">Total de Estudiantes</p>
              <p className="text-2xl font-bold text-blue-600">{pendingAttendanceData.totalStudents}</p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Esta acción guardará la asistencia en la base de datos. Verifica que los datos sean correctos.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelSave}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmSave} className="bg-accent hover:bg-accent/90">
            Guardar Asistencia
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function AdminTeacherAttendance() {
  const { user, role } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTimeFrom, setFilterTimeFrom] = useState<string>('');
  const [filterTimeTo, setFilterTimeTo] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<string>('');
  const [gradeToDelete, setGradeToDelete] = useState<string>('');
  const [sectionToDelete, setSectionToDelete] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  const attendanceQuery = useMemoFirebase(() => collection(firestore, 'attendance'), [firestore]);
  const { data: allAttendanceData } = useCollection<Attendance>(attendanceQuery);

  const allStudents = users?.filter((user) => user.role === 'student');

  // Get unique grades and sections
  const gradeOrder = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', '1°', '2°', '3°', '4°', '5°'];
  const uniqueGrades = Array.from(new Set(allStudents?.map(s => s.grade).filter(Boolean))) as string[];
  const sortedGrades = uniqueGrades.sort((a, b) => {
    const indexA = gradeOrder.indexOf(a);
    const indexB = gradeOrder.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b, 'es');
  });

  const uniqueSections = Array.from(new Set(allStudents?.map(s => s.section).filter(Boolean))) as string[];

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade);
    setSelectedSection('');
    setAttendanceRecords([]);
  };

  const loadAttendanceRecords = async (grade: string, section: string, date?: string) => {
    // Filter students by grade and section
    const filteredStudents = allStudents?.filter(
      s => s.grade === grade && s.section === section
    );

    // Use selected date or today
    const targetDate = date || selectedDate;
    const attendanceDocId = `${grade}_${section}_${targetDate}`;
    
    try {
      const attendanceRef = doc(firestore, 'attendance', attendanceDocId);
      const attendanceSnap = await import('firebase/firestore').then(m => m.getDoc(attendanceRef));
      
      if (attendanceSnap.exists()) {
        // Load existing records
        const data = attendanceSnap.data() as Attendance;
        setAttendanceRecords(data.records);
      } else {
        // Create new records with default status 'none' and empty date/time
        const records = filteredStudents?.map(student => ({
          studentId: student.id,
          studentName: student.displayName || `${student.lastName}, ${student.firstName}` || student.name,
          status: 'none' as AttendanceStatus,
          registeredDate: '',
          registeredTime: '',
        })) || [];

        // Sort by last name
        records.sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));
        setAttendanceRecords(records);
      }
    } catch (error) {
      // If error, create default records with empty date/time
      const records = filteredStudents?.map(student => ({
        studentId: student.id,
        studentName: student.displayName || `${student.lastName}, ${student.firstName}` || student.name,
        status: 'none' as AttendanceStatus,
        registeredDate: '',
        registeredTime: '',
      })) || [];
      records.sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));
      setAttendanceRecords(records);
    }
  };

  const handleSectionChange = (section: string) => {
    setSelectedSection(section);
    loadAttendanceRecords(selectedGrade, section, selectedDate);
    loadAvailableDates(selectedGrade, section);
  };

  const loadAvailableDates = (grade: string, section: string) => {
    if (!allAttendanceData) return;
    
    const dates = allAttendanceData
      .filter(a => a.grade === grade && a.section === section)
      .map(a => a.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    setAvailableDates(dates);
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (selectedGrade && selectedSection) {
      loadAttendanceRecords(selectedGrade, selectedSection, date);
    }
  };

  const handleUploadComplete = () => {
    setRefreshKey(prev => prev + 1);
    loadAttendanceRecords(selectedGrade, selectedSection, selectedDate);
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceRecords(prev =>
      prev.map(rec => (rec.studentId === studentId ? { ...rec, status } : rec))
    );
  };

  const validateAttendance = () => {
    // Validar que no haya estudiantes sin asistencia registrada
    const studentsWithoutAttendance = attendanceRecords.filter(r => r.status === 'none');
    if (studentsWithoutAttendance.length > 0) {
      return {
        valid: false,
        message: `Hay ${studentsWithoutAttendance.length} estudiante(s) sin asistencia registrada. Debes marcar el estado de todos los estudiantes antes de guardar.`
      };
    }

    // Validar que la fecha no sea futura
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    
    if (selectedDateObj > today) {
      return {
        valid: false,
        message: 'No puedes registrar asistencia para fechas futuras.'
      };
    }

    // Validar que solo se pueda editar hasta 2 días atrás
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    if (selectedDateObj < twoDaysAgo) {
      return {
        valid: false,
        message: 'Solo puedes editar asistencias de los últimos 2 días.'
      };
    }

    return { valid: true, message: '' };
  };

  const saveAttendance = async () => {
    if (!selectedGrade || !selectedSection) return;

    // Validar antes de guardar
    const validation = validateAttendance();
    if (!validation.valid) {
      toast({
        variant: 'destructive',
        title: 'No se puede guardar',
        description: validation.message,
      });
      return;
    }

    const attendanceDocId = `${selectedGrade}_${selectedSection}_${selectedDate}`;
    
    try {
        const attendanceRef = doc(firestore, 'attendance', attendanceDocId);
        await setDoc(attendanceRef, {
            date: selectedDate,
            grade: selectedGrade,
            section: selectedSection,
            records: attendanceRecords
        });

        toast({
            title: 'Asistencia Guardada',
            description: `Se ha guardado la asistencia de ${selectedGrade} - ${selectedSection} para ${format(new Date(selectedDate), 'PPP', { locale: es })}.`,
        });
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo guardar la asistencia.',
        });
    }
  };

  const handleDeleteClick = () => {
    setGradeToDelete('');
    setSectionToDelete('');
    setDateToDelete('');
    setAvailableDates([]);
    setDeleteDialogOpen(true);
  };

  const handleDeleteGradeChange = (grade: string) => {
    setGradeToDelete(grade);
    setSectionToDelete('');
    setDateToDelete('');
    setAvailableDates([]);
  };

  const handleDeleteSectionChange = (section: string) => {
    setSectionToDelete(section);
    setDateToDelete('');
    if (gradeToDelete && section) {
      loadAvailableDatesForDelete(gradeToDelete, section);
    }
  };

  const loadAvailableDatesForDelete = (grade: string, section: string) => {
    if (!allAttendanceData) return;
    
    const dates = allAttendanceData
      .filter(a => a.grade === grade && a.section === section)
      .map(a => a.date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
    setAvailableDates(dates);
  };

  const deleteAttendance = async () => {
    if (!gradeToDelete || !sectionToDelete || !dateToDelete) return;

    const attendanceDocId = `${gradeToDelete}_${sectionToDelete}_${dateToDelete}`;
    
    try {
        const attendanceRef = doc(firestore, 'attendance', attendanceDocId);
        await import('firebase/firestore').then(m => m.deleteDoc(attendanceRef));

        toast({
            title: 'Asistencia Eliminada',
            description: `Se ha eliminado la asistencia de ${gradeToDelete} - ${sectionToDelete} para ${format(new Date(dateToDelete), 'PPP', { locale: es })}.`,
        });

        setDeleteDialogOpen(false);
        setGradeToDelete('');
        setSectionToDelete('');
        setDateToDelete('');
        
        // Recargar registros si es el mismo grado, sección y fecha actual
        if (gradeToDelete === selectedGrade && sectionToDelete === selectedSection && dateToDelete === selectedDate) {
          loadAttendanceRecords(selectedGrade, selectedSection, selectedDate);
        }
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'No se pudo eliminar la asistencia.',
        });
    }
  };

  const canEditDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    return selectedDateObj >= twoDaysAgo && selectedDateObj <= today;
  };

  const hasAttendanceRecorded = () => {
    return attendanceRecords.some(r => r.status !== 'none');
  };

  const markAllAsPresent = () => {
    const currentDate = format(new Date(), 'dd/MM/yyyy');
    const currentTime = format(new Date(), 'HH:mm');
    
    setAttendanceRecords(prev =>
      prev.map(rec => ({
        ...rec,
        status: 'present' as AttendanceStatus,
        registeredDate: currentDate,
        registeredTime: currentTime,
      }))
    );

    toast({
      title: 'Todos marcados como presentes',
      description: `Se marcaron ${attendanceRecords.length} estudiantes como presentes con fecha y hora actual.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Control de Asistencia</CardTitle>
        <CardDescription>Selecciona el grado y sección para registrar la asistencia de los estudiantes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label>Grado</Label>
            <Select value={selectedGrade} onValueChange={handleGradeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un grado" />
              </SelectTrigger>
              <SelectContent>
                {sortedGrades.map(grade => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sección</Label>
            <Select 
              value={selectedSection} 
              onValueChange={handleSectionChange}
              disabled={!selectedGrade}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una sección" />
              </SelectTrigger>
              <SelectContent>
                {uniqueSections.sort().map(section => (
                  <SelectItem key={section} value={section}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {/* Filtros adicionales */}
        {selectedGrade && selectedSection && attendanceRecords.length > 0 && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FilterIcon className="h-4 w-4" />
              <span>Filtros Adicionales</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label className="text-xs">Buscar Estudiante</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Nombre o apellido..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-9 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Estado</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="present">Presente</SelectItem>
                    <SelectItem value="late">Tardanza</SelectItem>
                    <SelectItem value="justified">Justificada</SelectItem>
                    <SelectItem value="absent">Faltó</SelectItem>
                    <SelectItem value="none">Sin registro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Hora Desde</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="time"
                    value={filterTimeFrom}
                    onChange={(e) => setFilterTimeFrom(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-9 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Hora Hasta</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="time"
                    value={filterTimeTo}
                    onChange={(e) => setFilterTimeTo(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pl-9 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
            {(searchTerm || filterStatus !== 'all' || filterTimeFrom || filterTimeTo) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterTimeFrom('');
                  setFilterTimeTo('');
                }}
              >
                Limpiar Filtros
              </Button>
            )}
          </div>
        )}

        {selectedGrade && selectedSection && attendanceRecords.length > 0 && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <h3 className="text-lg font-semibold">
                {selectedGrade} - Sección {selectedSection} | Fecha: {format(new Date(), "PPP", { locale: es })}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="default" 
                  size="default"
                  onClick={markAllAsPresent}
                  disabled={!canEditDate()}
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Marcar Todos Presentes
                </Button>
                <BulkAttendanceUpload 
                  onUploadComplete={handleUploadComplete}
                  selectedGrade={selectedGrade}
                  selectedSection={selectedSection}
                />
                <Button 
                  variant="destructive" 
                  size="default"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Asistencia
                </Button>
              </div>
            </div>
            
            {/* Alertas de validación */}
            {!canEditDate() && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Solo puedes editar asistencias de los últimos 2 días. Esta fecha es de solo lectura.
                </AlertDescription>
              </Alert>
            )}
            
            {attendanceRecords.filter(r => r.status === 'none').length > 0 && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Hay {attendanceRecords.filter(r => r.status === 'none').length} estudiante(s) sin asistencia registrada.
                  Debes marcar el estado de todos antes de guardar.
                </AlertDescription>
              </Alert>
            )}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead className="text-right min-w-[400px]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const filteredRecords = attendanceRecords.filter(record => {
                      // Filtro de búsqueda
                      const searchMatch = searchTerm === '' || 
                        record.studentName.toLowerCase().includes(searchTerm.toLowerCase());
                      
                      // Filtro de estado
                      const statusMatch = filterStatus === 'all' || record.status === filterStatus;
                      
                      // Filtro de hora
                      let timeMatch = true;
                      if (filterTimeFrom || filterTimeTo) {
                        const recordTime = record.registeredTime;
                        if (recordTime) {
                          if (filterTimeFrom && recordTime < filterTimeFrom) timeMatch = false;
                          if (filterTimeTo && recordTime > filterTimeTo) timeMatch = false;
                        } else {
                          timeMatch = false; // Si no tiene hora registrada, no pasa el filtro de hora
                        }
                      }
                      
                      return searchMatch && statusMatch && timeMatch;
                    });
                    
                    if (filteredRecords.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                            No se encontraron estudiantes con los filtros aplicados.
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    return (
                      <>
                        {filteredRecords.length < attendanceRecords.length && (
                          <TableRow className="bg-muted/50">
                            <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-2">
                              Mostrando {filteredRecords.length} de {attendanceRecords.length} estudiantes
                            </TableCell>
                          </TableRow>
                        )}
                        {filteredRecords.map(record => (
                          <TableRow key={record.studentId}>
                            <TableCell className="font-medium">{record.studentName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {record.registeredDate || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {record.registeredTime || '-'}
                            </TableCell>
                            <TableCell>
                              <RadioGroup
                                value={record.status}
                                onValueChange={(value) => handleStatusChange(record.studentId, value as AttendanceStatus)}
                                className="flex justify-end gap-2 md:gap-3 flex-wrap"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="present" id={`present-${record.studentId}`} />
                                  <Label htmlFor={`present-${record.studentId}`}>Presente</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="late" id={`late-${record.studentId}`} />
                                  <Label htmlFor={`late-${record.studentId}`}>Tardanza</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="justified" id={`justified-${record.studentId}`} />
                                  <Label htmlFor={`justified-${record.studentId}`}>Justificada</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="absent" id={`absent-${record.studentId}`} />
                                  <Label htmlFor={`absent-${record.studentId}`}>Faltó</Label>
                                </div>
                              </RadioGroup>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {attendanceRecords.filter(r => r.status === 'present').length} presentes • 
                {attendanceRecords.filter(r => r.status === 'late').length} tardanzas • 
                {attendanceRecords.filter(r => r.status === 'justified').length} justificadas • 
                {attendanceRecords.filter(r => r.status === 'absent').length} faltas • 
                {attendanceRecords.filter(r => r.status === 'none').length} sin registro
              </div>
              <Button 
                onClick={saveAttendance} 
                className="bg-accent hover:bg-accent/90"
                disabled={!canEditDate() || attendanceRecords.filter(r => r.status === 'none').length > 0}
              >
                Guardar Asistencia
              </Button>
            </div>
          </div>
        )}

        {selectedGrade && selectedSection && attendanceRecords.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <p>No hay estudiantes registrados en {selectedGrade} - Sección {selectedSection}.</p>
          </div>
        )}
      </CardContent>

      {/* Diálogo de Eliminar Asistencia */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Eliminar Asistencia</DialogTitle>
            <DialogDescription>
              Selecciona el grado, sección y fecha de la asistencia que deseas eliminar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Grado</Label>
              <Select value={gradeToDelete} onValueChange={handleDeleteGradeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un grado" />
                </SelectTrigger>
                <SelectContent>
                  {sortedGrades.map(grade => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sección</Label>
              <Select 
                value={sectionToDelete} 
                onValueChange={handleDeleteSectionChange}
                disabled={!gradeToDelete}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una sección" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueSections.sort().map(section => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha de Asistencia</Label>
              {availableDates && availableDates.length > 0 ? (
                <Select 
                  value={dateToDelete} 
                  onValueChange={setDateToDelete}
                  disabled={!sectionToDelete}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una fecha" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map(date => (
                      <SelectItem key={date} value={date}>
                        {format(new Date(date), 'PPP', { locale: es })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : sectionToDelete ? (
                <p className="text-sm text-muted-foreground">
                  No hay asistencias registradas para {gradeToDelete} - {sectionToDelete}.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecciona un grado y sección primero.
                </p>
              )}
            </div>

            {gradeToDelete && sectionToDelete && dateToDelete && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Esta acción eliminará permanentemente la asistencia de <strong>{gradeToDelete} - {sectionToDelete}</strong> del día <strong>{format(new Date(dateToDelete), 'PPP', { locale: es })}</strong>. 
                  Esta acción no se puede deshacer.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setGradeToDelete('');
                setSectionToDelete('');
                setDateToDelete('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteAttendance}
              disabled={!gradeToDelete || !sectionToDelete || !dateToDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar Asistencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StudentParentAttendance() {
    const { user, role } = useRole();
    const { firestore } = useFirebase();
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [selectedChildIndex, setSelectedChildIndex] = useState(0);

    const attendanceQuery = useMemoFirebase(() => collection(firestore, 'attendance'), [firestore]);
    const { data: allAttendance, isLoading } = useCollection<Attendance>(attendanceQuery);

    const workshopsQuery = useMemoFirebase(() => collection(firestore, 'workshops'), [firestore]);
    const { data: workshops } = useCollection<Workshop>(workshopsQuery);
    
    // Para padres, obtener el hijo seleccionado
    const children = role === 'parent' ? (user as any)?.children || [] : [];
    const selectedChild = children[selectedChildIndex];
    
    const studentId = role === 'parent' ? selectedChild?.id : user?.id;
    const studentName = role === 'parent' ? selectedChild?.name : user?.name;
    
    // Usar useMemo para evitar recalcular en cada render
    const records = useMemo(() => {
        if (!allAttendance || !studentId) return [];
        return allAttendance.flatMap(a => 
            a.records.map(r => ({
                ...r, 
                workshopId: a.workshopId, 
                date: a.date, 
                grade: a.grade, 
                section: a.section
            }))
        ).filter(r => r.studentId === studentId);
    }, [allAttendance, studentId]);

    // Filtrar registros por rango de fechas
    const filteredRecords = useMemo(() => {
        if (!records) return [];
        
        return records.filter(record => {
            if (startDate && record.date < startDate) return false;
            if (endDate && record.date > endDate) return false;
            return true;
        });
    }, [records, startDate, endDate]);

    // Calcular estadísticas con useMemo usando registros filtrados
    const stats = useMemo(() => {
        if (!filteredRecords || filteredRecords.length === 0) {
            return { present: 0, late: 0, absent: 0, justified: 0, total: 0 };
        }
        
        const present = filteredRecords.filter(r => r.status === 'present').length;
        const late = filteredRecords.filter(r => r.status === 'late').length;
        const absent = filteredRecords.filter(r => r.status === 'absent').length;
        const justified = filteredRecords.filter(r => r.status === 'justified').length;
        
        return { present, late, absent, justified, total: filteredRecords.length };
    }, [filteredRecords]);

    const getStatusBadge = (status: AttendanceStatus) => {
        switch(status) {
            case 'present': 
                return (
                    <Badge className="bg-green-600">
                        <CheckCheck className="h-3 w-3 mr-1" />
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
            case 'justified': 
                return (
                    <Badge className="bg-blue-600">
                        <FileSpreadsheet className="h-3 w-3 mr-1" />
                        Justificado
                    </Badge>
                );
            case 'absent': 
                return (
                    <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Ausente
                    </Badge>
                );
            case 'none': 
                return <Badge variant="outline">Sin registro</Badge>;
        }
    }

    const attendancePercentage = stats.total > 0
        ? Math.round(((stats.present + stats.late) / stats.total) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Selector de Hijo (solo para padres) */}
            {role === 'parent' && children.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Seleccionar Hijo
                        </CardTitle>
                        <CardDescription>
                            Elige el hijo del cual deseas ver las asistencias
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {children.map((child: any, index: number) => (
                                <Button
                                    key={child.id}
                                    variant={selectedChildIndex === index ? 'default' : 'outline'}
                                    onClick={() => setSelectedChildIndex(index)}
                                >
                                    {child.name} ({child.grade} - {child.section})
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filtros de Fecha */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Filtros de Búsqueda
                    </CardTitle>
                    <CardDescription>
                        Filtra las asistencias por rango de fechas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Fecha Inicio</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                max={endDate || undefined}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">Fecha Fin</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate || undefined}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                className="w-full"
                            >
                                Limpiar Filtros
                            </Button>
                        </div>
                    </div>
                    {(startDate || endDate) && (
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Filtro activo:</strong> Mostrando registros 
                                {startDate && ` desde ${format(new Date(startDate), 'dd/MM/yyyy', { locale: es })}`}
                                {endDate && ` hasta ${format(new Date(endDate), 'dd/MM/yyyy', { locale: es })}`}
                                {' '}• {filteredRecords.length} registro(s) encontrado(s)
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Estadísticas */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <CheckCheck className="h-4 w-4 text-green-600" />
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
                            <AlertCircle className="h-4 w-4 text-red-600" />
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
                            <Calendar className="h-4 w-4 text-blue-600" />
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

            {/* Tabla de registros */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Historial de Asistencias
                    </CardTitle>
                    <CardDescription>
                        Registro completo de asistencias para {studentName}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!records || records.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-semibold">No hay registros de asistencia</p>
                            <p className="text-sm mt-2">
                                Las asistencias aparecerán aquí cuando el administrador las registre
                            </p>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-semibold">No se encontraron registros</p>
                            <p className="text-sm mt-2">
                                No hay asistencias en el rango de fechas seleccionado
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
                                        <TableHead>Hora</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((r, index) => (
                                        <TableRow key={`${r.date}-${r.workshopId || 'class'}-${index}`}>
                                            <TableCell className="font-medium">
                                                {format(new Date(r.date), "dd 'de' MMMM, yyyy", { locale: es })}
                                            </TableCell>
                                            <TableCell>
                                                {r.workshopId 
                                                    ? workshops?.find(w => w.id === r.workshopId)?.title || 'Taller'
                                                    : `Grado ${r.grade} - Sección ${r.section}`
                                                }
                                            </TableCell>
                                            <TableCell>{getStatusBadge(r.status)}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {r.registeredTime || '-'}
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
    )
}

function TeacherAttendanceView() {
  const { user, role } = useRole();
  const { firestore } = useFirebase();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'grade'>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const attendanceQuery = useMemoFirebase(() => collection(firestore, 'attendance'), [firestore]);
  const { data: allAttendance, isLoading } = useCollection<Attendance>(attendanceQuery);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  // Obtener grados y secciones únicos
  const grades = useMemo(() => {
    const gradeOrder = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', '1°', '2°', '3°', '4°', '5°'];
    const uniqueGrades = new Set(users?.filter(u => u.role === 'student' && u.grade).map(u => u.grade));
    return Array.from(uniqueGrades).filter((g): g is string => !!g).sort((a, b) => {
      const indexA = gradeOrder.indexOf(a);
      const indexB = gradeOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b, 'es');
    });
  }, [users]);

  const sections = useMemo(() => {
    const uniqueSections = new Set(
      users?.filter(u => u.role === 'student' && u.section && (selectedGrade === 'all' || u.grade === selectedGrade))
        .map(u => u.section)
    );
    return Array.from(uniqueSections).sort();
  }, [users, selectedGrade]);

  // Filtrar asistencias según selección
  const filteredAttendance = useMemo(() => {
    if (!allAttendance) return [];
    
    return allAttendance.filter(a => {
      // Filtrar por grado y sección si están seleccionados
      if (selectedGrade !== 'all' && a.grade !== selectedGrade) return false;
      if (selectedSection !== 'all' && a.section !== selectedSection) return false;
      
      // Filtrar por rango de fechas
      if (startDate && a.date < startDate) return false;
      if (endDate && a.date > endDate) return false;
      
      return true;
    });
  }, [allAttendance, selectedGrade, selectedSection, startDate, endDate]);

  // Calcular estadísticas
  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0, justified = 0, total = 0;
    
    filteredAttendance.forEach(attendance => {
      attendance.records?.forEach(record => {
        total++;
        switch (record.status) {
          case 'present': present++; break;
          case 'late': late++; break;
          case 'absent': absent++; break;
          case 'justified': justified++; break;
        }
      });
    });

    return { present, late, absent, justified, total };
  }, [filteredAttendance]);

  const attendancePercentage = stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : 0;

  const getStatusBadge = (status: AttendanceStatus) => {
    switch(status) {
      case 'present': 
        return (
          <Badge className="bg-green-600">
            <CheckCheck className="h-3 w-3 mr-1" />
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
      case 'justified': 
        return (
          <Badge className="bg-blue-600">
            <FileSpreadsheet className="h-3 w-3 mr-1" />
            Justificado
          </Badge>
        );
      case 'absent': 
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Ausente
          </Badge>
        );
      case 'none': 
        return <Badge variant="outline">Sin registro</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCheck className="h-4 w-4 text-green-600" />
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
              <AlertCircle className="h-4 w-4 text-red-600" />
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
              <Calendar className="h-4 w-4 text-blue-600" />
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

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="h-5 w-5" />
            Filtrar Asistencias
          </CardTitle>
          <CardDescription>
            Consulta las asistencias registradas por el administrador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Grado</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar grado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grados</SelectItem>
                  {grades.map(grade => (
                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sección</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sección" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las secciones</SelectItem>
                  {sections.map(section => (
                    <SelectItem key={section} value={section}>{section}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha Desde</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Fecha inicial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha Hasta</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Fecha final"
              />
            </div>
          </div>

          {(selectedGrade !== 'all' || selectedSection !== 'all' || startDate || endDate) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSelectedGrade('all');
                setSelectedSection('all');
                setStartDate('');
                setEndDate('');
              }}
              className="w-full"
            >
              Limpiar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabla de registros de asistencia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Registros de Asistencia
          </CardTitle>
          <CardDescription>
            {filteredAttendance.length} registro(s) de asistencia
            {selectedGrade !== 'all' && ` - Grado: ${selectedGrade}`}
            {selectedSection !== 'all' && ` - Sección: ${selectedSection}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAttendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">No hay registros de asistencia</p>
              <p className="text-sm mt-2">
                {selectedGrade !== 'all' || selectedSection !== 'all' 
                  ? 'Intenta con otros filtros'
                  : 'El administrador aún no ha registrado asistencias'}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Grado</TableHead>
                    <TableHead>Sección</TableHead>
                    <TableHead>Estudiante</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .flatMap((attendance, attendanceIdx) => 
                      attendance.records.map((record, recordIdx) => (
                        <TableRow key={`${attendance.date}-${record.studentId}-${attendanceIdx}-${recordIdx}`}>
                          <TableCell className="font-medium">
                            {format(new Date(attendance.date), "dd 'de' MMMM, yyyy", { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{attendance.grade}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{attendance.section}</Badge>
                          </TableCell>
                          <TableCell>{record.studentName}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {record.registeredTime || '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AsistenciaPage() {
  const { role } = useRole();

  if (role === 'admin') {
    return <AdminTeacherAttendance />;
  }

  if (role === 'teacher') {
    return <TeacherAttendanceView />;
  }
  
  if (role === 'student' || role === 'parent') {
    return <StudentParentAttendance />;
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Cargando...</CardTitle>
        </CardHeader>
        <CardContent>
            <p>Determinando el rol de usuario...</p>
        </CardContent>
    </Card>
  );
}
