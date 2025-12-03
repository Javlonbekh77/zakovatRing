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

    // Persist points reduction in local storage for one client to manage
    const gameJSON = localStorage.getItem(`game-${game.id}`);
    if (!gameJSON) return;
    const currentGame: Game = JSON.parse(gameJSON);

    const interval = setInterval(() => {
        const gameDataStr = localStorage.getItem(`game-${game.id}`);
        if(gameDataStr) {
            const gameData: Game = JSON.parse(gameDataStr);
            if(gameData.status !== 'in_progress') {
                clearInterval(interval);
                return;
            }
            const newPoints = Math.max(0, gameData.currentPoints - 1);
            gameData.currentPoints = newPoints;
            localStorage.setItem(`game-${game.id}`, JSON.stringify(gameData));
        }
    }, 1000); // Decrease 1 point every second

    return () => clearInterval(interval);
  }, [game.id, game.status]);


  // Effect to update local component state for UI from game state
   useEffect(() => {
    setPoints(game.currentPoints);
  }, [game.currentPoints]);


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
      
      // Ensure game is still in progress
      if (currentGame.status !== 'in_progress') {
        toast({ title: "Game Over", description: "This game has already finished." });
        setIsSubmitting(false);
        return;
      }

      const isCorrect = currentGame.mainAnswer.toLowerCase() === values.answer.toLowerCase();
      let updatedGame: Game;

      if (isCorrect) {
          const currentTeamState = currentGame[playerTeam];
          if (!currentTeamState) throw new Error("Team data is missing");
          
          updatedGame = {
              ...currentGame,
              status: 'finished',
              winner: playerTeam,
              [playerTeam]: { ...currentTeamState, score: currentTeamState.score + currentGame.currentPoints },
              lastActivityAt: new Date().toISOString(),
          };
           toast({
            title: 'You got it!',
            description: `Your team wins the round and gets ${currentGame.currentPoints} points.`,
          });
      } else {
          // No turn change, just a toast notification for the submitting team.
          updatedGame = currentGame;
          toast({
            variant: 'destructive',
            title: 'Incorrect Answer',
            description: 'That was not the correct answer. Keep trying!',
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
