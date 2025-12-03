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
import { Loader2, Plus, Trash, Wand } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import React, { useState, useEffect } from 'react';
import { Game, LetterQuestion, Round } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

const letterQuestionSchema = z.object({
  letter: z.string(),
  question: z.string().min(1, 'Question is required.'),
  answer: z.string().min(1, 'Answer is required.'),
});

const roundSchema = z.object({
  mainQuestion: z.string().min(10, 'Main question must be at least 10 characters.'),
  mainAnswer: z
    .string()
    .min(2, 'Main answer must be at least 2 characters.')
    .regex(/^[A-Z\s]+$/, 'Main answer can only contain uppercase letters and spaces.'),
  letterQuestions: z.array(letterQuestionSchema),
});

const formSchema = z.object({
  rounds: z.array(roundSchema).min(1, 'At least one round is required.'),
});


function generateGameCode(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function LetterFields({ roundIndex, control }: { roundIndex: number, control: any }) {
    const { fields, replace } = useFieldArray({
        control,
        name: `rounds.${roundIndex}.letterQuestions`
    });

    const mainAnswer = useForm().watch(`rounds.${roundIndex}.mainAnswer`);

    useEffect(() => {
        const uniqueLetters = [...new Set((mainAnswer || '').replace(/\s/g, '').split(''))];
        const existingLetterData = fields.reduce((acc, field: any) => {
            acc[field.letter] = { question: field.question, answer: field.answer };
            return acc;
        }, {} as Record<string, { question: string; answer: string }>);

        const newFields = uniqueLetters.map(letter => ({
            letter,
            question: existingLetterData[letter]?.question || '',
            answer: existingLetterData[letter]?.answer || '',
        }));

        replace(newFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mainAnswer, replace]);

    return (
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
                        {index > 0 && <Separator className='mb-6' />}
                        <h3 className="text-2xl font-bold font-mono text-primary mb-4">
                            Letter: {(field as any).letter}
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                                control={control}
                                name={`rounds.${roundIndex}.letterQuestions.${index}.question`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Question</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Question for '${(field as any).name}'`} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`rounds.${roundIndex}.letterQuestions.${index}.answer`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Answer</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Answer for '${(field as any).name}'`} {...field} />
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
    );
}

export default function CreateGameForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            rounds: [{ mainQuestion: '', mainAnswer: '', letterQuestions: [] }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "rounds"
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);
        try {
            const gameId = generateGameCode(4);

            const gameRounds: Round[] = values.rounds.map(r => {
                 const letterQuestionsMap: Record<string, LetterQuestion> = {};
                 r.letterQuestions.forEach(lq => {
                    letterQuestionsMap[lq.letter] = { question: lq.question, answer: lq.answer };
                });
                return {
                    mainQuestion: r.mainQuestion,
                    mainAnswer: r.mainAnswer,
                    letterQuestions: letterQuestionsMap,
                    status: 'pending',
                    currentPoints: 1000,
                    team1RevealedLetters: [],
                    team2RevealedLetters: [],
                };
            });

            if (gameRounds.length > 0) {
                gameRounds[0].status = 'in_progress';
            }

            const gameData: Game = {
                id: gameId,
                rounds: gameRounds,
                currentRoundIndex: 0,
                status: 'lobby',
                createdAt: new Date().toISOString(),
                lastActivityAt: new Date().toISOString(),
            };

            localStorage.setItem(`game-${gameId}`, JSON.stringify(gameData));

            toast({
                title: 'Game Created Locally!',
                description: `Game with code ${gameId} has been saved in your browser.`,
            });

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

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Accordion type="multiple" defaultValue={['item-0']} className="w-full">
                    {fields.map((field, index) => (
                        <AccordionItem value={`item-${index}`} key={field.id}>
                            <AccordionTrigger>
                                <div className="flex justify-between items-center w-full pr-4">
                                    <span className='font-bold text-lg'>Round {index + 1}</span>
                                    {fields.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation(); // prevent accordion from toggling
                                                remove(index);
                                            }}
                                        >
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-6 pt-4">
                                <FormField
                                    control={form.control}
                                    name={`rounds.${index}.mainQuestion`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Main Question</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="e.g., What is the capital of France?" {...field} />
                                            </FormControl>
                                            <FormDescription>This is the main riddle for this round.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name={`rounds.${index}.mainAnswer`}
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
                                <LetterFields roundIndex={index} control={form.control} />
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ mainQuestion: '', mainAnswer: '', letterQuestions: [] })}
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Round
                </Button>

                <Separator />

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
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
