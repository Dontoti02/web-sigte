'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, UploadCloud } from 'lucide-react';
import type { Workshop, User } from '@/lib/types';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import Image from 'next/image';
import { uploadToCloudinary } from '@/lib/cloudinary';

const daysOfWeek = [
    { id: 'Lunes', label: 'Lunes' },
    { id: 'Martes', label: 'Martes' },
    { id: 'Miércoles', label: 'Miércoles' },
    { id: 'Jueves', label: 'Jueves' },
    { id: 'Viernes', label: 'Viernes' },
];

interface WorkshopFormProps {
  workshop?: Workshop | null;
  onFinished: () => void;
}

export function WorkshopForm({ workshop, onFinished }: WorkshopFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  // Estados del formulario
  const [title, setTitle] = useState(workshop?.title || '');
  const [description, setDescription] = useState(workshop?.description || '');
  const [teacherId, setTeacherId] = useState(workshop?.teacherId || '');
  const [selectedDays, setSelectedDays] = useState<string[]>(
    workshop?.schedule?.split(', ').filter(s => !s.includes(':') && !s.includes('-')) || []
  );
  const [startTime, setStartTime] = useState(workshop?.schedule?.match(/\d{2}:\d{2}/)?.[0] || '');
  const [endTime, setEndTime] = useState(workshop?.schedule?.split(' - ')[1] || '');
  const [maxParticipants, setMaxParticipants] = useState(workshop?.maxParticipants || 30);
  const [enrollmentDeadline, setEnrollmentDeadline] = useState(
    workshop?.enrollmentDeadline ? new Date(workshop.enrollmentDeadline).toISOString().split('T')[0] : ''
  );
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(workshop?.imageUrl || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para restricciones (solo secciones)
  const [restrictByGradeSection, setRestrictByGradeSection] = useState(workshop?.restrictByGradeSection || false);
  const [allowedSections, setAllowedSections] = useState<string[]>(workshop?.allowedSections || []);

  const teachersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(teachersQuery);
  const teachers = users?.filter(u => u.role === 'teacher');
  
  // Cargar datos del taller cuando se edita
  useEffect(() => {
    if (workshop) {
      console.log('📖 Cargando datos del taller para editar:', {
        id: workshop.id,
        title: workshop.title,
        restrictByGradeSection: workshop.restrictByGradeSection,
        allowedSections: workshop.allowedSections
      });
      
      setRestrictByGradeSection(workshop.restrictByGradeSection || false);
      setAllowedSections(workshop.allowedSections || []);
    }
  }, [workshop]);
  
  // Obtener grados y secciones únicos de los estudiantes
  const availableGrades = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO'];
  const availableSections = [
    '1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D', '3A', '3B', '3C', '3D',
    '4A', '4B', '4C', '4D', '5A', '5B', '5C', '5D'
  ];
  
  const timeSlots = Array.from({ length: 20 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8;
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleDayToggle = (dayId: string) => {
    setSelectedDays(prev =>
      prev.includes(dayId)
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId]
    );
  };

  const handleSectionToggle = (section: string) => {
    setAllowedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const handleSelectAllSections = () => {
    if (allowedSections.length === availableSections.length) {
      setAllowedSections([]);
    } else {
      setAllowedSections([...availableSections]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!title || !description || !teacherId || selectedDays.length === 0 || !startTime || !endTime || !enrollmentDeadline) {
      toast({
        variant: 'destructive',
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos obligatorios.'
      });
      return;
    }

    if (endTime <= startTime) {
      toast({
        variant: 'destructive',
        title: 'Error en horarios',
        description: 'La hora de fin debe ser posterior a la hora de inicio.'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedTeacher = teachers?.find(t => t.id === teacherId);
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

      const schedule = `${selectedDays.join(', ')}, ${startTime} - ${endTime}`;

      const workshopData: Omit<Workshop, 'id'> = {
        title,
        description,
        teacherId,
        teacherName: selectedTeacher.name,
        schedule,
        imageUrl,
        participants: workshop?.participants || [],
        status: workshop?.status || 'active',
        maxParticipants,
        enrollmentDeadline: new Date(enrollmentDeadline).toISOString(),
        restrictByGradeSection: restrictByGradeSection, // Asegurar que se guarde correctamente
        allowedGrades: [], // Ya no se usa, siempre vacío
        allowedSections: restrictByGradeSection && allowedSections.length > 0 ? allowedSections : [],
      };

      console.log('💾 Guardando taller con restricciones:', {
        restrictByGradeSection,
        allowedSections,
        workshopData
      });

      if (workshop) {
        const workshopDocRef = doc(firestore, 'workshops', workshop.id);
        // Usar updateDoc con los campos explícitos para asegurar que se actualicen
        await updateDoc(workshopDocRef, {
          ...workshopData,
          restrictByGradeSection: restrictByGradeSection === true, // Forzar boolean
          allowedSections: restrictByGradeSection && allowedSections.length > 0 ? allowedSections : [],
          allowedGrades: [], // Siempre vacío
        });
        console.log('✅ Taller actualizado en Firestore');
        toast({ title: 'Taller actualizado', description: 'Los datos han sido guardados.' });
      } else {
        const collectionRef = collection(firestore, 'workshops');
        await addDoc(collectionRef, workshopData);
        console.log('✅ Taller creado en Firestore');
        toast({ title: 'Taller Creado', description: 'El nuevo taller ha sido registrado.' });
      }
      onFinished();
    } catch(error: any) {
      toast({ variant: "destructive", title: 'Error', description: error.message || "Ocurrió un error." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pr-1">
      {/* Imagen */}
      <div className="space-y-2">
        <Label>Imagen del Taller</Label>
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

      {/* Título */}
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Arte Creativo"
          required
        />
      </div>

      {/* Descripción */}
      <div className="space-y-2">
        <Label htmlFor="description">Descripción *</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Una breve descripción del taller..."
          required
        />
      </div>

      {/* Docente */}
      <div className="space-y-2">
        <Label htmlFor="teacherId">Docente *</Label>
        <select
          id="teacherId"
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          required
        >
          <option value="">Selecciona un docente</option>
          {teachers?.map(teacher => (
            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
          ))}
        </select>
      </div>

      {/* Días de la semana */}
      <div className="space-y-2">
        <Label>Días de la semana *</Label>
        <p className="text-sm text-muted-foreground">Selecciona uno o más días.</p>
        <div className="flex flex-wrap gap-4">
          {daysOfWeek.map((day) => (
            <div key={day.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`day-${day.id}`}
                className="h-4 w-4 rounded border-input"
                checked={selectedDays.includes(day.id)}
                onChange={() => handleDayToggle(day.id)}
              />
              <Label htmlFor={`day-${day.id}`} className="font-normal text-sm cursor-pointer">
                {day.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Horarios */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Hora de Inicio *</Label>
          <select
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
          >
            <option value="">Selecciona una hora</option>
            {timeSlots.map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">Hora de Fin *</Label>
          <select
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            required
          >
            <option value="">Selecciona una hora</option>
            {timeSlots.map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Capacidad y Fecha límite */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxParticipants">Capacidad Máxima *</Label>
          <Input
            id="maxParticipants"
            type="number"
            min="1"
            max="100"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 30)}
            required
          />
          <p className="text-xs text-muted-foreground">Número máximo de estudiantes</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="enrollmentDeadline">Fecha Límite de Inscripción *</Label>
          <Input
            id="enrollmentDeadline"
            type="date"
            value={enrollmentDeadline}
            onChange={(e) => setEnrollmentDeadline(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
          <p className="text-xs text-muted-foreground">Fecha hasta la cual se aceptan inscripciones</p>
        </div>
      </div>

      {/* Restricciones por Grado y Sección */}
      <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-semibold">Restricciones por Grado y Sección</Label>
            <p className="text-sm text-muted-foreground">
              Limita la inscripción a estudiantes de grados y secciones específicos
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="restrictByGradeSection"
              className="h-4 w-4 rounded border-input"
              checked={restrictByGradeSection}
              onChange={(e) => setRestrictByGradeSection(e.target.checked)}
            />
            <Label htmlFor="restrictByGradeSection" className="font-normal cursor-pointer">
              Activar restricciones
            </Label>
          </div>
        </div>

        {restrictByGradeSection && (
          <div className="space-y-4 pt-4 border-t">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>ℹ️ Importante:</strong> Si no seleccionas ninguna sección, el taller estará disponible para todos los estudiantes.
              </p>
            </div>

            {/* Secciones Permitidas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Secciones Permitidas</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllSections}
                  className="text-xs"
                >
                  {allowedSections.length === availableSections.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </Button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {availableSections.sort().map((section) => (
                  <div key={section} className="flex items-center space-x-2 border rounded-md p-2 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      id={`section-${section}`}
                      className="h-4 w-4 rounded border-input"
                      checked={allowedSections.includes(section)}
                      onChange={() => handleSectionToggle(section)}
                    />
                    <Label htmlFor={`section-${section}`} className="font-normal text-sm cursor-pointer flex-1">
                      {section}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botón de envío */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting || isUploadingImage}>
          {(isSubmitting || isUploadingImage) ? <Loader2 className="animate-spin mr-2" /> : null}
          {isUploadingImage ? 'Subiendo imagen...' : (workshop ? "Guardar Cambios" : "Crear Taller")}
        </Button>
      </div>
    </form>
  );
}
