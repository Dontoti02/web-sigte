'use server';

/**
 * @fileOverview Generates insights about student attendance using AI to identify trends and at-risk students.
 *
 * - generateAttendanceReportInsights - A function that generates insights from attendance data.
 * - GenerateAttendanceReportInsightsInput - The input type for the generateAttendanceReportInsights function.
 * - GenerateAttendanceReportInsightsOutput - The return type for the generateAttendanceReportInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAttendanceReportInsightsInputSchema = z.object({
  attendanceReport: z
    .string()
    .describe(
      'A detailed report of student attendance, including dates, students, and attendance statuses.'
    ),
});
export type GenerateAttendanceReportInsightsInput = z.infer<
  typeof GenerateAttendanceReportInsightsInputSchema
>;

const GenerateAttendanceReportInsightsOutputSchema = z.object({
  summary: z.string().describe('A summary of the key attendance trends.'),
  atRiskStudents: z
    .string()
    .describe('A list of students identified as at-risk based on attendance.'),
  recommendations: z
    .string()
    .describe('Recommendations for improving attendance rates and supporting at-risk students.'),
});
export type GenerateAttendanceReportInsightsOutput = z.infer<
  typeof GenerateAttendanceReportInsightsOutputSchema
>;

export async function generateAttendanceReportInsights(
  input: GenerateAttendanceReportInsightsInput
): Promise<GenerateAttendanceReportInsightsOutput> {
  return generateAttendanceReportInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAttendanceReportInsightsPrompt',
  input: {schema: GenerateAttendanceReportInsightsInputSchema},
  output: {schema: GenerateAttendanceReportInsightsOutputSchema},
  prompt: `You are an AI assistant that analyzes student attendance reports and provides insights to improve attendance rates.

  Analyze the following attendance report:
  {{attendanceReport}}

  Provide a summary of the key attendance trends.
  Identify students who are at-risk based on their attendance records.
  Offer recommendations for improving overall attendance rates and supporting at-risk students.
  
  Format the result as a JSON object with the following keys: summary, atRiskStudents, recommendations.
  `,
});

const generateAttendanceReportInsightsFlow = ai.defineFlow(
  {
    name: 'generateAttendanceReportInsightsFlow',
    inputSchema: GenerateAttendanceReportInsightsInputSchema,
    outputSchema: GenerateAttendanceReportInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
