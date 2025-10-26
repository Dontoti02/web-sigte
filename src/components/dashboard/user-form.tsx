'use client';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { Loader2 } from 'lucide-react';
import type { User, Role } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { firebaseConfig } from '@/firebase/config';

const formSchema = z
  .object({
    firstName: z.string().min(1, 'El nombre es requerido'),
    lastName: z.string().min(1, 'El apellido es requerido'),
    email: z.string().email('Email inválido'),
    role: z.enum(['admin', 'teacher', 'parent']),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
    grade: z.string().optional(),
    section: z.string().optional(),
  })
  .refine((data) => {
    if (data.password || data.confirmPassword) {
        return data.password && data.password.length >= 6 && data.password === data.confirmPassword;
    }
    return true;
  }, {
    message: "Las contraseñas no coinciden o tienen menos de 6 caracteres",
    path: ['confirmPassword'],
  });


interface UserFormProps {
  user?: User | null;
  onFinished: () => void;
}

export function UserForm({ user, onFinished }: UserFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      role: user?.role || 'teacher',
      password: '',
      confirmPassword: '',
      grade: user?.grade || '',
      section: user?.section || '',
    },
  });

  const isSubmitting = form.formState.isSubmitting;
  
  const selectedRole = useWatch({
    control: form.control,
    name: 'role'
  });

  useEffect(() => {
    if(user) {
        form.reset({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            role: user.role || 'teacher',
            password: '',
            confirmPassword: '',
            grade: user.grade || '',
            section: user.section || '',
        })
    } else {
        form.reset({
            firstName: '',
            lastName: '',
            email: '',
            role: 'teacher',
            password: '',
            confirmPassword: '',
            grade: '',
            section: '',
        })
    }
  }, [user, form]);
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    let tempApp;
    try {
        if (user) {
            // Edit logic
            const userDocRef = doc(firestore, 'users', user.id);
            const dataToUpdate: Partial<User> = {
                firstName: values.firstName,
                lastName: values.lastName,
                name: `${values.firstName} ${values.lastName}`,
                role: values.role,
            };

            // Clear student fields for non-student roles
            dataToUpdate.grade = '';
            dataToUpdate.section = '';

            await updateDoc(userDocRef, dataToUpdate);

            toast({ title: 'Usuario actualizado', description: 'Los datos han sido guardados.' });
        } else {
            // Create logic
            if (!values.password) {
                form.setError("password", { message: "La contraseña es requerida para nuevos usuarios."});
                return;
            }
            // Create a temporary Firebase app to create user without logging out admin
            const appName = `temp-user-creation-${Date.now()}`;
            tempApp = initializeApp(firebaseConfig, appName);
            const tempAuth = getAuth(tempApp);

            const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
            const newUser = userCredential.user;

            const userData: User = {
                id: newUser.uid,
                firstName: values.firstName,
                lastName: values.lastName,
                name: `${values.firstName} ${values.lastName}`,
                email: values.email,
                role: values.role,
                photoURL: '',
            };


            await setDoc(doc(firestore, 'users', newUser.uid), userData);
            toast({ title: 'Usuario Creado', description: 'El nuevo usuario ha sido registrado.' });
        }
        onFinished();
    } catch(error: any) {
        toast({ variant: "destructive", title: 'Error', description: error.message || "Ocurrió un error." });
    } finally {
        if (tempApp) {
            await deleteApp(tempApp);
        }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Juan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input placeholder="Pérez" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="usuario@sigte.com" {...field} disabled={!!user} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rol</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="teacher">Docente</SelectItem>
                  <SelectItem value="parent">Padre/Madre</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />


        {!user && (
          <>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                {user ? "Guardar Cambios" : "Crear Usuario"}
            </Button>
        </div>
      </form>
    </Form>
  );
}
