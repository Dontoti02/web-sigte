'use client';
import { useState, useMemo, useCallback } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
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
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [isExporting, setIsExporting] = useState(false);

    // Cargar datos de Firebase
    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users } = useCollection<User>(usersQuery);

    const attendanceQuery = useMemoFirebase(() => collection(firestore, 'attendance'), [firestore]);
    const { data: allAttendanceData } = useCollection<Attendance>(attendanceQuery);

    const allStudents = users?.filter((user) => user.role === 'student');

    // Obtener secciones únicas
    const uniqueSections = Array.from(new Set(allStudents?.map(s => s.section).filter(Boolean))) as string[];

    // Obtener fechas disponibles de asistencias
    const availableDates = useMemo(() => {
        if (!allAttendanceData) return [];
        const dates = Array.from(new Set(
            allAttendanceData.map(att => format(new Date(att.date), 'yyyy-MM-dd'))
        )).sort().reverse();
        return dates;
    }, [allAttendanceData]);

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

    // Datos para gráfico de líneas - Tendencia de asistencia por fecha
    const attendanceTrendData = useMemo(() => {
        if (!allAttendanceData) return [];

        // Agrupar por fecha y calcular estadísticas
        const dateMap = new Map<string, { present: number; late: number; absent: number; total: number }>();

        allAttendanceData.forEach(att => {
            const dateStr = format(new Date(att.date), 'dd/MM/yyyy');
            const current = dateMap.get(dateStr) || { present: 0, late: 0, absent: 0, total: 0 };
            
            const presentCount = att.records.filter(r => r.status === 'present').length;
            const lateCount = att.records.filter(r => r.status === 'late').length;
            const absentCount = att.records.filter(r => r.status === 'absent').length;

            current.present += presentCount;
            current.late += lateCount;
            current.absent += absentCount;
            current.total += att.records.length;

            dateMap.set(dateStr, current);
        });

        // Convertir a array y ordenar por fecha
        return Array.from(dateMap.entries())
            .sort((a, b) => {
                const dateA = new Date(a[0].split('/').reverse().join('-'));
                const dateB = new Date(b[0].split('/').reverse().join('-'));
                return dateA.getTime() - dateB.getTime();
            })
            .slice(-30) // Últimos 30 registros
            .map(([date, stats]) => ({
                date,
                presentes: stats.present,
                tardanzas: stats.late,
                ausentes: stats.absent,
                tasa: stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0,
            }));
    }, [allAttendanceData]);

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
    const exportToExcel = useCallback(() => {
        if (!selectedSection || !allAttendanceData) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Selecciona una sección primero.',
            });
            return;
        }

        setIsExporting(true);

        try {
            let filteredAttendances = allAttendanceData
                .filter(a => a.section === selectedSection)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Aplicar filtro de fechas si están definidas
            if (startDate || endDate) {
                filteredAttendances = filteredAttendances.filter(att => {
                    const attDate = format(new Date(att.date), 'yyyy-MM-dd');
                    if (startDate && attDate < startDate) return false;
                    if (endDate && attDate > endDate) return false;
                    return true;
                });
            }

            if (filteredAttendances.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Sin datos',
                    description: 'No hay asistencias registradas para los filtros seleccionados.',
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

            const dateRange = startDate && endDate ? `_${startDate}_a_${endDate}` : '';
            XLSX.writeFile(wb, `Asistencias_Seccion_${selectedSection}${dateRange}_${format(new Date(), 'ddMMyyyy')}.xlsx`);

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
    }, [selectedSection, startDate, endDate, allAttendanceData, toast]);

    // Exportar a PDF
    const exportToPDF = useCallback(() => {
        if (!selectedSection || !allAttendanceData) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Selecciona una sección primero.',
            });
            return;
        }

        setIsExporting(true);

        try {
            let filteredAttendances = allAttendanceData
                .filter(a => a.section === selectedSection)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Aplicar filtro de fechas si están definidas
            if (startDate || endDate) {
                filteredAttendances = filteredAttendances.filter(att => {
                    const attDate = format(new Date(att.date), 'yyyy-MM-dd');
                    if (startDate && attDate < startDate) return false;
                    if (endDate && attDate > endDate) return false;
                    return true;
                });
            }

            if (filteredAttendances.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Sin datos',
                    description: 'No hay asistencias registradas para los filtros seleccionados.',
                });
                setIsExporting(false);
                return;
            }

            const doc = new jsPDF();
            
            // Título
            doc.setFontSize(18);
            doc.text(`Reporte de Asistencias`, 14, 20);
            doc.setFontSize(12);
            doc.text(`Sección ${selectedSection}`, 14, 28);
            doc.setFontSize(10);
            const dateRangeText = startDate && endDate 
                ? `Período: ${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`
                : 'Todos los registros';
            doc.text(dateRangeText, 14, 34);
            doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 14, 40);

            // Estadísticas
            const stats = {
                total: filteredAttendances.reduce((sum, att) => sum + att.records.length, 0),
                present: filteredAttendances.reduce((sum, att) => sum + att.records.filter(r => r.status === 'present').length, 0),
                late: filteredAttendances.reduce((sum, att) => sum + att.records.filter(r => r.status === 'late').length, 0),
                absent: filteredAttendances.reduce((sum, att) => sum + att.records.filter(r => r.status === 'absent').length, 0),
            };

            doc.setFontSize(10);
            doc.text(`Total Registros: ${stats.total} | Presentes: ${stats.present} | Tardanzas: ${stats.late} | Ausentes: ${stats.absent}`, 14, 48);

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
                startY: 54,
                styles: { fontSize: 8, cellPadding: 2 },
                headStyles: { fillColor: [63, 81, 181], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 245, 245] },
            });

            const dateRange = startDate && endDate ? `_${startDate}_a_${endDate}` : '';
            doc.save(`Asistencias_Seccion_${selectedSection}${dateRange}_${format(new Date(), 'ddMMyyyy')}.pdf`);

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
    }, [selectedSection, startDate, endDate, allAttendanceData, toast]);

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
                        <CardTitle>Tendencia de Asistencia</CardTitle>
                        <CardDescription>Evolución de asistencia en los últimos registros.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer
                            config={{
                                presentes: { label: 'Presentes', color: '#10b981' },
                                tardanzas: { label: 'Tardanzas', color: '#f59e0b' },
                                ausentes: { label: 'Ausentes', color: '#ef4444' },
                                tasa: { label: 'Tasa %', color: '#3b82f6' },
                            }}
                            className="h-80"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={attendanceTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                                    <YAxis tickLine={false} axisLine={false} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Line type="monotone" dataKey="presentes" stroke="#10b981" strokeWidth={2} name="Presentes" dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="tardanzas" stroke="#f59e0b" strokeWidth={2} name="Tardanzas" dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="ausentes" stroke="#ef4444" strokeWidth={2} name="Ausentes" dot={{ r: 4 }} />
                                </LineChart>
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
                            <PieChart>
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Pie 
                                    data={statusDistribution} 
                                    dataKey="value" 
                                    nameKey="name" 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={60}
                                    outerRadius={100}
                                    labelLine={false}
                                >
                                    {statusDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Exportar Reportes */}
            <Card>
                <CardHeader>
                    <CardTitle>Exportar Reportes</CardTitle>
                    <CardDescription>Genera reportes de asistencia en formato PDF o Excel por sección y rango de fechas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Sección</Label>
                            <Select 
                                value={selectedSection} 
                                onValueChange={setSelectedSection}
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
                        <div>
                            <Label>Fecha Inicio</Label>
                            <Select value={startDate} onValueChange={setStartDate}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Desde..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableDates.map(date => (
                                        <SelectItem key={date} value={date}>
                                            {format(new Date(date), 'dd/MM/yyyy')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Fecha Fin</Label>
                            <Select value={endDate} onValueChange={setEndDate}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Hasta..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableDates.map(date => (
                                        <SelectItem key={date} value={date}>
                                            {format(new Date(date), 'dd/MM/yyyy')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <Button 
                            onClick={exportToExcel}
                            disabled={!selectedSection || isExporting}
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
                            disabled={!selectedSection || isExporting}
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
