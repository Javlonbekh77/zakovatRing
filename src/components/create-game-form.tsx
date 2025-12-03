'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Wand } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import React, { useState, useEffect, useCallback } from 'react';
import { createGameOnClient } from '@/app/admin/actions';
import { Game, LetterQuestion } from '@/lib/types';
import { useRouter } from 'next/navigation';


const letterQuestionSchema = z.object({
  letter: z.string(),
  question: z.string().min(1, 'Question is required.'),
  answer: z.string().min(1, 'Answer is required.'),
});

const formSchema = z.object({
  mainQuestion: z.string().min(10, 'Main question must be at least 10 characters.'),
  mainAnswer: z
    .string()
    .min(2, 'Main answer must be at least 2 characters.')
    .regex(/^[A-Z\s]+$/, 'Main answer can only contain uppercase letters and spaces.'),
  letterQuestions: z.array(letterQuestionSchema),
});

function generateGameCode(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export default function CreateGameForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  useEffect(() => {
      setIsMounted(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mainQuestion: '',
      mainAnswer: '',
      letterQuestions: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: 'letterQuestions',
  });

  const mainAnswer = form.watch('mainAnswer');
  
  useEffect(() => {
    if (!isMounted) return;
    const timer = setTimeout(() => {
      const uniqueLetters = [...new Set(mainAnswer.replace(/\s/g, '').split(''))];
      const existingLetterData = fields.reduce((acc, field) => {
        acc[field.letter] = { question: field.question, answer: field.answer };
        return acc;
      }, {} as Record<string, { question: string; answer: string }>);

      const newFields = uniqueLetters.map(letter => ({
        letter,
        question: existingLetterData[letter]?.question || '',
        answer: existingLetterData[letter]?.answer || '',
      }));

      replace(newFields);
    }, 500); // Debounce to avoid rapid updates

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainAnswer, isMounted, replace]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

    try {
        const gameId = generateGameCode(4);

        const letterQuestionsMap: Record<string, LetterQuestion> = {};
        const uniqueLetters = [...new Set(values.mainAnswer.replace(/\s/g, '').split(''))];
        
        if (values.letterQuestions.length !== uniqueLetters.length) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Please fill out the questions for all unique letters in the answer.',
            });
            setIsSubmitting(false);
            return;
        }

        values.letterQuestions.forEach(lq => {
            letterQuestionsMap[lq.letter] = { question: lq.question, answer: lq.answer };
        });

        const gameData: Game = {
            id: gameId,
            mainQuestion: values.mainQuestion,
            mainAnswer: values.mainAnswer,
            letterQuestions: letterQuestionsMap,
            revealedLetters: [],
            status: 'lobby',
            createdAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
            currentPoints: 1000,
        };

        // Save to local storage instead of server
        localStorage.setItem(`game-${gameId}`, JSON.stringify(gameData));

        toast({
            title: 'Game Created Locally!',
            description: `Game with code ${gameId} has been saved in your browser.`,
        });

        // Redirect using client-side router
        router.push(`/admin/created/${gameId}`);

    } catch (error) {
      if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'An unexpected error occurred',
          description: error.message,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isMounted) {
      return (
          <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
          </div>
      );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="mainQuestion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Main Question</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., What is the capital of France?" {...field} />
              </FormControl>
              <FormDescription>This is the main riddle the teams will try to solve.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mainAnswer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Main Answer</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., PARIS"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </FormControl>
              <FormDescription>The answer to the main question. Use only letters and spaces.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {fields.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle>Letter Questions</CardTitle>
                    <FormDescription>
                        For each unique letter in your answer, provide a question and its answer.
                    </FormDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                    {fields.map((field, index) => (
                        <div key={field.id}>
                            {index > 0 && <Separator className='mb-6'/>}
                             <h3 className="text-2xl font-bold font-mono text-primary mb-4">
                                Letter: {field.letter}
                            </h3>
                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                <FormField
                                    control={form.control}
                                    name={`letterQuestions.${index}.question`}
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Question</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Question for '${field.name}'`} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`letterQuestions.${index}.answer`}
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Answer</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Answer for '${field.name}'`} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || fields.length === 0}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand className="mr-2 h-4 w-4" />
          )}
          Create Game
        </Button>
      </form>
    </Form>
  );
}
