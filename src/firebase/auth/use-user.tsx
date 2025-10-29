'use client';
import { useEffect, useState, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { useStudentSession } from '@/contexts/student-session-context'; 

// Define a more specific user profile type
interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  photoURL?: string | null;
  children?: { id: string; name: string; grade?: string; section?: string; }[];
  // Campos adicionales para estudiantes
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  grade?: string;
  section?: string;
}

interface UseUserResult {
  user: (User & UserProfile) | null;
  isLoading: boolean;
  error: Error | null;
}

export const useUserProfile = (): UseUserResult => {
  const { auth, firestore, isUserLoading: isAuthLoading, user: authUser } = useFirebase();
  const { studentSession } = useStudentSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log('useUserProfile - isAuthLoading:', isAuthLoading, 'authUser:', authUser?.uid, 'studentSession:', studentSession?.uid);
    
    // Si hay una sesión de estudiante, cargar datos completos desde Firestore
    if (studentSession) {
      console.log('useUserProfile - Using student session, loading full data from Firestore');
      
      const loadStudentData = async () => {
        try {
          // Cargar datos completos desde la colección users
          const userDocRef = doc(firestore, 'users', studentSession.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('✅ Datos cargados desde users para studentSession:', {
              uid: studentSession.uid,
              section: userData.section,
              grade: userData.grade,
              role: userData.role
            });
            
            // Combinar datos de la sesión con datos de Firestore
            setProfile({
              ...studentSession,
              ...userData,
            } as any);
          } else {
            console.log('⚠️ No se encontró documento en users para:', studentSession.uid);
            setProfile(studentSession as any);
          }
        } catch (error) {
          console.error('❌ Error cargando datos de usuario:', error);
          setProfile(studentSession as any);
        } finally {
          setIsLoading(false);
        }
      };
      
      loadStudentData();
      return;
    }
    
    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }

    if (!authUser) {
      console.log('useUserProfile - No auth user and no student session, setting profile to null');
      setProfile(null);
      setIsLoading(false);
      return;
    }

    console.log('useUserProfile - Fetching profile for uid:', authUser.uid);
    
    // Auth user exists, now fetch the profile
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const userDocRef = doc(firestore, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);

        let userData: UserProfile | null = null;
        
        if (userDoc.exists()) {
          userData = userDoc.data() as UserProfile;
        }
        
        // Si no hay documento en users, intentar cargar desde students
        if (!userData || userData.role === 'student') {
          try {
            const studentDocRef = doc(firestore, 'students', authUser.uid);
            const studentDoc = await getDoc(studentDocRef);
            
            if (studentDoc.exists()) {
              const studentData = studentDoc.data();
              
              // Los campos en students son: firstName, lastName, email, etc.
              const firstName = studentData.firstName || '';
              const lastName = studentData.lastName || '';
              
              console.log('Student data loaded:', { firstName, lastName, email: studentData.email, uid: authUser.uid });
              
              // Combinar datos del usuario con datos del estudiante
              setProfile({
                ...(userData || {}),
                ...studentData,
                firstName,
                lastName,
                email: studentData.email || authUser.email || '',
                role: 'student',
                photoURL: studentData.photoURL || userData?.photoURL || '',
              } as UserProfile);
            } else if (userData) {
              console.log('Student document not found for uid:', authUser.uid);
              setProfile(userData);
            } else {
              console.log('No user or student document found for uid:', authUser.uid);
              setError(new Error('User profile not found in database.'));
            }
          } catch (studentError) {
            console.error('Error fetching student data:', studentError);
            if (userData) {
              setProfile(userData);
            } else {
              setError(studentError instanceof Error ? studentError : new Error('Failed to fetch student profile.'));
            }
          }
        } else if (userData) {
          setProfile(userData);
        } else {
          setError(new Error('User profile not found in database.'));
        }
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Failed to fetch user profile.'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();

  }, [authUser, isAuthLoading, firestore, studentSession]);
  
  const user = useMemo(() => {
    // Si hay sesión de estudiante, retornar esos datos
    if (studentSession && profile) {
      return { ...profile, uid: studentSession.uid } as any;
    }
    // Si hay usuario de Firebase Auth, combinar con profile
    if (authUser && profile) {
      return { ...authUser, ...profile };
    }
    return null;
  }, [authUser, profile, studentSession]);

  return { user, isLoading: isLoading || isAuthLoading, error };
};
