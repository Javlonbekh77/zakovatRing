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
  ShieldAlert,
  Smile,
  Frown,
  Home,
  AlertTriangle,
  MessageSquarePlus,
} from 'lucide-react';
import Scoreboard from './scoreboard';
import GameArea from './game-area';
import { Button } from './ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge } from './ui/badge';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, runTransaction, serverTimestamp, updateDoc, collection, addDoc } from 'firebase/firestore';
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
import { Dialog, DialogClose, DialogHeader, DialogTitle, DialogContent, DialogDescription } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

const POINTS_DECREMENT_INTERVAL = 5000;
const POINTS_DECREMENT_AMOUNT = 10;
const LETTER_REVEAL_REWARD = 10;
const INCORRECT_ANSWER_PENALTY = 20;
const SKIP_ROUND_COST = 500;


function AdminControls({ game }: { game: Game;}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isAdmin = useSearchParams().get('admin') === 'true';

  const handleGameStatusToggle = async () => {
    if (!firestore) return;
    const gameDocRef = doc(firestore, 'games', game.id);
    let newStatus: GameStatus = game.status === 'in_progress' ? 'paused' : 'in_progress';
    
    if (game.status === 'finished') {
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

  if (!isAdmin) return null;

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
          {game.status === 'in_progress' ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
          {game.status === 'in_progress' ? 'Pause Game' : 'Resume Game'}
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

function SpectatorView({ game }: { game: Game; }) {
    const winnerTeamKey = useMemo(() => {
        if (game.status !== 'finished') return null;

        if (game.forfeitedBy) {
            return game.forfeitedBy === 'team1' ? 'team2' : 'team1';
        }
        
        const team1 = game.team1;
        const team2 = game.team2;
        
        if (!team1 || !team2) return null;

        if (team1.score > team2.score) return 'team1';
        if (team2.score > team1.score) return 'team2';
        return 'draw'; // It's a draw
    }, [game]);

    const winner = winnerTeamKey && winnerTeamKey !== 'draw' ? game[winnerTeamKey] : null;

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
          <Scoreboard game={game} playerTeam={null} isSpectator={true} />
        </CardContent>
      </Card>

      <AdminControls game={game} />

      {game.status === 'finished' && (
        <Card className="w-full text-center p-8 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="mx-auto w-fit rounded-full bg-yellow-100 p-4 dark:bg-yellow-900/50 mb-4">
            <Trophy className="h-16 w-16 text-yellow-500 dark:text-yellow-400" />
          </div>
          <CardHeader className="pt-0">
            <CardTitle className="text-4xl font-headline">Game Over!</CardTitle>
            {winnerTeamKey === 'draw' ? (
                <CardDescription className="text-xl">It's a draw!</CardDescription>
            ) : winner ? (
              <CardDescription className="text-xl">
                <span className="font-bold text-primary">{winner.name}</span> wins!
              </CardDescription>
            ) : (
              <CardDescription className="text-xl">The results are in!</CardDescription>
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
                index === game.team1?.currentRoundIndex && game.status === 'in_progress'
                    ? 'border-primary shadow-lg'
                    : 'border-border'
                }`}
            >
                <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Round {index + 1}</CardTitle>
                     <p className='text-sm font-bold'>{game.team1?.completedRounds?.includes(index) ? "Finished" : "Pending"}</p>
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
                index === game.team2?.currentRoundIndex && game.status === 'in_progress'
                    ? 'border-primary shadow-lg'
                    : 'border-border'
                }`}
            >
                <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Round {index + 1}</CardTitle>
                    <p className='text-sm font-bold'>{game.team2?.completedRounds?.includes(index) ? "Finished" : "Pending"}</p>
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

function FeedbackDialog({
  gameId,
  teamName,
  isOpen,
  onOpenChange,
}: {
  gameId: string;
  teamName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!firestore || !feedback.trim()) {
      toast({
        variant: 'destructive',
        title: 'Feedback cannot be empty.',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'feedback'), {
        gameId,
        teamName,
        feedback,
        createdAt: serverTimestamp(),
      });
      toast({
        title: 'Feedback submitted!',
        description: 'Thank you for your thoughts.',
      });
      onOpenChange(false);
      setFeedback('');
    } catch (e) {
      if (e instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Error submitting feedback',
          description: e.message,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave Feedback for Game {gameId}</DialogTitle>
          <DialogDescription>
            Share your thoughts, suggestions, or any issues you encountered.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="feedback-textarea">Your Feedback</Label>
          <Textarea
            id="feedback-textarea"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="This game was great, but..."
            rows={5}
            disabled={isSubmitting}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


interface GameClientProps {
  gameId: string;
}

export default function GameClient({ gameId }: GameClientProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const gameDocRef = useMemoFirebase(
    () => (firestore && gameId ? doc(firestore, 'games', gameId) : null),
    [firestore, gameId]
  );
  
  const { data: game, isLoading, error } = useDoc<Game>(gameDocRef);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  
  const teamNameFromUrl = useMemo(() => searchParams.get('teamName'), [searchParams]);
  const isAdminView = useMemo(() => searchParams.get('admin') === 'true', [searchParams]);
  const isSpectator = !teamNameFromUrl && !isAdminView;

  const playerTeam = useMemo<'team1' | 'team2' | null>(() => {
    if (!game || !teamNameFromUrl) return null;
    if (game.team1?.name === teamNameFromUrl) return 'team1';
    if (game.team2?.name === teamNameFromUrl) return 'team2';
    return null;
  }, [game, teamNameFromUrl]);
  
  const playerTeamData = useMemo(() => {
    if (!game || !playerTeam) return null;
    return game[playerTeam];
  }, [game, playerTeam]);

  // Player's active round is local state to allow navigation
  // It defaults to the server-side current round index
  const [activeRoundIndex, setActiveRoundIndex] = useState(playerTeamData?.currentRoundIndex || 0);

  // Sync active round index with server state only when the playerTeamData first loads
  useEffect(() => {
    if (playerTeamData) {
      setActiveRoundIndex(playerTeamData.currentRoundIndex);
    }
  }, [playerTeamData?.currentRoundIndex]);

  // Effect for joining the game.
  useEffect(() => {
    const assignTeam = async () => {
        if (!teamNameFromUrl || !firestore || !gameId || playerTeam || !game) return;
        
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

                if (gameData.team1?.name === teamNameFromUrl || gameData.team2?.name === teamNameFromUrl) {
                    return; // Already joined
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
                    // If the second team joins, start the game
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
  }, [teamNameFromUrl, firestore, gameId, toast, game, playerTeam, isAdminView]);
  
  // Effect to manage the paused state locally based on live game data
  useEffect(() => {
    if (game?.status === 'paused') {
      setIsPaused(true);
    } else {
      setIsPaused(false);
    }
  }, [game?.status]);


  // Effect for the points countdown timer.
  useEffect(() => {
    if (!game || !playerTeam || game.status !== 'in_progress' || !gameDocRef || !firestore) return;
  
    const teamData = game[playerTeam];
    if (!teamData || !Array.isArray(game.rounds)) return;

    // Check if the current active round is already completed by the player
    const isRoundAlreadyCompleted = teamData.completedRounds?.includes(activeRoundIndex);
    if(isRoundAlreadyCompleted) return;

    const timer = setInterval(() => {
      // Use a transaction to decrement points safely
      runTransaction(firestore, async transaction => {
        const freshGameSnap = await transaction.get(gameDocRef);
        if(!freshGameSnap.exists()) return;
        
        const freshGame = freshGameSnap.data() as Game;
        const roundToUpdate = freshGame.rounds[activeRoundIndex];
        
        // Final check inside transaction to prevent race conditions
        if (freshGame.status !== 'in_progress' || freshGame[playerTeam!]?.completedRounds?.includes(activeRoundIndex)) {
            return;
        }

        const newPoints = Math.max(0, roundToUpdate.currentPoints - POINTS_DECREMENT_AMOUNT);
        
        // Create a new rounds array with the updated points
        const newRounds = [...freshGame.rounds];
        newRounds[activeRoundIndex] = { ...roundToUpdate, currentPoints: newPoints };
        
        transaction.update(gameDocRef, { rounds: newRounds });

      }).catch(err => {
        console.error("Point decrement transaction failed: ", err);
      });

    }, POINTS_DECREMENT_INTERVAL);
  
    return () => clearInterval(timer);
  }, [game, playerTeam, activeRoundIndex, gameDocRef, firestore]);
  
  const handleLetterReveal = useCallback(
    async (letterKey: string) => {
      if (!playerTeam || !game || !firestore || !gameDocRef) return;
  
      setIsSyncing(true);
      runTransaction(firestore, async transaction => {
        const gameSnap = await transaction.get(gameDocRef);
        if (!gameSnap.exists()) throw new Error("Game disappeared");

        const serverGame = gameSnap.data() as Game;
        const serverTeamData = serverGame[playerTeam!];
        if (!serverTeamData) throw new Error("Team not found on server");
        
        const newScore = serverTeamData.score + LETTER_REVEAL_REWARD;
        const newRevealedLetters = { ...serverTeamData.revealedLetters };
        const revealedForRound = newRevealedLetters[activeRoundIndex] || [];
        
        if (!revealedForRound.includes(letterKey)) {
            revealedForRound.push(letterKey);
        }
        newRevealedLetters[activeRoundIndex] = revealedForRound;

        transaction.update(gameDocRef, {
            [`${playerTeam}.score`]: newScore,
            [`${playerTeam}.revealedLetters`]: newRevealedLetters,
            lastActivityAt: serverTimestamp(),
        });
      }).catch(e => {
        console.error("Failed to sync letter reveal:", e);
        toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save letter reveal. Please check connection.'})
      }).finally(() => setIsSyncing(false));
  
    },
    [playerTeam, game, toast, firestore, gameDocRef, activeRoundIndex]
  );

  const handleMainAnswerSubmit = useCallback(
    async (answer: string) => {
      if (!playerTeam || !game || !firestore || !gameDocRef) {
        throw new Error('Game state is not ready for submission.');
      }
      
      setIsSyncing(true);
      const currentRound = game.rounds[activeRoundIndex];
      const isCorrect = normalizeApostrophes(currentRound.mainAnswer) === normalizeApostrophes(answer);
      
      try {
        await runTransaction(firestore, async transaction => {
            const gameSnap = await transaction.get(gameDocRef);
            if (!gameSnap.exists()) throw new Error("Game not found");
            const serverGame = gameSnap.data() as Game;
            const serverTeamData = serverGame[playerTeam!];
            if (!serverTeamData) throw new Error("Team data not found");
            
            if (isCorrect) {
                const pointsFromRound = serverGame.rounds[activeRoundIndex].currentPoints;
                const newScore = serverTeamData.score + pointsFromRound;
                const newCompletedRounds = [...(serverTeamData.completedRounds || []), activeRoundIndex];
                
                let nextRoundToPlay = serverTeamData.currentRoundIndex;
                if (activeRoundIndex === serverTeamData.currentRoundIndex) {
                    let nextIndex = activeRoundIndex + 1;
                    while(nextIndex < serverGame.rounds.length && newCompletedRounds.includes(nextIndex)){
                        nextIndex++;
                    }
                    nextRoundToPlay = nextIndex;
                }
                
                transaction.update(gameDocRef, {
                    [`${playerTeam}.score`]: newScore,
                    [`${playerTeam}.completedRounds`]: newCompletedRounds,
                    [`${playerTeam}.roundsCompleted`]: newCompletedRounds.length,
                    [`${playerTeam}.currentRoundIndex`]: nextRoundToPlay,
                    lastActivityAt: serverTimestamp(),
                });

                // This toast happens outside the transaction, on the client immediately.
                 toast({
                    title: `Correct! Round ${activeRoundIndex + 1} finished.`,
                    description: `Your team gets ${pointsFromRound} points.`,
                });
                
            } else { // Incorrect Answer
                const newScore = serverTeamData.score - INCORRECT_ANSWER_PENALTY;
                transaction.update(gameDocRef, {
                    [`${playerTeam}.score`]: newScore,
                    lastActivityAt: serverTimestamp(),
                });

                // This toast happens outside the transaction, on the client immediately.
                toast({
                    variant: 'destructive',
                    title: 'Incorrect Answer',
                    description: `That's not right. Your team loses ${INCORRECT_ANSWER_PENALTY} points.`,
                });
            }
        });
      } catch (e) {
          console.error("Failed to sync main answer:", e);
          toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save round result.'})
      } finally {
          setIsSyncing(false);
      }
    },
    [playerTeam, game, toast, firestore, gameDocRef, activeRoundIndex]
  );
  
  const handleSkipRound = useCallback(async () => {
    if (!playerTeam || !game || !firestore || !gameDocRef) return;
    const teamData = game[playerTeam];
    if (!teamData || teamData.score < SKIP_ROUND_COST) {
        toast({ variant: 'destructive', title: 'Not enough points!', description: `You need ${SKIP_ROUND_COST} points to skip a round.`});
        return;
    }

    setIsSyncing(true);
    runTransaction(firestore, async transaction => {
        const gameSnap = await transaction.get(gameDocRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        const serverGame = gameSnap.data() as Game;
        const serverTeamData = serverGame[playerTeam!];
        if (!serverTeamData) throw new Error("Team data not found");

        const newScore = serverTeamData.score - SKIP_ROUND_COST;
        const newCompletedRounds = [...(serverTeamData.completedRounds || []), activeRoundIndex];
        
        let nextRoundToPlay = serverTeamData.currentRoundIndex;
        if (activeRoundIndex === serverTeamData.currentRoundIndex) {
            let nextIndex = activeRoundIndex + 1;
            while(nextIndex < serverGame.rounds.length && newCompletedRounds.includes(nextIndex)){
                nextIndex++;
            }
            nextRoundToPlay = nextIndex;
        }
        
        transaction.update(gameDocRef, {
            [`${playerTeam}.score`]: newScore,
            [`${playerTeam}.completedRounds`]: newCompletedRounds,
            [`${playerTeam}.roundsCompleted`]: newCompletedRounds.length,
            [`${playerTeam}.currentRoundIndex`]: nextRoundToPlay,
            lastActivityAt: serverTimestamp(),
        });
        toast({ title: 'Round Skipped', description: `You spent ${SKIP_ROUND_COST} points.` });
    }).catch(e => {
        console.error("Failed to sync skip round:", e);
        toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save skip round action.' })
    }).finally(() => setIsSyncing(false));

  }, [playerTeam, game, firestore, gameDocRef, activeRoundIndex, toast]);

  const handleForfeit = useCallback(async () => {
    if (!playerTeam || !game || !firestore || !gameDocRef || isSyncing) return;

    setIsSyncing(true);
    toast({ title: "You've finished your game!", description: 'Your score is locked in. Waiting for the other team...' });
    
    runTransaction(firestore, async (transaction) => {
        const gameSnap = await transaction.get(gameDocRef);
        if (!gameSnap.exists()) throw new Error("Game not found during final sync");

        const serverGame = gameSnap.data() as Game;

        const finalUpdate: any = {
            [`${playerTeam}.roundsCompleted`]: serverGame.rounds.length,
            lastActivityAt: serverTimestamp(),
        };

        const otherTeamKey = playerTeam === 'team1' ? 'team2' : 'team1';
        const otherTeamData = serverGame[otherTeamKey];
        if (otherTeamData && (otherTeamData.roundsCompleted >= serverGame.rounds.length)) {
            finalUpdate.status = 'finished';
        }

        transaction.update(gameDocRef, finalUpdate);
    }).catch(e => {
        console.error("Failed to sync final game state:", e);
        toast({ variant: 'destructive', title: 'Sync Error', description: 'Could not save final game result. Please check your connection.' })
    }).finally(() => {
        setIsSyncing(false);
    });
}, [playerTeam, game, firestore, gameDocRef, isSyncing, toast]);
  
  const winnerTeamKey = useMemo(() => {
    if (!game || game.status !== 'finished') return null;
    
    const team1 = game.team1;
    const team2 = game.team2;

    if (game.forfeitedBy) {
        return game.forfeitedBy === 'team1' ? 'team2' : 'team1';
    }

    if (!team1 || !team2) return null;

    if (team1.score > team2.score) return 'team1';
    if (team2.score > team1.score) return 'team2';
    return 'draw';
    
  }, [game]);

  const currentRound = useMemo(() => {
    if (!game || !Array.isArray(game.rounds) || activeRoundIndex >= game.rounds.length || activeRoundIndex < 0) {
      return null;
    }
    return game.rounds[activeRoundIndex];
  }, [game, activeRoundIndex]);


  if (isLoading || !game) {
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
  
  if (isSpectator || (isAdminView && !playerTeam)) {
    return <SpectatorView game={game} />;
  }
  
  const hasPlayerFinishedAllRounds = playerTeamData && playerTeamData.roundsCompleted >= game.rounds.length;

  if (game.status === 'finished') {
    const isWinner = playerTeam && winnerTeamKey === playerTeam;
    const isLoser = playerTeam && winnerTeamKey && winnerTeamKey !== 'draw' && winnerTeamKey !== playerTeam;
    const isDraw = winnerTeamKey === 'draw';

    return (
      <>
      <Card className="w-full max-w-lg text-center p-8 shadow-2xl animate-in fade-in zoom-in-95 m-auto">
        {isSyncing && (
            <div className='absolute top-4 right-4 text-muted-foreground'>
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        )}
        <div className={`mx-auto w-fit rounded-full p-4 mb-4 ${isWinner ? 'bg-green-100 dark:bg-green-900/50' : isLoser ? 'bg-red-100 dark:bg-red-900/50' : 'bg-yellow-100 dark:bg-yellow-900/50'}`}>
          {isWinner && <Smile className="h-16 w-16 text-green-500 dark:text-green-400" />}
          {isLoser && <Frown className="h-16 w-16 text-red-500 dark:text-red-400" />}
          {(isDraw || (!isWinner && !isLoser)) && <Trophy className="h-16 w-16 text-yellow-500 dark:text-yellow-400" />}
        </div>
        <CardHeader className="p-0">
            {isWinner && <CardTitle className="text-4xl font-headline text-green-600">Siz Yutdingiz!</CardTitle>}
            {isLoser && <CardTitle className="text-4xl font-headline text-red-600">Siz Yutqazdingiz</CardTitle>}
            {isDraw && <CardTitle className="text-4xl font-headline">Durang!</CardTitle>}
            {!isWinner && !isLoser && !isDraw && <CardTitle className="text-4xl font-headline">O'yin Tugadi!</CardTitle>}
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mt-4">Yakuniy hisoblar:</p>
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
        <CardFooter className="flex-col gap-4">
          <Button
            className="w-full"
            onClick={() => setIsFeedbackModalOpen(true)}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Leave Feedback
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link href="/">Bosh Sahifa</Link>
          </Button>
        </CardFooter>
      </Card>
      {playerTeamData && (
        <FeedbackDialog 
          gameId={game.id}
          teamName={playerTeamData.name}
          isOpen={isFeedbackModalOpen}
          onOpenChange={setIsFeedbackModalOpen}
        />
      )}
      </>
    );
  }

  if (hasPlayerFinishedAllRounds) {
      return (
        <Card className="w-full max-w-lg text-center p-8 shadow-2xl animate-in fade-in zoom-in-95 m-auto">
            <CardHeader>
                <CardTitle>Barcha roundlarni yakunladingiz!</CardTitle>
                <CardDescription>Yakuniy natijalarni ko'rish uchun ikkinchi jamoa o'yinni tugatishini kuting.</CardDescription>
            </CardHeader>
            <CardContent>
                <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            </CardContent>
        </Card>
      );
  }
  
  if (game.status === 'lobby') {
    return (
      <Card className="w-full max-w-lg text-center p-8 shadow-xl m-auto">
        <CardHeader>
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">O'yin Lobisi</CardTitle>
          <CardDescription>
            Ikkinchi o'yinchi qo'shilishi kutilmoqda...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="font-mono text-xl p-3 bg-muted rounded-md">
            O'yin Kodi: <span className="font-bold tracking-widest">{game.id}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
            <div className="p-4 border rounded-md">
              <h3 className="font-bold">1-Jamoa</h3>
              <p>{game.team1?.name || 'Kutilmoqda...'}</p>
            </div>
            <div className="p-4 border rounded-md">
              <h3 className="font-bold">2-Jamoa</h3>
              <p>{game.team2?.name || 'Kutilmoqda...'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isPaused) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-2 sm:p-4 md:p-6">
        <div className="flex flex-col items-center gap-4 text-lg text-center">
          <Pause className="h-12 w-12 text-primary" />
          O'yin admin tomonidan to'xtatildi...
        </div>
      </div>
    );
  }

  if (!currentRound) {
     return (
        <Card className="w-full max-w-lg text-center p-8 shadow-2xl animate-in fade-in zoom-in-95 m-auto">
            <CardHeader>
                <CardTitle>Xatolik</CardTitle>
                <CardDescription>Joriy roundni yuklab bo'lmadi. Iltimos, sahifani yangilang.</CardDescription>
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
          O'yin Kodi: <strong className="font-mono">{game.id}</strong>
        </span>
        <RoundNavigator
          totalRounds={game.rounds.length}
          activeRoundIndex={activeRoundIndex}
          completedRounds={playerTeamData?.completedRounds || []}
          onSelectRound={setActiveRoundIndex}
          playerCurrentRoundIndex={playerTeamData?.currentRoundIndex || 0}
        />
        <span>
          Round:{' '}
          <strong className="font-mono">
            {activeRoundIndex + 1} / {game.rounds.length}
          </strong>
        </span>
      </div>
      <Scoreboard
        game={game}
        playerTeam={playerTeam}
      />
      
      <GameArea
        key={activeRoundIndex}
        game={game}
        currentRound={currentRound}
        localCurrentPoints={currentRound.currentPoints}
        playerTeam={playerTeam}
        playerTeamData={playerTeamData}
        onLetterReveal={handleLetterReveal}
        onMainAnswerSubmit={handleMainAnswerSubmit}
        onSkipRound={handleSkipRound}
      />
      {playerTeam && (
          <div className='flex gap-4'>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isSyncing}>
                  <AlertTriangle className="mr-2 h-4 w-4" /> O'yinni tugatish
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>O'yinni tugatishga ishonchingiz komilmi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bu amal joriy hisobingizni saqlab qoladi va o'yinni siz uchun yakunlaydi. Siz boshqa savollarga javob bera olmaysiz. Yakuniy natija ikkinchi jamoa ham o'yinni tugatgandan so'ng ko'rsatiladi.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                  <AlertDialogAction onClick={handleForfeit}>
                    Ha, o'yinni tugatish
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
      )}
    </div>
  );
}

    
