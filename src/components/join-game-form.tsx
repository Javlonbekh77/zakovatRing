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
      const gameJSON = localStorage.getItem(`game-${gameId}`);

      if (!gameJSON) {
        toast({
          variant: 'destructive',
          title: 'Game Not Found',
          description: 'No game with this code was found in your browser\'s storage.',
        });
        setIsSubmitting(false);
        return;
      }
      
      const game: Game = JSON.parse(gameJSON);

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
      
      if ( (teamSlot === 'team1' && game.team1) || (teamSlot === 'team2' && game.team2) ) {
        toast({
          variant: 'destructive',
          title: 'Game Full',
          description: 'This game already has two teams.',
        });
        setIsSubmitting(false);
        return;
      }


      // Update game state locally before redirect
      const updatedGame: Game = { ...game };
      // Initialize team with 0 score
      updatedGame[teamSlot] = { name: values.teamName, score: 0 };
      updatedGame.lastActivityAt = new Date().toISOString();
      
      // Only start the game if the SECOND team is joining
      if (teamSlot === 'team2' && updatedGame.team1) {
          updatedGame.status = 'in_progress';
      }

      localStorage.setItem(`game-${gameId}`, JSON.stringify(updatedGame));
      localStorage.setItem(`zakovat-game-${gameId}`, JSON.stringify({ team: teamSlot }));

      // Redirect via router, as server actions are tricky with local storage
      window.location.href = `/game/${gameId.toUpperCase()}?team=${teamSlot}`;

    } catch (error) {
      if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Failed to Join Game',
          description: error.message,
        });
      }
    } finally {
      // This might not be reached if redirect is successful
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
