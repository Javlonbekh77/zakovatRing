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
import { Loader2, Plus, Trash, Download, Upload, Save, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import React, { useState, useEffect, useCallback } from 'react';
import { Game, Round, UnassignedLetterQuestion } from '@/lib/types';
import { useRouter, useParams } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { serverTimestamp, doc, setDoc, runTransaction } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

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
  unassignedLetterQuestions: z.array(unassignedLetterQuestionSchema).min(1, "At least one letter-reveal question is required."),
});

const formSchema = z.object({
  rounds: z.array(roundSchema).min(1, 'At least one round is required.'),
});

type FormData = z.infer<typeof formSchema>;


function LetterFields({ roundIndex, control, form }: { roundIndex: number, control: any, form: any }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `rounds.${roundIndex}.unassignedLetterQuestions`
    });

    const mainAnswer: string = useWatch({
      control,
      name: `rounds.${roundIndex}.mainAnswer`,
    }) || '';
    
    const lettersCount = (mainAnswer).replace(/\s/g, '').length;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Letter-Reveal Questions</CardTitle>
                <FormDescription>
                    Provide a pool of questions for this round. The system will randomly assign them to the letters in the main answer ({lettersCount} letters).
                </FormDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md">
                        {index > 0 && <Separator className='absolute -top-3 left-0 w-full' />}
                        <h3 className="text-lg font-semibold mb-4">
                           Question Set {index + 1}
                        </h3>
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                            onClick={() => remove(index)}
                        >
                            <Trash className="h-4 w-4" />
                        </Button>
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
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ question: '', answer: '' })}
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Question
                </Button>
            </CardContent>
        </Card>
    );
}

export default function EditGamePage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const gameId = params.gameId as string;
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const gameDocRef = useMemoFirebase(() => firestore && gameId ? doc(firestore, 'games', gameId) : null, [firestore, gameId]);
    const { data: game, isLoading: isGameLoading, error: gameError } = useDoc<Game>(gameDocRef);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            rounds: [],
        },
    });

    useEffect(() => {
        if (game) {
            // Check if game.rounds is an array before mapping
            if (Array.isArray(game.rounds)) {
                const formRounds = game.rounds.map(r => {
                    // Because unassignedLetterQuestions are not stored, we just create empty ones
                    // based on the length of the main answer for initial display.
                    const answerLettersCount = r.mainAnswer.replace(/\s/g, '').length;
                    
                    const unassignedLetterQuestions: UnassignedLetterQuestion[] = Array.from({ length: answerLettersCount }, () => ({
                        question: '',
                        answer: '',
                    }));

                    // In a real scenario, you might want to fetch original unassigned questions if they were stored.
                    // For this logic, we assume they are not persisted, so we can't repopulate them.
                    
                    return {
                        mainQuestion: r.mainQuestion,
                        mainAnswer: r.mainAnswer,
                        unassignedLetterQuestions: r.unassignedLetterQuestions || [],
                    };
                });
                form.reset({ rounds: formRounds });
            } else {
                // Handle case where game.rounds is not an array (e.g. old data)
                console.warn("Game rounds data is not in array format. Initializing empty form.");
                form.reset({ rounds: [{ mainQuestion: '', mainAnswer: '', unassignedLetterQuestions: [] }] });
            }
        }
    }, [game, form]);

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
            const exportFileDefaultName = `zakovat_game_${gameId}.json`;

            let linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();

        } catch (error) {
            console.error("Export failed", error);
            toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not export the game data.' });
        }
    }, [form, toast, gameId]);
    
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
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };


    async function onSubmit(values: FormData) {
        setIsSubmitting(true);
        if (!firestore || !user || !gameDocRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot save. User or game not found.' });
            setIsSubmitting(false);
            return;
        }

        try {
            await runTransaction(firestore, async (transaction) => {
                const gameSnap = await transaction.get(gameDocRef);
                if (!gameSnap.exists()) throw new Error("Game not found!");

                const gameData = gameSnap.data() as Game;

                const newRounds: Round[] = values.rounds.map(r => {
                    const answerLetters = (r.mainAnswer).replace(/\s/g, '').split('').filter(Boolean);
                    if (answerLetters.length > r.unassignedLetterQuestions.length) {
                        throw new Error(`Round with question "${r.mainQuestion.substring(0, 20)}..." requires at least ${answerLetters.length} letter-reveal questions, but only ${r.unassignedLetterQuestions.length} were provided.`);
                    }
                    
                    const shuffledQuestions = [...r.unassignedLetterQuestions].sort(() => Math.random() - 0.5);

                    const letterQuestionsMap: Round['letterQuestions'] = {};
                    const letterIndices: Record<string, number> = {};

                    answerLetters.forEach((letter, index) => {
                        const questionData = shuffledQuestions[index];
                        const upperLetter = letter.toUpperCase();
                        const count = letterIndices[upperLetter] || 0;
                        const uniqueKey = `${upperLetter}_${count}`;
                        letterIndices[upperLetter] = count + 1;
                        letterQuestionsMap[uniqueKey] = { 
                            question: questionData.question,
                            answer: questionData.answer
                        };
                    });
                    
                    return {
                        ...gameData.rounds.find(or => or.mainQuestion === r.mainQuestion)!,
                        mainQuestion: r.mainQuestion,
                        mainAnswer: r.mainAnswer,
                        letterQuestions: letterQuestionsMap,
                        unassignedLetterQuestions: r.unassignedLetterQuestions,
                        status: 'pending',
                        currentPoints: 1000,
                        team1RevealedLetters: [],
                        team2RevealedLetters: [],
                        winner: null,
                    };
                });
                
                if (gameData.status === 'in_progress' || gameData.status === 'lobby') {
                    if (newRounds[gameData.currentRoundIndex]) {
                       newRounds[gameData.currentRoundIndex].status = 'in_progress';
                    }
                } else if (gameData.status === 'paused') {
                     if (newRounds[gameData.currentRoundIndex]) {
                       newRounds[gameData.currentRoundIndex].status = 'paused';
                    }
                }

                transaction.update(gameDocRef, {
                    rounds: newRounds,
                    lastActivityAt: serverTimestamp(),
                });
            });

            toast({
                title: 'Game Saved!',
                description: `Changes to game ${gameId} have been saved.`,
            });
            router.push(`/admin/games`);

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

    if (isUserLoading || isGameLoading) {
        return (
             <div className="flex-1 p-4 sm:p-6 md:p-8">
                 <div className="container mx-auto max-w-3xl">
                     <Skeleton className="w-full h-screen rounded-lg bg-muted animate-pulse" />
                 </div>
             </div>
        );
    }

    if (gameError) {
        return <div className="text-destructive text-center p-8">Error: {gameError.message}</div>
    }

    if (!game) {
        return <div className="text-muted-foreground text-center p-8">Game not found.</div>
    }
    
    return (
        <div className="flex-1 p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/admin/games">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Games List
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-headline font-bold">Edit Game <span className='font-mono text-primary'>{gameId}</span></h1>
                    <div></div>
                </div>

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
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save Changes
                        </Button>
                    </form>
                </Form>
             </div>
        </div>
    );
}
