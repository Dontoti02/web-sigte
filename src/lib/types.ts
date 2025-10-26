export type Role = 'admin' | 'teacher' | 'student' | 'parent';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  name: string; // Combined firstName and lastName
  displayName?: string; // Format: "Apellido Paterno Apellido Materno, Nombres"
  email: string;
  role: Role;
  photoURL?: string;
  children?: { id: string; name: string }[];
  grade?: string;
  section?: string;
}

export interface Workshop {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  schedule: string;
  participants: string[];
  imageUrl?: string;
  imageHint?: string;
  feedback?: string;
  status: 'active' | 'inactive';
  maxParticipants: number; // Capacidad máxima de estudiantes
  enrollmentDeadline: string; // Fecha límite de inscripción (ISO string)
  allowedGrades?: string[]; // Grados permitidos (ej: ["1ro", "2do"])
  allowedSections?: string[]; // Secciones permitidas (ej: ["A", "B"])
  restrictByGradeSection?: boolean; // Si true, solo permite grados/secciones especificados
}

export interface Student {
    id: string;
    name: string;
    grade: string;
}

export type AttendanceStatus = 'present' | 'late' | 'justified' | 'absent' | 'none';

export interface AttendanceRecord {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  registeredDate?: string; // Fecha de registro desde Excel
  registeredTime?: string; // Hora de registro desde Excel
}

export interface Attendance {
  date: string; 
  grade?: string;
  section?: string;
  workshopId?: string;
  records: AttendanceRecord[];
}

export interface Message {
    id: string;
    senderId: string;
    senderName: string;
    recipientId: string;
    content: string;
    timestamp: string;
    isRead: boolean;
    avatar: string;
}

export interface Conversation {
    id: string;
    participant: {
        id: string;
        name: string;
        avatar: string;
    };
    messages: Message[];
}

export interface Notification {
    id: string;
    title: string;
    description: string;
    timestamp: string;
    isRead: boolean;
    icon: React.ElementType;
}

    
    