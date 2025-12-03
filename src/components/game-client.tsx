'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Game } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Loader2, Users, Trophy } from 'lucide-react';
import Scoreboard from './scoreboard';
import GameArea from './game-area';
import { Button } from './ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface GameClientProps {
  gameId: string;
  assignedTeam?: 'team1' | 'team2' | undefined;
}

export default function GameClient({ gameId, assignedTeam }: GameClientProps) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerTeam, setPlayerTeam] = useState<'team1' | 'team2' | null>(null);
  const searchParams = useSearchParams();

  const loadGameFromStorage = useCallback(() => {
    try {
      const gameJSON = localStorage.getItem(`game-${gameId}`);
      if (gameJSON) {
        setGame(JSON.parse(gameJSON));
      } else {
        setError('Game not found in local storage. It might have been deleted or never created on this device.');
        setGame(null);
      }
    } catch (e) {
      setError("Failed to load game data. It might be corrupted.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [gameId]);


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
    
    if (assignedTeam) {
      setPlayerTeam(assignedTeam);
       try {
        localStorage.setItem(`zakovat-game-${gameId}`, JSON.stringify({ team: assignedTeam }));
      } catch (e) {
        console.error('Could not write team info to localStorage', e);
      }
    } else if (teamFromUrl) {
      setPlayerTeam(teamFromUrl);
      try {
        localStorage.setItem(`zakovat-game-${gameId}`, JSON.stringify({ team: teamFromUrl }));
      } catch (e) {
        console.error('Could not write team info to localStorage', e);
      }
    } else if (storedTeamInfo) {
      setPlayerTeam(storedTeamInfo.team);
    }

  }, [gameId, searchParams, assignedTeam]);

  useEffect(() => {
    loadGameFromStorage();

    // Poll localStorage for updates from other tabs (simple alternative to onSnapshot)
    const interval = setInterval(loadGameFromStorage, 1000);

    return () => clearInterval(interval);
  }, [gameId, loadGameFromStorage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 text-lg">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        Loading game...
      </div>
    );
  }

  if (error) {
    return <Card className="w-full max-w-md"><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent>{error}</CardContent></Card>;
  }

  if (!game) {
    return <Card className="w-full max-w-md"><CardHeader><CardTitle>Game not found</CardTitle></CardHeader></Card>;
  }
  
  const currentRound = game.rounds[game.currentRoundIndex];
  
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
