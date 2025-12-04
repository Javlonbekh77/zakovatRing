'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Game, Round, Team } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Loader2, Users, Trophy, Circle, CheckCircle2, Award, Play, Pause, SkipForward, ShieldAlert, AlertTriangle } from 'lucide-react';
import Scoreboard from './scoreboard';
import GameArea from './game-area';
import { Button } from './ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge } from './ui/badge';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';


const POINTS_DECREMENT_INTERVAL = 5000; // 5 seconds
const POINTS_DECREMENT_AMOUNT = 10; // 10 points


function AdminControls({ game, user }: { game: Game, user: any }) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleGameStatusToggle = async () => {
        if (!firestore) return;
        const gameDocRef = doc(firestore, 'games', game.id);
        const newStatus = game.status === 'in_progress' ? 'paused' : 'in_progress';
        try {
            await runTransaction(firestore, async (transaction) => {
                transaction.update(gameDocRef, { 
                    status: newStatus,
                    [`rounds.${game.currentRoundIndex}.status`]: newStatus,
                    lastActivityAt: serverTimestamp() 
                });
            });
            toast({ title: `Game ${newStatus === 'paused' ? 'Paused' : 'Resumed'}` });
        } catch (e) {
            if (e instanceof Error) toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const handleSkipRound = async () => {
        if (!firestore) return;
        const gameDocRef = doc(firestore, 'games', game.id);
         try {
            await runTransaction(firestore, async (transaction) => {
                const gameSnap = await transaction.get(gameDocRef);
                if (!gameSnap.exists()) throw new Error("Game does not exist.");
                const currentGame = gameSnap.data() as Game;

                if (currentGame.currentRoundIndex >= currentGame.rounds.length - 1) {
                    transaction.update(gameDocRef, { status: 'finished' });
                } else {
                    const nextIndex = currentGame.currentRoundIndex + 1;
                    transaction.update(gameDocRef, { 
                        [`rounds.${currentGame.currentRoundIndex}.status`]: 'finished',
                        currentRoundIndex: nextIndex,
                        [`rounds.${nextIndex}.status`]: 'in_progress',
                        lastActivityAt: serverTimestamp()
                    });
                }
            });
            toast({ title: "Round Skipped" });
        } catch (e) {
             if (e instanceof Error) toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };
    
    const adjustScore = async (teamId: 'team1' | 'team2', amount: number, reason: string) => {
        if (!firestore || !game[teamId]) return;
        const gameDocRef = doc(firestore, 'games', game.id);
        try {
             await runTransaction(firestore, async (transaction) => {
                const gameSnap = await transaction.get(gameDocRef);
                if (!gameSnap.exists()) throw new Error("Game does not exist.");
                const currentGame = gameSnap.data() as Game;
                const currentTeam = currentGame[teamId];
                if (!currentTeam) throw new Error("Team does not exist.");
                
                transaction.update(gameDocRef, {
                    [`${teamId}.score`]: currentTeam.score + amount,
                    lastActivityAt: serverTimestamp()
                });
             });
             toast({ title: "Score Adjusted", description: `${game[teamId]?.name}'s score was adjusted by ${amount} for: ${reason}` });
        } catch(e) {
            if (e instanceof Error) toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };

    const disqualifyTeam = async (teamId: 'team1' | 'team2') => {
        if (!firestore || !game[teamId]) return;
        const gameDocRef = doc(firestore, 'games', game.id);
        try {
            await runTransaction(firestore, async (transaction) => {
                transaction.update(gameDocRef, {
                    status: 'finished',
                    winner: teamId === 'team1' ? 'team2' : 'team1',
                    lastActivityAt: serverTimestamp()
                });
             });
             toast({ variant: 'destructive', title: "Team Disqualified", description: `${game[teamId]?.name} has been disqualified.` });
        } catch(e) {
            if (e instanceof Error) toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    }


    if (user?.uid !== game.creatorId) return null;

    return (
        <Card className="shadow-lg border-amber-500/50 border-2 mt-6">
            <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center gap-2"><ShieldAlert /> Admin Controls</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" onClick={handleGameStatusToggle} disabled={game.status === 'finished' || game.status === 'lobby'}>
                    {game.status === 'in_progress' ? <Pause/> : <Play/>}
                    {game.status === 'in_progress' ? 'Pause Game' : 'Resume Game'}
                </Button>
                <Button variant="outline" onClick={handleSkipRound} disabled={game.status !== 'in_progress'}>
                    <SkipForward/> Skip Round
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={!game.team1}>Disqualify {game.team1?.name || 'Team 1'}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will immediately end the game and declare {game.team2?.name || 'Team 2'} the winner.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => disqualifyTeam('team1')}>Disqualify</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={!game.team2}>Disqualify {game.team2?.name || 'Team 2'}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will immediately end the game and declare {game.team1?.name || 'Team 1'} the winner.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => disqualifyTeam('team2')}>Disqualify</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                 <Button variant="secondary" onClick={() => adjustScore('team1', 100, 'Bonus')}>+100 {game.team1?.name || 'Team 1'}</Button>
                 <Button variant="secondary" onClick={() => adjustScore('team1', -50, 'Penalty')}>-50 {game.team1?.name || 'Team 1'}</Button>
                 <Button variant="secondary" onClick={() => adjustScore('team2', 100, 'Bonus')}>+100 {game.team2?.name || 'Team 2'}</Button>
                 <Button variant="secondary" onClick={() => adjustScore('team2', -50, 'Penalty')}>-50 {game.team2?.name || 'Team 2'}</Button>
            </CardContent>
        </Card>
    )
}

function SpectatorView({ game, user }: { game: Game, user: any }) {
  const getWinner = () => {
    if (game.status !== 'finished' || !game.team1 || !game.team2) return null;
    if (game.forfeitedBy) {
        return game.forfeitedBy === 'team1' ? game.team2 : game.team1;
    }
    if (game.team1.score > game.team2.score) return game.team1;
    if (game.team2.score > game.team1.score) return game.team2;
    return null; // Draw
  };

  const winner = getWinner();
  
  if (!Array.isArray(game.rounds)) {
      return <div>Round data is in an invalid format. Cannot display overview.</div>;
  }

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

      {user?.uid === game.creatorId && <AdminControls game={game} user={user} />}
      
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
                 {game.forfeitedBy && (
                    <CardDescription className="text-sm text-destructive mt-2">
                        Game was forfeited by {game[game.forfeitedBy]?.name}.
                    </CardDescription>
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
                  <Badge variant='outline'>{round.status}</Badge>
                )}
              </div>
              <CardDescription>{round.mainQuestion}</CardDescription>
            </CardHeader>
             {round.status === 'in_progress' && (
                <CardContent>
                    <p className='text-lg font-bold font-mono text-primary'>{round.currentPoints} points remaining</p>
                </CardContent>
            )}
            {round.winner && game[round.winner] && (
              <CardFooter>
                 <div className='text-sm text-muted-foreground flex items-center'>
                   <Award className='mr-2 h-4 w-4 text-yellow-500' />
                   Winner: <span className='font-bold text-foreground ml-1'>{game[round.winner]?.name}</span>
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

interface GameClientProps {
  gameId: string;
  assignedTeam?: 'team1' | 'team2' | undefined;
}


export default function GameClient({ gameId, assignedTeam }: GameClientProps) {
  const [playerTeam, setPlayerTeam] = useState<'team1' | 'team2' | null>(null);
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const gameDocRef = useMemoFirebase(() => {
    if (!firestore || !gameId) return null;
    return doc(firestore, 'games', gameId);
  }, [firestore, gameId]);

  const { data: game, isLoading, error } = useDoc<Game>(gameDocRef);
  
  const currentRound = useMemo(() => {
    if (!game || !Array.isArray(game.rounds) || game.currentRoundIndex >= game.rounds.length) {
      return null;
    }
    return game.rounds[game.currentRoundIndex];
  }, [game]);
  
  const winner = useMemo(() => {
     if (!game || game.status !== 'finished' || !game.team1 || !game.team2) return null;
    if (game.forfeitedBy) {
        return game.forfeitedBy === 'team1' ? game.team2 : game.team1;
    }
    if (game.team1.score > game.team2.score) return game.team1;
    if (game.team2.score > game.team1.score) return game.team2;
    return null; // Draw
  }, [game]);

  const isSpectator = useMemo(() => !playerTeam && typeof window !== 'undefined' && window.location.pathname.includes('/spectate'), [playerTeam]);
  
  const [localPoints, setLocalPoints] = useState<number | null>(null);
  
  // Effect 1: Initialize and update local points when the official round changes
  useEffect(() => {
    if (currentRound) {
        setLocalPoints(currentRound.currentPoints);
    }
  }, [currentRound]);


  // Effect 2: The timer logic, runs only for the creator
  useEffect(() => {
    if (!game || !user || user.uid !== game.creatorId || game.status !== 'in_progress' || localPoints === null || localPoints <= 0) {
      return;
    }
  
    const timer = setInterval(async () => {
       setLocalPoints(prevPoints => {
           const newPoints = (prevPoints || 0) - POINTS_DECREMENT_AMOUNT;
           if (newPoints <= 0) {
               // Time is up for this round. Update Firestore.
               if (firestore && gameDocRef) {
                   runTransaction(firestore, async (transaction) => {
                       const gameSnap = await transaction.get(gameDocRef);
                       if (!gameSnap.exists()) throw new Error("Game not found.");
                       
                       const currentGame = gameSnap.data() as Game;
                       // Only proceed if this is still the current round
                       if(currentGame.status === 'in_progress' && currentGame.currentRoundIndex === game.currentRoundIndex) {
                           const updates: any = {
                               [`rounds.${game.currentRoundIndex}.currentPoints`]: 0,
                               [`rounds.${game.currentRoundIndex}.status`]: 'finished',
                               lastActivityAt: serverTimestamp(),
                           };
                           if (game.currentRoundIndex < game.rounds.length - 1) {
                               updates.currentRoundIndex = game.currentRoundIndex + 1;
                               updates[`rounds.${game.currentRoundIndex + 1}.status`] = 'in_progress';
                           } else {
                               updates.status = 'finished'; // End of game
                           }
                           transaction.update(gameDocRef, updates);
                       }
                   });
               }
               return 0;
           }
           return newPoints;
       });
    }, POINTS_DECREMENT_INTERVAL);
  
    return () => clearInterval(timer);
  }, [game, user, firestore, gameDocRef, localPoints]);


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

    if (typeof window !== 'undefined' && !window.location.pathname.includes('/spectate')) {
      setPlayerTeam(teamToSet);
    }

    if (teamToSet && !assignedTeam && !teamFromUrl) {
       const newUrl = `${window.location.pathname}?team=${teamToSet}`;
       window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    }
    
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
    return (
        <Card className="w-full max-w-md">
            <CardHeader><CardTitle>Game not found</CardTitle></CardHeader>
            <CardContent>
                No game with ID <span className='font-mono bg-muted p-1 rounded'>{gameId}</span> was found. It may have been deleted.
            </CardContent>
        </Card>
    );
  }
  
  if (isSpectator) {
    return <SpectatorView game={game} user={user} />
  }
  
  if (game.status === 'finished' || game.status === 'forfeited') {
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
           {game.forfeitedBy && game[game.forfeitedBy] && (
              <CardDescription className="text-sm text-destructive mt-2">
                  Game was forfeited by {game[game.forfeitedBy]?.name}.
              </CardDescription>
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

  if (game.status !== 'in_progress' || !currentRound || localPoints === null) {
     return (
        <div className="flex flex-col items-center justify-center p-2 sm:p-4 md:p-6">
          <div className="flex flex-col items-center gap-4 text-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            {game.status === 'paused' ? 'Game is paused by the admin...' : 'Loading game state...'}
        </div>
      </div>
     )
  }

  const handleForfeit = async () => {
      if (!firestore || !playerTeam) return;
      const gameDocRef = doc(firestore, "games", game.id);
      try {
        await runTransaction(firestore, async (transaction) => {
            transaction.update(gameDocRef, {
                status: 'forfeited',
                forfeitedBy: playerTeam,
                lastActivityAt: serverTimestamp()
            });
        });
        toast({variant: 'destructive', title: 'You Forfeited', description: 'Your team has forfeited the game.'});
      } catch (e) {
          if (e instanceof Error) toast({ variant: 'destructive', title: 'Error', description: e.message });
      }
  }
  
  const roundWithLocalPoints: Round = {
      ...currentRound,
      currentPoints: localPoints,
  };


  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      <div className="text-center p-2 bg-muted text-muted-foreground rounded-md flex justify-between items-center">
        <span>Game Code: <strong className="font-mono">{game.id}</strong></span>
        <span>Round: <strong className="font-mono">{game.currentRoundIndex + 1} / {game.rounds.length}</strong></span>
      </div>
      <Scoreboard team1={game.team1} team2={game.team2} playerTeam={playerTeam} />
      <GameArea game={game} currentRound={roundWithLocalPoints} playerTeam={playerTeam} />
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                    <AlertTriangle className="mr-2 h-4 w-4" /> Forfeit Game
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. You will lose the game immediately.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleForfeit}>Yes, Forfeit</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
