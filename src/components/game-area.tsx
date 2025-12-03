'use client';

import { Game } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import AnswerGrid from './answer-grid';
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
    if (!playerTeam) {
        toast({ variant: "destructive", title: "You are a spectator!", description: "You cannot submit answers." });
        return;
    }

    setIsSubmitting(true);
    try {
      const gameJSON = localStorage.getItem(`game-${game.id}`);
      if (!gameJSON) throw new Error("Game data not found in storage.");
      const currentGame: Game = JSON.parse(gameJSON);

      const isCorrect = currentGame.mainAnswer.toLowerCase() === values.answer.toLowerCase();
      let updatedGame: Game;

      if (isCorrect) {
          const currentScore = currentGame[playerTeam]?.score || 0;
          updatedGame = {
              ...currentGame,
              status: 'finished',
              winner: playerTeam,
              [`${playerTeam}`]: { ...currentGame[playerTeam]!, score: currentScore + points },
              lastActivityAt: new Date().toISOString(),
          };
      } else {
          updatedGame = {
              ...currentGame,
              currentTurn: playerTeam === 'team1' ? 'team2' : 'team1', // Turn still passes
              lastActivityAt: new Date().toISOString(),
          };
          toast({
            variant: 'destructive',
            title: 'Incorrect Answer',
            description: 'That was not the correct answer. The turn passes to the other team.',
          });
      }

      localStorage.setItem(`game-${game.id}`, JSON.stringify(updatedGame));
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
                    <Button type="submit" disabled={isSubmitting} className='w-full'>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
                    Submit Final Answer
                    </Button>
                </form>
                </Form>
            ) : (
                <p className='text-muted-foreground text-center'>You are observing this game.</p>
            )}
            </CardContent>
        </Card>
        </div>
        <Card className="lg:col-span-3">
            <CardContent className="p-6">
                <AnswerGrid game={game} playerTeam={playerTeam} />
            </CardContent>
        </Card>
    </div>
  );
}
