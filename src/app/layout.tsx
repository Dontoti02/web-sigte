import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Suspense } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { StudentSessionProvider } from '@/contexts/student-session-context';

export const metadata: Metadata = {
  title: 'SIGTE: Asistencia y Talleres',
  description: 'Sistema de Gestión Escolar para Control de Asistencia y Talleres',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <StudentSessionProvider>
            <Suspense>{children}</Suspense>
            <Toaster />
          </StudentSessionProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
