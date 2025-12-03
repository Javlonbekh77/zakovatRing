'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Game, Round } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Loader2, Users, Trophy, Circle, CheckCircle2, Award } from 'lucide-react';
import Scoreboard from './scoreboard';
import GameArea from './game-area';
import { Button } from './ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge } from './ui/badge';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

interface GameClientProps {
  gameId: string;
  assignedTeam?: 'team1' | 'team2' | undefined;
}

function SpectatorView({ game }: { game: Game }) {
  const getWinner = () => {
    if (game.status !== 'finished' || !game.team1 || !game.team2) return null;
    if (game.team1.score > game.team2.score) return game.team1;
    if (game.team2.score > game.team1.score) return game.team2;
    return null; // Draw
  };

  const winner = getWinner();

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className='shadow-xl'>
        <CardHeader>
          <CardTitle className='text-3xl font-headline text-center'>Spectator Dashboard</CardTitle>
          <CardDescription className='text-center'>
            Game Code: <strong className="font-mono">{game.id}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Scoreboard team1={game.team1} team2={game.team2} playerTeam={null} />
        </CardContent>
      </Card>
      
      {game.status === 'finished' && (
         <Card className="w-full text-center p-8 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="mx-auto w-fit rounded-full bg-yellow-100 p-4 dark:bg-yellow-900/50 mb-4">
                <Trophy className="h-16 w-16 text-yellow-500 dark:text-yellow-400" />
            </div>
            <CardHeader className='pt-0'>
            <CardTitle className="text-4xl font-headline">Game Over!</CardTitle>
            {winner ? (
                <CardDescription className="text-xl">
                <span className='font-bold text-primary'>{winner.name}</span> wins!
                </CardDescription>
            ) : (
                <CardDescription className="text-xl">It's a draw!</CardDescription>
            )}
            </CardHeader>
        </Card>
      )}

      <div className='space-y-4'>
        <h3 className='text-2xl font-bold text-center'>Rounds Overview</h3>
        {game.rounds.map((round, index) => (
          <Card key={index} className={`border-l-4 ${index === game.currentRoundIndex && game.status === 'in_progress' ? 'border-primary shadow-lg' : 'border-border'}`}>
            <CardHeader>
              <div className='flex justify-between items-center'>
                <CardTitle>Round {index + 1}</CardTitle>
                {round.status === 'finished' ? (
                  <Badge variant='secondary'><CheckCircle2 className='mr-2' />Finished</Badge>
                ) : round.status === 'in_progress' ? (
                  <Badge><Circle className='mr-2 animate-pulse' />In Progress</Badge>
                ) : (
                  <Badge variant='outline'>Pending</Badge>
                )}
              </div>
              <CardDescription>{round.mainQuestion}</CardDescription>
            </CardHeader>
            {round.winner && game[round.winner] && (
              <CardFooter>
                 <div className='text-sm text-muted-foreground flex items-center'>
                   <Award className='mr-2 h-4 w-4 text-yellow-500' />
                   Winner: <span className='font-bold text-foreground ml-1'>{game[round.winner]?.name}</span>,
                   <span className='font-bold text-foreground ml-1'>+{round.currentPoints}</span> points
                 </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>

       <Button asChild className='w-full mt-8'>
          <Link href="/">Back to Home</Link>
        </Button>
    </div>
  )
}

export default function GameClient({ gameId, assignedTeam }: GameClientProps) {
  const [playerTeam, setPlayerTeam] = useState<'team1' | 'team2' | null>(null);
  const searchParams = useSearchParams();
  const firestore = useFirestore();

  const gameDocRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: game, isLoading, error } = useDoc<Game>(gameDocRef);

  useEffect(() => {
    const teamFromUrl = searchParams.get('team') as 'team1' | 'team2' | null;
    let storedTeamInfo = null;

    try {
      const item = localStorage.getItem(`zakovat-game-${gameId}`);
      if (item) {
        storedTeamInfo = JSON.parse(item);
      }
    } catch (e) {
      console.error('Could not parse team info from localStorage', e);
    }
    
    const teamToSet = assignedTeam || teamFromUrl || storedTeamInfo?.team || null;

    if (!window.location.pathname.includes('/spectate')) {
      setPlayerTeam(teamToSet);
    }

    if (teamToSet && !assignedTeam && !teamFromUrl) {
       // Persist team in URL for reloads if not already there
       const newUrl = `${window.location.pathname}?team=${teamToSet}`;
       window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, searchParams, assignedTeam]);


  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 text-lg">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        Loading game...
      </div>
    );
  }

  if (error) {
    return <Card className="w-full max-w-md"><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent>{error.message}</CardContent></Card>;
  }

  if (!game) {
    return <Card className="w-full max-w-md"><CardHeader><CardTitle>Game not found</CardTitle></CardHeader></Card>;
  }
  
  const currentRound = game.rounds[game.currentRoundIndex];
  const isSpectator = playerTeam === null;

  // Render spectator-specific dashboard
  if (isSpectator) {
    return <SpectatorView game={game} />
  }
  
  const getWinner = () => {
    if (!game.team1 || !game.team2) return null;
    if (game.team1.score > game.team2.score) return game.team1;
    if (game.team2.score > game.team1.score) return game.team2;
    return null; // Draw
  }

  const winner = getWinner();

  if (game.status === 'finished') {
    return (
      <Card className="w-full max-w-lg text-center p-8 shadow-2xl animate-in fade-in zoom-in-95">
         <div className="mx-auto w-fit rounded-full bg-yellow-100 p-4 dark:bg-yellow-900/50 mb-4">
            <Trophy className="h-16 w-16 text-yellow-500 dark:text-yellow-400" />
          </div>
        <CardHeader>
          <CardTitle className="text-4xl font-headline">Game Over!</CardTitle>
          {winner ? (
            <CardDescription className="text-xl">
              <span className='font-bold text-primary'>{winner.name}</span> wins!
            </CardDescription>
          ) : (
            <CardDescription className="text-xl">It's a draw!</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>Final Scores:</p>
          <div className='flex justify-around mt-4'>
            {game.team1 && <div className='text-lg'><span className='font-bold'>{game.team1.name}</span>: {game.team1.score}</div>}
            {game.team2 && <div className='text-lg'><span className='font-bold'>{game.team2.name}</span>: {game.team2.score}</div>}
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild className='w-full'>
            <Link href="/">Play Again</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (game.status === 'lobby') {
    return (
      <Card className="w-full max-w-lg text-center p-8 shadow-xl">
        <CardHeader>
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Game Lobby</CardTitle>
          <CardDescription>Waiting for the second player to join...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className='font-mono text-xl p-3 bg-muted rounded-md'>Game Code: <span className='font-bold tracking-widest'>{game.id}</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
                <div className='p-4 border rounded-md'>
                    <h3 className='font-bold'>Team 1</h3>
                    <p>{game.team1?.name || 'Waiting...'}</p>
                </div>
                 <div className='p-4 border rounded-md'>
                    <h3 className='font-bold'>Team 2</h3>
                    <p>{game.team2?.name || 'Waiting...'}</p>
                </div>
            </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentRound) {
     return <Card className="w-full max-w-md"><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent>Current round data is missing.</CardContent></Card>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      <div className="text-center p-2 bg-muted text-muted-foreground rounded-md flex justify-between items-center">
        <span>Game Code: <strong className="font-mono">{game.id}</strong></span>
        <span>Round: <strong className="font-mono">{game.currentRoundIndex + 1} / {game.rounds.length}</strong></span>
      </div>
      <Scoreboard team1={game.team1} team2={game.team2} playerTeam={playerTeam} />
      <GameArea game={game} currentRound={currentRound} playerTeam={playerTeam} />
    </div>
  );
}
