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
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

interface GameAreaProps {
  game: Game;
  currentRound: Round;
  playerTeam: 'team1' | 'team2' | null;
}

const answerSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty.'),
});

const INCORRECT_ANSWER_PENALTY = 50;

export default function GameArea({ game, currentRound, playerTeam }: GameAreaProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof answerSchema>>({
    resolver: zodResolver(answerSchema),
    defaultValues: { answer: '' },
  });

  const handleAnswerSubmit = async (values: z.infer<typeof answerSchema>) => {
    if (!playerTeam || !firestore) {
        toast({ variant: "destructive", title: "You are a spectator!", description: "You cannot submit answers." });
        return;
    }

    setIsSubmitting(true);
    let toastMessage: { title: string, description: string, variant?: "default" | "destructive" } | null = null;
    
    try {
      const gameDocRef = doc(firestore, 'games', game.id);
      
      await runTransaction(firestore, async (transaction) => {
          const gameSnap = await transaction.get(gameDocRef);
          if (!gameSnap.exists()) throw new Error("Game data not found.");

          const currentGame = gameSnap.data() as Game;
          const round = currentGame.rounds[currentGame.currentRoundIndex];
          const team = currentGame[playerTeam];

          if (!team) throw new Error("Team data is missing");
      
          if (round.status !== 'in_progress') {
            toastMessage = { title: "Round Over", description: "This round has already finished." };
            return;
          }

          const isCorrect = round.mainAnswer.toLowerCase().trim() === values.answer.toLowerCase().trim();
          const teamScorePath = `${playerTeam}.score`;
          let updateData: any = { lastActivityAt: serverTimestamp() };

          if (isCorrect) {
              const pointsWon = round.currentPoints;
              updateData[teamScorePath] = team.score + pointsWon;
              updateData[`rounds.${currentGame.currentRoundIndex}.status`] = 'finished';
              updateData[`rounds.${currentGame.currentRoundIndex}.winner`] = playerTeam;
              
              toastMessage = {
                title: `Correct! Round ${currentGame.currentRoundIndex + 1} finished.`,
                description: `Your team gets ${pointsWon} points.`,
              };

              if (currentGame.currentRoundIndex < currentGame.rounds.length - 1) {
                  updateData.currentRoundIndex = currentGame.currentRoundIndex + 1;
                  updateData[`rounds.${currentGame.currentRoundIndex + 1}.status`] = 'in_progress';
              } else {
                  updateData.status = 'finished';
              }
          } else {
              updateData[teamScorePath] = Math.max(0, team.score - INCORRECT_ANSWER_PENALTY);
              toastMessage = {
                variant: 'destructive',
                title: 'Incorrect Answer',
                description: `That's not right. Your team loses ${INCORRECT_ANSWER_PENALTY} points.`,
              };
          }
          
          transaction.update(gameDocRef, updateData);
      });

      if (toastMessage) {
        toast(toastMessage);
      }
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
                            {currentRound.currentPoints} Points
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
