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
import type { Game, Round, GameStatus, FormLetterQuestion } from '@/lib/types';
import { useRouter, useParams } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { serverTimestamp, doc, runTransaction } from 'firebase/firestore';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const letterQuestionSchema = z.object({
  letter: z.string(),
  question: z.string(),
  answer: z.string(),
});

const roundSchema = z.object({
  mainQuestion: z.string().min(5, 'Main question must be at least 5 characters.'),
  mainAnswer: z
    .string()
    .min(1, 'Main answer is required.')
    .regex(/^[A-ZА-Я\s'ʻ‘]+$/, "Main answer can only contain uppercase letters, Cyrillic letters, apostrophes, and spaces."),
  letterQuestions: z.array(letterQuestionSchema)
});

const formSchema = z.object({
  rounds: z.array(roundSchema).min(1, 'At least one round is required.'),
});


type FormData = z.infer<typeof formSchema>;

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

    React.useEffect(() => {
        const currentValues = form.getValues(`rounds.${roundIndex}.letterQuestions`);
        const answerLetters = mainAnswer.replace(/\s/g, '').split('');

        const newFields = answerLetters.map((letter, index) => {
            const existingField = Array.isArray(currentValues) && currentValues[index]
                ? currentValues[index]
                : { letter: letter.toUpperCase(), question: '', answer: '' };
            
            existingField.letter = letter.toUpperCase();

            return existingField;
        });

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
                     Provide one question for each letter in your main answer. (Optional)
                </FormDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md">
                        {index > 0 && <Separator className='absolute -top-3 left-0 w-full' />}
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                           Question for letter: <span className='font-mono text-2xl text-primary bg-primary/10 px-2 rounded-md'>{mainAnswer.replace(/\s/g, '')[index]?.toUpperCase()}</span>
                        </h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                                control={control}
                                name={`rounds.${roundIndex}.letterQuestions.${index}.question`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Question</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Question that reveals '${mainAnswer.replace(/\s/g, '')[index]?.toUpperCase()}'`} {...field} />
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

export default function EditGamePage() {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
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

    React.useEffect(() => {
        if (game && Array.isArray(game.rounds)) {
            const formRounds = game.rounds.map(r => {
                const answerLetters = r.mainAnswer.replace(/\s/g, '').split('');
                const letterIndices: Record<string, number> = {};
                
                const letterQuestions: FormLetterQuestion[] = answerLetters.map(letter => {
                    const upperLetter = letter.toUpperCase();
                    const count = letterIndices[upperLetter] || 0;
                    const key = `${upperLetter}_${count}`;
                    letterIndices[upperLetter] = count + 1;
                    
                    const questionData = r.letterQuestions[key];

                    return {
                        letter: letter,
                        question: questionData?.question || '',
                        answer: questionData?.answer || ''
                    };
                });

                return {
                    mainQuestion: r.mainQuestion,
                    mainAnswer: r.mainAnswer,
                    letterQuestions: letterQuestions,
                };
            });
            form.reset({ rounds: formRounds });
        }
    }, [game, form]);

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "rounds"
    });

    const handleExport = React.useCallback(() => {
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
            const exportFileDefaultName = `zakovat_game_${gameId}.json`;

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
                
                const roundsData = jsonData.rounds?.map((round: any) => ({
                    mainQuestion: round.mainQuestion || '',
                    mainAnswer: (round.mainAnswer || round.mainAnswerWord || '').toUpperCase().replace(/Т/g, 'T'),
                    letterQuestions: Array.isArray(round.letterQuestions) ? round.letterQuestions.map((lq: any) => ({
                        letter: lq.letter || '',
                        question: lq.question || '',
                        answer: lq.answer || ''
                    })) : []
                }));

                if (!roundsData) {
                    throw new Error("JSON file is missing a 'rounds' array.");
                }

                const validation = formSchema.safeParse({ rounds: roundsData });

                if (validation.success) {
                    form.reset(validation.data);
                    toast({ title: 'Game Imported!', description: 'Your game data has been loaded into the form.' });
                } else {
                    console.error("Import validation failed:", validation.error.flatten().fieldErrors);
                    throw new Error("JSON file structure is not valid after parsing.");
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
                    const answerLetters = r.mainAnswer.replace(/\s/g, '');
                    if (answerLetters.length !== r.letterQuestions.length) {
                        throw new Error(`Mismatch in round "${r.mainQuestion.substring(0, 20)}...": The answer has ${answerLetters.length} letters, but ${r.letterQuestions.length} questions were provided.`);
                    }

                    const letterQuestionsMap: Round['letterQuestions'] = {};
                    const letterIndices: Record<string, number> = {};

                    r.letterQuestions.forEach((lq) => {
                         // Only include letter questions that have a question text
                        if (lq.question) {
                            const upperLetter = lq.letter.toUpperCase();
                            const count = letterIndices[upperLetter] || 0;
                            const uniqueKey = `${upperLetter}_${count}`;
                            letterIndices[upperLetter] = count + 1;

                            letterQuestionsMap[uniqueKey] = {
                                question: lq.question,
                                answer: lq.answer
                            };
                        }
                    });
                    
                    const originalRound = gameData.rounds.find(or => or.mainQuestion === r.mainQuestion);

                    return {
                        mainQuestion: r.mainQuestion,
                        mainAnswer: r.mainAnswer,
                        letterQuestions: letterQuestionsMap,
                        status: originalRound?.status || 'pending',
                        currentPoints: originalRound?.currentPoints ?? 1000,
                        winner: originalRound?.winner || null,
                    };
                });
                
                let gameStatus: GameStatus = gameData.status;

                if (gameStatus === 'lobby') {
                     newRounds.forEach(r => r.status = 'pending');
                }
                
                let currentRoundIndex = gameData.currentRoundIndex;
                if (currentRoundIndex >= newRounds.length) {
                    currentRoundIndex = 0;
                }

                if (newRounds.length > 0) {
                   if (gameStatus === 'in_progress' || gameStatus === 'lobby') {
                       if(newRounds[currentRoundIndex]) {
                         newRounds[currentRoundIndex].status = 'in_progress';
                       }
                   } else if (gameStatus === 'paused') {
                       if(newRounds[currentRoundIndex]) {
                         newRounds[currentRoundIndex].status = 'paused';
                       }
                   }
                }

                transaction.update(gameDocRef, {
                    rounds: newRounds,
                    currentRoundIndex: currentRoundIndex,
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
