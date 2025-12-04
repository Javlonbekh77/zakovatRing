'use client';

import { Game, Round } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import AnswerGrid from './answer-grid';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';

interface GameAreaProps {
  game: Game;
  currentRound: Round;
  localCurrentPoints: number;
  playerTeam: 'team1' | 'team2' | null;
  onLetterReveal: (letterKey: string) => Promise<void>;
  onMainAnswerSubmit: (answer: string) => Promise<void>;
}

const answerSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty.'),
});

export default function GameArea({ game, currentRound, localCurrentPoints, playerTeam, onLetterReveal, onMainAnswerSubmit }: GameAreaProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
    defaultValues: { answer: '' },
  });

  const handleAnswerSubmit = async (values: z.infer<typeof answerSchema>) => {
    if (!playerTeam) {
        toast({ variant: "destructive", title: "You are a spectator!", description: "You cannot submit answers." });
        return;
    }

    setIsSubmitting(true);
    
    try {
      // The actual logic is now in game-client.tsx
      await onMainAnswerSubmit(values.answer);
      form.reset();
    } catch (error) {
      if (error instanceof Error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-lg border-primary/20 border-2">
                <CardHeader>
                    <div className='flex justify-between items-start gap-4'>
                        <div>
                            <Badge variant="secondary" className="mb-2">Round Question</Badge>
                            <CardTitle className="font-headline text-2xl">
                                {currentRound.mainQuestion}
                            </CardTitle>
                        </div>
                        <div className='text-right flex-shrink-0'>
                            <Badge variant="default" className="text-lg font-mono font-bold shadow-md">
                            {localCurrentPoints} Points
                            </Badge>
                             <p className='text-xs text-muted-foreground mt-1'>Available</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <AnswerGrid game={game} currentRound={currentRound} playerTeam={playerTeam} onLetterReveal={onLetterReveal} />
                </CardContent>
            </Card>
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Your Controls</CardTitle>
                </CardHeader>
                <CardContent>
                {playerTeam ? (
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAnswerSubmit)} className='space-y-4'>
                        <FormField
                        control={form.control}
                        name="answer"
                        render={({ field }) => (
                            <FormItem>
                            <FormControl>
                                <Input placeholder="Type your final answer" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <Button type="submit" disabled={isSubmitting || currentRound.status !== 'in_progress'} className='w-full'>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
                            Submit Final Answer
                        </Button>
                    </form>
                    </Form>
                ) : (
                    <p className='text-muted-foreground text-center p-8'>You are observing this game.</p>
                )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
