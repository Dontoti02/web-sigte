'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface StudentSession {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'student';
  photoURL?: string;
  [key: string]: any;
}

interface StudentSessionContextType {
  studentSession: StudentSession | null;
  setStudentSession: (session: StudentSession | null) => void;
  clearStudentSession: () => void;
}

const StudentSessionContext = createContext<StudentSessionContextType | undefined>(undefined);

export const StudentSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [studentSession, setStudentSessionState] = useState<StudentSession | null>(null);

  // Cargar sesión desde sessionStorage al montar
  useEffect(() => {
    const savedSession = sessionStorage.getItem('studentSession');
    if (savedSession) {
      try {
        setStudentSessionState(JSON.parse(savedSession));
      } catch (error) {
        console.error('Error parsing student session:', error);
        sessionStorage.removeItem('studentSession');
      }
    }
  }, []);

  const setStudentSession = (session: StudentSession | null) => {
    setStudentSessionState(session);
    if (session) {
      sessionStorage.setItem('studentSession', JSON.stringify(session));
    } else {
      sessionStorage.removeItem('studentSession');
    }
  };

  const clearStudentSession = () => {
    setStudentSessionState(null);
    sessionStorage.removeItem('studentSession');
  };

  return (
    <StudentSessionContext.Provider value={{ studentSession, setStudentSession, clearStudentSession }}>
      {children}
    </StudentSessionContext.Provider>
  );
};

export const useStudentSession = () => {
  const context = useContext(StudentSessionContext);
  if (context === undefined) {
    throw new Error('useStudentSession must be used within a StudentSessionProvider');
  }
  return context;
};
