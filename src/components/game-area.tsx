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
import { useState, useEffect } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';

interface GameAreaProps {
  game: Game;
  currentRound: Round;
  playerTeam: 'team1' | 'team2' | null;
}

const answerSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty.'),
});

export default function GameArea({ game, currentRound, playerTeam }: GameAreaProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [points, setPoints] = useState(currentRound.currentPoints);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
    defaultValues: {
      answer: '',
    },
  });

  // Effect for points countdown
  useEffect(() => {
    if (currentRound.status !== 'in_progress') return;

    const interval = setInterval(() => {
        const gameDataStr = localStorage.getItem(`game-${game.id}`);
        if(gameDataStr) {
            const currentGame: Game = JSON.parse(gameDataStr);
            const currentRoundInStorage = currentGame.rounds[currentGame.currentRoundIndex];
            
            if(currentRoundInStorage.status !== 'in_progress') {
                clearInterval(interval);
                return;
            }

            const newPoints = Math.max(0, currentRoundInStorage.currentPoints - 1);
            currentGame.rounds[currentGame.currentRoundIndex].currentPoints = newPoints;
            localStorage.setItem(`game-${game.id}`, JSON.stringify(currentGame));
        }
    }, 1000); // Decrease 1 point every second

    return () => clearInterval(interval);
  }, [game.id, game.currentRoundIndex, currentRound.status]);


  // Effect to update local component state for UI from game state
   useEffect(() => {
    setPoints(currentRound.currentPoints);
  }, [currentRound.currentPoints]);


  const handleAnswerSubmit = async (values: z.infer<typeof answerSchema>) => {
    if (!playerTeam) {
        toast({ variant: "destructive", title: "You are a spectator!", description: "You cannot submit answers." });
        return;
    }

    setIsSubmitting(true);
    try {
      const gameJSON = localStorage.getItem(`game-${game.id}`);
      if (!gameJSON) throw new Error("Game data not found in storage.");
      let currentGame: Game = JSON.parse(gameJSON);
      let round = currentGame.rounds[currentGame.currentRoundIndex];
      
      if (round.status !== 'in_progress') {
        toast({ title: "Round Over", description: "This round has already finished." });
        setIsSubmitting(false);
        return;
      }

      const isCorrect = round.mainAnswer.toLowerCase() === values.answer.toLowerCase();

      if (isCorrect) {
          const team = currentGame[playerTeam];
          if (!team) throw new Error("Team data is missing");

          // Update round status
          round.status = 'finished';
          round.winner = playerTeam;
          
          // Update team's total score
          team.score += round.currentPoints;

          toast({
            title: `Correct! Round ${currentGame.currentRoundIndex + 1} finished.`,
            description: `Your team gets ${round.currentPoints} points.`,
          });

          // Check if there is a next round
          if (currentGame.currentRoundIndex < currentGame.rounds.length - 1) {
              currentGame.currentRoundIndex += 1;
              currentGame.rounds[currentGame.currentRoundIndex].status = 'in_progress';
          } else {
              // This was the last round, finish the game
              currentGame.status = 'finished';
          }
      } else {
          toast({
            variant: 'destructive',
            title: 'Incorrect Answer',
            description: 'That was not the correct answer. Keep trying!',
          });
      }
      
      currentGame.lastActivityAt = new Date().toISOString();
      localStorage.setItem(`game-${game.id}`, JSON.stringify(currentGame));
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
                {currentRound.mainQuestion}
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
                    <Button type="submit" disabled={isSubmitting || currentRound.status !== 'in_progress'} className='w-full'>
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
                <AnswerGrid game={game} currentRound={currentRound} playerTeam={playerTeam} />
            </CardContent>
        </Card>
    </div>
  );
}
