'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { useFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AddChildDialog } from '@/components/parent/add-child-dialog';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  GraduationCap,
  AlertCircle
} from 'lucide-react';

interface Child {
  id: string;
  name: string;
  grade?: string;
  section?: string;
}

export default function MisHijosPage() {
  const { user, role } = useRole();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadChildren();
    }
  }, [user?.id, firestore]);

  const loadChildren = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const userRef = doc(firestore, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const childrenData = userData.children || [];
        setChildren(childrenData);
      } else {
        setChildren([]);
      }
    } catch (error) {
      console.error('Error al cargar hijos:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los hijos.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveChild = async (child: Child) => {
    if (!user?.id) return;

    try {
      const userRef = doc(firestore, 'users', user.id);
      await updateDoc(userRef, {
        children: arrayRemove(child),
      });

      toast({
        title: 'Hijo Eliminado',
        description: `${child.name} ha sido eliminado de tu lista.`,
      });

      loadChildren();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo eliminar el hijo.',
      });
    }
  };

  if (role !== 'parent') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-semibold">Acceso Restringido</p>
              <p className="text-sm text-muted-foreground mt-2">
                Esta sección solo está disponible para padres.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Mis Hijos
          </h1>
          <p className="text-muted-foreground">
            Gestiona la información de tus hijos vinculados
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Agregar Hijo
        </Button>
      </div>

      {/* Estadísticas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Total de Hijos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{children.length}</div>
          <p className="text-xs text-muted-foreground">
            {children.length === 0 ? 'No hay hijos agregados' : 'Hijos vinculados a tu cuenta'}
          </p>
        </CardContent>
      </Card>

      {/* Lista de Hijos */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      ) : children.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-lg font-semibold">No hay hijos agregados</p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Agrega a tus hijos para ver sus asistencias y talleres inscritos
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar Primer Hijo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <Card key={child.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {child.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{child.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <GraduationCap className="h-3 w-3" />
                        {child.grade} - {child.section}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="outline">{child.grade}</Badge>
                  <Badge variant="outline">{child.section}</Badge>
                </div>
                <div className="mt-4 flex justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará a {child.name} de tu lista de hijos. 
                          Podrás agregarlo nuevamente más tarde si lo deseas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveChild(child)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para agregar hijo */}
      <AddChildDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        parentId={user?.id || ''}
        onChildAdded={loadChildren}
      />
    </div>
  );
}
