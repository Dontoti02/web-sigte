'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Users, CheckCircle } from 'lucide-react';
import { Logo } from '@/components/logo';

const formSchema = z.object({
  apellidoPaterno: z.string().min(1, 'El apellido paterno es requerido'),
  apellidoMaterno: z.string().min(1, 'El apellido materno es requerido'),
  grade: z.string().min(1, 'El grado es requerido'),
  section: z.string().min(1, 'La sección es requerida'),
});

interface ParentOnboardingProps {
  parentId: string;
  parentName: string;
  onComplete: () => void;
}

export function ParentOnboarding({ parentId, parentName, onComplete }: ParentOnboardingProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Cargar estudiantes de la colección users
  const studentsQuery = useMemoFirebase(() => {
    const usersRef = collection(firestore, 'users');
    return query(usersRef, where('role', '==', 'student'));
  }, [firestore]);
  const { data: students } = useCollection<any>(studentsQuery);

  // Cargar usuarios para obtener grados y secciones
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<any>(usersQuery);

  // Obtener grados únicos
  const grades = Array.from(
    new Set(users?.filter(u => u.role === 'student' && u.grade).map(u => u.grade))
  ).sort();

  // Obtener secciones únicas
  const sections = Array.from(
    new Set(users?.filter(u => u.role === 'student' && u.section).map(u => u.section))
  ).sort();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apellidoPaterno: '',
      apellidoMaterno: '',
      grade: '',
      section: '',
    },
  });

  // Buscar sugerencias mientras el usuario escribe
  const watchApellidoPaterno = form.watch('apellidoPaterno');
  const watchApellidoMaterno = form.watch('apellidoMaterno');
  const watchGrade = form.watch('grade');
  const watchSection = form.watch('section');

  useEffect(() => {
    if (!students || students.length === 0) return;

    const filtered = students.filter((student: any) => {
      let matches = true;

      if (watchApellidoPaterno && watchApellidoPaterno.length >= 2) {
        const paterno = (student.apellidoPaterno || student.apellido_paterno || '')?.toLowerCase();
        matches = matches && paterno.includes(watchApellidoPaterno.toLowerCase());
      }

      if (watchApellidoMaterno && watchApellidoMaterno.length >= 2) {
        const materno = (student.apellidoMaterno || student.apellido_materno || '')?.toLowerCase();
        matches = matches && materno.includes(watchApellidoMaterno.toLowerCase());
      }

      if (watchGrade) {
        matches = matches && student.grade === watchGrade;
      }

      if (watchSection) {
        matches = matches && student.section === watchSection;
      }

      return matches;
    });

    setSuggestions(filtered.slice(0, 5)); // Máximo 5 sugerencias
    setShowSuggestions(filtered.length > 0 && (watchApellidoPaterno.length >= 2 || watchApellidoMaterno.length >= 2));
  }, [watchApellidoPaterno, watchApellidoMaterno, watchGrade, watchSection, students]);

  const handleSelectSuggestion = (student: any) => {
    form.setValue('apellidoPaterno', student.apellidoPaterno || student.apellido_paterno || '');
    form.setValue('apellidoMaterno', student.apellidoMaterno || student.apellido_materno || '');
    form.setValue('grade', student.grade || '');
    form.setValue('section', student.section || '');
    setShowSuggestions(false);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // Buscar estudiante en la colección users
      const usersRef = collection(firestore, 'users');
      const q = query(
        usersRef,
        where('role', '==', 'student'),
        where('apellidoPaterno', '==', values.apellidoPaterno),
        where('apellidoMaterno', '==', values.apellidoMaterno),
        where('grade', '==', values.grade),
        where('section', '==', values.section)
      );
      
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'Estudiante no encontrado',
          description: 'No se encontró un estudiante con los datos proporcionados. Verifica que los apellidos <strong>EN MAYÚSCULAS</strong>, grado y sección sean correctos.',
        });
        setIsLoading(false);
        return;
      }

      const studentDoc = querySnapshot.docs[0];
      const studentData = studentDoc.data();

      // Actualizar el documento del padre agregando el hijo
      const parentRef = doc(firestore, 'users', parentId);
      await updateDoc(parentRef, {
        children: arrayUnion({
          id: studentDoc.id,
          name: studentData.name || `${studentData.firstName || ''} ${studentData.apellidoPaterno || studentData.apellido_paterno || ''} ${studentData.apellidoMaterno || studentData.apellido_materno || ''}`.trim(),
          grade: studentData.grade,
          section: studentData.section,
        }),
      });

      toast({
        title: '¡Hijo Agregado Exitosamente!',
        description: `${studentData.name || studentData.firstName} ha sido vinculado a tu cuenta.`,
      });

      // Esperar un momento para que el usuario vea el mensaje
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error: any) {
      console.error('Error al agregar hijo:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo agregar el hijo.',
      });
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo className="h-16 w-16" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">
              ¡Bienvenido, {parentName}!
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Para comenzar, necesitas agregar al menos un hijo a tu cuenta
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Instrucciones */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  ¿Cómo agregar a tu hijo?
                </p>
                <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                  <li>Ingresa los apellidos paterno y materno <strong>EN MAYÚSCULAS</strong></li>
                  <li>Selecciona su grado y sección</li>
                  <li>El sistema te sugerirá coincidencias mientras escribes</li>
                  <li>Verifica que los datos sean correctos antes de agregar</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="apellidoPaterno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido Paterno *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="GARCÍA" 
                          {...field}
                          autoComplete="off"
                          style={{ textTransform: 'uppercase' }}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormDescription>
                        En mayúsculas, escribe al menos 2 letras
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apellidoMaterno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido Materno *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="LÓPEZ" 
                          {...field}
                          autoComplete="off"
                          style={{ textTransform: 'uppercase' }}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormDescription>
                        En mayúsculas, escribe al menos 2 letras
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grado *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el grado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {grades.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                              {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sección *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la sección" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sections.map((section) => (
                            <SelectItem key={section} value={section}>
                              {section}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Sugerencias */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Estudiantes encontrados ({suggestions.length})
                  </p>
                  <div className="space-y-2">
                    {suggestions.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(student)}
                        className="w-full text-left p-3 rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {student.name || `${student.firstName || ''} ${student.apellidoPaterno || student.apellido_paterno || ''} ${student.apellidoMaterno || student.apellido_materno || ''}`}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline">{student.grade}</Badge>
                              <Badge variant="outline">{student.section}</Badge>
                            </div>
                          </div>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Agregando hijo...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-5 w-5" />
                    Agregar Hijo y Continuar
                  </>
                )}
              </Button>
            </form>
          </Form>

          <p className="text-xs text-center text-muted-foreground">
            Podrás agregar más hijos después desde el menú "Mis Hijos"
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
