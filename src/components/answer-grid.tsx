'use client';

import { Game, Round, Team } from '@/lib/types';
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
  currentRound: Round;
  playerTeam: 'team1' | 'team2' | null;
  playerTeamData: Team | null;
  onLetterReveal: (letterKey: string) => Promise<void>;
}

const letterAnswerSchema = z.object({
  answer: z.string().min(1, 'Answer is required.'),
});


function LetterDialog({ letter, letterKey, game, currentRound, playerTeam, onLetterReveal }: { letter: string; letterKey: string; game: Game; currentRound: Round; playerTeam: 'team1' | 'team2' | null, onLetterReveal: (letterKey: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const letterQuestion = currentRound.letterQuestions[letterKey];

  if (!letterQuestion) return null;

  const form = useForm<z.infer<typeof letterAnswerSchema>>({
    resolver: zodResolver(letterAnswerSchema),
    defaultValues: { answer: '' },
  });

  const handleLetterSubmit = async (values: z.infer<typeof letterAnswerSchema>) => {
    if (!playerTeam) {
        toast({ variant: "destructive", title: "You are a spectator!", description: "You cannot interact with the game." });
        return;
    }
    
    setIsSubmitting(true);
    
    try {
        const isCorrect = letterQuestion.answer.toLowerCase().trim() === values.answer.toLowerCase().trim();

        if (isCorrect) {
            await onLetterReveal(letterKey);
            toast({
                title: 'Correct!',
                description: `The letter '${letter.toUpperCase()}' is revealed! You earned a small point bonus.`,
              });
            setOpen(false);
        } else {
            toast({ variant: "destructive", title: "Incorrect", description: "That's not the right answer. Try again." });
        }
        
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
                    <Input placeholder="Your answer" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSubmitting || !playerTeam} className="w-full">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send />}
              Submit
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AnswerGrid({ game, currentRound, playerTeam, playerTeamData, onLetterReveal }: AnswerGridProps) {
  if (!currentRound?.mainAnswer) {
    return <div className='text-muted-foreground'>Answer grid not available.</div>;
  }
  
  const answerChars = currentRound.mainAnswer.split('');

  const revealedLettersForRound = playerTeamData?.revealedLetters[playerTeamData.currentRoundIndex] || [];
    
  // Keep track of used indices for duplicate letters
  const letterIndices: Record<string, number> = {};

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {answerChars.map((char, index) => {
        if (char === ' ') {
          return <div key={index} className="w-8" />;
        }
        
        const upperChar = char.toUpperCase();
        const count = letterIndices[upperChar] || 0;
        const letterKey = `${upperChar}_${count}`;
        letterIndices[upperChar] = count + 1;

        const isRevealed = revealedLettersForRound.includes(letterKey);

        return (
          <div key={index}>
            {isRevealed ? (
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-lg border-2 border-primary bg-primary/20 font-mono text-3xl font-bold text-primary shadow-inner animate-in fade-in zoom-in-90">
                {upperChar}
              </div>
            ) : (
              <LetterDialog letter={char} letterKey={letterKey} game={game} currentRound={currentRound} playerTeam={playerTeam} onLetterReveal={onLetterReveal} />
            )}
          </div>
        );
      })}
    </div>
  );
}
