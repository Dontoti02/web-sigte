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
import { Loader2 } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useFirebase } from "@/firebase";

const formSchema = z.object({
  email: z.string().email({
    message: "Por favor, introduce un email válido.",
  }),
});

export default function ForgotPasswordPage() {
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const usersRef = collection(firestore, "users");
      const q = query(usersRef, where("email", "==", values.email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Email no encontrado.");
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as any;
      const allowedRoles = ['admin', 'teacher', 'parent'];

      if (!allowedRoles.includes(userData.role)) {
        throw new Error("No tienes permiso para restablecer la contraseña.");
      }

      await sendPasswordResetEmail(auth, values.email);

      toast({
        title: "Correo Enviado",
        description: "Se ha enviado un enlace para restablecer tu contraseña a tu correo electrónico.",
      });

      router.push("/login");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "¡Uy! Algo salió mal.",
        description: error.message || "No se pudo enviar el correo de restablecimiento.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold">¿Olvidaste tu contraseña?</h1>
          <p className="text-gray-600">
            Introduce tu correo electrónico y te enviaremos un enlace para restablecerla.
          </p>
        </div>
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
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : "Enviar Correo"}
            </Button>
          </form>
        </Form>
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="underline">
            Volver a Iniciar Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
