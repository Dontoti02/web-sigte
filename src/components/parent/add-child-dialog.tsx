'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2, UserPlus, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const formSchema = z.object({
  apellidoPaterno: z.string().min(1, 'El apellido paterno es requerido'),
  apellidoMaterno: z.string().min(1, 'El apellido materno es requerido'),
  grade: z.string().min(1, 'El grado es requerido'),
  section: z.string().min(1, 'La sección es requerida'),
});

interface Student {
  id: string;
  name: string;
  firstName: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  grade: string;
  section: string;
}

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  onChildAdded?: () => void;
}

export function AddChildDialog({ open, onOpenChange, parentId, onChildAdded }: AddChildDialogProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Cargar usuarios para obtener grados y secciones
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<any>(usersQuery);

  // Obtener estudiantes
  const students = useMemo(() => {
    return users?.filter(u => u.role === 'student') || [];
  }, [users]);

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

  const apellidoPaterno = form.watch('apellidoPaterno');
  const apellidoMaterno = form.watch('apellidoMaterno');
  const grade = form.watch('grade');
  const section = form.watch('section');

  // Filtrar sugerencias de hijos basado en lo que escribe
  const suggestedStudents = useMemo(() => {
    if (!apellidoPaterno && !apellidoMaterno) return [];

    return students.filter(student => {
      const paterno = (student.apellidoPaterno || '').toUpperCase();
      const materno = (student.apellidoMaterno || '').toUpperCase();
      const paternoInput = apellidoPaterno.toUpperCase();
      const maternoInput = apellidoMaterno.toUpperCase();

      const matchPaterno = !paternoInput || paterno.includes(paternoInput);
      const matchMaterno = !maternoInput || materno.includes(maternoInput);

      return matchPaterno && matchMaterno;
    }).slice(0, 5); // Mostrar máximo 5 sugerencias
  }, [apellidoPaterno, apellidoMaterno, students]);

  const handleSelectStudent = (student: any) => {
    form.setValue('apellidoPaterno', student.apellidoPaterno || '');
    form.setValue('apellidoMaterno', student.apellidoMaterno || '');
    form.setValue('grade', student.grade || '');
    form.setValue('section', student.section || '');
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
          description: 'No se encontró un estudiante con los datos proporcionados. Verifica que los apellidos EN MAYÚSCULAS, grado y sección sean correctos.',
        });
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
        title: 'Hijo Agregado',
        description: `${studentData.name || studentData.firstName} ha sido agregado correctamente.`,
      });

      form.reset();
      onOpenChange(false);
      if (onChildAdded) onChildAdded();
    } catch (error: any) {
      console.error('Error al agregar hijo:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo agregar el hijo.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Agregar Hijo
          </DialogTitle>
          <DialogDescription>
            Ingresa los datos de tu hijo <strong>EN MAYÚSCULAS</strong> para vincularlo a tu cuenta y ver sus asistencias y talleres.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="apellidoPaterno"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apellido Paterno</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="GARCÍA"
                      {...field}
                      style={{ textTransform: 'uppercase' }}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    En mayúsculas, tal como está registrado
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
                  <FormLabel>Apellido Materno</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="LÓPEZ"
                      {...field}
                      style={{ textTransform: 'uppercase' }}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    En mayúsculas, tal como está registrado
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sugerencias de hijos */}
            {suggestedStudents.length > 0 && (
              <Card className="p-4 bg-blue-50 border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-3">
                  Hijos que coinciden:
                </p>
                <div className="space-y-2">
                  {suggestedStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleSelectStudent(student)}
                      className="w-full text-left p-3 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">
                          {student.name || `${student.firstName} ${student.apellidoPaterno} ${student.apellidoMaterno}`}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {student.grade}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {student.section}
                          </Badge>
                        </div>
                      </div>
                      <Check className="h-5 w-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona" />
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
                    <FormLabel>Sección</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona" />
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agregar Hijo
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
