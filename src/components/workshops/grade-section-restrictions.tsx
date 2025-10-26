'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { User } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Users, GraduationCap } from 'lucide-react';

interface GradeSectionRestrictionsProps {
  restrictByGradeSection: boolean;
  allowedGrades: string[];
  allowedSections: string[];
  onRestrictChange: (restrict: boolean) => void;
  onGradesChange: (grades: string[]) => void;
  onSectionsChange: (sections: string[]) => void;
}

export function GradeSectionRestrictions({
  restrictByGradeSection,
  allowedGrades,
  allowedSections,
  onRestrictChange,
  onGradesChange,
  onSectionsChange,
}: GradeSectionRestrictionsProps) {
  const { firestore } = useFirebase();

  // Cargar usuarios para obtener grados y secciones únicos
  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users } = useCollection<User>(usersQuery);

  // Obtener grados únicos
  const availableGrades = useMemo(() => {
    if (!users) return [];
    const grades = new Set(
      users
        .filter(u => u.role === 'student' && u.grade)
        .map(u => u.grade!)
    );
    return Array.from(grades).sort();
  }, [users]);

  // Obtener secciones únicas
  const availableSections = useMemo(() => {
    if (!users) return [];
    const sections = new Set(
      users
        .filter(u => u.role === 'student' && u.section)
        .map(u => u.section!)
    );
    return Array.from(sections).sort();
  }, [users]);

  const handleGradeToggle = (grade: string) => {
    if (allowedGrades.includes(grade)) {
      onGradesChange(allowedGrades.filter(g => g !== grade));
    } else {
      onGradesChange([...allowedGrades, grade]);
    }
  };

  const handleSectionToggle = (section: string) => {
    if (allowedSections.includes(section)) {
      onSectionsChange(allowedSections.filter(s => s !== section));
    } else {
      onSectionsChange([...allowedSections, section]);
    }
  };

  const handleSelectAllGrades = () => {
    if (allowedGrades.length === availableGrades.length) {
      onGradesChange([]);
    } else {
      onGradesChange([...availableGrades]);
    }
  };

  const handleSelectAllSections = () => {
    if (allowedSections.length === availableSections.length) {
      onSectionsChange([]);
    } else {
      onSectionsChange([...availableSections]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Restricciones por Grado y Sección
            </CardTitle>
            <CardDescription>
              Limita la inscripción a estudiantes de grados y secciones específicos
            </CardDescription>
          </div>
          <Switch
            checked={restrictByGradeSection}
            onCheckedChange={onRestrictChange}
          />
        </div>
      </CardHeader>

      {restrictByGradeSection && (
        <CardContent className="space-y-6">
          {/* Alerta informativa */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-semibold">Solo estudiantes seleccionados podrán inscribirse</p>
              <p className="mt-1">
                Si no seleccionas ningún grado o sección, el taller estará disponible para todos.
              </p>
            </div>
          </div>

          {/* Selección de Grados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Grados Permitidos</Label>
              <button
                type="button"
                onClick={handleSelectAllGrades}
                className="text-sm text-primary hover:underline"
              >
                {allowedGrades.length === availableGrades.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            
            {availableGrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay grados disponibles</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availableGrades.map(grade => (
                  <div
                    key={grade}
                    className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleGradeToggle(grade)}
                  >
                    <Checkbox
                      id={`grade-${grade}`}
                      checked={allowedGrades.includes(grade)}
                      onCheckedChange={() => handleGradeToggle(grade)}
                    />
                    <Label
                      htmlFor={`grade-${grade}`}
                      className="flex-1 cursor-pointer"
                    >
                      {grade}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {allowedGrades.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Seleccionados:</span>
                {allowedGrades.map(grade => (
                  <Badge key={grade} variant="secondary">
                    {grade}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Selección de Secciones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Secciones Permitidas</Label>
              <button
                type="button"
                onClick={handleSelectAllSections}
                className="text-sm text-primary hover:underline"
              >
                {allowedSections.length === availableSections.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            </div>
            
            {availableSections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay secciones disponibles</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {availableSections.map(section => (
                  <div
                    key={section}
                    className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleSectionToggle(section)}
                  >
                    <Checkbox
                      id={`section-${section}`}
                      checked={allowedSections.includes(section)}
                      onCheckedChange={() => handleSectionToggle(section)}
                    />
                    <Label
                      htmlFor={`section-${section}`}
                      className="flex-1 cursor-pointer"
                    >
                      {section}
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {allowedSections.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Seleccionadas:</span>
                {allowedSections.map(section => (
                  <Badge key={section} variant="secondary">
                    {section}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Resumen */}
          {(allowedGrades.length > 0 || allowedSections.length > 0) && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                <span className="font-semibold text-sm">Resumen de Restricciones</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {allowedGrades.length === 0 && allowedSections.length > 0 && (
                  <>Solo estudiantes de las secciones: <strong>{allowedSections.join(', ')}</strong></>
                )}
                {allowedGrades.length > 0 && allowedSections.length === 0 && (
                  <>Solo estudiantes de los grados: <strong>{allowedGrades.join(', ')}</strong></>
                )}
                {allowedGrades.length > 0 && allowedSections.length > 0 && (
                  <>
                    Solo estudiantes de los grados <strong>{allowedGrades.join(', ')}</strong> y 
                    secciones <strong>{allowedSections.join(', ')}</strong>
                  </>
                )}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
