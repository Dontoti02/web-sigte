
import { LoginForm } from '@/components/auth/login-form';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader>
            <div className="flex flex-col items-center text-center">
              <Link href="/" className="group flex flex-col items-center cursor-pointer transition-transform hover:scale-105">
                <Logo className="h-16 w-16 mb-4 text-primary group-hover:text-accent transition-colors" />
                <h1 className="text-3xl font-bold font-headline text-primary group-hover:text-accent transition-colors">
                  SIGTE
                </h1>
              </Link>
              <p className="text-muted-foreground mt-2">
                Sistema de Gestión Escolar para Talleres y Asistencia
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
