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
const LETTER_REVEAL_REWARD = 10;
const INCORRECT_ANSWER_PENALTY = 50;


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
  // All hooks must be at the top level
  const [playerTeam, setPlayerTeam] = useState<'team1' | 'team2' | null>(null);
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const gameDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'games', gameId) : null, [firestore, gameId]);
  const { data: game, isLoading, error } = useDoc<Game>(gameDocRef);

  // Use a local state for game data to prevent UI flickers
  const [localGameData, setLocalGameData] = useState<Game | null>(null);

  useEffect(() => {
    if (game) {
      setLocalGameData(game);
    }
  }, [game]);


  const currentRound = useMemo(() => {
    if (!localGameData || !Array.isArray(localGameData.rounds) || localGameData.currentRoundIndex >= localGameData.rounds.length) {
      return null;
    }
    return localGameData.rounds[localGameData.currentRoundIndex];
  }, [localGameData]);
  
  const winner = useMemo(() => {
    if (!localGameData || localGameData.status !== 'finished' || !localGameData.team1 || !localGameData.team2) return null;
    if (localGameData.forfeitedBy) {
        return localGameData.forfeitedBy === 'team1' ? localGameData.team2 : localGameData.team1;
    }
    if (localGameData.team1.score > localGameData.team2.score) return localGameData.team1;
    if (localGameData.team2.score > localGameData.team1.score) return localGameData.team2;
    return null; // Draw
  }, [localGameData]);

  const isSpectator = useMemo(() => !playerTeam && typeof window !== 'undefined' && window.location.pathname.includes('/spectate'), [playerTeam]);
  
  // Timer effect, runs only for the game creator
  useEffect(() => {
    if (!localGameData || !user || user.uid !== localGameData.creatorId || localGameData.status !== 'in_progress' || !currentRound) {
      return;
    }
  
    const timer = setInterval(() => {
        setLocalGameData(prevData => {
            if (!prevData || !prevData.rounds[prevData.currentRoundIndex]) return prevData;
            
            const newPoints = prevData.rounds[prevData.currentRoundIndex].currentPoints - POINTS_DECREMENT_AMOUNT;
            
            if (newPoints <= 0) {
                // Time is up for this round. Update Firestore.
                if (firestore && gameDocRef) {
                   runTransaction(firestore, async (transaction) => {
                       const gameSnap = await transaction.get(gameDocRef);
                       if (!gameSnap.exists()) throw new Error("Game not found.");
                       const currentGame = gameSnap.data() as Game;

                       // Only proceed if this is still the current round and it's in progress
                       if(currentGame.status === 'in_progress' && currentGame.currentRoundIndex === localGameData.currentRoundIndex) {
                           const updates: any = {
                               [`rounds.${localGameData.currentRoundIndex}.currentPoints`]: 0,
                               [`rounds.${localGameData.currentRoundIndex}.status`]: 'finished',
                               lastActivityAt: serverTimestamp(),
                           };
                           if (localGameData.currentRoundIndex < localGameData.rounds.length - 1) {
                               updates.currentRoundIndex = localGameData.currentRoundIndex + 1;
                               updates[`rounds.${localGameData.currentRoundIndex + 1}.status`] = 'in_progress';
                           } else {
                               updates.status = 'finished'; // End of game
                           }
                           transaction.update(gameDocRef, updates);
                       }
                   });
                }
                // Stop the timer locally by returning the previous state - Firestore will update the rest
                return prevData; 
            } else {
                 // Just update the local state, no Firestore write
                const newRounds = [...prevData.rounds];
                newRounds[prevData.currentRoundIndex] = {
                    ...newRounds[prevData.currentRoundIndex],
                    currentPoints: newPoints
                };
                return { ...prevData, rounds: newRounds };
            }
        });
    }, POINTS_DECREMENT_INTERVAL);
  
    return () => clearInterval(timer);
  }, [localGameData, user, firestore, gameDocRef]);


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

  const handleLetterReveal = useCallback((letter: string) => {
    if (!playerTeam) return;

    setLocalGameData(prevData => {
      if (!prevData) return null;

      const newRounds = [...prevData.rounds];
      const roundIndex = prevData.currentRoundIndex;
      const currentRound = newRounds[roundIndex];
      const revealedLettersKey = playerTeam === 'team1' ? 'team1RevealedLetters' : 'team2RevealedLetters';
      
      const newRevealedLetters = [...currentRound[revealedLettersKey], letter];
      
      const newTeam = { ...prevData[playerTeam]! };
      newTeam.score += LETTER_REVEAL_REWARD;

      newRounds[roundIndex] = {
        ...currentRound,
        [revealedLettersKey]: newRevealedLetters
      };

      return {
        ...prevData,
        rounds: newRounds,
        [playerTeam]: newTeam
      };
    });
  }, [playerTeam]);

  const handleMainAnswerSubmit = useCallback(async (answer: string) => {
    if (!playerTeam || !firestore || !gameDocRef || !localGameData || !currentRound) {
      throw new Error("Game state is not ready for submission.");
    }

    let toastMessage: { title: string, description: string, variant?: "default" | "destructive" } | null = null;
    
    await runTransaction(firestore, async (transaction) => {
        const gameSnap = await transaction.get(gameDocRef);
        if (!gameSnap.exists()) throw new Error("Game data not found.");

        const serverGame = gameSnap.data() as Game;
        const serverRound = serverGame.rounds[serverGame.currentRoundIndex];
        const serverTeam = serverGame[playerTeam]!;

        if (serverRound.status !== 'in_progress') {
            toastMessage = { title: "Round Over", description: "This round has already finished." };
            return;
        }

        const isCorrect = serverRound.mainAnswer.toLowerCase().trim() === answer.toLowerCase().trim();
        let updateData: any = { lastActivityAt: serverTimestamp() };
        
        // Take local game data for revealed letters and score as it's more up-to-date
        const localTeam = localGameData[playerTeam]!;
        updateData[`${playerTeam}.score`] = localTeam.score;
        updateData[`rounds.${serverGame.currentRoundIndex}.team1RevealedLetters`] = localGameData.rounds[serverGame.currentRoundIndex].team1RevealedLetters;
        updateData[`rounds.${serverGame.currentRoundIndex}.team2RevealedLetters`] = localGameData.rounds[serverGame.currentRoundIndex].team2RevealedLetters;


        if (isCorrect) {
            const pointsWon = currentRound.currentPoints; 
            updateData[`${playerTeam}.score`] += pointsWon;
            updateData[`rounds.${serverGame.currentRoundIndex}.status`] = 'finished';
            updateData[`rounds.${serverGame.currentRoundIndex}.winner`] = playerTeam;
            
            toastMessage = {
              title: `Correct! Round ${serverGame.currentRoundIndex + 1} finished.`,
              description: `Your team gets ${pointsWon} points.`,
            };

            if (serverGame.currentRoundIndex < serverGame.rounds.length - 1) {
                updateData.currentRoundIndex = serverGame.currentRoundIndex + 1;
                updateData[`rounds.${serverGame.currentRoundIndex + 1}.status`] = 'in_progress';
            } else {
                updateData.status = 'finished';
            }
        } else {
            updateData[`${playerTeam}.score`] -= INCORRECT_ANSWER_PENALTY;
            toastMessage = {
              variant: 'destructive',
              title: 'Incorrect Answer',
              description: `That's not right. Your team loses ${INCORRECT_ANSWER_PENALTY} points.`,
            };
        }
        
        transaction.update(gameDocRef, updateData);
    });
      
    if (toastMessage) {
      toast(toastMessage);
    }
  }, [playerTeam, firestore, gameDocRef, localGameData, currentRound, toast]);

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

  // Render logic starts here
  if (isLoading || !localGameData) {
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
  
  if (isSpectator) {
    return <SpectatorView game={localGameData} user={user} />
  }
  
  if (localGameData.status === 'finished' || localGameData.status === 'forfeited') {
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
           {localGameData.forfeitedBy && localGameData[localGameData.forfeitedBy] && (
              <CardDescription className="text-sm text-destructive mt-2">
                  Game was forfeited by {localGameData[localGameData.forfeitedBy]?.name}.
              </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>Final Scores:</p>
          <div className='flex justify-around mt-4'>
            {localGameData.team1 && <div className='text-lg'><span className='font-bold'>{localGameData.team1.name}</span>: {localGameData.team1.score}</div>}
            {localGameData.team2 && <div className='text-lg'><span className='font-bold'>{localGameData.team2.name}</span>: {localGameData.team2.score}</div>}
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

  if (localGameData.status === 'lobby') {
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
            <div className='font-mono text-xl p-3 bg-muted rounded-md'>Game Code: <span className='font-bold tracking-widest'>{localGameData.id}</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
                <div className='p-4 border rounded-md'>
                    <h3 className='font-bold'>Team 1</h3>
                    <p>{localGameData.team1?.name || 'Waiting...'}</p>
                </div>
                 <div className='p-4 border rounded-md'>
                    <h3 className='font-bold'>Team 2</h3>
                    <p>{localGameData.team2?.name || 'Waiting...'}</p>
                </div>
            </div>
        </CardContent>
      </Card>
    );
  }
  
  if (localGameData.status === 'paused') {
     return (
        <div className="flex flex-col items-center justify-center p-2 sm:p-4 md:p-6">
          <div className="flex flex-col items-center gap-4 text-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            Game is paused by the admin...
        </div>
      </div>
     )
  }

  if (localGameData.status !== 'in_progress' || !currentRound) {
    return (
        <div className="flex flex-col items-center justify-center p-2 sm:p-4 md:p-6">
          <div className="flex flex-col items-center gap-4 text-lg">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            Loading game state...
          </div>
        </div>
    )
  }
  
  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      <div className="text-center p-2 bg-muted text-muted-foreground rounded-md flex justify-between items-center">
        <span>Game Code: <strong className="font-mono">{localGameData.id}</strong></span>
        <span>Round: <strong className="font-mono">{localGameData.currentRoundIndex + 1} / {localGameData.rounds.length}</strong></span>
      </div>
      <Scoreboard team1={localGameData.team1} team2={localGameData.team2} playerTeam={playerTeam} />
      <GameArea game={localGameData} currentRound={currentRound} playerTeam={playerTeam} onLetterReveal={handleLetterReveal} onMainAnswerSubmit={handleMainAnswerSubmit} />
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
