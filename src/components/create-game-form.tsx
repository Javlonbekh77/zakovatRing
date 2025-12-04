'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
import { Loader2, Plus, Trash, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import React, { useState, useEffect, useCallback } from 'react';
import { Game, Round, GameStatus, FormLetterQuestion, Team } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Skeleton } from './ui/skeleton';

const letterQuestionSchema = z.object({
  letter: z.string(),
  question: z.string().min(1, 'Question is required.'),
  answer: z.string().min(1, 'Answer is required.'),
});

const roundSchema = z.object({
  mainQuestion: z.string().min(10, 'Main question must be at least 10 characters.'),
  mainAnswer: z
    .string()
    .min(1, 'Main answer is required.')
    .regex(/^[A-Z\s]+$/, 'Main answer can only contain uppercase letters and spaces.'),
  letterQuestions: z.array(letterQuestionSchema)
});

const formSchema = z.object({
  rounds: z.array(roundSchema).min(1, 'At least one round is required.'),
});

type FormData = z.infer<typeof formSchema>;

function generateGameCode(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function LetterFields({ roundIndex, control, form }: { roundIndex: number, control: any, form: any }) {
    const mainAnswer: string = useWatch({
      control,
      name: `rounds.${roundIndex}.mainAnswer`,
      defaultValue: ""
    }) || '';
    
    const { fields, replace } = useFieldArray({
        control,
        name: `rounds.${roundIndex}.letterQuestions`
    });

    useEffect(() => {
        const answerLetters = mainAnswer.replace(/\s/g, '').split('');
        
        // Unregister old fields to prevent stale data issues on validation
        form.unregister(`rounds.${roundIndex}.letterQuestions`);

        const existingFields = form.getValues(`rounds.${roundIndex}.letterQuestions`);
        const existingData: { [key: string]: { question: string, answer: string } } = {};
        if (Array.isArray(existingFields)) {
            existingFields.forEach((field: FormLetterQuestion) => {
                if (field.letter) {
                    existingData[field.letter] = { question: field.question, answer: field.answer };
                }
            });
        }
        
        const newFields: FormLetterQuestion[] = answerLetters.map(letter => ({
            letter: letter,
            question: existingData[letter]?.question || '',
            answer: existingData[letter]?.answer || ''
        }));
        replace(newFields);
    }, [mainAnswer, replace, form, roundIndex]);

    if (!mainAnswer) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Letter-Reveal Questions</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Please enter a Main Answer above to generate fields for letter-reveal questions.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Letter-Reveal Questions</CardTitle>
                <FormDescription>
                    Provide one question for each letter in your main answer.
                </FormDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md">
                        {index > 0 && <Separator className='absolute -top-3 left-0 w-full' />}
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                           Question for letter: <span className='font-mono text-2xl text-primary bg-primary/10 px-2 rounded-md'>{mainAnswer.replace(/\s/g, '')[index]}</span>
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                                control={control}
                                name={`rounds.${roundIndex}.letterQuestions.${index}.question`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Question</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Question that reveals '${mainAnswer.replace(/\s/g, '')[index]}'`} {...field} />
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
                                            <Input placeholder={`Answer to the question`} {...field} />
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
    const [isClient, setIsClient] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            rounds: [{ mainQuestion: '', mainAnswer: '', letterQuestions: [] }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "rounds"
    });

    const handleExport = useCallback(() => {
        try {
            const values = form.getValues();
            const validation = formSchema.safeParse(values);
            if (!validation.success) {
                toast({
                    variant: 'destructive',
                    title: 'Form is not valid',
                    description: 'Please fix the errors before exporting.',
                });
                console.error("Form validation errors on export:", validation.error.flatten().fieldErrors);
                return;
            }

            const dataStr = JSON.stringify(validation.data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = 'zakovat_game.json';

            let linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();

        } catch (error) {
             if (error instanceof Error) {
                console.error("Export failed", error);
                toast({ variant: 'destructive', title: 'Export Failed', description: error.message });
            }
        }
    }, [form, toast]);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("File is not a valid text file.");
                }
                const jsonData = JSON.parse(text);
                const validation = formSchema.safeParse(jsonData);

                if (validation.success) {
                    form.reset(validation.data);
                    toast({ title: 'Game Imported!', description: 'Your game data has been loaded into the form.' });
                } else {
                    console.error("Import validation failed:", validation.error.flatten().fieldErrors);
                    throw new Error("JSON file structure is not valid.");
                }
            } catch (err) {
                 if (err instanceof Error) {
                    toast({ variant: 'destructive', title: 'Import Failed', description: err.message });
                 }
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };


    async function onSubmit(values: FormData) {
        setIsSubmitting(true);
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be signed in to create a game.' });
            setIsSubmitting(false);
            return;
        }

        try {
            const gameId = generateGameCode(4);

            const gameRounds: Round[] = values.rounds.map(r => {
                const letterQuestionsMap: Round['letterQuestions'] = {};
                const letterIndices: Record<string, number> = {};

                r.letterQuestions.forEach((lq) => {
                    const upperLetter = lq.letter.toUpperCase();
                    const count = letterIndices[upperLetter] || 0;
                    const uniqueKey = `${upperLetter}_${count}`;
                    letterIndices[upperLetter] = count + 1;

                    letterQuestionsMap[uniqueKey] = { 
                        question: lq.question,
                        answer: lq.answer
                    };
                });

                return {
                    mainQuestion: r.mainQuestion,
                    mainAnswer: r.mainAnswer,
                    letterQuestions: letterQuestionsMap,
                    status: 'pending',
                    currentPoints: 1000,
                    winner: null,
                };
            });

            const gameDocRef = doc(firestore, 'games', gameId);

            const gameData: Omit<Game, 'team1' | 'team2'> = {
                id: gameId,
                creatorId: user.uid,
                rounds: gameRounds,
                currentRoundIndex: 0, // Master index
                status: 'lobby' as GameStatus,
                createdAt: serverTimestamp(),
                lastActivityAt: serverTimestamp(),
            };
            

            await setDoc(gameDocRef, gameData);

            toast({
                title: 'Game Created!',
                description: `Game with code ${gameId} has been created.`,
            });

            router.push(`/admin/created/${gameId}`);

        } catch (error) {
            if (error instanceof FirestorePermissionError) {
                errorEmitter.emit('permission-error', error);
            } else if (error instanceof Error) {
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

    if (!isClient || isUserLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="w-full h-40 rounded-lg bg-muted animate-pulse" />
                <Skeleton className="w-full h-12 rounded-lg bg-muted animate-pulse" />
                <Skeleton className="w-full h-12 rounded-lg bg-muted animate-pulse" />
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Accordion type="multiple" defaultValue={['item-0']} className="w-full">
                    {fields.map((field, index) => (
                         <AccordionItem value={`item-${index}`} key={field.id}>
                            <div className="flex items-center w-full">
                                <AccordionTrigger className="flex-1">
                                    <span className='font-bold text-lg'>Round {index + 1}</span>
                                </AccordionTrigger>
                                {fields.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="ml-2 text-destructive hover:bg-destructive/10"
                                        onClick={() => remove(index)}
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
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
                                            <FormDescription>The answer to the main question. Use only uppercase letters and spaces.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <LetterFields roundIndex={index} control={form.control} form={form} />
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
                
                <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className='w-full'
                    >
                        <Upload className="mr-2 h-4 w-4" /> Import from JSON
                    </Button>
                     <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="application/json"
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleExport}
                        className='w-full'
                    >
                       <Download className="mr-2 h-4 w-4" /> Export to JSON
                    </Button>
                </div>


                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !user}>
                    {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                       "Create Game"
                    )}
                </Button>
            </form>
        </Form>
    );
}

    