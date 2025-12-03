'use client';

import { Game } from '@/lib/types';
import * as z from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useState } from 'react';
import { Button } from './ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnswerGridProps {
  game: Game;
  playerTeam: 'team1' | 'team2' | null;
}

const letterAnswerSchema = z.object({
  answer: z.string().min(1, 'Answer is required.'),
});

// Cost to reveal a letter
const LETTER_REVEAL_COST = 5;

function LetterDialog({ letter, game, playerTeam }: { letter: string; game: Game; playerTeam: 'team1' | 'team2' | null }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const letterQuestion = game.letterQuestions[letter.toUpperCase()];

  const form = useForm<z.infer<typeof letterAnswerSchema>>({
    resolver: zodResolver(letterAnswerSchema),
    defaultValues: { answer: '' },
  });

  if (!letterQuestion) return null;

  const handleLetterSubmit = async (values: z.infer<typeof letterAnswerSchema>) => {
    if (!playerTeam) {
        toast({ variant: "destructive", title: "You are a spectator!", description: "You cannot interact with the game." });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const gameJSON = localStorage.getItem(`game-${game.id}`);
        if (!gameJSON) throw new Error("Game data not found in storage.");
        const currentGame: Game = JSON.parse(gameJSON);

        const isCorrect = letterQuestion.answer.toLowerCase() === values.answer.toLowerCase();
        let updatedGame: Game;

        if (isCorrect) {
            const team = currentGame[playerTeam];
            if (!team) throw new Error("Your team data was not found.");

            // Add letter to team's specific revealed letters and deduct points
            const updatedTeam = {
                ...team,
                revealedLetters: [...team.revealedLetters, letter.toUpperCase()],
                score: team.score - LETTER_REVEAL_COST,
            };

            updatedGame = {
                ...currentGame,
                [playerTeam]: updatedTeam,
                lastActivityAt: new Date().toISOString(),
            };
            toast({ title: "Correct!", description: `Letter '${letter.toUpperCase()}' revealed! It cost ${LETTER_REVEAL_COST} points.`});
        } else {
            // No changes to game state on incorrect answer, just a notification
            updatedGame = currentGame;
            toast({ variant: "destructive", title: "Incorrect", description: "That's not the right answer. Try again." });
        }
        
        localStorage.setItem(`game-${game.id}`, JSON.stringify(updatedGame));
        setOpen(false);

    } catch(e) {
      if (e instanceof Error) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
      }
    } finally {
        setIsSubmitting(false);
        form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button disabled={!playerTeam} className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-md border-2 border-dashed bg-card shadow-sm transition-all hover:border-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Reveal letter ${letter}`}>
          ?
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Question to reveal "{letter.toUpperCase()}"</DialogTitle>
          <DialogDescription className="text-lg pt-2">
            {letterQuestion.question}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleLetterSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="answer"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Your answer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting || !playerTeam} className="w-full">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />}
              Submit
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AnswerGrid({ game, playerTeam }: AnswerGridProps) {
  const answerChars = game.mainAnswer.split('');
  
  // Determine which set of revealed letters to use
  const revealedLetters = playerTeam && game[playerTeam] 
    ? game[playerTeam]!.revealedLetters 
    : [];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {answerChars.map((char, index) => {
        if (char === ' ') {
          return <div key={index} className="w-8" />;
        }

        const isRevealed = revealedLetters.includes(char.toUpperCase());

        return (
          <div key={index}>
            {isRevealed ? (
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-lg border-2 border-primary bg-primary/20 font-mono text-3xl font-bold text-primary shadow-inner animate-in fade-in zoom-in-90">
                {char.toUpperCase()}
              </div>
            ) : (
              <LetterDialog letter={char} game={game} playerTeam={playerTeam} />
            )}
          </div>
        );
      })}
    </div>
  );
}
