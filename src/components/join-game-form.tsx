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
import { useFirestore, useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Skeleton } from './ui/skeleton';

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
  const { user, isUserLoading } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gameCode: '',
      teamName: '',
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
      
      const game = gameSnap.data();

      // Spectators can always go to the spectate page
      // But for joining, we do a preliminary check
      if (game.status !== 'lobby' && (game.team1 && game.team2)) {
        toast({
          variant: 'destructive',
          title: 'Game Full or In Progress',
          description: 'This game already has two teams or has started. You can spectate instead.',
        });
        setIsSubmitting(false);
        return;
      }
      
      // Redirect to the game page with team name as a query parameter.
      // The game page will handle the logic of assigning the team slot.
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

  if (isUserLoading) {
    return (
        <div className="space-y-6">
            <div className='space-y-2'>
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
             <div className='space-y-2'>
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
        </div>
    )
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
        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !user}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
          Join Game
        </Button>
      </form>
    </Form>
  );
}
