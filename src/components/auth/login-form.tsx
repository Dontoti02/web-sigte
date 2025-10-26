
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { useStudentSession } from "@/contexts/student-session-context";

const formSchema = z.object({
  email: z.string().email({
    message: "Por favor, introduce un email válido.",
  }),
  password: z.string().min(1, {
    message: "La contraseña no puede estar vacía.",
  }),
});

export function LoginForm() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const { setStudentSession } = useStudentSession();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // Buscar usuario por email en Firestore
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, where("email", "==", values.email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Email no encontrado.");
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as any;

      // Para estudiantes: validar que la contraseña sea el apellido paterno
      if (userData.role === 'student') {
        // Buscar datos del estudiante en la colección students
        const studentDocRef = doc(firestore, 'students', userDoc.id);
        const studentDoc = await getDoc(studentDocRef);
        
        if (!studentDoc.exists()) {
          throw new Error("Datos del estudiante no encontrados.");
        }
        
        const studentData = studentDoc.data();
        
        // Validar contraseña contra apellido paterno o lastName
        const apellidoPaterno = studentData.apellidoPaterno || studentData.apellido_paterno || studentData.lastName?.split(' ')[0] || '';
        if (values.password !== apellidoPaterno) {
          throw new Error("Contraseña incorrecta.");
        }
        
        // Establecer sesión del estudiante
        setStudentSession({
          uid: userDoc.id,
          email: studentData.email || values.email,
          firstName: studentData.firstName || studentData.nombres || '',
          lastName: studentData.lastName || '',
          role: 'student',
          photoURL: studentData.photoURL || '',
          ...studentData
        });
      } else {
        // Para otros roles: usar Firebase Authentication
        await signInWithEmailAndPassword(auth, values.email, values.password);
      }

      const role = userData.role || 'student';
      
      toast({
        title: "Inicio de Sesión Exitoso",
        description: "Bienvenido de nuevo a SIGTE.",
      });
      
      // El layout se encargará de mostrar el onboarding si es padre sin hijos
      router.push(`/dashboard?role=${role}`);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "¡Uy! Algo salió mal.",
        description: error.message || "No se pudo iniciar sesión.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="tu@email.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="********"
                      {...field}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {showPassword ? 'Ocultar' : 'Mostrar'} contraseña
                      </span>
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : "Iniciar Sesión"}
          </Button>
        </form>
      </Form>
      <div className="mt-4 text-center text-sm">
        Si eres padre o madre de familia{" "}
        <Link href="/register" className="underline">
          Regístrate Aqui
        </Link>
      </div>
    </>
  );
}
