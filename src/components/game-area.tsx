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
import { cn } from '@/lib/utils';

interface GameAreaProps {
  game: Game;
  currentRound: Round;
  playerTeam: 'team1' | 'team2' | null;
}

const answerSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty.'),
});

const INCORRECT_ANSWER_PENALTY = 5;

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
            const roundInStorage = currentGame.rounds[currentGame.currentRoundIndex];
            
            if(roundInStorage.status !== 'in_progress') {
                clearInterval(interval);
                return;
            }

            const newPoints = Math.max(0, roundInStorage.currentPoints - 1);
            roundInStorage.currentPoints = newPoints;
            
            // If points reach 0 and round is still in progress, finish it
            if(newPoints === 0) {
              roundInStorage.status = 'finished';
              roundInStorage.winner = null; // No winner
              toast({ title: `Round ${currentGame.currentRoundIndex + 1} Over`, description: "Time ran out! No one gets the points for this round."});
              
              // Move to next round or finish game
              if (currentGame.currentRoundIndex < currentGame.rounds.length - 1) {
                  currentGame.currentRoundIndex += 1;
                  currentGame.rounds[currentGame.currentRoundIndex].status = 'in_progress';
              } else {
                  currentGame.status = 'finished';
              }
            }
            
            localStorage.setItem(`game-${game.id}`, JSON.stringify(currentGame));
        }
    }, 1000); // Decrease 1 point every second

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const team = currentGame[playerTeam];
      if (!team) throw new Error("Team data is missing");
      
      if (round.status !== 'in_progress') {
        toast({ title: "Round Over", description: "This round has already finished." });
        setIsSubmitting(false);
        return;
      }

      const isCorrect = round.mainAnswer.toLowerCase().trim() === values.answer.toLowerCase().trim();

      if (isCorrect) {
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
          // Apply penalty for incorrect answer
          team.score -= INCORRECT_ANSWER_PENALTY;
          toast({
            variant: 'destructive',
            title: 'Incorrect Answer',
            description: `That's not right. Your team loses ${INCORRECT_ANSWER_PENALTY} points.`,
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-lg border-primary/20 border-2">
                <CardHeader>
                    <div className='flex justify-between items-start gap-4'>
                        <div>
                            <Badge variant="secondary" className="mb-2">Round Question</Badge>
                            <CardTitle className="font-headline text-2xl">
                                The Question
                            </CardTitle>
                        </div>
                        <div className='text-right flex-shrink-0'>
                            <Badge variant="default" className="text-lg font-mono font-bold shadow-md">
                            {points} Points
                            </Badge>
                             <p className='text-xs text-muted-foreground mt-1'>Available</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-xl md:text-2xl leading-relaxed bg-primary/5 p-4 rounded-md">
                        {currentRound.mainQuestion}
                    </p>
                </CardContent>
            </Card>
            <Card className={cn("shadow-lg", playerTeam ? 'bg-card' : 'bg-muted')}>
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

        <Card className="lg:col-span-3 shadow-md">
            <CardHeader>
                <CardTitle className='text-center text-xl font-headline'>
                    Reveal Letters
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <AnswerGrid game={game} currentRound={currentRound} playerTeam={playerTeam} />
            </CardContent>
        </Card>
    </div>
  );
}
