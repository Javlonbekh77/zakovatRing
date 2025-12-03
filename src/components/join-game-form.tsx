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
import { joinGame } from '@/app/join/actions';
import { Loader2, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
      await joinGame(values.gameCode.toUpperCase(), values.teamName);
    } catch (error) {
      if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Failed to Join Game',
          description: error.message,
        });
      }
    } finally {
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
          {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
          Join Game
        </Button>
      </form>
    </Form>
  );
}
