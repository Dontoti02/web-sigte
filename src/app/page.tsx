
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { ArrowRight, BookOpen, CalendarCheck, MessageSquare, Users, FileText, Shield, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header con efecto glassmorphism */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
              <Logo className="relative h-10 w-10 text-primary" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-headline">
              SIGTE
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hover:bg-primary/10">
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
            <Button asChild className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 shadow-lg shadow-accent/30">
              <Link href="/register">
                Registrarse
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section con diseño mejorado */}
        <section className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          {/* Efectos de fondo decorativos */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>
          </div>

          <div className="max-w-4xl mx-auto text-center">
            {/* Badge de bienvenida */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Bienvenido a la nueva era de gestión escolar</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent font-headline">
                Gestión Escolar
              </span>
              <br />
              <span className="text-foreground">Simplificada</span>
            </h1>
            
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              La plataforma <span className="font-semibold text-foreground">todo-en-uno</span> para administrar talleres, 
              controlar asistencias y mantener una comunicación fluida en tu comunidad educativa.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild className="bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 shadow-xl shadow-accent/30 text-base">
                <Link href="/login">
                  Empezar Ahora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-2 hover:bg-primary/5 text-base">
                <Link href="/register">
                  Crear Cuenta
                </Link>
              </Button>
            </div>

            {/* Estadísticas rápidas */}
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground mt-1">Digital</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-accent">24/7</div>
                <div className="text-sm text-muted-foreground mt-1">Acceso</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary">∞</div>
                <div className="text-sm text-muted-foreground mt-1">Posibilidades</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section mejorada */}
        <section className="relative py-20 md:py-32">
          <div className="absolute inset-0 bg-gradient-to-b from-muted/50 to-background"></div>
          
          <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Funcionalidades Principales
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Descubre cómo SIGTE puede transformar la gestión de tu centro educativo
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature Card 1 */}
              <div className="group relative bg-card border border-border rounded-2xl p-8 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground mb-6 shadow-lg shadow-primary/30">
                    <BookOpen className="h-8 w-8"/>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Gestión de Talleres</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Crea, administra e inscribe estudiantes en talleres de forma sencilla y centralizada con restricciones personalizadas.
                  </p>
                </div>
              </div>

              {/* Feature Card 2 */}
              <div className="group relative bg-card border border-border rounded-2xl p-8 hover:shadow-2xl hover:shadow-accent/10 transition-all duration-300 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-accent to-accent/80 text-accent-foreground mb-6 shadow-lg shadow-accent/30">
                    <CalendarCheck className="h-8 w-8"/>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Control de Asistencia</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Los docentes pueden pasar lista digitalmente, y los padres pueden ver el historial completo de sus hijos en tiempo real.
                  </p>
                </div>
              </div>

              {/* Feature Card 3 */}
              <div className="group relative bg-card border border-border rounded-2xl p-8 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground mb-6 shadow-lg shadow-primary/30">
                    <MessageSquare className="h-8 w-8"/>
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Comunicación Directa</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Un portal de mensajería seguro para la comunicación efectiva entre docentes y padres de familia.
                  </p>
                </div>
              </div>
            </div>

            {/* Características adicionales */}
            <div className="mt-16 grid md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50">
                <Users className="h-8 w-8 text-primary flex-shrink-0" />
                <div>
                  <h4 className="font-semibold">Gestión de Usuarios</h4>
                  <p className="text-sm text-muted-foreground">Administra estudiantes, docentes y padres</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50">
                <FileText className="h-8 w-8 text-accent flex-shrink-0" />
                <div>
                  <h4 className="font-semibold">Reportes Detallados</h4>
                  <p className="text-sm text-muted-foreground">Exporta datos en Excel y PDF</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50">
                <Shield className="h-8 w-8 text-primary flex-shrink-0" />
                <div>
                  <h4 className="font-semibold">Seguridad Garantizada</h4>
                  <p className="text-sm text-muted-foreground">Protección de datos y privacidad</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 md:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-accent to-primary p-12 md:p-16 text-center">
              <div className="absolute inset-0 bg-grid-white/10"></div>
              <div className="relative">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  ¿Listo para comenzar?
                </h2>
                <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8">
                  Únete a SIGTE hoy y transforma la gestión de tu institución educativa
                </p>
                <Button size="lg" variant="secondary" asChild className="shadow-xl text-base">
                  <Link href="/register">
                   Si eres padre o madre de familia debes Crear Cuenta es Gratis
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer mejorado */}
      <footer className="relative border-t border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo className="h-8 w-8 text-primary" />
              <span className="text-lg font-bold text-primary">SIGTE</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} SIGTE. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
