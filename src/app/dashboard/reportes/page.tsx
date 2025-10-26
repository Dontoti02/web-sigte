'use client';
import { useState, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Pie, PieChart, Cell, Legend } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Attendance, User } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

export default function ReportesPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [selectedGrade, setSelectedGrade] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [isExporting, setIsExporting] = useState(false);

    // Cargar datos de Firebase
    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users } = useCollection<User>(usersQuery);

    const attendanceQuery = useMemoFirebase(() => collection(firestore, 'attendance'), [firestore]);
    const { data: allAttendanceData } = useCollection<Attendance>(attendanceQuery);

    const allStudents = users?.filter((user) => user.role === 'student');

    // Obtener grados y secciones únicos
    const gradeOrder = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', '1°', '2°', '3°', '4°', '5°'];
    const uniqueGrades = Array.from(new Set(allStudents?.map(s => s.grade).filter(Boolean))) as string[];
    const sortedGrades = uniqueGrades.sort((a, b) => {
        const indexA = gradeOrder.indexOf(a);
        const indexB = gradeOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b, 'es');
    });

    const uniqueSections = Array.from(new Set(allStudents?.map(s => s.section).filter(Boolean))) as string[];

    // Calcular estadísticas generales
    const generalStats = useMemo(() => {
        if (!allAttendanceData || !allStudents) return null;

        const totalRecords = allAttendanceData.reduce((sum, att) => sum + att.records.length, 0);
        const presentCount = allAttendanceData.reduce((sum, att) => 
            sum + att.records.filter(r => r.status === 'present').length, 0
        );
        const lateCount = allAttendanceData.reduce((sum, att) => 
            sum + att.records.filter(r => r.status === 'late').length, 0
        );
        const justifiedCount = allAttendanceData.reduce((sum, att) => 
            sum + att.records.filter(r => r.status === 'justified').length, 0
        );
        const absentCount = allAttendanceData.reduce((sum, att) => 
            sum + att.records.filter(r => r.status === 'absent').length, 0
        );

        return {
            total: totalRecords,
            present: presentCount,
            late: lateCount,
            justified: justifiedCount,
            absent: absentCount,
            attendanceRate: totalRecords > 0 ? ((presentCount + lateCount) / totalRecords * 100).toFixed(1) : '0'
        };
    }, [allAttendanceData, allStudents]);

    // Datos para gráfico de barras por grado
    const gradeAttendanceData = useMemo(() => {
        if (!allAttendanceData || !sortedGrades) return [];

        return sortedGrades.map(grade => {
            const gradeAttendances = allAttendanceData.filter(a => a.grade === grade);
            const total = gradeAttendances.reduce((sum, att) => sum + att.records.length, 0);
            const present = gradeAttendances.reduce((sum, att) => 
                sum + att.records.filter(r => r.status === 'present').length, 0
            );
            const late = gradeAttendances.reduce((sum, att) => 
                sum + att.records.filter(r => r.status === 'late').length, 0
            );
            const absent = gradeAttendances.reduce((sum, att) => 
                sum + att.records.filter(r => r.status === 'absent').length, 0
            );

            return {
                name: grade,
                presentes: present,
                tardanzas: late,
                ausentes: absent,
            };
        });
    }, [allAttendanceData, sortedGrades]);

    // Datos para gráfico circular
    const statusDistribution = useMemo(() => {
        if (!generalStats) return [];

        return [
            { name: 'Presentes', value: generalStats.present, color: '#10b981' },
            { name: 'Tardanzas', value: generalStats.late, color: '#f59e0b' },
            { name: 'Justificadas', value: generalStats.justified, color: '#3b82f6' },
            { name: 'Ausentes', value: generalStats.absent, color: '#ef4444' },
        ].filter(item => item.value > 0);
    }, [generalStats]);

    // Exportar a Excel
    const exportToExcel = () => {
        if (!selectedGrade || !selectedSection || !allAttendanceData) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Selecciona un grado y sección primero.',
            });
            return;
        }

        setIsExporting(true);

        try {
            const filteredAttendances = allAttendanceData.filter(
                a => a.grade === selectedGrade && a.section === selectedSection
            ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (filteredAttendances.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Sin datos',
                    description: 'No hay asistencias registradas para este grado y sección.',
                });
                setIsExporting(false);
                return;
            }

            const excelData = filteredAttendances.flatMap(att => 
                att.records.map(record => ({
                    'Fecha': format(new Date(att.date), 'dd/MM/yyyy'),
                    'Estudiante': record.studentName,
                    'Estado': record.status === 'present' ? 'Presente' : 
                             record.status === 'late' ? 'Tardanza' : 
                             record.status === 'justified' ? 'Justificada' : 
                             record.status === 'absent' ? 'Faltó' : 'Sin registro',
                    'Hora Registro': record.registeredTime || '-',
                    'Fecha Registro': record.registeredDate || '-',
                }))
            );

            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Asistencias');
            
            // Ajustar ancho de columnas
            ws['!cols'] = [
                { wch: 12 },
                { wch: 35 },
                { wch: 15 },
                { wch: 15 },
                { wch: 15 }
            ];

            XLSX.writeFile(wb, `Asistencias_${selectedGrade}_${selectedSection}_${format(new Date(), 'ddMMyyyy')}.xlsx`);

            toast({
                title: 'Excel Generado',
                description: `Archivo descargado exitosamente.`,
            });
        } catch (error) {
            console.error('Error al exportar Excel:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo generar el archivo Excel.',
            });
        } finally {
            setIsExporting(false);
        }
    };

    // Exportar a PDF
    const exportToPDF = () => {
        if (!selectedGrade || !selectedSection || !allAttendanceData) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Selecciona un grado y sección primero.',
            });
            return;
        }

        setIsExporting(true);

        try {
            const filteredAttendances = allAttendanceData.filter(
                a => a.grade === selectedGrade && a.section === selectedSection
            ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (filteredAttendances.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Sin datos',
                    description: 'No hay asistencias registradas para este grado y sección.',
                });
                setIsExporting(false);
                return;
            }

            const doc = new jsPDF();
            
            // Título
            doc.setFontSize(18);
            doc.text(`Reporte de Asistencias`, 14, 20);
            doc.setFontSize(12);
            doc.text(`${selectedGrade} - Sección ${selectedSection}`, 14, 28);
            doc.setFontSize(10);
            doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 14, 34);

            // Estadísticas
            const stats = {
                total: filteredAttendances.reduce((sum, att) => sum + att.records.length, 0),
                present: filteredAttendances.reduce((sum, att) => sum + att.records.filter(r => r.status === 'present').length, 0),
                late: filteredAttendances.reduce((sum, att) => sum + att.records.filter(r => r.status === 'late').length, 0),
                absent: filteredAttendances.reduce((sum, att) => sum + att.records.filter(r => r.status === 'absent').length, 0),
            };

            doc.setFontSize(10);
            doc.text(`Total Registros: ${stats.total} | Presentes: ${stats.present} | Tardanzas: ${stats.late} | Ausentes: ${stats.absent}`, 14, 42);

            // Tabla
            const tableData = filteredAttendances.flatMap(att => 
                att.records.map(record => [
                    format(new Date(att.date), 'dd/MM/yyyy'),
                    record.studentName,
                    record.status === 'present' ? 'Presente' : 
                    record.status === 'late' ? 'Tardanza' : 
                    record.status === 'justified' ? 'Justificada' : 
                    record.status === 'absent' ? 'Faltó' : 'Sin registro',
                    record.registeredTime || '-',
                ])
            );

            autoTable(doc, {
                head: [['Fecha', 'Estudiante', 'Estado', 'Hora']],
                body: tableData,
                startY: 48,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [63, 81, 181], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
            });

            doc.save(`Asistencias_${selectedGrade}_${selectedSection}_${format(new Date(), 'ddMMyyyy')}.pdf`);

            toast({
                title: 'PDF Generado',
                description: `Archivo descargado exitosamente.`,
            });
        } catch (error) {
            console.error('Error al exportar PDF:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudo generar el archivo PDF.',
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="grid gap-6">
            {/* Estadísticas Generales */}
            {generalStats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Registros</CardDescription>
                            <CardTitle className="text-3xl">{generalStats.total}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Presentes</CardDescription>
                            <CardTitle className="text-3xl text-green-600">{generalStats.present}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Tardanzas</CardDescription>
                            <CardTitle className="text-3xl text-yellow-600">{generalStats.late}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Ausentes</CardDescription>
                            <CardTitle className="text-3xl text-red-600">{generalStats.absent}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Tasa Asistencia</CardDescription>
                            <CardTitle className="text-3xl text-blue-600">{generalStats.attendanceRate}%</CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            {/* Gráficos */}
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Asistencias por Grado</CardTitle>
                        <CardDescription>Distribución de presentes, tardanzas y ausentes por grado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={gradeAttendanceData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                                    <YAxis tickLine={false} axisLine={false} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="presentes" fill="#10b981" radius={[4, 4, 0, 0]} name="Presentes" />
                                    <Bar dataKey="tardanzas" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Tardanzas" />
                                    <Bar dataKey="ausentes" fill="#ef4444" radius={[4, 4, 0, 0]} name="Ausentes" />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Distribución de Estados</CardTitle>
                        <CardDescription>Porcentaje general de cada estado de asistencia.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip />
                                    <Legend />
                                    <Pie 
                                        data={statusDistribution} 
                                        dataKey="value" 
                                        nameKey="name" 
                                        cx="50%" 
                                        cy="50%" 
                                        outerRadius={100}
                                        label
                                    >
                                        {statusDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Exportar Reportes */}
            <Card>
                <CardHeader>
                    <CardTitle>Exportar Reportes</CardTitle>
                    <CardDescription>Genera reportes de asistencia en formato PDF o Excel por grado y sección.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Grado</Label>
                            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona un grado" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sortedGrades.map(grade => (
                                        <SelectItem key={grade} value={grade}>
                                            {grade}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Sección</Label>
                            <Select 
                                value={selectedSection} 
                                onValueChange={setSelectedSection}
                                disabled={!selectedGrade}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una sección" />
                                </SelectTrigger>
                                <SelectContent>
                                    {uniqueSections.sort().map(section => (
                                        <SelectItem key={section} value={section}>
                                            {section}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button 
                            onClick={exportToExcel}
                            disabled={!selectedGrade || !selectedSection || isExporting}
                            className="flex-1"
                        >
                            {isExporting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                            )}
                            Exportar a Excel
                        </Button>
                        <Button 
                            onClick={exportToPDF}
                            disabled={!selectedGrade || !selectedSection || isExporting}
                            variant="outline"
                            className="flex-1"
                        >
                            {isExporting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <FileDown className="mr-2 h-4 w-4" />
                            )}
                            Exportar a PDF
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
