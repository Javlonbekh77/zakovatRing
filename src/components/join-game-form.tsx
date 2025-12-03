'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Game } from '@/lib/types';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  gameCode: z
    .string()
    .length(4, 'Game code must be 4 characters.')
    .regex(/^[A-Z0-9]+$/, 'Game code can only contain uppercase letters and numbers.'),
  teamName: z
    .string()
    .min(2, 'Team name must be at least 2 characters.')
    .max(20, 'Team name cannot exceed 20 characters.'),
});

export default function JoinGameForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gameCode: '',
      teamName: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const gameId = values.gameCode.toUpperCase();
      const gameDocRef = doc(firestore, 'games', gameId);
      const gameSnap = await getDoc(gameDocRef);

      if (!gameSnap.exists()) {
        toast({
          variant: 'destructive',
          title: 'Game Not Found',
          description: 'No game with this code was found.',
        });
        setIsSubmitting(false);
        return;
      }
      
      const game = gameSnap.data() as Game;

      if (game.status !== 'lobby') {
        toast({
          variant: 'destructive',
          title: 'Game Not Joinable',
          description: 'This game is already in progress or has finished.',
        });
        setIsSubmitting(false);
        return;
      }

      let teamSlot: 'team1' | 'team2' | null = null;
      if (!game.team1) {
        teamSlot = 'team1';
      } else if (!game.team2) {
        teamSlot = 'team2';
      }

      if (!teamSlot) {
        toast({
          variant: 'destructive',
          title: 'Game Full',
          description: 'This game already has two teams.',
        });
        setIsSubmitting(false);
        return;
      }
      
      const updateData: any = {
        [`${teamSlot}`]: { name: values.teamName, score: 0 },
        lastActivityAt: serverTimestamp(),
      };
      
      // If the SECOND team is joining, start the game
      if (teamSlot === 'team2' && game.team1) {
          updateData.status = 'in_progress';
      }
      
      await updateDoc(gameDocRef, updateData);

      // Store team assignment for this browser session
      localStorage.setItem(`zakovat-game-${gameId}`, JSON.stringify({ team: teamSlot }));
      
      router.push(`/game/${gameId.toUpperCase()}`);

    } catch (error) {
      if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Failed to Join Game',
          description: error.message,
        });
      }
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="gameCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Game Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="ABCD"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="font-mono text-center text-lg tracking-widest"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="teamName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., The Masterminds" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
          Join Game
        </Button>
      </form>
    </Form>
  );
}
