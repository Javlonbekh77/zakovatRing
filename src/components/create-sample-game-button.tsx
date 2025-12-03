'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { createSampleGame } from '@/app/admin/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand } from 'lucide-react';

export default function CreateSampleGameButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    setIsSubmitting(true);
    try {
      const result = await createSampleGame();
      if (result?.error) {
        toast({
          variant: 'destructive',
          title: 'Error Creating Game',
          description: result.error,
        });
      }
      // On success, the action redirects, so no need to handle success case here.
    } catch (error) {
      if (error instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'An unexpected error occurred',
          description: error.message,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isSubmitting}
      className="w-full"
      size="lg"
    >
      {isSubmitting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Wand className="mr-2 h-4 w-4" />
      )}
      Create Sample Game
    </Button>
  );
}
