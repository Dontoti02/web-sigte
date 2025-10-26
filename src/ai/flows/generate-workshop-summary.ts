'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a summary of workshop feedback using AI.
 *
 * It includes:
 * - generateWorkshopSummary: An async function that takes workshop feedback as input and returns a summarized analysis.
 * - GenerateWorkshopSummaryInput: The input type for the generateWorkshopSummary function.
 * - GenerateWorkshopSummaryOutput: The output type for the generateWorkshopSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateWorkshopSummaryInputSchema = z.object({
  feedback: z
    .string()
    .describe('The feedback provided for the workshop.'),
  workshopName: z.string().describe('The name of the workshop.'),
});
export type GenerateWorkshopSummaryInput = z.infer<typeof GenerateWorkshopSummaryInputSchema>;

const GenerateWorkshopSummaryOutputSchema = z.object({
  summary: z.string().describe('A summarized analysis of the workshop feedback, highlighting key takeaways and areas for improvement.'),
});
export type GenerateWorkshopSummaryOutput = z.infer<typeof GenerateWorkshopSummaryOutputSchema>;

export async function generateWorkshopSummary(input: GenerateWorkshopSummaryInput): Promise<GenerateWorkshopSummaryOutput> {
  return generateWorkshopSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWorkshopSummaryPrompt',
  input: {schema: GenerateWorkshopSummaryInputSchema},
  output: {schema: GenerateWorkshopSummaryOutputSchema},
  prompt: `You are an AI assistant designed to summarize workshop feedback and identify areas for improvement.

  Summarize the key takeaways and identify areas for improvement from the following workshop feedback for the workshop: {{workshopName}}.

  Feedback: {{{feedback}}}

  Please provide a concise summary.
  `,
});

const generateWorkshopSummaryFlow = ai.defineFlow(
  {
    name: 'generateWorkshopSummaryFlow',
    inputSchema: GenerateWorkshopSummaryInputSchema,
    outputSchema: GenerateWorkshopSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
