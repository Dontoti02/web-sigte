'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUserProfile as useUser } from '@/firebase';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Edit, X } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { doc, updateDoc, getDoc, collection } from 'firebase/firestore';
import { uploadToCloudinary } from '@/lib/cloudinary';

const profileSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
    newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export default function PerfilPage() {
  const { user: authUser, isLoading: isUserLoading, error } = useUser();
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPhotoURL, setNewPhotoURL] = useState<string | null>(null);

  // Debug logs
  console.log('PerfilPage - authUser:', authUser);
  console.log('PerfilPage - isUserLoading:', isUserLoading);
  console.log('PerfilPage - error:', error);

  // Usar los datos del authUser directamente (ya incluye datos de students si es estudiante)
  const displayUser = authUser ? {
    ...authUser, // Incluir todos los datos del usuario
    id: authUser.uid,
    firstName: (authUser as any).firstName || 'Usuario',
    lastName: (authUser as any).lastName || '',
    email: authUser.email || '',
    role: (authUser as any).role || 'student',
    photoURL: authUser.photoURL || ''
  } : null;
  
  const isLoading = isUserLoading;

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });

  // Inicializar el formulario solo cuando cambia el usuario o el modo de edición
  useEffect(() => {
    if (displayUser) {
      if (!isEditing) {
        setNewPhotoURL(null);
      }
      
      profileForm.reset({
        firstName: displayUser.firstName || '',
        lastName: displayUser.lastName || '',
      });
    }
  }, [displayUser?.id, isEditing]); // Solo depende del ID del usuario y del modo de edición

  const handleImageUploaded = async (url: string) => {
    if (!displayUser) return;

    setNewPhotoURL(url);

    try {
      // Update Firebase Auth profile (solo para no estudiantes)
      if (displayUser?.role !== 'student' && auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url });
      }

      // Update Firestore user document
      const userDocRef = doc(firestore, 'users', displayUser.id);
      await updateDoc(userDocRef, {
        photoURL: url,
        updatedAt: new Date().toISOString()
      });

      // Si es estudiante, actualizar también el documento de estudiante
      if (displayUser.role === 'student') {
        const studentDocRef = doc(firestore, 'students', displayUser.id);
        // Escribir ambos esquemas para compatibilidad
        await updateDoc(studentDocRef, {
          photoURL: url,
          updatedAt: new Date().toISOString(),
          photo: url,
        });
      }

      toast({
        title: 'Foto actualizada',
        description: 'Tu foto de perfil ha sido actualizada correctamente.'
      });
    } catch (error: any) {
      console.error('Error al actualizar foto:', error);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar foto',
        description: 'No se pudo actualizar la foto de perfil. Intenta nuevamente.'
      });
    }
  };

  const handleProfileSave = async (data: z.infer<typeof profileSchema>) => {
    if (!displayUser) return;
    setIsSaving(true);
    try {
      let photoURL = displayUser.photoURL;

      if (newPhotoURL) {
        photoURL = newPhotoURL;
      }

      // Actualizar documento de usuario en Firestore
      const userDocRef = doc(firestore, 'users', displayUser.id);
      // Guardar en users también ambos formatos para compatibilidad
      await updateDoc(userDocRef, {
        firstName: data.firstName,
        lastName: data.lastName,
        nombres: data.firstName,
        photoURL: photoURL ?? '',
        displayName: `${data.firstName} ${data.lastName}`, // Actualizar nombre completo
        updatedAt: new Date().toISOString(),
      });

      // Si es estudiante, actualizar también el documento de estudiante
      if (displayUser.role === 'student') {
        const studentDocRef = doc(firestore, 'students', displayUser.id);

        // Intentar separar apellido paterno y materno desde el campo lastName
        const lastNameParts = (data.lastName || '').trim().split(/\s+/).filter(Boolean);
        const apellidoPaterno = lastNameParts.length > 0 ? lastNameParts[0] : '';
        const apellidoMaterno = lastNameParts.length > 1 ? lastNameParts.slice(1).join(' ') : '';

        const studentUpdate: any = {
          nombres: data.firstName,
          apellido_paterno: apellidoPaterno,
          apellido_materno: apellidoMaterno,
          apellidoPaterno: apellidoPaterno,
          apellidoMaterno: apellidoMaterno,
          firstName: data.firstName,
          lastName: `${apellidoPaterno} ${apellidoMaterno}`.trim(),
          displayName: `${apellidoPaterno} ${apellidoMaterno}, ${data.firstName}`.trim(),
          photoURL: photoURL ?? '',
          updatedAt: new Date().toISOString(),
        };

        // Escribir los campos en el documento de estudiante
        await updateDoc(studentDocRef, studentUpdate);
      }

      toast({ title: 'Perfil actualizado', description: 'Tus datos han sido guardados correctamente.' });
      
      setIsEditing(false);
      setNewPhotoURL(null);
    } catch (error: any) {
      console.error('Error al guardar perfil:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Error al guardar perfil', 
        description: 'No se pudieron guardar los cambios. Intenta nuevamente.' 
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handlePasswordChange = async (data: z.infer<typeof passwordSchema>) => {
      // Solo para usuarios con Firebase Auth (no estudiantes)
      if (!displayUser || !displayUser.email || !auth.currentUser) return;
      setIsChangingPassword(true);

      try {
        const credential = EmailAuthProvider.credential(displayUser.email, data.currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, data.newPassword);

        toast({ title: 'Contraseña actualizada', description: 'Tu contraseña ha sido cambiada exitosamente.' });
        passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } catch (error: any) {
          console.error('Error al cambiar contraseña:', error);
          toast({ 
            variant: 'destructive', 
            title: 'Error al cambiar contraseña', 
            description: error.code === 'auth/wrong-password' 
              ? 'Tu contraseña actual es incorrecta.' 
              : 'Ocurrió un error al cambiar la contraseña. Intenta nuevamente.'
          });
      } finally {
          setIsChangingPassword(false);
      }
  }


  const roleNames = {
    admin: 'Administrador',
    teacher: 'Docente',
    student: 'Estudiante',
    parent: 'Padre/Madre',
  };

  // Mostrar un esqueleto de carga mientras se obtienen los datos
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
  // Asegurarse de que displayUser tenga un valor antes de continuar
  if (!displayUser) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Error al cargar perfil</CardTitle>
            <CardDescription>
              No se pudo cargar la información del perfil. Intenta recargar la página.
              {error && <div className="mt-2 text-sm text-red-600">Error: {error.message}</div>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>Recargar página</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Asegurarse de que los datos del usuario estén disponibles
  const name = `${displayUser?.firstName || ''} ${displayUser?.lastName || ''}`.trim() || 'Usuario';
  const userRole = (displayUser?.role || 'student') as keyof typeof roleNames;

  return (
    <div className="max-w-4xl mx-auto grid gap-8 md:grid-cols-3">
      <Card className="md:col-span-1 h-fit">
        <CardHeader className="text-center items-center">
            <ImageUpload
              currentImageUrl={newPhotoURL || displayUser?.photoURL || ''}
              onImageUploaded={handleImageUploaded}
              folder="profiles"
              fallbackText={`${displayUser?.firstName?.charAt(0) || ''}${displayUser?.lastName?.charAt(0) || ''}`}
              size="lg"
              shape="circle"
            />
          <CardTitle className="text-3xl pt-4">{name}</CardTitle>
          <CardDescription>
            <Badge variant="secondary" className="text-sm">
              {roleNames[userRole]}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label className="text-sm font-medium">Email</Label>
                <Input value={displayUser?.email || ''} readOnly disabled className="text-sm" />
            </div>
            
            {displayUser?.role === 'student' && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nombres</Label>
                  <Input value={displayUser.firstName || ''} readOnly disabled className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Apellidos</Label>
                  <Input value={displayUser.lastName || ''} readOnly disabled className="text-sm" />
                </div>
                {(displayUser as any)?.gradeId && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Grado</Label>
                    <Input value={(displayUser as any).gradeId} readOnly disabled className="text-sm" />
                  </div>
                )}
                {(displayUser as any)?.dateOfBirth && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Fecha de Nacimiento</Label>
                    <Input value={(displayUser as any).dateOfBirth} readOnly disabled className="text-sm" />
                  </div>
                )}
                {(displayUser as any)?.phone && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Teléfono</Label>
                    <Input value={(displayUser as any).phone} readOnly disabled className="text-sm" />
                  </div>
                )}
                {(displayUser as any)?.address && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Dirección</Label>
                    <Input value={(displayUser as any).address} readOnly disabled className="text-sm" />
                  </div>
                )}
              </>
            )}
        </CardContent>
      </Card>

      <div className="md:col-span-2 space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Información Personal</CardTitle>
              <CardDescription>
                Actualiza tu nombre y apellido.
              </CardDescription>
            </div>
            <Button variant={isEditing ? "ghost" : "outline"} size="icon" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <X className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
                <span className="sr-only">{isEditing ? 'Cancelar' : 'Editar'}</span>
            </Button>
          </CardHeader>
          <form onSubmit={profileForm.handleSubmit(handleProfileSave)}>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    {...profileForm.register('firstName')}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input
                    id="lastName"
                    {...profileForm.register('lastName')}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
            {isEditing && (
              <CardFooter>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin mr-2" /> : null}
                  Guardar Cambios
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Cambiar Contraseña</CardTitle>
                <CardDescription>Actualiza tu contraseña de acceso.</CardDescription>
            </CardHeader>
             {false ? (
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Los estudiantes usan su apellido paterno como contraseña. Para cambiarla, contacta al administrador.
                    </p>
                </CardContent>
             ) : (
             <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)}>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="currentPassword">Contraseña Actual</Label>
                        <Input id="currentPassword" type="password" {...passwordForm.register('currentPassword')} />
                        {passwordForm.formState.errors.currentPassword && <p className="text-sm text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>}
                    </div>
                     <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Nueva Contraseña</Label>
                            <Input id="newPassword" type="password" {...passwordForm.register('newPassword')} />
                             {passwordForm.formState.errors.newPassword && <p className="text-sm text-destructive">{passwordForm.formState.errors.newPassword.message}</p>}
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                            <Input id="confirmPassword" type="password" {...passwordForm.register('confirmPassword')} />
                            {passwordForm.formState.errors.confirmPassword && <p className="text-sm text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>}
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isChangingPassword}>
                        {isChangingPassword ? <Loader2 className="animate-spin mr-2" /> : null}
                        Cambiar Contraseña
                    </Button>
                </CardFooter>
            </form>
             )}
        </Card>
      </div>
    </div>
  );
}
