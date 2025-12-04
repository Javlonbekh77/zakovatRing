'use client';

import { Game, Round } from '@/lib/types';
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
import { useFirestore } from '@/firebase';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

interface AnswerGridProps {
  game: Game;
  currentRound: Round;
  playerTeam: 'team1' | 'team2' | null;
}

const letterAnswerSchema = z.object({
  answer: z.string().min(1, 'Answer is required.'),
});

// Reward for revealing a letter
const LETTER_REVEAL_REWARD = 10;

function LetterDialog({ letter, game, currentRound, playerTeam }: { letter: string; game: Game; currentRound: Round; playerTeam: 'team1' | 'team2' | null }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const letterQuestion = currentRound.letterQuestions[letter.toUpperCase()];

  const form = useForm<z.infer<typeof letterAnswerSchema>>({
    resolver: zodResolver(letterAnswerSchema),
    defaultValues: { answer: '' },
  });

  if (!letterQuestion) return null;

  const handleLetterSubmit = async (values: z.infer<typeof letterAnswerSchema>) => {
    if (!playerTeam || !firestore) {
        toast({ variant: "destructive", title: "You are a spectator or something went wrong!", description: "You cannot interact with the game." });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const gameDocRef = doc(firestore, 'games', game.id);
        
        const isCorrect = letterQuestion.answer.toLowerCase() === values.answer.toLowerCase();
        
        // This is tricky. We need to read the latest state before writing.
        // For simplicity, we assume the `game` prop is reasonably up-to-date.
        const currentTeam = game[playerTeam];
        const currentRoundState = game.rounds[game.currentRoundIndex];
        const revealedLettersKey = playerTeam === 'team1' ? 'team1RevealedLetters' : 'team2RevealedLetters';
        const teamRevealedLetters = currentRoundState[revealedLettersKey] || [];
        
        if (!currentTeam) throw new Error("Your team data was not found.");

        if (isCorrect) {
            if (!teamRevealedLetters.includes(letter.toUpperCase())) {
                const newRevealedLetters = [...teamRevealedLetters, letter.toUpperCase()];
                const newScore = currentTeam.score + LETTER_REVEAL_REWARD;

                const updatePath = `rounds.${game.currentRoundIndex}.${revealedLettersKey}`;
                const teamScorePath = `${playerTeam}.score`;

                await updateDoc(gameDocRef, {
                    [updatePath]: newRevealedLetters,
                    [teamScorePath]: newScore,
                    lastActivityAt: serverTimestamp()
                });

                toast({ title: "Correct!", description: `Letter '${letter.toUpperCase()}' revealed! You earned ${LETTER_REVEAL_REWARD} points.`});
                setOpen(false);
            } else {
                toast({ title: "Already Revealed", description: `You have already revealed this letter.`});
            }
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
        <button disabled={!playerTeam || currentRound.status !== 'in_progress'} className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-md border-2 border-dashed bg-card shadow-sm transition-all hover:border-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Reveal letter ${letter}`}>
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

export default function AnswerGrid({ game, currentRound, playerTeam }: AnswerGridProps) {
  if (!currentRound?.mainAnswer) {
    return <div className='text-muted-foreground'>Answer grid not available.</div>;
  }
  
  const answerChars = currentRound.mainAnswer.split('');
  
  // For players, show only their revealed letters. For spectators, show all revealed letters.
  const revealedLetters = playerTeam 
    ? (currentRound[playerTeam === 'team1' ? 'team1RevealedLetters' : 'team2RevealedLetters'] || [])
    : [...new Set([...(currentRound.team1RevealedLetters || []), ...(currentRound.team2RevealedLetters || [])])];

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
              <LetterDialog letter={char} game={game} currentRound={currentRound} playerTeam={playerTeam} />
            )}
          </div>
        );
      })}
    </div>
  );
}
