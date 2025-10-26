'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Settings, 
  User, 
  Bell, 
  Moon, 
  Sun,
  Shield,
  Mail,
  Phone,
  Loader2
} from 'lucide-react';

export default function ConfiguracionPage() {
  const { user, role } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  // Cargar tema actual
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    setDarkMode(savedTheme === 'dark');
  }, []);

  const handleThemeToggle = () => {
    const newTheme = darkMode ? 'light' : 'dark';
    setDarkMode(!darkMode);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    
    toast({
      title: 'Tema Actualizado',
      description: `Modo ${newTheme === 'dark' ? 'oscuro' : 'claro'} activado.`,
    });
  };

  const handleSaveNotifications = async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        const userRef = doc(firestore, 'users', user.id);
        await updateDoc(userRef, {
          emailNotifications,
          pushNotifications,
        });

        toast({
          title: 'Configuración Guardada',
          description: 'Tus preferencias de notificaciones han sido actualizadas.',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo guardar la configuración.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleName = () => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'teacher': return 'Docente';
      case 'student': return 'Estudiante';
      case 'parent': return 'Padre/Madre';
      default: return 'Usuario';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Configuración
        </h1>
        <p className="text-muted-foreground">
          Administra tus preferencias y configuración de la cuenta
        </p>
      </div>

      {/* Información del Usuario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información de la Cuenta
          </CardTitle>
          <CardDescription>
            Detalles de tu perfil en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              {user?.photoURL && user.photoURL.trim() !== '' && <AvatarImage src={user.photoURL} alt={user.name} />}
              <AvatarFallback className="text-2xl">
                {user?.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">{user?.name}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{getRoleName()}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Correo Electrónico
              </Label>
              <Input value={user?.email || ''} disabled />
            </div>
            
            {(user as any)?.grade && (
              <div className="space-y-2">
                <Label>Grado</Label>
                <Input value={(user as any).grade} disabled />
              </div>
            )}
            
            {(user as any)?.section && (
              <div className="space-y-2">
                <Label>Sección</Label>
                <Input value={(user as any).section} disabled />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Apariencia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            Apariencia
          </CardTitle>
          <CardDescription>
            Personaliza la apariencia de la aplicación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dark-mode">Modo Oscuro</Label>
              <p className="text-sm text-muted-foreground">
                Activa el tema oscuro para reducir la fatiga visual
              </p>
            </div>
            <Switch
              id="dark-mode"
              checked={darkMode}
              onCheckedChange={handleThemeToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones
          </CardTitle>
          <CardDescription>
            Configura cómo deseas recibir notificaciones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Notificaciones por Email</Label>
              <p className="text-sm text-muted-foreground">
                Recibe actualizaciones importantes por correo electrónico
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">Notificaciones Push</Label>
              <p className="text-sm text-muted-foreground">
                Recibe notificaciones en tiempo real en tu navegador
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveNotifications} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Preferencias
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Información del Sistema */}
      {role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Información del Sistema</CardTitle>
            <CardDescription>
              Detalles técnicos y versión de la aplicación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Versión:</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Última actualización:</span>
              <span className="font-medium">Octubre 2024</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base de datos:</span>
              <span className="font-medium">Firebase Firestore</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
