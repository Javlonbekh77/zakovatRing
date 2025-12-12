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
  ArrowRight,
  Lock,
} from 'lucide-react';
import Scoreboard from './scoreboard';
import GameArea from './game-area';
import { Button } from './ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge } from './ui/badge';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, runTransaction, serverTimestamp, getDoc, updateDoc, setDoc } from 'firebase/firestore';
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
import { normalizeApostrophes } from '@/lib/utils';
import RoundNavigator from './round-navigator';


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
    let newStatus: GameStatus = game.status === 'in_progress' ? 'paused' : 'in_progress';
    
    // If resuming from lobby, start the first round for both teams
    if (game.status === 'lobby' && newStatus === 'in_progress' && game.team1 && game.team2) {
       // This logic is simplified; starting is handled by team2 joining
    } else if (game.status === 'finished') {
        return; // Cannot change status of a finished game
    }

    try {
      await updateDoc(gameDocRef, {
        status: newStatus,
        lastActivityAt: serverTimestamp(),
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

        const isLastRound = currentGame.currentRoundIndex >= currentGame.rounds.length - 1;

        if (isLastRound) {
          transaction.update(gameDocRef, {
            status: 'finished',
            lastActivityAt: serverTimestamp(),
          });
        } else {
          const nextIndex = currentGame.currentRoundIndex + 1;
          transaction.update(gameDocRef, {
            currentRoundIndex: nextIndex, // This is the master index
            lastActivityAt: serverTimestamp(),
          });
        }
      });
      toast({ title: 'Round Skipped (Master)' });
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
          disabled={game.status === 'finished'}
        >
          {game.status === 'in_progress' ? <Pause /> : <Play />}
          {game.status === 'in_progress' ? 'Pause Game' : game.status === 'lobby' ? 'Start Game' : 'Resume Game'}
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

function SpectatorView({ game, user }: { game: Game; user: any; isAdmin: boolean }) {
    const winner = useMemo(() => {
        const activeGame = game;
        if (activeGame.status !== 'finished') return null;
        if (activeGame.forfeitedBy) {
          return activeGame.forfeitedBy === 'team1' ? activeGame.team2 : activeGame.team1;
        }

        const team1Finished = activeGame.team1 && activeGame.team1.roundsCompleted >= activeGame.rounds.length;
        const team2Finished = activeGame.team2 && activeGame.team2.roundsCompleted >= activeGame.rounds.length;

        if (team1Finished && team2Finished) {
            if (activeGame.team1.score > activeGame.team2.score) return activeGame.team1;
            if (activeGame.team2.score > activeGame.team1.score) return activeGame.team2;
            return null; // Draw
        }
        
        return null;
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
  
  const team1Round = game.team1?.currentRoundIndex ?? 0;
  const team2Round = game.team2?.currentRoundIndex ?? 0;
  const isAdmin = user?.uid === game.creatorId;

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
          <Scoreboard game={game} playerTeam={null} isSpectator={true} />
        </CardContent>
      </Card>

      {isAdmin && <AdminControls game={game} user={user} />}

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team 1 Progress */}
        <div className="space-y-2">
            <h3 className="text-2xl font-bold text-center">{game.team1?.name || 'Team 1'}</h3>
            {game.rounds.map((round, index) => (
            <Card
                key={`t1-${index}`}
                className={`border-l-4 ${
                index === team1Round && game.status === 'in_progress'
                    ? 'border-primary shadow-lg'
                    : 'border-border'
                }`}
            >
                <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Round {index + 1}</CardTitle>
                    { (game.team1?.completedRounds || []).includes(index) ? (
                    <Badge variant="secondary">
                        <CheckCircle2 className="mr-2" />
                        Finished
                    </Badge>
                    ) : index === team1Round && game.status === 'in_progress' ? (
                    <Badge>
                        <Circle className="mr-2 animate-pulse" />
                        In Progress
                    </Badge>
                    ) : (
                    <Badge variant="outline">
                        Pending
                    </Badge>
                    )}
                </div>
                <CardDescription>{round.mainQuestion}</CardDescription>
                </CardHeader>
            </Card>
            ))}
        </div>

        {/* Team 2 Progress */}
        <div className="space-y-2">
            <h3 className="text-2xl font-bold text-center">{game.team2?.name || 'Team 2'}</h3>
            {game.rounds.map((round, index) => (
            <Card
                key={`t2-${index}`}
                className={`border-l-4 ${
                index === team2Round && game.status === 'in_progress'
                    ? 'border-primary shadow-lg'
                    : 'border-border'
                }`}
            >
                <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Round {index + 1}</CardTitle>
                    { (game.team2?.completedRounds || []).includes(index) ? (
                    <Badge variant="secondary">
                        <CheckCircle2 className="mr-2" />
                        Finished
                    </Badge>
                    ) : index === team2Round && game.status === 'in_progress' ? (
                    <Badge>
                        <Circle className="mr-2 animate-pulse" />
                        In Progress
                    </Badge>
                    ) : (
                    <Badge variant="outline">
                        Pending
                    </Badge>
                    )}
                </div>
                <CardDescription>{round.mainQuestion}</CardDescription>
                </CardHeader>
            </Card>
            ))}
        </div>
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
  
  const [localGame, setLocalGame] = useState<Game | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeRoundIndex, setActiveRoundIndex] = useState<number>(0);

  const teamNameFromUrl = useMemo(() => searchParams.get('teamName'), [searchParams]);
  const isAdminView = useMemo(() => searchParams.get('admin') === 'true', [searchParams]);
  const isSpectator = !teamNameFromUrl && !isAdminView;

  const [playerTeam, setPlayerTeam] = useState<'team1' | 'team2' | null>(null);

  useEffect(() => {
    if (game) {
      setLocalGame(game);
      
      let team: 'team1' | 'team2' | null = null;
      if (teamNameFromUrl) {
          if (game.team1?.name === teamNameFromUrl) team = 'team1';
          else if (game.team2?.name === teamNameFromUrl) team = 'team2';
      }
      setPlayerTeam(team);

      if (team && game[team]) {
        setActiveRoundIndex(game[team]!.currentRoundIndex);
      } else if (isSpectator || isAdminView) {
        setActiveRoundIndex(game.currentRoundIndex);
      }
    }
  }, [game, teamNameFromUrl, isSpectator, isAdminView]);


  // Effect for joining the game.
  useEffect(() => {
    const assignTeam = async () => {
        if (!teamNameFromUrl || !firestore || !gameId || !user || playerTeam || !game) return;
        
        if (game.status !== 'lobby') {
            const alreadyJoined = game.team1?.name === teamNameFromUrl || game.team2?.name === teamNameFromUrl;
            if (!alreadyJoined) {
                toast({ variant: 'destructive', title: 'Game in Progress', description: 'You can only spectate an active game.'});
                return;
            }
        }

        const docRef = doc(firestore, 'games', gameId);
        try {
            await runTransaction(firestore, async (transaction) => {
                const gameSnap = await transaction.get(docRef);
                if (!gameSnap.exists()) {
                    throw new Error("Game not found!");
                }
                const gameData = gameSnap.data() as Game;

                if (gameData.team1?.name === teamNameFromUrl) { return; }
                if (gameData.team2?.name === teamNameFromUrl) { return; }

                if (gameData.status !== 'lobby') {
                    toast({ variant: 'destructive', title: 'Game has already started or is full.' }); return;
                }
                
                const newTeamData: Team = { 
                  name: teamNameFromUrl, 
                  score: 0, 
                  currentRoundIndex: 0,
                  roundsCompleted: 0,
                  completedRounds: [],
                  revealedLetters: {}
                };

                let newTeamSlot: 'team1' | 'team2' | null = null;
                if (!gameData.team1) {
                    newTeamSlot = 'team1';
                } else if (!gameData.team2) {
                    newTeamSlot = 'team2';
                }

                if (newTeamSlot) {
                    const updateData: any = {
                        [`${newTeamSlot}`]: newTeamData,
                        lastActivityAt: serverTimestamp(),
                    };
                    if (gameData.team1 && newTeamSlot === 'team2') {
                        updateData.status = 'in_progress';
                    }
                    transaction.update(docRef, updateData);
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
    if (game && !playerTeam && !isAdminView) {
        assignTeam();
    }
  }, [teamNameFromUrl, firestore, gameId, toast, user, game, playerTeam, isAdminView]);
  
  // Effect for the points countdown timer.
  useEffect(() => {
    if (!localGame || !playerTeam || localGame.status !== 'in_progress') return;
  
    const teamData = localGame[playerTeam];
    if (!teamData || !localGame.rounds || !Array.isArray(localGame.rounds)) return;

    if (teamData.roundsCompleted >= localGame.rounds.length) return;
  
    const timer = setInterval(() => {
      setLocalGame(prevGame => {
        if (!prevGame || !Array.isArray(prevGame.rounds) || !prevGame[playerTeam!]) return prevGame;
        if (prevGame.status !== 'in_progress') return prevGame;
  
        // Create a deep copy to avoid mutation issues
        const newGame = JSON.parse(JSON.stringify(prevGame));
        
        // Find the active round for the player (not necessarily the same as their currentRoundIndex if they are navigating)
        const currentRoundForTimer = newGame.rounds[activeRoundIndex];
  
        if (currentRoundForTimer && !newGame[playerTeam!]?.completedRounds?.includes(activeRoundIndex)) {
          currentRoundForTimer.currentPoints = Math.max(0, currentRoundForTimer.currentPoints - POINTS_DECREMENT_AMOUNT);
          return newGame;
        }
        return prevGame;
      });
    }, POINTS_DECREMENT_INTERVAL);
  
    return () => clearInterval(timer);
  }, [localGame, playerTeam, activeRoundIndex]);
  
  const handleLetterReveal = useCallback(
    async (letterKey: string) => {
      if (!playerTeam || !localGame || !firestore || !gameDocRef) return;
  
      setLocalGame(prevGame => {
        if (!prevGame || !prevGame[playerTeam!]) return null;
        
        const newGame = JSON.parse(JSON.stringify(prevGame));
        const teamData = newGame[playerTeam!]!;
        const roundIndexToUpdate = activeRoundIndex;

        teamData.score += LETTER_REVEAL_REWARD;
        if (!teamData.revealedLetters[roundIndexToUpdate]) {
            teamData.revealedLetters[roundIndexToUpdate] = [];
        }
        if (!teamData.revealedLetters[roundIndexToUpdate].includes(letterKey)) {
             teamData.revealedLetters[roundIndexToUpdate].push(letterKey);
        }
        return newGame;
      });

      runTransaction(firestore, async transaction => {
        const gameSnap = await transaction.get(gameDocRef);
        if (!gameSnap.exists()) throw new Error("Game disappeared");

        const serverGame = gameSnap.data() as Game;
        const serverTeamData = serverGame[playerTeam!];
        if (!serverTeamData) throw new Error("Team not found on server");

        const roundIndexToUpdate = activeRoundIndex;
        const newScore = serverTeamData.score + LETTER_REVEAL_REWARD;
        
        const revealedLettersForRound = serverTeamData.revealedLetters[roundIndexToUpdate] || [];
        if (!revealedLettersForRound.includes(letterKey)) {
            revealedLettersForRound.push(letterKey);
        }

        transaction.update(gameDocRef, {
            [`${playerTeam}.score`]: newScore,
            [`${playerTeam}.revealedLetters.${roundIndexToUpdate}`]: revealedLettersForRound,
            lastActivityAt: serverTimestamp(),
        });
      }).catch(e => {
        console.error("Failed to sync letter reveal:", e);
        toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save letter reveal. Please check connection.'})
        setLocalGame(game); 
      });
  
    },
    [playerTeam, localGame, toast, firestore, gameDocRef, game, activeRoundIndex]
  );

  const handleMainAnswerSubmit = useCallback(
    async (answer: string) => {
      if (!playerTeam || !localGame || !firestore || !gameDocRef) {
        throw new Error('Game state is not ready for submission.');
      }
      
      const teamData = localGame[playerTeam];
      if (!teamData) return;

      const currentRound = localGame.rounds[activeRoundIndex];
      const isCorrect = normalizeApostrophes(currentRound.mainAnswer) === normalizeApostrophes(answer);
      
      if (isCorrect) {
          const pointsFromRound = currentRound.currentPoints;
          const newScore = teamData.score + pointsFromRound;
          const newCompletedRounds = teamData.completedRounds ? [...teamData.completedRounds, activeRoundIndex] : [activeRoundIndex];
          
          let nextRoundToPlay = teamData.currentRoundIndex;
          if (activeRoundIndex === teamData.currentRoundIndex) {
              // Find the next uncompleted round
              let nextIndex = activeRoundIndex + 1;
              while(nextIndex < localGame.rounds.length && newCompletedRounds.includes(nextIndex)){
                  nextIndex++;
              }
              nextRoundToPlay = nextIndex;
          }
          if (nextRoundToPlay < localGame.rounds.length) {
              setActiveRoundIndex(nextRoundToPlay);
          }


          setLocalGame(prevGame => {
              if (!prevGame || !prevGame[playerTeam!]) return null;
              const newGame = JSON.parse(JSON.stringify(prevGame));
              const newTeamData = newGame[playerTeam!]!;
              newTeamData.score = newScore;
              newTeamData.completedRounds = newCompletedRounds;
              newTeamData.roundsCompleted = newCompletedRounds.length;
              newTeamData.currentRoundIndex = nextRoundToPlay;
              return newGame;
          });
          
          toast({
            title: `Correct! Round ${activeRoundIndex + 1} finished.`,
            description: `Your team gets ${currentRound.currentPoints} points.`,
          });

          runTransaction(firestore, async transaction => {
              transaction.update(gameDocRef, {
                  [`${playerTeam}.score`]: newScore,
                  [`${playerTeam}.completedRounds`]: newCompletedRounds,
                  [`${playerTeam}.roundsCompleted`]: newCompletedRounds.length,
                  [`${playerTeam}.currentRoundIndex`]: nextRoundToPlay,
                  lastActivityAt: serverTimestamp(),
              });
          }).catch(e => {
              console.error("Failed to sync main answer:", e);
              toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save round result.'})
              setLocalGame(game); 
          });

      } else {
         const newScore = teamData.score - INCORRECT_ANSWER_PENALTY;
         setLocalGame(prevGame => {
            if (!prevGame || !prevGame[playerTeam!]) return null;
            const newGame = JSON.parse(JSON.stringify(prevGame));
            newGame[playerTeam!]!.score = newScore;
            // The points timer will continue from its current state, no reset needed here
            return newGame;
        });

        toast({
          variant: 'destructive',
          title: 'Incorrect Answer',
          description: `That's not right. Your team loses ${INCORRECT_ANSWER_PENALTY} points.`,
        });

        runTransaction(firestore, async transaction => {
            transaction.update(gameDocRef, {
                [`${playerTeam}.score`]: newScore,
                lastActivityAt: serverTimestamp(),
            });
        }).catch(e => {
             console.error("Failed to sync penalty:", e);
             toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save penalty.'})
             setLocalGame(game); 
        });
      }
    },
    [playerTeam, localGame, toast, firestore, gameDocRef, game, activeRoundIndex]
  );
  
  const handlePlayerFinish = useCallback(async () => {
    if (!playerTeam || !localGame || !firestore || !gameDocRef || isSyncing) return;

    const teamData = localGame[playerTeam];
    if (!teamData) return;

    setIsSyncing(true);
    toast({ title: "You've finished your game!", description: 'Your score is locked in. Waiting for the other team...' });
    
    runTransaction(firestore, async (transaction) => {
        const gameSnap = await transaction.get(gameDocRef);
        if (!gameSnap.exists()) throw new Error("Game not found during final sync");

        const serverGame = gameSnap.data() as Game;

        // Mark this team as finished by setting their completedRounds to the total number of rounds
        const finalCompletedRounds = Array.from({ length: serverGame.rounds.length }, (_, i) => i);

        const finalUpdate: any = {
            [`${playerTeam}.roundsCompleted`]: serverGame.rounds.length,
            [`${playerTeam}.completedRounds`]: finalCompletedRounds,
            lastActivityAt: serverTimestamp(),
        };

        const otherTeamKey = playerTeam === 'team1' ? 'team2' : 'team1';
        const otherTeamData = serverGame[otherTeamKey];
        // If the other team has also finished, end the game
        if (otherTeamData && otherTeamData.roundsCompleted >= serverGame.rounds.length) {
            finalUpdate.status = 'finished';
        }

        transaction.update(gameDocRef, finalUpdate);
    }).catch(e => {
        console.error("Failed to sync final game state:", e);
        toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save final game result. Please check your connection.' })
    }).finally(() => {
        setIsSyncing(false);
    });
}, [playerTeam, localGame, firestore, gameDocRef, isSyncing, toast]);

  
  // Use the live Firestore `game` for spectators, and `localGame` for players
  const activeGame = isSpectator || isAdminView ? game : localGame;

  const winner = useMemo(() => {
    if (!activeGame || activeGame.status !== 'finished') return null;

    if (activeGame.forfeitedBy) {
        return activeGame.forfeitedBy === 'team1' ? activeGame.team2 : activeGame.team1;
    }
    
    const team1Finished = activeGame.team1 && activeGame.team1.roundsCompleted >= activeGame.rounds.length;
    const team2Finished = activeGame.team2 && activeGame.team2.roundsCompleted >= activeGame.rounds.length;

    if (team1Finished && team2Finished) {
        if (activeGame.team1.score > activeGame.team2.score) return activeGame.team1;
        if (activeGame.team2.score > activeGame.team1.score) return activeGame.team2;
        return null; // Draw
    }
    
    return null; 
  }, [activeGame]);
  
  const playerTeamData = useMemo(() => {
    if (!activeGame || !playerTeam) return null;
    return activeGame[playerTeam];
  }, [activeGame, playerTeam]);

  const currentRound = useMemo(() => {
    if (!activeGame || !Array.isArray(activeGame.rounds) || activeRoundIndex >= activeGame.rounds.length || activeRoundIndex < 0) {
      return null;
    }
    return activeGame.rounds[activeRoundIndex];
  }, [activeGame, activeRoundIndex]);


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
  
  if (isSpectator || (isAdminView && !playerTeam)) {
    return <SpectatorView game={game} user={user} isAdmin={isAdminView && user?.uid === game.creatorId} />;
  }
  
  const hasPlayerFinishedAllRounds = playerTeamData && playerTeamData.roundsCompleted >= activeGame.rounds.length;

  if (activeGame.status === 'finished') {
    return (
      <Card className="w-full max-w-lg text-center p-8 shadow-2xl animate-in fade-in zoom-in-95 m-auto">
        {isSyncing && (
            <div className='absolute top-4 right-4 text-muted-foreground'>
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        )}
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

  if (hasPlayerFinishedAllRounds) {
      return (
        <Card className="w-full max-w-lg text-center p-8 shadow-2xl animate-in fade-in zoom-in-95 m-auto">
            <CardHeader>
                <CardTitle>You've Finished!</CardTitle>
                <CardDescription>Waiting for the other team to finish to see the final results.</CardDescription>
            </CardHeader>
            <CardContent>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            </CardContent>
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

  if (!currentRound) {
    if (isLoading || isSyncing) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 md:p-6">
                <div className="flex flex-col items-center gap-4 text-lg">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    Loading...
                </div>
            </div>
        );
    }
     return (
        <Card className="w-full max-w-lg text-center p-8 shadow-2xl animate-in fade-in zoom-in-95 m-auto">
            <CardHeader>
                <CardTitle>Error</CardTitle>
                <CardDescription>Could not load the current round. Please refresh the page.</CardDescription>
            </CardHeader>
        </Card>
      );
  }


  // Main Gameplay View
  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 relative">
        {isSyncing && (
            <div className='absolute -top-2 right-0 text-muted-foreground animate-in fade-in'>
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        )}
      <div className="text-center p-2 bg-muted text-muted-foreground rounded-md flex justify-between items-center">
        <span>
          Game Code: <strong className="font-mono">{activeGame.id}</strong>
        </span>
        <RoundNavigator
          totalRounds={activeGame.rounds.length}
          activeRoundIndex={activeRoundIndex}
          completedRounds={playerTeamData?.completedRounds || []}
          onSelectRound={setActiveRoundIndex}
        />
        <span>
          Round:{' '}
          <strong className="font-mono">
            {activeRoundIndex + 1} / {activeGame.rounds.length}
          </strong>
        </span>
      </div>
      <Scoreboard
        game={activeGame}
        playerTeam={playerTeam}
      />
      
      <GameArea
        key={activeRoundIndex} // Add key to force re-render on round change
        game={activeGame}
        currentRound={currentRound}
        localCurrentPoints={currentRound.currentPoints}
        playerTeam={playerTeam}
        playerTeamData={playerTeamData}
        onLetterReveal={handleLetterReveal}
        onMainAnswerSubmit={handleMainAnswerSubmit}
      />
      {playerTeam && (
          <div className='flex gap-4'>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isSyncing}>
                  <AlertTriangle className="mr-2 h-4 w-4" /> Finish Game
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to finish?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will lock in your current score and end the game for your team. You won't be able to answer any more questions. The final result will be shown when the other team also finishes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handlePlayerFinish}>
                    Yes, Finish My Game
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
      )}
    </div>
  );
}
