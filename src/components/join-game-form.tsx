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
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Skeleton } from './ui/skeleton';
import type { Game } from '@/lib/types';

const formSchema = z.object({
  gameCode: z
    .string()
    .length(4, 'Game code must be 4 characters.')
    .regex(/^[A-Z0-9]+$/, 'Game code can only contain uppercase letters and numbers.'),
  teamName: z
    .string()
    .min(2, 'Team name must be at least 2 characters.')
    .max(20, 'Team name cannot exceed 20 characters.'),
  password: z.string().min(1, 'Password is required.'),
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
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    if (!firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Firestore is not available.' });
        setIsSubmitting(false);
        return
    }

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
      
      const gameData = gameSnap.data() as Game;

      if (gameData.password !== values.password) {
        toast({
          variant: 'destructive',
          title: 'Incorrect Password',
          description: 'The password for this game is incorrect.',
        });
        setIsSubmitting(false);
        return;
      }

      if (gameData.status !== 'lobby') {
        if (
          gameData.team1?.name !== values.teamName &&
          gameData.team2?.name !== values.teamName
        ) {
            toast({
                variant: 'destructive',
                title: 'Game in Progress',
                description: 'This game has already started. You can only rejoin with your original team name.',
            });
            setIsSubmitting(false);
            return;
        }
      }

      // Check if the game is full
      const isTeam1SlotTaken = !!gameData.team1;
      const isTeam2SlotTaken = !!gameData.team2;
      const isRejoining = gameData.team1?.name === values.teamName || gameData.team2?.name === values.teamName;

      if (isTeam1SlotTaken && isTeam2SlotTaken && !isRejoining) {
        toast({
            variant: 'destructive',
            title: 'Game is Full',
            description: 'This game already has two teams.',
        });
        setIsSubmitting(false);
        return;
      }


      router.push(`/game/${gameId.toUpperCase()}?teamName=${encodeURIComponent(values.teamName)}`);

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
         <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Game Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
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
