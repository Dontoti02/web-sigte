
'use client';
import { useState, useEffect } from 'react';
import * as xlsx from 'xlsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
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
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, FileText, CheckCircle, Loader2, PlusCircle, Trash2, Filter, UserPlus, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRole } from '@/hooks/use-role';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

function AddStudentDialog({ onStudentAdded }: { onStudentAdded: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    grado: '',
    seccion: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombres || !formData.apellidoPaterno) {
      toast({
        variant: 'destructive',
        title: 'Campos requeridos',
        description: 'El nombre y apellido paterno son obligatorios.'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const firstName = formData.nombres;
      const apellidoPaterno = formData.apellidoPaterno;
      const apellidoMaterno = formData.apellidoMaterno;
      const lastName = `${apellidoPaterno} ${apellidoMaterno}`.trim();
      const name = `${firstName} ${lastName}`;
      const displayName = `${apellidoPaterno} ${apellidoMaterno}, ${firstName}`.trim();

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const uid = `student_${timestamp}_${randomSuffix}`;
      
      const email = `${firstName.toLowerCase().split(' ')[0]}.${lastName.toLowerCase().replace(/\s/g, '')}.${uid.substring(8, 12)}@sigte.com`.replace(/[^a-zA-Z0-9.@-]/g, '');

      const batch = writeBatch(firestore);

      const userDocRef = doc(firestore, 'users', uid);
      batch.set(userDocRef, {
        id: uid,
        firstName: firstName,
        lastName: lastName,
        apellidoPaterno: apellidoPaterno,
        apellidoMaterno: apellidoMaterno,
        name: name,
        displayName: displayName,
        email: email,
        role: 'student',
        grade: formData.grado || '',
        section: formData.seccion || '',
        photoURL: '',
        createdAt: new Date().toISOString(),
      });

      const studentDocRef = doc(firestore, 'students', uid);
      batch.set(studentDocRef, {
        id: uid,
        firstName: firstName,
        lastName: lastName,
        email: email,
        dateOfBirth: '',
        phone: '',
        address: '',
        parentId: '',
        createdAt: new Date().toISOString(),
      });

      await batch.commit();

      toast({
        title: 'Estudiante Creado',
        description: `${displayName} ha sido registrado exitosamente.`
      });

      setFormData({
        nombres: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        grado: '',
        seccion: ''
      });
      setIsOpen(false);
      onStudentAdded();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al crear estudiante',
        description: error.message || 'Ocurrió un error inesperado.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Añadir Estudiante
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Estudiante</DialogTitle>
          <CardDescription>
            Registra un estudiante individual en el sistema.
          </CardDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombres">Nombres *</Label>
            <Input
              id="nombres"
              value={formData.nombres}
              onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
              placeholder="Juan Carlos"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apellidoPaterno">Apellido Paterno *</Label>
              <Input
                id="apellidoPaterno"
                value={formData.apellidoPaterno}
                onChange={(e) => setFormData({ ...formData, apellidoPaterno: e.target.value })}
                placeholder="García"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
              <Input
                id="apellidoMaterno"
                value={formData.apellidoMaterno}
                onChange={(e) => setFormData({ ...formData, apellidoMaterno: e.target.value })}
                placeholder="López"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grado">Grado</Label>
              <Input
                id="grado"
                value={formData.grado}
                onChange={(e) => setFormData({ ...formData, grado: e.target.value })}
                placeholder="Primero"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seccion">Sección</Label>
              <Input
                id="seccion"
                value={formData.seccion}
                onChange={(e) => setFormData({ ...formData, seccion: e.target.value })}
                placeholder="A"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Estudiante
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkUploadDialog({ onUploadComplete }: { onUploadComplete: () => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [isUploading, setIsUploading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [registrationProgress, setRegistrationProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importedData, setImportedData] = useState<any[] | null>(null);
  
  const [uploadComplete, setUploadComplete] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (uploadComplete && fileName) {
        toast({
            title: 'Importación Completa',
            description: `${fileName} ha sido procesado exitosamente.`,
        });
        setUploadComplete(false);
    }
  }, [uploadComplete, fileName, toast]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx')) {
        toast({
          variant: 'destructive',
          title: 'Formato de archivo no válido',
          description: 'Por favor, selecciona un archivo .xlsx',
        });
        return;
      }
      
      setFileName(file.name);
      setIsUploading(true);
      setImportedData(null);
      setProgress(0);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = xlsx.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = xlsx.utils.sheet_to_json(worksheet);
          
          const interval = setInterval(() => {
            setProgress((prev) => {
              if (prev >= 100) {
                clearInterval(interval);
                setIsUploading(false);
                setImportedData(json);
                setUploadComplete(true);
                return 100;
              }
              return prev + 20;
            });
          }, 100);

        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al leer el archivo', description: 'El formato del archivo Excel no es válido.'})
            setIsUploading(false);
            resetState();
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleUploadClick = () => {
    document.getElementById('file-upload-dialog')?.click();
  };

  const handleConfirm = async () => {
    if (!importedData) return;
  
    setIsRegistering(true);
    setRegistrationProgress(0);
  
    const totalStudents = importedData.length;
    let registeredCount = 0;
    let successCount = 0;
    let errorCount = 0;
  
    for (const student of importedData) {
      try {
        const firstName = student.nombres;
        const apellidoPaterno = student.apellido_paterno || '';
        const apellidoMaterno = student.apellido_materno || '';
        const lastName = `${apellidoPaterno} ${apellidoMaterno}`.trim();
        const grade = student.grado;
        const section = student.seccion;
        const name = `${firstName} ${lastName}`;
        const displayName = `${apellidoPaterno} ${apellidoMaterno}, ${firstName}`.trim();

        if (!firstName || !lastName) {
          console.error("Skipping student with missing name:", student);
          errorCount++;
          continue;
        }

        // Generate a unique ID based on student data
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const uid = `student_${timestamp}_${randomSuffix}`;
        
        const email = `${firstName.toLowerCase().split(' ')[0]}.${lastName.toLowerCase().replace(/\s/g, '')}.${uid.substring(8, 12)}@sigte.com`.replace(/[^a-zA-Z0-9.@-]/g, '');

        const batch = writeBatch(firestore);

        const userDocRef = doc(firestore, 'users', uid);
        batch.set(userDocRef, {
          id: uid,
          firstName: firstName,
          lastName: lastName,
          apellidoPaterno: apellidoPaterno,
          apellidoMaterno: apellidoMaterno,
          name: name,
          displayName: displayName,
          email: email,
          role: 'student',
          grade: grade || '',
          section: section || '',
          photoURL: '',
          createdAt: new Date().toISOString(),
        });

        const studentDocRef = doc(firestore, 'students', uid);
        batch.set(studentDocRef, {
          id: uid,
          firstName: firstName,
          lastName: lastName,
          email: email,
          dateOfBirth: '',
          phone: '',
          address: '',
          parentId: '',
          createdAt: new Date().toISOString(),
        });

        await batch.commit();
        successCount++;

      } catch (error: any) {
        errorCount++;
        console.error("Failed to register student:", student.nombres, error);
        toast({
          variant: 'destructive',
          title: `Error al registrar a ${student.nombres}`,
          description: error.message || 'Por favor, revisa la consola para más detalles.'
        });
      } finally {
        registeredCount++;
        setRegistrationProgress(Math.round((registeredCount / totalStudents) * 100));
      }
    }
  
    setIsRegistering(false);
    
    // Show final summary
    toast({
      title: 'Registro Completado',
      description: `${successCount} estudiante(s) registrado(s) exitosamente. ${errorCount > 0 ? `${errorCount} error(es).` : ''}`,
    });
    
    // Reset and close dialog
    setTimeout(() => {
      resetState();
      setIsDialogOpen(false);
      onUploadComplete();
    }, 500);
  }


  const resetState = () => {
    setFileName(null);
    setImportedData(null);
    setIsUploading(false);
    setProgress(0);
    setIsRegistering(false);
    setRegistrationProgress(0);
    const fileInput = document.getElementById('file-upload-dialog') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };
  
  return (
    <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
        setIsDialogOpen(isOpen);
        if (!isOpen) resetState();
    }}>
        <DialogTrigger asChild>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Carga Masiva de Estudiantes
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Carga Masiva de Estudiantes</DialogTitle>
                <CardDescription>
                    Importa la lista de estudiantes desde un archivo de Excel (.xlsx).
                    <br />
                    Asegúrate que las columnas sean: <strong>nombres, apellido_paterno, apellido_materno, grado, seccion</strong>.
                </CardDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
                <div 
                    className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-accent hover:bg-accent/5 cursor-pointer transition-colors"
                    onClick={handleUploadClick}
                >
                    <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="font-semibold text-lg mb-1">Cargar Archivo</p>
                    <p className="text-sm text-muted-foreground">Haz clic o arrastra y suelta un archivo .xlsx aquí</p>
                    <input 
                        type="file" 
                        id="file-upload-dialog" 
                        className="hidden" 
                        onChange={handleFileChange}
                        accept=".xlsx"
                        disabled={isUploading || isRegistering}
                    />
                </div>

                {fileName && (
                    <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
                    <FileText className="h-6 w-6 text-primary" />
                    <div className="flex-1">
                        <p className="font-medium text-sm">{fileName}</p>
                        <p className="text-xs text-muted-foreground">
                        {isUploading ? `Subiendo... ${progress}%` : (importedData ? 'Listo para registrar' : 'Error')}
                        </p>
                    </div>
                    {isUploading && <Progress value={progress} className="w-1/3 h-2" />}
                    {!isUploading && importedData && <CheckCircle className="h-6 w-6 text-green-500" />}
                    </div>
                )}
                
                {importedData && !isRegistering && (
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Vista Previa de Datos ({importedData.length} estudiantes)</h3>
                        <div className="border rounded-lg overflow-x-auto max-h-64">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Nombres</TableHead>
                                <TableHead>Apellidos</TableHead>
                                <TableHead>Grado</TableHead>
                                <TableHead>Sección</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {importedData.slice(0, 5).map((student, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{student.nombres}</TableCell>
                                    <TableCell>{`${student.apellido_paterno || ''} ${student.apellido_materno || ''}`.trim()}</TableCell>
                                    <TableCell>{student.grado}</TableCell>
                                    <TableCell>{student.seccion}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>
                        {importedData.length > 5 && <p className="text-sm text-center text-muted-foreground mt-2">Mostrando los primeros 5 de {importedData.length} registros.</p>}
                    </div>
                )}
                
                {isRegistering && importedData && (
                    <div className="space-y-4 p-6 bg-muted/30 rounded-lg border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                <div>
                                    <p className="font-semibold text-base">Registrando estudiantes...</p>
                                    <p className="text-sm text-muted-foreground">
                                        Por favor espera mientras se procesan los datos
                                    </p>
                                </div>
                            </div>
                            <span className="text-2xl font-bold text-primary">{registrationProgress}%</span>
                        </div>
                        <div className="space-y-2">
                            <Progress value={registrationProgress} className="h-3 w-full" />
                            <p className="text-xs text-center text-muted-foreground">
                                Procesando {Math.round((registrationProgress / 100) * importedData.length)} de {importedData.length} estudiantes
                            </p>
                        </div>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button onClick={() => setIsDialogOpen(false)} variant="outline" disabled={isRegistering}>Cancelar</Button>
                <Button onClick={handleConfirm} disabled={!importedData || isRegistering || isUploading}>
                    {isRegistering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirmar y Registrar
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}


export default function GestionEstudiantesPage() {
  const { role } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [filterSection, setFilterSection] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const studentsPerPage = 20;
  
  const usersQuery = useMemoFirebase(() => {
    return collection(firestore, 'users');
  }, [firestore, refreshKey]);

  const { data: users, isLoading } = useCollection<User>(usersQuery);
  const allStudents = users?.filter((user) => user.role === 'student');
  
  // Get unique grades and sections for filters
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
  
  // Apply filters
  const filteredStudents = allStudents?.filter((student) => {
    const sectionMatch = filterSection === 'all' || student.section === filterSection;
    
    // Search filter
    const searchMatch = searchTerm === '' || 
      student.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return sectionMatch && searchMatch;
  });

  // Sort students alphabetically by last name (apellido paterno, then materno)
  const students = filteredStudents?.sort((a, b) => {
    const lastNameA = a.lastName?.toLowerCase() || '';
    const lastNameB = b.lastName?.toLowerCase() || '';
    if (lastNameA !== lastNameB) {
      return lastNameA.localeCompare(lastNameB, 'es');
    }
    // If last names are equal, sort by first name
    const firstNameA = a.firstName?.toLowerCase() || '';
    const firstNameB = b.firstName?.toLowerCase() || '';
    return firstNameA.localeCompare(firstNameB, 'es');
  });

  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = students?.slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil((students?.length || 0) / studentsPerPage);

  const handleUploadComplete = () => {
    setRefreshKey(oldKey => oldKey + 1);
  };

  const handleDeleteSelected = async () => {
    if (selectedStudents.length === 0) return;

    try {
      const batch = writeBatch(firestore);
      selectedStudents.forEach(studentId => {
        const userDocRef = doc(firestore, 'users', studentId);
        const studentDocRef = doc(firestore, 'students', studentId);
        batch.delete(userDocRef);
        batch.delete(studentDocRef);
      });
      await batch.commit();

      toast({
        title: 'Eliminación Exitosa',
        description: `${selectedStudents.length} estudiante(s) ha(n) sido eliminado(s).`,
      });
      setSelectedStudents([]);
      setRefreshKey(oldKey => oldKey + 1);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al Eliminar',
        description: 'No se pudieron eliminar los estudiantes seleccionados.',
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allStudentIdsOnPage = currentStudents?.map(s => s.id) || [];
      setSelectedStudents(allStudentIdsOnPage);
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectSingle = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents(prev => [...prev, studentId]);
    } else {
      setSelectedStudents(prev => prev.filter(id => id !== studentId));
    }
  };

  if (role !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso Denegado</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Esta sección solo está disponible para administradores.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className='flex-1'>
                    <CardTitle>Gestión de Estudiantes</CardTitle>
                    <CardDescription>
                        Administra, importa y visualiza los estudiantes registrados en el sistema.
                    </CardDescription>
                </div>
                 <div className="flex flex-wrap gap-2">
                    <AddStudentDialog onStudentAdded={handleUploadComplete} />
                    {selectedStudents.length > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar ({selectedStudents.length})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se eliminarán permanentemente los datos de {selectedStudents.length} estudiante(s) de la base de datos.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelected}>Continuar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    <BulkUploadDialog onUploadComplete={handleUploadComplete} />
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por nombre, apellidos o email..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }}
                />
            </div>
            
            {/* Filters Section */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    <span>Filtros:</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <div className="flex-1 min-w-[180px]">
                        <Select value={filterSection} onValueChange={(value) => {
                            setFilterSection(value);
                            setCurrentPage(1);
                            setSelectedStudents([]);
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filtrar por sección" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las secciones</SelectItem>
                                {uniqueSections.sort().map(section => (
                                    <SelectItem key={section} value={section}>{section}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {filterSection !== 'all' && (
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                                setFilterSection('all');
                                setCurrentPage(1);
                                setSelectedStudents([]);
                            }}
                            className="whitespace-nowrap"
                        >
                            Limpiar filtros
                        </Button>
                    )}
                </div>
            </div>
            
            {/* Results count */}
            {students && students.length > 0 && (
                <div className="text-sm text-muted-foreground">
                    Mostrando {students.length} estudiante{students.length !== 1 ? 's' : ''}
                    {filterSection !== 'all' && (
                        <span> (filtrado{allStudents && ` de ${allStudents.length} total`})</span>
                    )}
                </div>
            )}
            
            <div className="border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px] px-4">
                                <Checkbox
                                    checked={currentStudents ? currentStudents.length > 0 && selectedStudents.length === currentStudents.length : false}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                    aria-label="Seleccionar todo"
                                />
                            </TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Grado</TableHead>
                            <TableHead>Sección</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && Array.from({length: 5}).map((_, i) => (
                             <TableRow key={i}>
                                <TableCell colSpan={5}>
                                  <div className="w-full p-4">
                                    <Skeleton className="h-4 w-full" />
                                  </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {currentStudents && currentStudents.map(student => (
                            <TableRow key={student.id} data-state={selectedStudents.includes(student.id) ? 'selected' : ''}>
                                <TableCell className="px-4">
                                    <Checkbox
                                        checked={selectedStudents.includes(student.id)}
                                        onCheckedChange={(checked) => handleSelectSingle(student.id, !!checked)}
                                        aria-label={`Seleccionar a ${student.name}`}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            {student.photoURL && student.photoURL.trim() !== '' && <AvatarImage src={student.photoURL} alt={student.name} />}
                                            <AvatarFallback>{student.lastName?.charAt(0) || student.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">
                                            {student.displayName || `${student.lastName}, ${student.firstName}` || student.name}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>{student.email}</TableCell>
                                <TableCell><Badge variant="secondary">{student.grade}</Badge></TableCell>
                                <TableCell><Badge variant="outline">{student.section}</Badge></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
             {(!students || students.length === 0) && !isLoading && (
                <div className="text-center text-muted-foreground py-10">
                    <p>No hay estudiantes registrados. Utiliza la carga masiva para empezar.</p>
                </div>
            )}
            {totalPages > 1 && (
                 <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Siguiente
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

    