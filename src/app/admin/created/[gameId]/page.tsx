'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Clipboard, Home } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function GameCreatedPage({
  params,
}: {
  params: { gameId: string };
}) {
  const { toast } = useToast();
  const [joinUrl, setJoinUrl] = useState('');
  const { gameId } = params;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setJoinUrl(`${window.location.origin}/join`);
    }
  }, []);

  const copyToClipboard = () => {
    const textToCopy = `Game Code: ${gameId}`;
    navigator.clipboard.writeText(textToCopy);
    toast({
      title: 'Copied to clipboard!',
      description: `Players can now use the code ${gameId} to join.`,
    });
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center shadow-2xl">
        <CardHeader>
          <div className="mx-auto w-fit rounded-full bg-green-100 p-4 dark:bg-green-900/50">
            <CheckCircle className="h-12 w-12 text-green-500 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl font-headline">Game Created!</CardTitle>
          <CardDescription>
            Your game is ready. Share the code below with your players.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Game Code:</p>
          <div className="flex items-center justify-center gap-4">
            <div className="select-all rounded-md border-2 border-dashed border-primary bg-primary/5 p-4 font-mono text-4xl font-bold tracking-widest text-primary">
              {gameId}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              aria-label="Copy game code"
            >
              <Clipboard className="h-5 w-5" />
            </Button>
          </div>
           <CardDescription>
            {joinUrl && (
              <>
                Players can join at: <Link href="/join" className='text-primary underline'>{joinUrl}</Link>
              </>
            )}
          </CardDescription>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Go to Homepage
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
