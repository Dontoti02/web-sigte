'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud } from 'lucide-react';
import type { Workshop, User } from '@/lib/types';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Checkbox } from '../ui/checkbox';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { GradeSectionRestrictions } from '@/components/workshops/grade-section-restrictions';

const daysOfWeek = [
    { id: 'Lunes', label: 'Lunes' },
    { id: 'Martes', label: 'Martes' },
    { id: 'Miércoles', label: 'Miércoles' },
    { id: 'Jueves', label: 'Jueves' },
    { id: 'Viernes', label: 'Viernes' },
]

const formSchema = z.object({
    title: z.string().min(1, 'El título es requerido'),
    description: z.string().min(1, 'La descripción es requerida'),
    teacherId: z.string().min(1, 'Debes seleccionar un docente'),
    days: z.array(z.string()).refine((value) => value.length > 0, { message: 'Debes seleccionar al menos un día.' }),
    startTime: z.string().min(1, 'La hora de inicio es requerida'),
    endTime: z.string().min(1, 'La hora de fin es requerida'),
    maxParticipants: z.number().min(1, 'La capacidad mínima es 1').max(100, 'La capacidad máxima es 100').default(30),
    enrollmentDeadline: z.string().min(1, 'La fecha límite de inscripción es requerida'),
    image: z.any().optional(),
}).refine(data => {
    return data.endTime > data.startTime;
}, {
    message: 'La hora de fin debe ser posterior a la hora de inicio',
    path: ['endTime'],
}).refine(data => {
    const deadline = new Date(data.enrollmentDeadline);
    const now = new Date();
    return deadline > now;
}, {
    message: 'La fecha límite debe ser futura',
    path: ['enrollmentDeadline'],
});


interface WorkshopFormProps {
  workshop?: Workshop | null;
  onFinished: () => void;
}

export function WorkshopForm({ workshop, onFinished }: WorkshopFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(workshop?.imageUrl || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para restricciones
  const [restrictByGradeSection, setRestrictByGradeSection] = useState(workshop?.restrictByGradeSection || false);
  const [allowedGrades, setAllowedGrades] = useState<string[]>(workshop?.allowedGrades || []);
  const [allowedSections, setAllowedSections] = useState<string[]>(workshop?.allowedSections || []);

  const teachersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(teachersQuery);
  const teachers = users?.filter(u => u.role === 'teacher');
  
  const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8; // Start from 8 AM
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: workshop?.title || '',
      description: workshop?.description || '',
      teacherId: workshop?.teacherId || '',
      days: workshop?.schedule?.split(', ').filter(s => !s.includes(':')) || [],
      startTime: workshop?.schedule?.match(/\d{2}:\d{2}/)?.[0] || '',
      endTime: workshop?.schedule?.split(' - ')[1] || '',
      maxParticipants: workshop?.maxParticipants || 30,
      enrollmentDeadline: workshop?.enrollmentDeadline ? new Date(workshop.enrollmentDeadline).toISOString().split('T')[0] : '',
      image: undefined,
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
        const selectedTeacher = teachers?.find(t => t.id === values.teacherId);
        if (!selectedTeacher) {
            toast({ variant: 'destructive', title: 'Error', description: 'Docente no encontrado.' });
            return;
        }

        let imageUrl = workshop?.imageUrl || '';

        if (imageFile) {
            setIsUploadingImage(true);
            try {
                const uploadResult = await uploadToCloudinary(imageFile, 'workshops');
                imageUrl = uploadResult.secure_url;
                setIsUploadingImage(false);
            } catch (error: any) {
                setIsUploadingImage(false);
                toast({ 
                    variant: 'destructive', 
                    title: 'Error al subir imagen', 
                    description: error.message || 'No se pudo subir la imagen.' 
                });
                return;
            }
        }

        const schedule = `${values.days.join(', ')}, ${values.startTime} - ${values.endTime}`;

        const workshopData: Omit<Workshop, 'id'> = {
            title: values.title,
            description: values.description,
            teacherId: values.teacherId,
            teacherName: selectedTeacher.name,
            schedule: schedule,
            imageUrl: imageUrl,
            participants: workshop?.participants || [],
            status: workshop?.status || 'active',
            maxParticipants: values.maxParticipants,
            enrollmentDeadline: new Date(values.enrollmentDeadline).toISOString(),
            restrictByGradeSection: restrictByGradeSection,
            allowedGrades: restrictByGradeSection ? allowedGrades : [],
            allowedSections: restrictByGradeSection ? allowedSections : [],
        };

        if (workshop) {
            // Edit logic
            const workshopDocRef = doc(firestore, 'workshops', workshop.id);
            await updateDoc(workshopDocRef, workshopData);
            toast({ title: 'Taller actualizado', description: 'Los datos han sido guardados.' });
        } else {
            // Create logic
            const collectionRef = collection(firestore, 'workshops');
            await addDoc(collectionRef, workshopData);
            toast({ title: 'Taller Creado', description: 'El nuevo taller ha sido registrado.' });
        }
        onFinished();
    } catch(error: any) {
        toast({ variant: "destructive", title: 'Error', description: error.message || "Ocurrió un error." });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pr-1">
         <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Imagen del Taller</FormLabel>
              <FormControl>
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-full h-48 rounded-lg border-2 border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/20 hover:bg-muted/50 transition-colors">
                        {imagePreview ? (
                            <Image src={imagePreview} alt="Vista previa" layout="fill" objectFit="cover" className="rounded-lg" />
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <UploadCloud className="mx-auto h-10 w-10 mb-2" />
                                <p>Haz clic o arrastra una imagen</p>
                                <p className="text-xs">Recomendado: 1200x800px</p>
                            </div>
                        )}
                         <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/png, image/jpeg, image/gif"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Título</FormLabel>
                <FormControl>
                <Input placeholder="Ej: Arte Creativo" {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
            <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                <Textarea placeholder="Una breve descripción del taller..." {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="teacherId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Docente</FormLabel>
                <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un docente" />
                    </SelectTrigger>
                    <SelectContent>
                        {teachers?.map(teacher => (
                            <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        
        <FormField
            control={form.control}
            name="days"
            render={() => (
                <FormItem>
                <div className="mb-2">
                    <FormLabel>Días de la semana</FormLabel>
                    <FormDescription>
                        Selecciona uno o más días.
                    </FormDescription>
                </div>
                <div className="flex flex-wrap gap-4">
                {daysOfWeek.map((item) => (
                    <FormField
                    key={item.id}
                    control={form.control}
                    name="days"
                    render={({ field }) => {
                        return (
                        <FormItem
                            key={item.id}
                            className="flex flex-row items-start space-x-2 space-y-0"
                        >
                            <FormControl>
                            <Checkbox
                                checked={field.value?.includes(item.id)}
                                onCheckedChange={(checked) => {
                                return checked
                                    ? field.onChange([...(field.value || []), item.id])
                                    : field.onChange(
                                        field.value?.filter(
                                            (value) => value !== item.id
                                        )
                                    )
                                }}
                            />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">
                            {item.label}
                            </FormLabel>
                        </FormItem>
                        )
                    }}
                    />
                ))}
                </div>
                <FormMessage />
                </FormItem>
            )}
        />
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Hora de Inicio</FormLabel>
                    <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona una hora" />
                        </SelectTrigger>
                        <SelectContent>
                            {timeSlots.map(time => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Hora de Fin</FormLabel>
                    <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona una hora" />
                        </SelectTrigger>
                        <SelectContent>
                            {timeSlots.map(time => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="maxParticipants"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Capacidad Máxima</FormLabel>
                    <FormControl>
                        <Input 
                            type="number" 
                            min="1" 
                            max="100" 
                            placeholder="30" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                        />
                    </FormControl>
                    <FormDescription>
                        Número máximo de estudiantes (por defecto: 30)
                    </FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="enrollmentDeadline"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Fecha Límite de Inscripción</FormLabel>
                    <FormControl>
                        <Input 
                            type="date" 
                            {...field}
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </FormControl>
                    <FormDescription>
                        Fecha hasta la cual se aceptan inscripciones
                    </FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
        </div>

        {/* Componente de restricciones por grado y sección */}
        <GradeSectionRestrictions
          restrictByGradeSection={restrictByGradeSection}
          allowedGrades={allowedGrades}
          allowedSections={allowedSections}
          onRestrictChange={setRestrictByGradeSection}
          onGradesChange={setAllowedGrades}
          onSectionsChange={setAllowedSections}
        />
       
        <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting || isUploadingImage}>
                {(isSubmitting || isUploadingImage) ? <Loader2 className="animate-spin mr-2" /> : null}
                {isUploadingImage ? 'Subiendo imagen...' : (workshop ? "Guardar Cambios" : "Crear Taller")}
            </Button>
        </div>
      </form>
    </Form>
  );
}

    