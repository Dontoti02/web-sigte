import type { User, Student, Workshop, Attendance, Notification } from '@/lib/types';
import { BookOpen, CalendarCheck, Megaphone, UserCheck } from 'lucide-react';

export const users: User[] = [
  { id: 'admin-1', firstName: 'Admin', lastName: '', name: 'Admin', email: 'admin@sigte.com', role: 'admin', photoURL: '' },
  { id: 'teacher-1', firstName: 'Prof.', lastName: 'Garcia', name: 'Prof. Garcia', email: 'teacher@sigte.com', role: 'teacher', photoURL: '' },
  { id: 'student-1', firstName: 'Estudiante', lastName: '', name: 'Estudiante', email: 'student@sigte.com', role: 'student', photoURL: '' },
  { id: 'parent-1', firstName: 'Padre/Madre', lastName: '', name: 'Padre/Madre', email: 'parent@sigte.com', role: 'parent', photoURL: '', children: [{id: 'student-1', name: 'Estudiante'}] },
];

export const students: Student[] = [
    { id: 'student-1', name: 'Ana Morales', grade: '5º Grado' },
    { id: 'student-2', name: 'Luis Jiménez', grade: '5º Grado' },
    { id: 'student-3', name: 'Carla Solís', grade: '5º Grado' },
    { id: 'student-4', name: 'Pedro Pascal', grade: '5º Grado' },
    { id: 'student-5', name: 'Sofía Vergara', grade: '5º Grado' },
];

export const workshops: Workshop[] = [
    {
        id: 'ws-1', title: 'Arte Creativo', description: 'Explora tu creatividad con pintura y escultura.',
        teacherId: 'teacher-1', teacherName: 'Prof. Garcia', schedule: 'Lunes, 15:00 - 16:30',
        participants: ['student-1', 'student-3'], imageUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw3fHxhcnQlMjBzdXBwbGllc3xlbnwwfHx8fDE3NjEwMDYyODV8MA&ixlib=rb-4.1.0&q=80&w=1080',
        feedback: 'El taller fue muy divertido. A los niños les encantó la parte de la escultura. Quizás podríamos tener más variedad de pinturas la próxima vez.'
    },
    {
        id: 'ws-2', title: 'Iniciación a la Música', description: 'Aprende los fundamentos de la música y toca instrumentos.',
        teacherId: 'teacher-1', teacherName: 'Prof. Garcia', schedule: 'Martes, 15:00 - 16:30',
        participants: ['student-2', 'student-4', 'student-5'], imageUrl: 'https://images.unsplash.com/photo-1623771859039-e435068f39d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw2fHxtdXNpY2FsJTIwaW5zdHJ1bWVudHN8ZW58MHx8fHwxNzYxMDY2MzE2fDA&ixlib=rb-4.1.0&q=80&w=1080'
    },
    {
        id: 'ws-3', title: 'Programación Divertida', description: 'Crea tus propios juegos y animaciones.',
        teacherId: 'teacher-1', teacherName: 'Prof. Garcia', schedule: 'Miércoles, 15:00 - 16:30',
        participants: ['student-1', 'student-4'], imageUrl: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw1fHxsYXB0b3AlMjBjb2RlfGVufDB8fHx8MTc2MTA2NjMxNnww&ixlib=rb-4.1.0&q=80&w=1080'
    },
    {
        id: 'ws-4', title: 'Robótica para Principiantes', description: 'Construye y programa tu primer robot.',
        teacherId: 'teacher-1', teacherName: 'Prof. Garcia', schedule: 'Jueves, 15:00 - 16:30',
        participants: ['student-2', 'student-5'], imageUrl: 'https://images.unsplash.com/photo-1743495851178-56ace672e545?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxMHx8cm9ib3QlMjBraXR8ZW58MHx8fHwxNzYxMDY2MzE2fDA&ixlib=rb-4.1.0&q=80&w=1080'
    },
];

export const attendance: Attendance[] = [
    {
        date: '2024-05-20', workshopId: 'ws-1',
        records: [
            { studentId: 'student-1', studentName: 'Ana Morales', status: 'present' },
            { studentId: 'student-3', studentName: 'Carla Solís', status: 'present' },
        ]
    },
    {
        date: '2024-05-21', workshopId: 'ws-2',
        records: [
            { studentId: 'student-2', studentName: 'Luis Jiménez', status: 'present' },
            { studentId: 'student-4', studentName: 'Pedro Pascal', status: 'absent' },
            { studentId: 'student-5', studentName: 'Sofía Vergara', status: 'present' },
        ]
    },
    {
        date: '2024-05-22', workshopId: 'ws-3',
        records: [
            { studentId: 'student-1', studentName: 'Ana Morales', status: 'late' },
            { studentId: 'student-4', studentName: 'Pedro Pascal', status: 'present' },
        ]
    }
];

export const notifications: Notification[] = [
    { id: 'notif-1', title: 'Recordatorio de Taller', description: 'El taller de Arte Creativo es mañana a las 15:00.', timestamp: 'hace 5 minutos', isRead: false, icon: CalendarCheck },
    { id: 'notif-2', title: 'Nueva Calificación', description: 'Se ha publicado la calificación del último proyecto.', timestamp: 'hace 1 hora', isRead: false, icon: UserCheck },
    { id: 'notif-3', title: 'Anuncio General', description: 'La reunión de padres y maestros será el próximo viernes.', timestamp: 'hace 3 horas', isRead: true, icon: Megaphone },
    { id: 'notif-4', title: 'Inscripción a Taller', description: 'Te has inscrito correctamente en "Programación Divertida".', timestamp: 'hace 1 día', isRead: true, icon: BookOpen },
]
