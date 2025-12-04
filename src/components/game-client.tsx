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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const POINTS_DECREMENT_INTERVAL = 5000; // 5 seconds
const POINTS_DECREMENT_AMOUNT = 10; // 10 points
const LETTER_REVEAL_REWARD = 10;
const INCORRECT_ANSWER_PENALTY = 50;

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

  const currentRound = game.rounds[game.currentRoundIndex];

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

      {user?.uid === game.creatorId && <AdminControls game={game} user={user} />}

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
  assignedTeam?: 'team1' | 'team2' | undefined;
}

export default function GameClient({ gameId, assignedTeam }: GameClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const gameDocRef = useMemoFirebase(
    () => (firestore && gameId ? doc(firestore, 'games', gameId) : null),
    [firestore, gameId]
  );
  
  const { data: game, isLoading, error } = useDoc<Game>(gameDocRef);

  const [playerTeam, setPlayerTeam] = useState<'team1' | 'team2' | null>(null);
  const [localCurrentPoints, setLocalCurrentPoints] = useState(1000); 

  const winner = useMemo(() => {
    if (!game || game.status !== 'finished' || !game.team1 || !game.team2) return null;
    if (game.forfeitedBy) {
        return game.forfeitedBy === 'team1' ? game.team2 : game.team1;
    }
    if (game.team1.score > game.team2.score) return game.team1;
    if (game.team2.score > game.team1.score) return game.team2;
    return null; // Draw
  }, [game]);

  const currentRound = useMemo(() => {
    if (!game || !Array.isArray(game.rounds) || game.currentRoundIndex >= game.rounds.length) {
      return null;
    }
    return game.rounds[game.currentRoundIndex];
  }, [game]);
  
  useEffect(() => {
    const isSpectator = window.location.pathname.includes('/spectate');
    if (isSpectator) {
      setPlayerTeam(null);
      return;
    }

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
    setPlayerTeam(teamToSet);

    if (teamToSet && !assignedTeam && !teamFromUrl && typeof window !== 'undefined') {
      const newUrl = `${window.location.pathname}?team=${teamToSet}`;
      window.history.replaceState(
        { ...window.history.state, as: newUrl, url: newUrl },
        '',
        newUrl
      );
    }
  }, [gameId, searchParams, assignedTeam]);

  useEffect(() => {
    if (currentRound) {
        setLocalCurrentPoints(currentRound.currentPoints);
    }

    if (game?.status !== 'in_progress' || !currentRound || currentRound.status !== 'in_progress') {
        return; 
    }
    
    const timer = setInterval(() => {
        setLocalCurrentPoints(prevPoints => Math.max(0, prevPoints - POINTS_DECREMENT_AMOUNT));
    }, POINTS_DECREMENT_INTERVAL);

    return () => clearInterval(timer);
  }, [currentRound, game?.status]); 

  const handleLetterReveal = useCallback(
    async (letterKey: string) => {
      if (!playerTeam || !game || !gameDocRef || !currentRound) return;

      try {
        await runTransaction(firestore, async (transaction) => {
          const gameSnap = await transaction.get(gameDocRef);
          if (!gameSnap.exists()) throw new Error('Game not found');
          const currentGame = gameSnap.data() as Game;
		      const currentRoundIndex = currentGame.currentRoundIndex;
		      const round = currentGame.rounds[currentRoundIndex];

          if (round.status !== 'in_progress') {
            toast({ title: "Round Over", description: "This round has already finished." });
            return;
          }

          const revealedLettersKey =
            playerTeam === 'team1'
              ? 'team1RevealedLetters'
              : 'team2RevealedLetters';
          const currentRevealed = round[revealedLettersKey] || [];

          if (!currentRevealed.includes(letterKey)) {
            const newRevealed = [...currentRevealed, letterKey];
            const newScore =
              (currentGame[playerTeam]?.score || 0) + LETTER_REVEAL_REWARD;

            transaction.update(gameDocRef, {
              [`rounds.${currentRoundIndex}.${revealedLettersKey}`]: newRevealed,
              [`${playerTeam}.score`]: newScore,
              lastActivityAt: serverTimestamp(),
            });

            toast({
              title: 'Correct!',
              description: `Letter revealed! You earned ${LETTER_REVEAL_REWARD} points.`,
            });
          } else {
            toast({
              title: 'Already Revealed',
              description: `You have already revealed this letter.`,
            });
          }
        });
      } catch (e) {
        if (e instanceof Error) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
      }
    },
    [playerTeam, game, gameDocRef, firestore, toast, currentRound]
  );

  const handleMainAnswerSubmit = useCallback(
    async (answer: string) => {
      if (!playerTeam || !game || !currentRound || !gameDocRef) {
        throw new Error('Game state is not ready for submission.');
      }

      try {
        await runTransaction(firestore, async (transaction) => {
          const gameSnap = await transaction.get(gameDocRef);
          if (!gameSnap.exists()) throw new Error('Game data not found.');
          
          const serverGame = gameSnap.data() as Game;
          const serverRoundIndex = serverGame.currentRoundIndex;
          const serverRound = serverGame.rounds[serverRoundIndex];

          if (serverRound.status !== 'in_progress') {
            toast({ title: 'Round Over', description: 'This round has already finished.' });
            return;
          }
          
          const isCorrect = serverRound.mainAnswer.toLowerCase().trim() === answer.toLowerCase().trim();

          if (isCorrect) {
            const pointsFromRound = localCurrentPoints;
            const finalTeamScore = (serverGame[playerTeam]?.score || 0) + pointsFromRound;

            const updateData: any = {
              [`rounds.${serverRoundIndex}.status`]: 'finished',
              [`rounds.${serverRoundIndex}.winner`]: playerTeam,
              [`rounds.${serverRoundIndex}.currentPoints`]: pointsFromRound,
              [`${playerTeam}.score`]: finalTeamScore,
              lastActivityAt: serverTimestamp(),
            };

            if (serverRoundIndex < serverGame.rounds.length - 1) {
              const nextRoundIndex = serverRoundIndex + 1;
              updateData.currentRoundIndex = nextRoundIndex;
              updateData[`rounds.${nextRoundIndex}.status`] = 'in_progress';
            } else {
              updateData.status = 'finished' as GameStatus;
            }

            transaction.update(gameDocRef, updateData);

            toast({
              title: `Correct! Round ${serverRoundIndex + 1} finished.`,
              description: `Your team gets ${pointsFromRound} points.`,
            });
          } else {
            const newScore =
              (serverGame[playerTeam]?.score || 0) - INCORRECT_ANSWER_PENALTY;
            transaction.update(gameDocRef, {
              [`${playerTeam}.score`]: newScore,
              lastActivityAt: serverTimestamp(),
            });
            toast({
              variant: 'destructive',
              title: 'Incorrect Answer',
              description: `That's not right. Your team loses ${INCORRECT_ANSWER_PENALTY} points.`,
            });
          }
        });
      } catch (e) {
        if (e instanceof Error) {
          toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
      }
    },
    [playerTeam, firestore, gameDocRef, game, toast, currentRound, localCurrentPoints]
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

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="flex flex-col items-center gap-4 text-lg">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          Loading game...
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
  
  if (!game) {
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

  const isSpectator = !playerTeam;
  if (isSpectator) {
    return <SpectatorView game={game} user={user} />;
  }

  if (game.status === 'lobby') {
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
            Game Code: <span className="font-bold tracking-widest">{game.id}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
            <div className="p-4 border rounded-md">
              <h3 className="font-bold">Team 1</h3>
              <p>{game.team1?.name || 'Waiting...'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <h3 className="font-bold">Team 2</h3>
              <p>{game.team2?.name || 'Waiting...'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (game.status === 'paused') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="flex flex-col items-center gap-4 text-lg">
          <Pause className="h-12 w-12 text-primary" />
          Game is paused by the admin...
        </div>
      </div>
    );
  }
  
  if (game.status === 'finished') {
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
          {game.forfeitedBy && game[game.forfeitedBy] && (
            <CardDescription className="text-sm text-destructive mt-2">
              Game was forfeited by {game[game.forfeitedBy]?.name}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Final Scores:</p>
          <div className="flex justify-around mt-4">
            {game.team1 && (
              <div className="text-lg">
                <span className="font-bold">{game.team1.name}</span>:{' '}
                {game.team1.score}
              </div>
            )}
            {game.team2 && (
              <div className="text-lg">
                <span className="font-bold">{game.team2.name}</span>:{' '}
                {game.team2.score}
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

  if (game.status === 'in_progress' && !currentRound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="flex flex-col items-center gap-4 text-lg">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          Loading round...
        </div>
      </div>
    );
  }
  
  return (
      <div className="w-full max-w-6xl mx-auto space-y-4">
        <div className="text-center p-2 bg-muted text-muted-foreground rounded-md flex justify-between items-center">
          <span>
            Game Code: <strong className="font-mono">{game.id}</strong>
          </span>
          <span>
            Round:{' '}
            <strong className="font-mono">
              {game.currentRoundIndex + 1} / {game.rounds.length}
            </strong>
          </span>
        </div>
        <Scoreboard
          team1={game.team1}
          team2={game.team2}
          playerTeam={playerTeam}
        />
        <GameArea
          game={game}
          currentRound={currentRound!}
          localCurrentPoints={localCurrentPoints}
          playerTeam={playerTeam}
          onLetterReveal={handleLetterReveal}
          onMainAnswerSubmit={handleMainAnswerSubmit}
        />
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
      </div>
    );
}
