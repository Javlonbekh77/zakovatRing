'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
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
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import React, { useState, useEffect, useCallback } from 'react';
import { Game, Round, GameStatus, FormLetterQuestion } from '@/lib/types';
import { useRouter, useParams } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser, useMemoFirebase, useDoc } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Skeleton } from './ui/skeleton';
import Link from 'next/link';
import { normalizeApostrophes } from '@/lib/utils';


const letterQuestionSchema = z.object({
  letter: z.string(),
  question: z.string(), // Now optional
  answer: z.string(),   // Now optional
});

const roundSchema = z.object({
  mainQuestion: z.string().min(5, 'Main question must be at least 5 characters.'),
  mainAnswer: z
    .string()
    .min(1, 'Main answer is required.')
    .regex(/^[A-ZА-Я\s'ʻ‘]+$/, "Main answer can only contain uppercase letters (Latin/Cyrillic), apostrophes, and spaces."),
  letterQuestions: z.array(letterQuestionSchema)
});

const formSchema = z.object({
  title: z.string().min(3, 'Game title must be at least 3 characters.'),
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

    React.useEffect(() => {
        const answerLetters = normalizeApostrophes(mainAnswer).replace(/\s/g, '').split('');
        const currentValues = form.getValues(`rounds.${roundIndex}.letterQuestions`);
        
        const existingDataMap = new Map((Array.isArray(currentValues) ? currentValues : []).map(f => [f.letter, f]));

        const finalFields = answerLetters.map(letter => {
             const upperLetter = letter.toUpperCase();
             if(existingDataMap.has(upperLetter)) {
                 const existingData = existingDataMap.get(upperLetter);
                 return { letter: upperLetter, question: existingData.question || '', answer: existingData.answer || '' };
             }
             return { letter: upperLetter, question: '', answer: '' };
        });

        replace(finalFields);
        
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
                           Question for letter: <span className='font-mono text-2xl text-primary bg-primary/10 px-2 rounded-md'>{normalizeApostrophes(mainAnswer).replace(/\s/g, '')[index]?.toUpperCase()}</span>
                        </h3>
                         <Controller
                            control={control}
                            name={`rounds.${roundIndex}.letterQuestions.${index}.letter`}
                            defaultValue={normalizeApostrophes(mainAnswer).replace(/\s/g, '')[index]?.toUpperCase()}
                            render={({ field }) => <input type="hidden" {...field} />}
                        />
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                            <FormField
                                control={control}
                                name={`rounds.${roundIndex}.letterQuestions.${index}.question`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Question</FormLabel>
                                        <FormControl>
                                            <Input placeholder={`Question that reveals '${normalizeApostrophes(mainAnswer).replace(/\s/g, '')[index]?.toUpperCase()}'`} {...field} />
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
    const [isPageLoading, setIsPageLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const gameId = params.gameId as string;
    const isNewGame = gameId === 'new';

    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const gameDocRef = useMemoFirebase(() => firestore && !isNewGame ? doc(firestore, 'games', gameId) : null, [firestore, gameId, isNewGame]);
    const { data: existingGame, isLoading: isGameLoading } = useDoc<Game>(gameDocRef);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            rounds: [{ mainQuestion: '', mainAnswer: '', letterQuestions: [] }],
        },
    });

     useEffect(() => {
        if (!isGameLoading && !isUserLoading) {
            setIsPageLoading(false);
        }
        if (existingGame) {
             const formRounds = existingGame.rounds.map(r => {
                const answerLetters = normalizeApostrophes(r.mainAnswer).replace(/\s/g, '').split('');
                const letterIndices: Record<string, number> = {};
                
                const letterQuestions: FormLetterQuestion[] = answerLetters.map(letter => {
                    const upperLetter = letter.toUpperCase();
                    const count = letterIndices[upperLetter] || 0;
                    const key = `${upperLetter}_${count}`;
                    letterIndices[upperLetter] = count + 1;
                    
                    const questionData = r.letterQuestions[key];

                    return {
                        letter: letter.toUpperCase(),
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
            form.reset({ title: existingGame.title || '', rounds: formRounds });
        }
    }, [existingGame, isGameLoading, isUserLoading, form]);

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "rounds"
    });

    const handleExport = useCallback(() => {
        form.trigger().then(isValid => {
            if (!isValid) {
                toast({
                    variant: 'destructive',
                    title: 'Form is not valid',
                    description: 'Please fix the errors before exporting.',
                });
                console.error("Form validation errors on export:", form.formState.errors);
                return;
            }

            const values = form.getValues();
            const dataStr = JSON.stringify({ title: values.title, rounds: values.rounds }, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `timeline_game_${gameId}.json`;

            let linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        });
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
                    mainAnswer: (round.mainAnswer || round.mainAnswerWord || '').toUpperCase(),
                    letterQuestions: Array.isArray(round.letterQuestions) ? round.letterQuestions.map((lq: any) => ({
                        letter: lq.letter || '',
                        question: lq.question || '',
                        answer: lq.answer || ''
                    })) : []
                }));

                if (!roundsData) {
                    throw new Error("JSON file is missing a 'rounds' array.");
                }
                
                const dataToValidate = {
                    title: jsonData.title || jsonData.gameTitle || 'Imported Game',
                    rounds: roundsData
                };

                const validation = formSchema.safeParse(dataToValidate);

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
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be signed in to create or save a game.' });
            setIsSubmitting(false);
            return;
        }

        const finalGameId = isNewGame ? generateGameCode(4) : gameId;

        try {
            const gameRounds: Round[] = values.rounds.map(r => {
                const letterQuestionsMap: Round['letterQuestions'] = {};
                const letterIndices: Record<string, number> = {};

                r.letterQuestions.forEach((lq) => {
                    if (lq.question && lq.answer) {
                        const upperLetter = normalizeApostrophes(lq.letter).toUpperCase();
                        const count = letterIndices[upperLetter] || 0;
                        const uniqueKey = `${upperLetter}_${count}`;
                        letterIndices[upperLetter] = count + 1;

                        letterQuestionsMap[uniqueKey] = { 
                            question: lq.question,
                            answer: lq.answer
                        };
                    }
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

            const gameDocRef = doc(firestore, 'games', finalGameId);

            const gameData: Game = {
                id: finalGameId,
                title: values.title,
                creatorId: user.uid,
                rounds: gameRounds,
                currentRoundIndex: 0,
                status: 'lobby',
                createdAt: isNewGame ? serverTimestamp() : existingGame?.createdAt || serverTimestamp(),
                lastActivityAt: serverTimestamp(),
            };
            
            await setDoc(gameDocRef, gameData, { merge: true });

            toast({
                title: `Game ${isNewGame ? 'Created' : 'Saved'}!`,
                description: `Game with code ${finalGameId} has been ${isNewGame ? 'created' : 'updated'}.`,
            });
            
            if (isNewGame) {
                router.push(`/admin/created/${finalGameId}`);
            } else {
                router.push('/admin/games');
            }

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

    if (isPageLoading) {
        return (
            <div className="flex-1 p-4 sm:p-6 md:p-8">
                 <div className="container mx-auto max-w-3xl">
                     <Skeleton className="w-full h-screen rounded-lg bg-muted animate-pulse" />
                 </div>
             </div>
        );
    }

    return (
        <div className="flex-1 p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/admin">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Admin
                        </Link>
                    </Button>
                     <h1 className="text-3xl font-headline font-bold">{isNewGame ? "Create New Game" : `Edit Game ${gameId}`}</h1>
                    <div></div>
                </div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                         <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Game Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., History of Ancient Rome" {...field} />
                                    </FormControl>
                                    <FormDescription>A catchy title for your game.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                            {isNewGame ? 'Create and Host Game' : 'Save Changes'}
                        </Button>
                    </form>
                </Form>
             </div>
        </div>
    );
}
