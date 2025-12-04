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
import { Game, Round, UnassignedLetterQuestion } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Skeleton } from './ui/skeleton';

const unassignedLetterQuestionSchema = z.object({
  question: z.string().min(1, 'Question is required.'),
  answer: z.string().min(1, 'Answer is required.'),
});

const roundSchema = z.object({
  mainQuestion: z.string().min(10, 'Main question must be at least 10 characters.'),
  mainAnswer: z
    .string()
    .min(1, 'Main answer is required.')
    .regex(/^[A-Z\s]+$/, 'Main answer can only contain uppercase letters and spaces.'),
  unassignedLetterQuestions: z.array(unassignedLetterQuestionSchema),
});

const formSchema = z.object({
  rounds: z.array(roundSchema).min(1, 'At least one round is required.'),
});

type FormData = z.infer<typeof formSchema>;


function generateGameCode(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    if (typeof window !== 'undefined') {
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
    } else {
        result = Array.from({length}, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
    }
    return result;
}


function LetterFields({ roundIndex, control, form }: { roundIndex: number, control: any, form: any }) {
    const { fields, replace } = useFieldArray({
        control,
        name: `rounds.${roundIndex}.unassignedLetterQuestions`
    });

    const mainAnswer: string = useWatch({
      control,
      name: `rounds.${roundIndex}.mainAnswer`,
    }) || '';
    
    const uniqueLettersCount = new Set((mainAnswer).replace(/\s/g, '').split('').filter(Boolean)).size;

    useEffect(() => {
        const currentFields = form.getValues(`rounds.${roundIndex}.unassignedLetterQuestions`);
        const newFields: UnassignedLetterQuestion[] = Array.from({ length: uniqueLettersCount }, (_, i) => {
            return currentFields[i] || { question: '', answer: '' };
        });
        replace(newFields);
    }, [uniqueLettersCount, replace, form, roundIndex]);
    
    if (uniqueLettersCount === 0) {
      return (
         <p className='text-muted-foreground text-center py-4'>
              Enter a main answer above to add letter-reveal questions.
          </p>
      )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Letter-Reveal Questions</CardTitle>
                <FormDescription>
                    The main answer has {uniqueLettersCount} unique letter(s). Please provide {uniqueLettersCount} question(s). They will be randomly assigned to the letters.
                </FormDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
                {fields.map((field, index) => (
                    <div key={field.id}>
                        {index > 0 && <Separator className='mb-6' />}
                        <h3 className="text-lg font-semibold mb-4">
                            Question Set {index + 1}
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                                control={control}
                                name={`rounds.${roundIndex}.unassignedLetterQuestions.${index}.question`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Question</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Question text`} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name={`rounds.${roundIndex}.unassignedLetterQuestions.${index}.answer`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Answer</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Answer text`} {...field} />
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
            rounds: [{ mainQuestion: '', mainAnswer: '', unassignedLetterQuestions: [] }],
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
                console.error(validation.error.flatten().fieldErrors);
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
            console.error("Export failed", error);
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not export the game data.' });
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
                    console.error(validation.error.flatten().fieldErrors);
                    throw new Error("JSON file structure is not valid.");
                }
            } catch (err) {
                 if (err instanceof Error) {
                    toast({ variant: 'destructive', title: 'Import Failed', description: err.message });
                 }
            }
        };
        reader.readAsText(file);
        // Reset file input to allow re-uploading the same file
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
                 const uniqueLetters = [...new Set((r.mainAnswer).replace(/\s/g, '').split('').filter(Boolean))];
                 if (uniqueLetters.length !== r.unassignedLetterQuestions.length) {
                     throw new Error(`Round with question "${r.mainQuestion.substring(0, 20)}..." has a mismatch between unique letters (${uniqueLetters.length}) and provided questions (${r.unassignedLetterQuestions.length}).`);
                 }

                // Shuffle questions for random assignment
                const shuffledQuestions = [...r.unassignedLetterQuestions].sort(() => Math.random() - 0.5);

                const letterQuestionsMap: Record<string, Omit<AssignedLetterQuestion, 'letter'>> = {};
                uniqueLetters.forEach((letter, index) => {
                    const questionData = shuffledQuestions[index];
                    letterQuestionsMap[letter.toUpperCase()] = { 
                        question: questionData.question,
                        answer: questionData.answer
                    };
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

            const gameDocRef = doc(firestore, 'games', gameId);

            const gameData: Omit<Game, 'createdAt' | 'lastActivityAt'> & { createdAt: any, lastActivityAt: any } = {
                id: gameId,
                creatorId: user.uid,
                rounds: gameRounds,
                currentRoundIndex: 0,
                status: 'lobby',
                createdAt: serverTimestamp(),
                lastActivityAt: serverTimestamp(),
            };

            await setDoc(gameDocRef, gameData).catch(error => {
                 errorEmitter.emit(
                    'permission-error',
                    new FirestorePermissionError({
                        path: gameDocRef.path,
                        operation: 'create',
                        requestResourceData: gameData
                    })
                )
            });

            toast({
                title: 'Game Created!',
                description: `Game with code ${gameId} has been created.`,
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
                                            <FormDescription>The answer to the main question. Use only letters and spaces.</FormDescription>
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
                    onClick={() => append({ mainQuestion: '', mainAnswer: '', unassignedLetterQuestions: [] })}
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
