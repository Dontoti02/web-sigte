'use client';
import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Bell, Plus, Edit, Trash2, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRole } from '@/hooks/use-role';

interface Aviso {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  targetAudience: 'all' | 'students' | 'parents' | 'teachers';
  createdAt: any;
  createdBy: string;
  active: boolean;
}

const TIPO_ICONS = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  urgent: AlertCircle,
};

const TIPO_COLORS = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  urgent: 'bg-red-100 text-red-800 border-red-200',
};

const TIPO_BADGE_COLORS = {
  info: 'bg-blue-500',
  warning: 'bg-yellow-500',
  success: 'bg-green-500',
  urgent: 'bg-red-500',
};

export default function AvisosPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { user, role } = useRole();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAviso, setEditingAviso] = useState<Aviso | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as Aviso['type'],
    targetAudience: 'all' as Aviso['targetAudience'],
  });

  // Cargar avisos
  const avisosQuery = useMemoFirebase(() => collection(firestore, 'avisos'), [firestore]);
  const { data: avisos } = useCollection<Aviso>(avisosQuery);

  // Filtrar avisos según el rol
  const filteredAvisos = avisos?.filter(aviso => {
    if (role === 'admin') return true; // Admin ve todos
    if (role === 'teacher') {
      // Docentes solo ven avisos para 'all' o 'teachers'
      return aviso.targetAudience === 'all' || aviso.targetAudience === 'teachers';
    }
    return false;
  });

  const sortedAvisos = filteredAvisos?.sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0;
    return b.createdAt.seconds - a.createdAt.seconds;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.message.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El título y mensaje son obligatorios.',
      });
      return;
    }

    try {
      if (editingAviso) {
        // Actualizar aviso existente
        const avisoRef = doc(firestore, 'avisos', editingAviso.id);
        await updateDoc(avisoRef, {
          title: formData.title,
          message: formData.message,
          type: formData.type,
          targetAudience: formData.targetAudience,
        });

        toast({
          title: 'Aviso Actualizado',
          description: 'El aviso se ha actualizado correctamente.',
        });
      } else {
        // Crear nuevo aviso
        await addDoc(collection(firestore, 'avisos'), {
          title: formData.title,
          message: formData.message,
          type: formData.type,
          targetAudience: formData.targetAudience,
          createdAt: serverTimestamp(),
          createdBy: user?.name || 'Administrador',
          active: true,
        });

        toast({
          title: 'Aviso Creado',
          description: 'El aviso se ha publicado correctamente.',
        });
      }

      // Limpiar formulario y cerrar diálogo
      setFormData({
        title: '',
        message: '',
        type: 'info',
        targetAudience: 'all',
      });
      setEditingAviso(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error al guardar aviso:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar el aviso.',
      });
    }
  };

  const handleEdit = (aviso: Aviso) => {
    setEditingAviso(aviso);
    setFormData({
      title: aviso.title,
      message: aviso.message,
      type: aviso.type,
      targetAudience: aviso.targetAudience,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (avisoId: string) => {
    try {
      await deleteDoc(doc(firestore, 'avisos', avisoId));
      toast({
        title: 'Aviso Eliminado',
        description: 'El aviso se ha eliminado correctamente.',
      });
    } catch (error) {
      console.error('Error al eliminar aviso:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar el aviso.',
      });
    }
  };

  const handleToggleActive = async (aviso: Aviso) => {
    try {
      const avisoRef = doc(firestore, 'avisos', aviso.id);
      await updateDoc(avisoRef, {
        active: !aviso.active,
      });

      toast({
        title: aviso.active ? 'Aviso Desactivado' : 'Aviso Activado',
        description: `El aviso ahora está ${aviso.active ? 'oculto' : 'visible'}.`,
      });
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cambiar el estado del aviso.',
      });
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAviso(null);
    setFormData({
      title: '',
      message: '',
      type: 'info',
      targetAudience: 'all',
    });
  };

  if (role !== 'admin' && role !== 'teacher') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Acceso Denegado</CardTitle>
          <CardDescription>No tienes permisos para gestionar avisos.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{role === 'admin' ? 'Gestión de Avisos' : 'Avisos'}</h1>
          <p className="text-muted-foreground">
            {role === 'admin' 
              ? 'Crea y administra anuncios para la comunidad educativa'
              : 'Consulta los avisos y anuncios importantes'}
          </p>
        </div>
        {role === 'admin' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleCloseDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Aviso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingAviso ? 'Editar Aviso' : 'Crear Nuevo Aviso'}</DialogTitle>
                <DialogDescription>
                  {editingAviso ? 'Modifica los detalles del aviso' : 'Completa la información para publicar un nuevo aviso'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ej: Reunión de Padres"
                      maxLength={100}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="message">Mensaje *</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Escribe el contenido del aviso..."
                      rows={5}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {formData.message.length}/500 caracteres
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="type">Tipo de Aviso</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: Aviso['type']) => setFormData({ ...formData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Información</SelectItem>
                          <SelectItem value="success">Éxito</SelectItem>
                          <SelectItem value="warning">Advertencia</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="audience">Dirigido a</Label>
                      <Select
                        value={formData.targetAudience}
                        onValueChange={(value: Aviso['targetAudience']) =>
                          setFormData({ ...formData, targetAudience: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="students">Estudiantes</SelectItem>
                          <SelectItem value="parents">Padres</SelectItem>
                          <SelectItem value="teachers">Profesores</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingAviso ? 'Actualizar' : 'Publicar'} Aviso
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Lista de Avisos */}
      <div className="grid gap-4">
        {sortedAvisos && sortedAvisos.length > 0 ? (
          sortedAvisos.map((aviso) => {
            const Icon = TIPO_ICONS[aviso.type];
            return (
              <Card key={aviso.id} className={`${!aviso.active ? 'opacity-50' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${TIPO_COLORS[aviso.type]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-xl">{aviso.title}</CardTitle>
                          <Badge className={TIPO_BADGE_COLORS[aviso.type]}>
                            {aviso.type === 'info' && 'Info'}
                            {aviso.type === 'success' && 'Éxito'}
                            {aviso.type === 'warning' && 'Advertencia'}
                            {aviso.type === 'urgent' && 'Urgente'}
                          </Badge>
                          {!aviso.active && (
                            <Badge variant="outline">Oculto</Badge>
                          )}
                        </div>
                        <CardDescription>
                          Publicado por {aviso.createdBy} •{' '}
                          {aviso.createdAt &&
                            format(new Date(aviso.createdAt.seconds * 1000), "PPP 'a las' p", { locale: es })}
                          {' • '}
                          Dirigido a:{' '}
                          {aviso.targetAudience === 'all' && 'Todos'}
                          {aviso.targetAudience === 'students' && 'Estudiantes'}
                          {aviso.targetAudience === 'parents' && 'Padres'}
                          {aviso.targetAudience === 'teachers' && 'Profesores'}
                        </CardDescription>
                      </div>
                    </div>
                    {role === 'admin' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleToggleActive(aviso)}
                          title={aviso.active ? 'Ocultar aviso' : 'Mostrar aviso'}
                        >
                          <Bell className={`h-4 w-4 ${aviso.active ? '' : 'opacity-50'}`} />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleEdit(aviso)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar aviso?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. El aviso será eliminado permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(aviso.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{aviso.message}</p>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay avisos publicados</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crea tu primer aviso para comunicarte con la comunidad educativa
              </p>
              {role === 'admin' && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primer Aviso
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
