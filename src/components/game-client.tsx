'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Game, Team, Round, GameStatus } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Loader2,
  Users,
  Trophy,
  Play,
  Pause,
  SkipForward,
  ShieldAlert,
  AlertTriangle,
  Award,
  CheckCircle2,
  Circle,
  Home,
} from 'lucide-react';
import Scoreboard from './scoreboard';
import GameArea from './game-area';
import { Button } from './ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge } from './ui/badge';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const POINTS_DECREMENT_INTERVAL = 5000; // 5 seconds
const POINTS_DECREMENT_AMOUNT = 10; // 10 points
const LETTER_REVEAL_REWARD = 10;
const INCORRECT_ANSWER_PENALTY = 20;


function AdminControls({ game, user }: { game: Game; user: any }) {
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
          lastActivityAt: serverTimestamp(),
        });
      });
      toast({ title: `Game ${newStatus === 'paused' ? 'Paused' : 'Resumed'}` });
    } catch (e) {
      if (e instanceof Error)
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleSkipRound = async () => {
    if (!firestore) return;
    const gameDocRef = doc(firestore, 'games', game.id);
    try {
      await runTransaction(firestore, async (transaction) => {
        const gameSnap = await transaction.get(gameDocRef);
        if (!gameSnap.exists()) throw new Error('Game does not exist.');
        const currentGame = gameSnap.data() as Game;

        if (currentGame.currentRoundIndex >= currentGame.rounds.length - 1) {
          transaction.update(gameDocRef, {
            status: 'finished',
            lastActivityAt: serverTimestamp(),
          });
        } else {
          const nextIndex = currentGame.currentRoundIndex + 1;
          transaction.update(gameDocRef, {
            [`rounds.${currentGame.currentRoundIndex}.status`]: 'finished',
            currentRoundIndex: nextIndex,
            [`rounds.${nextIndex}.status`]: 'in_progress',
            lastActivityAt: serverTimestamp(),
          });
        }
      });
      toast({ title: 'Round Skipped' });
    } catch (e) {
      if (e instanceof Error)
        toast({ variant: 'destructive', title: 'Error', description: e.message });
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
          forfeitedBy: teamId,
          lastActivityAt: serverTimestamp(),
        });
      });
      toast({
        variant: 'destructive',
        title: 'Team Disqualified',
        description: `${game[teamId]?.name} has been disqualified.`,
      });
    } catch (e) {
      if (e instanceof Error)
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  if (user?.uid !== game.creatorId) return null;

  return (
    <Card className="shadow-lg border-amber-500/50 border-2 mt-6">
      <CardHeader>
        <CardTitle className="text-xl font-headline flex items-center gap-2">
          <ShieldAlert /> Admin Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          onClick={handleGameStatusToggle}
          disabled={game.status === 'finished' || game.status === 'lobby'}
        >
          {game.status === 'in_progress' ? <Pause /> : <Play />}
          {game.status === 'in_progress' ? 'Pause Game' : 'Resume Game'}
        </Button>
        <Button
          variant="outline"
          onClick={handleSkipRound}
          disabled={game.status !== 'in_progress'}
        >
          <SkipForward /> Skip Round
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!game.team1}>
              Disqualify {game.team1?.name || 'Team 1'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately end the game and declare{' '}
                {game.team2?.name || 'Team 2'} the winner.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => disqualifyTeam('team1')}>
                Disqualify
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!game.team2}>
              Disqualify {game.team2?.name || 'Team 2'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately end the game and declare{' '}
                {game.team1?.name || 'Team 1'} the winner.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => disqualifyTeam('team2')}>
                Disqualify
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function SpectatorView({ game, user }: { game: Game; user: any }) {
    const winner = useMemo(() => {
        if (game.status !== 'finished' || !game.team1 || !game.team2) return null;
        if (game.forfeitedBy) {
          return game.forfeitedBy === 'team1' ? game.team2 : game.team1;
        }
        if (game.team1.score > game.team2.score) return game.team1;
        if (game.team2.score > game.team1.score) return game.team2;
        return null; // Draw
    }, [game]);


  if (!Array.isArray(game.rounds)) {
    return (
      <Card className="w-full text-center p-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-destructive">Invalid Game Data</CardTitle>
          <CardDescription>
            Round data is missing or in an invalid format. Cannot display overview.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center">
            Spectator Dashboard
          </CardTitle>
          <CardDescription className="text-center">
            Game Code: <strong className="font-mono">{game.id}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Scoreboard team1={game.team1} team2={game.team2} playerTeam={null} />
        </CardContent>
      </Card>

      <AdminControls game={game} user={user} />

      {game.status === 'finished' && (
        <Card className="w-full text-center p-8 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="mx-auto w-fit rounded-full bg-yellow-100 p-4 dark:bg-yellow-900/50 mb-4">
            <Trophy className="h-16 w-16 text-yellow-500 dark:text-yellow-400" />
          </div>
          <CardHeader className="pt-0">
            <CardTitle className="text-4xl font-headline">Game Over!</CardTitle>
            {winner ? (
              <CardDescription className="text-xl">
                <span className="font-bold text-primary">{winner.name}</span> wins!
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
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-center">Rounds Overview</h3>
        {game.rounds.map((round, index) => (
          <Card
            key={index}
            className={`border-l-4 ${
              index === game.currentRoundIndex &&
              (game.status === 'in_progress' || game.status === 'paused')
                ? 'border-primary shadow-lg'
                : 'border-border'
            }`}
          >
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Round {index + 1}</CardTitle>
                {round.status === 'finished' ? (
                  <Badge variant="secondary">
                    <CheckCircle2 className="mr-2" />
                    Finished
                  </Badge>
                ) : game.status === 'in_progress' &&
                  round.status === 'in_progress' ? (
                  <Badge>
                    <Circle className="mr-2 animate-pulse" />
                    In Progress
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    {round.status === 'paused' ? (
                      <Pause className="mr-2" />
                    ) : null}
                    {round.status}
                  </Badge>
                )}
              </div>
              <CardDescription>{round.mainQuestion}</CardDescription>
            </CardHeader>
            {index === game.currentRoundIndex &&
              (game.status === 'in_progress' || game.status === 'paused') && (
                <CardContent>
                  <p className="text-lg font-bold font-mono text-primary">
                    {round.currentPoints} points remaining
                  </p>
                </CardContent>
              )}
            {round.winner && game[round.winner] && (
              <CardFooter>
                <div className="text-sm text-muted-foreground flex items-center">
                  <Award className="mr-2 h-4 w-4 text-yellow-500" />
                  Winner:{' '}
                  <span className="font-bold text-foreground ml-1">
                    {game[round.winner]?.name}
                  </span>
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>

      <Button asChild className="w-full mt-8">
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}

interface GameClientProps {
  gameId: string;
}

export default function GameClient({ gameId }: GameClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const gameDocRef = useMemoFirebase(
    () => (firestore && gameId ? doc(firestore, 'games', gameId) : null),
    [firestore, gameId]
  );
  
  const { data: game, isLoading, error } = useDoc<Game>(gameDocRef);
  
  // Local state is now only used for immediate feedback on wrong answers.
  const [localGame, setLocalGame] = useState<Game | null>(null);

  const [playerTeam, setPlayerTeam] = useState<'team1' | 'team2' | null>(null);

  const teamNameFromUrl = useMemo(() => searchParams.get('teamName'), [searchParams]);

  useEffect(() => {
    if (game) {
      setLocalGame(game);
    }
  }, [game]);

  useEffect(() => {
    const assignTeam = async () => {
        if (!teamNameFromUrl || !firestore || !gameId || !user || !game) return;

        if ((game.team1?.name === teamNameFromUrl && playerTeam === 'team1') || 
            (game.team2?.name === teamNameFromUrl && playerTeam === 'team2')) {
            return;
        }

        const docRef = doc(firestore, 'games', gameId);
        try {
            await runTransaction(firestore, async (transaction) => {
                const gameSnap = await transaction.get(docRef);
                if (!gameSnap.exists()) {
                    throw new Error("Game not found!");
                }
                const gameData = gameSnap.data() as Game;

                if (gameData.team1?.name === teamNameFromUrl) {
                    setPlayerTeam('team1');
                    return;
                }
                 if (gameData.team2?.name === teamNameFromUrl) {
                    setPlayerTeam('team2');
                    return;
                }

                if (gameData.status !== 'lobby') {
                    toast({ variant: 'destructive', title: 'Game has already started or is full.' });
                    return;
                }


                let newTeamSlot: 'team1' | 'team2' | null = null;
                if (!gameData.team1) {
                    newTeamSlot = 'team1';
                } else if (!gameData.team2) {
                    newTeamSlot = 'team2';
                }

                if (newTeamSlot) {
                    const updateData: any = {
                        [`${newTeamSlot}`]: { name: teamNameFromUrl, score: 0 },
                        lastActivityAt: serverTimestamp(),
                    };
                    if (newTeamSlot === 'team2') {
                        updateData.status = 'in_progress';
                    }
                    transaction.update(docRef, updateData);
                    setPlayerTeam(newTeamSlot);
                } else {
                     toast({ variant: 'destructive', title: 'Game is full' });
                }
            });
        } catch (e) {
            if (e instanceof Error) {
                toast({ variant: 'destructive', title: 'Failed to join game', description: e.message });
            }
        }
    };
    if (game && !playerTeam) {
        assignTeam();
    }
  }, [teamNameFromUrl, firestore, gameId, toast, user, game, playerTeam]);

  const winner = useMemo(() => {
    const activeGame = game || localGame;
    if (!activeGame || activeGame.status !== 'finished' || !activeGame.team1 || !activeGame.team2) return null;
    if (activeGame.forfeitedBy) {
        return activeGame.forfeitedBy === 'team1' ? activeGame.team2 : activeGame.team1;
    }
    if (activeGame.team1.score > activeGame.team2.score) return activeGame.team1;
    if (activeGame.team2.score > activeGame.team1.score) return activeGame.team2;
    return null; // Draw
  }, [localGame, game]);

  const currentRound = useMemo(() => {
    const activeGame = game || localGame;
    if (!activeGame || !Array.isArray(activeGame.rounds) || activeGame.currentRoundIndex >= activeGame.rounds.length) {
      return null;
    }
    return activeGame.rounds[activeGame.currentRoundIndex];
  }, [localGame, game]);
  
  useEffect(() => {
    if (!game || game.status !== 'in_progress' || !currentRound || currentRound.status !== 'in_progress' || !gameDocRef || !firestore) {
        return; 
    }
    
    const timer = setInterval(() => {
      // Points deduction is now handled via a transaction to avoid overwriting other state changes.
      runTransaction(firestore, async (transaction) => {
        const freshGameSnap = await transaction.get(gameDocRef);
        if (!freshGameSnap.exists()) return;

        const freshGame = freshGameSnap.data() as Game;
        const freshRound = freshGame.rounds[freshGame.currentRoundIndex];
        
        // Only deduct points if the game and round are in progress
        if (freshGame.status === 'in_progress' && freshRound.status === 'in_progress') {
           const newPoints = Math.max(0, freshRound.currentPoints - POINTS_DECREMENT_AMOUNT);
           transaction.update(gameDocRef, {
             [`rounds.${freshGame.currentRoundIndex}.currentPoints`]: newPoints,
           });
        }
      });
    }, POINTS_DECREMENT_INTERVAL);

    return () => clearInterval(timer);
  }, [game, currentRound, gameDocRef, firestore]);
  
  const handleLetterReveal = useCallback(
    async (letterKey: string) => {
      if (!playerTeam || !game || !currentRound || !firestore || !gameDocRef) return;
      
      const revealedLettersKey = playerTeam === 'team1' ? 'team1RevealedLetters' : 'team2RevealedLetters';
      const currentRevealed = currentRound[revealedLettersKey] || [];
       if (currentRevealed.includes(letterKey)) {
            return;
       }

      runTransaction(firestore, async (transaction) => {
          const gameSnap = await transaction.get(gameDocRef);
          if (!gameSnap.exists()) throw new Error("Game not found");
          const serverGame = gameSnap.data() as Game;

          const newRevealed = [...(serverGame.rounds[serverGame.currentRoundIndex][revealedLettersKey] || []), letterKey];
          const newScore = (serverGame[playerTeam]?.score || 0) + LETTER_REVEAL_REWARD;

          transaction.update(gameDocRef, {
            [`rounds.${serverGame.currentRoundIndex}.${revealedLettersKey}`]: newRevealed,
            [`${playerTeam}.score`]: newScore
          });
      }).then(() => {
          toast({
            title: 'Correct!',
            description: `Letter revealed! You earned ${LETTER_REVEAL_REWARD} points.`,
          });
      }).catch(e => {
        if(e instanceof Error) toast({ variant: 'destructive', title: 'Error', description: e.message });
      })
    },
    [playerTeam, game, currentRound, firestore, gameDocRef, toast]
  );

  const handleMainAnswerSubmit = useCallback(
    async (answer: string) => {
      if (!playerTeam || !game || !currentRound || !gameDocRef || !firestore) {
        throw new Error('Game state is not ready for submission.');
      }

      const isCorrect = currentRound.mainAnswer.toLowerCase().trim() === answer.toLowerCase().trim();

      if (isCorrect) {
        toast({
          title: `Correct! Round ${game.currentRoundIndex + 1} finished.`,
          description: `Your team gets ${currentRound.currentPoints} points.`,
        });

        // The entire logic is now in a single, non-blocking transaction.
        // No more local state manipulation for round progression.
        runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameDocRef);
            if (!gameSnap.exists()) throw new Error("Game not found on server.");
            
            const serverGame = gameSnap.data() as Game;
            const currentRoundIndex = serverGame.currentRoundIndex;
            const isLastRound = currentRoundIndex === serverGame.rounds.length - 1;
            
            const pointsFromRound = serverGame.rounds[currentRoundIndex].currentPoints;
            const finalScore = (serverGame[playerTeam]?.score || 0) + pointsFromRound;

            let updateData: any = {
                [`rounds.${currentRoundIndex}.status`]: 'finished',
                [`rounds.${currentRoundIndex}.winner`]: playerTeam,
                [`${playerTeam}.score`]: finalScore,
                lastActivityAt: serverTimestamp(),
            };
            
            if (isLastRound) {
                updateData.status = 'finished';
            } else {
                updateData.currentRoundIndex = currentRoundIndex + 1;
                updateData[`rounds.${currentRoundIndex + 1}.status`] = 'in_progress';
            }
            
            transaction.update(gameDocRef, updateData);
        }).catch(e => {
            console.error("Failed to sync final game state:", e);
            toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save game result. Please check your connection.'})
        });
        
      } else {
         // Optimistically update local state for penalty for immediate feedback
         setLocalGame(prevGame => {
            if (!prevGame || !prevGame[playerTeam]) return null;
            const newScore = prevGame[playerTeam]!.score - INCORRECT_ANSWER_PENALTY;
            const newTeamData = { ...prevGame[playerTeam]!, score: newScore };
            return {...prevGame, [playerTeam]: newTeamData };
        });

        // Show toast only to the current player
        toast({
          variant: 'destructive',
          title: 'Incorrect Answer',
          description: `That's not right. Your team loses ${INCORRECT_ANSWER_PENALTY} points.`,
        });

        // Update the penalty in the database
         runTransaction(firestore, async (transaction) => {
            const gameSnap = await transaction.get(gameDocRef);
            if (!gameSnap.exists()) return;
            const serverGame = gameSnap.data() as Game;
            const newScore = (serverGame[playerTeam]?.score || 0) - INCORRECT_ANSWER_PENALTY;
            transaction.update(gameDocRef, {
                [`${playerTeam}.score`]: newScore
            });
         });
      }
    },
    [playerTeam, firestore, gameDocRef, game, toast, currentRound]
  );
  
  const handleForfeit = async () => {
    if (!firestore || !playerTeam || !game) return;
    const gameDocRef = doc(firestore, 'games', game.id);
    try {
      await runTransaction(firestore, async (transaction) => {
        transaction.update(gameDocRef, {
          status: 'finished',
          forfeitedBy: playerTeam,
          winner: playerTeam === 'team1' ? 'team2' : 'team1',
          lastActivityAt: serverTimestamp(),
        });
      });
      toast({
        variant: 'destructive',
        title: 'You Forfeited',
        description: 'Your team has forfeited the game.',
      });
    } catch (e) {
      if (e instanceof Error)
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const activeGame = game || localGame;

  if (isLoading || !activeGame) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="flex flex-col items-center gap-4 text-lg">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          Loading Game...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md m-auto">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Game</CardTitle>
          <CardDescription>Could not load game data. Please try again later.</CardDescription>
        </CardHeader>
        <CardContent>{error.message}</CardContent>
         <CardFooter>
            <Button asChild className="w-full">
                <Link href="/"><Home className="mr-2 h-4 w-4" /> Go to Home</Link>
            </Button>
        </CardFooter>
      </Card>
    );
  }
  
  if (!game && !localGame) { 
    return (
       <Card className="w-full max-w-md m-auto">
        <CardHeader>
          <CardTitle>Game Not Found</CardTitle>
          <CardDescription>The game with ID <span className='font-mono font-bold'>{gameId}</span> does not exist or has been deleted.</CardDescription>
        </CardHeader>
         <CardFooter>
            <Button asChild className="w-full">
                <Link href="/"><Home className="mr-2 h-4 w-4" /> Go to Home</Link>
            </Button>
        </CardFooter>
      </Card>
    )
  }

  const isSpectator = !teamNameFromUrl;
  if (isSpectator) {
    return <SpectatorView game={activeGame} user={user} />;
  }
  
  if (activeGame.status === 'finished') {
    return (
      <Card className="w-full max-w-lg text-center p-8 shadow-2xl animate-in fade-in zoom-in-95 m-auto">
        <div className="mx-auto w-fit rounded-full bg-yellow-100 p-4 dark:bg-yellow-900/50 mb-4">
          <Trophy className="h-16 w-16 text-yellow-500 dark:text-yellow-400" />
        </div>
        <CardHeader className="p-0">
          <CardTitle className="text-4xl font-headline">Game Over!</CardTitle>
          {winner ? (
            <CardDescription className="text-xl">
              <span className="font-bold text-primary">{winner.name}</span> wins!
            </CardDescription>
          ) : (
            <CardDescription className="text-xl">It's a draw!</CardDescription>
          )}
          {activeGame.forfeitedBy && activeGame[activeGame.forfeitedBy] && (
            <CardDescription className="text-sm text-destructive mt-2">
              Game was forfeited by {activeGame[activeGame.forfeitedBy]?.name}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Final Scores:</p>
          <div className="flex justify-around mt-4">
            {activeGame.team1 && (
              <div className="text-lg">
                <span className="font-bold">{activeGame.team1.name}</span>:{' '}
                {activeGame.team1.score}
              </div>
            )}
            {activeGame.team2 && (
              <div className="text-lg">
                <span className="font-bold">{activeGame.team2.name}</span>:{' '}
                {activeGame.team2.score}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/">Play Again</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  if (activeGame.status === 'lobby') {
    return (
      <Card className="w-full max-w-lg text-center p-8 shadow-xl m-auto">
        <CardHeader>
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Game Lobby</CardTitle>
          <CardDescription>
            Waiting for the second player to join...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="font-mono text-xl p-3 bg-muted rounded-md">
            Game Code: <span className="font-bold tracking-widest">{activeGame.id}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
            <div className="p-4 border rounded-md">
              <h3 className="font-bold">Team 1</h3>
              <p>{activeGame.team1?.name || 'Waiting...'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <h3 className="font-bold">Team 2</h3>
              <p>{activeGame.team2?.name || 'Waiting...'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!currentRound) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 md:p-6">
            <div className="flex flex-col items-center gap-4 text-lg">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                Loading...
            </div>
        </div>
    );
  }

  if (activeGame.status === 'paused') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="flex flex-col items-center gap-4 text-lg">
          <Pause className="h-12 w-12 text-primary" />
          Game is paused by the admin...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4">
      <div className="text-center p-2 bg-muted text-muted-foreground rounded-md flex justify-between items-center">
        <span>
          Game Code: <strong className="font-mono">{activeGame.id}</strong>
        </span>
        <span>
          Round:{' '}
          <strong className="font-mono">
            {activeGame.currentRoundIndex + 1} / {activeGame.rounds.length}
          </strong>
        </span>
      </div>
      <Scoreboard
        team1={activeGame.team1}
        team2={activeGame.team2}
        playerTeam={playerTeam}
      />
      
      <GameArea
        game={activeGame}
        currentRound={currentRound}
        localCurrentPoints={currentRound.currentPoints}
        playerTeam={playerTeam}
        onLetterReveal={handleLetterReveal}
        onMainAnswerSubmit={handleMainAnswerSubmit}
      />
      {playerTeam && (
          <div className='flex gap-4'>
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
                    This action cannot be undone. You will lose the game
                    immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleForfeit}>
                    Yes, Forfeit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            {user?.uid === activeGame.creatorId && (
              <AdminControls game={activeGame} user={user} />
            )}
          </div>
      )}
    </div>
  );
}

    