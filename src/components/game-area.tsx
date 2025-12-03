'use client';

import { Game } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import AnswerGrid from './answer-grid';
import { submitMainAnswer } from '@/app/game/[gameId]/actions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';

interface GameAreaProps {
  game: Game;
  playerTeam: 'team1' | 'team2' | null;
}

const answerSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty.'),
});

export default function GameArea({ game, playerTeam }: GameAreaProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [points, setPoints] = useState(game.currentPoints);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
    defaultValues: {
      answer: '',
    },
  });

  useEffect(() => {
    if (game.status !== 'in_progress') return;

    setPoints(game.currentPoints);

    const interval = setInterval(() => {
      setPoints((prevPoints) => {
        const newPoints = prevPoints - 1;
        return newPoints > 0 ? newPoints : 0;
      });
    }, 1000); // Decrease 1 point every second

    return () => clearInterval(interval);
  }, [game.status, game.currentPoints]);

  const handleAnswerSubmit = async (values: z.infer<typeof answerSchema>) => {
    if (!playerTeam || game.currentTurn !== playerTeam) {
        toast({ variant: "destructive", title: "Not your turn!", description: "Wait for the other team to make a move." });
        return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitMainAnswer(game.id, playerTeam, values.answer, points);
      if (!result.correct) {
        toast({
          variant: 'destructive',
          title: 'Incorrect Answer',
          description: 'That was not the correct answer. The turn passes to the other team.',
        });
        form.reset();
      }
      // On correct answer, the page will reload to the 'finished' state.
    } catch (error) {
      if (error instanceof Error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMyTurn = playerTeam === game.currentTurn;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className='flex justify-between items-start'>
            <div>
              <CardTitle className="font-headline text-2xl">
                The Question
              </CardTitle>
            </div>
            <Badge variant="secondary" className="text-lg font-mono font-bold">
              {points} Points
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg md:text-xl leading-relaxed">
            {game.mainQuestion}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your Team's Controls</CardTitle>
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
                <Button type="submit" disabled={isSubmitting || !isMyTurn} className='w-full'>
                   {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
                   Submit Final Answer
                </Button>
                {!isMyTurn && <p className='text-sm text-center text-muted-foreground mt-2'>Wait for your turn to answer.</p>}
              </form>
            ) : (
                <p className='text-muted-foreground text-center'>You are observing this game.</p>
            )}
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardContent className="p-6">
          <AnswerGrid game={game} playerTeam={playerTeam} />
        </CardContent>
      </Card>
    </div>
  );
}
