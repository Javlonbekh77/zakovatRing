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
import { CheckCircle, Clipboard, Home, Eye } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function GameCreatedPage() {
  const { toast } = useToast();
  const [joinUrl, setJoinUrl] = useState('');
  const [spectateUrl, setSpectateUrl] = useState('');
  const params = useParams();
  const gameId = Array.isArray(params.gameId) ? params.gameId[0] : params.gameId;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setJoinUrl(`${window.location.origin}/join`);
      setSpectateUrl(`${window.location.origin}/spectate/${gameId}`);
    }
  }, [gameId]);

  const copyToClipboard = (textToCopy: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(textToCopy);
    if (type === 'code') {
       toast({
        title: 'Copied to clipboard!',
        description: `Players can now use the code ${gameId} to join.`,
      });
    } else {
       toast({
        title: 'Link Copied!',
        description: `Spectator link copied to clipboard.`,
      });
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center shadow-2xl">
        <CardHeader>
          <div className="mx-auto w-fit rounded-full bg-green-100 p-4 dark:bg-green-900/50">
            <CheckCircle className="h-12 w-12 text-green-500 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl font-headline">Game Hosted!</CardTitle>
          <CardDescription>
            Your game is live. Share the code with players or the link with spectators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-muted-foreground">Share this code with players:</p>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="select-all rounded-md border-2 border-dashed border-primary bg-primary/5 p-4 font-mono text-4xl font-bold tracking-widest text-primary">
                {gameId}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(gameId, 'code')}
                aria-label="Copy game code"
              >
                <Clipboard className="h-5 w-5" />
              </Button>
            </div>
             <CardDescription className='mt-2'>
              {joinUrl && (
                <>
                  Players can join at: <Link href="/join" className='text-primary underline'>{joinUrl}</Link>
                </>
              )}
            </CardDescription>
          </div>
          <div>
            <p className="text-muted-foreground">Share this link with spectators:</p>
              <div className="flex items-center justify-center gap-4 mt-2">
                 <div className="select-all text-sm rounded-md border bg-muted p-2 font-mono text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                   {spectateUrl}
                 </div>
                 <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(spectateUrl, 'link')}
                    aria-label="Copy spectator link"
                 >
                   <Eye className="h-5 w-5" />
                 </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/admin">
              <Home className="mr-2 h-4 w-4" /> Go to Admin Panel
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
