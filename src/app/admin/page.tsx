'use client';

import { createSampleGame } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FilePlus2, Loader2, Wand } from 'lucide-react';
import { useState } from 'react';

export default function AdminPage() {
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
    <div className="flex-1 p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-3xl">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit mb-2">
              <FilePlus2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-3xl">
              Create New Game
            </CardTitle>
            <CardDescription>
              Click the button below to generate a sample game with a pre-defined quiz.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
