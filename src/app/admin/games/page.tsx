'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Game, Round } from '@/lib/types';
import {
  collection,
  query,
  orderBy,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Loader2,
  Edit,
  Trash,
  ArrowLeft,
  RefreshCw,
  Copy,
  EyeOff,
  Lock,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';

function generateGameCode(length: number): string {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export default function GamesListPage() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [rehostingGameId, setRehostingGameId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [currentAction, setCurrentAction] = useState<'edit' | 'delete' | 'rehost' | null>(null);

  const gamesQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'games'), where('creatorId', '==', user.uid), orderBy('createdAt', 'desc'))
        : null,
    [firestore, user]
  );
  
  const { data: games, isLoading, error } = useCollection<Game>(gamesQuery);

  const performAction = () => {
    if (!selectedGame || !currentAction) return;

    switch(currentAction) {
        case 'delete':
            handleDelete(selectedGame.id);
            break;
        case 'rehost':
            handleRehost(selectedGame);
            break;
        case 'edit':
            router.push(`/admin/edit/${selectedGame.id}`);
            break;
    }
  }

  const handleActionClick = (game: Game, action: 'edit' | 'delete' | 'rehost') => {
      setSelectedGame(game);
      setCurrentAction(action);

      // If game has no password, perform action immediately.
      if (!game.password) {
        performAction();
        return;
      }

      // Otherwise, open the password confirmation dialog.
      setIsActionModalOpen(true);
      setPasswordInput('');
  }

  const handleConfirmAction = () => {
    if (!selectedGame || !currentAction) return;

    if (selectedGame.password !== passwordInput) {
        toast({
            variant: 'destructive',
            title: 'Incorrect Password',
            description: 'The password you entered is incorrect.',
        });
        return;
    }
    
    // Close modal before performing action
    setIsActionModalOpen(false);
    performAction();
  };


  const handleDelete = async (gameId: string) => {
    if (!firestore) {
        toast({variant: 'destructive', title: 'Error', description: 'Firestore is not available.'});
        return;
    }
    const gameDocRef = doc(firestore, 'games', gameId);
    try {
      await deleteDoc(gameDocRef);
      toast({
        title: 'Game Deleted',
        description: `Game ${gameId} has been successfully deleted.`,
      });
    } catch (e) {
      if (e instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Error deleting game',
          description: e.message,
        });
      }
    }
  };

  const handleReset = async (game: Game) => {
    if (!firestore) return;
    const gameDocRef = doc(firestore, 'games', game.id);
    try {
      await runTransaction(firestore, async (transaction) => {
        const newRounds = game.rounds.map((round) => ({
          ...round,
          status: 'pending',
          currentPoints: 1000,
          winner: null,
        }));
        
        transaction.update(gameDocRef, {
          status: 'lobby',
          team1: null,
          team2: null,
          forfeitedBy: null,
          winner: null,
          currentRoundIndex: 0,
          rounds: newRounds,
          lastActivityAt: serverTimestamp(),
        });
      });
      toast({
        title: 'Game Reset',
        description: `Game ${game.id} is now back in the lobby.`,
      });
    } catch (e) {
      if (e instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Error resetting game',
          description: e.message,
        });
      }
    }
  };

  const handleRehost = async (gameToClone: Game) => {
    if (!firestore || !user) {
        toast({variant: 'destructive', title: 'Error', description: 'You must be signed in to re-host a game.'});
        return;
    }
    setRehostingGameId(gameToClone.id);

    const newGameId = generateGameCode(4);

    try {
        const newRounds: Round[] = gameToClone.rounds.map(r => ({
          ...r,
          status: 'pending',
          currentPoints: 1000,
          winner: null,
        }));

        const newGameData: Game = {
          id: newGameId,
          title: gameToClone.title,
          password: gameToClone.password,
          creatorId: user.uid,
          rounds: newRounds,
          currentRoundIndex: 0,
          status: 'lobby',
          createdAt: serverTimestamp(),
          lastActivityAt: serverTimestamp(),
        };
        
        const newGameRef = doc(firestore, 'games', newGameId);
        await setDoc(newGameRef, newGameData);
        toast({ title: 'Game Re-hosted!', description: `A new game with code ${newGameId} has been created.`});
        router.push(`/admin/created/${newGameId}`);

    } catch (e) {
         if (e instanceof Error) {
        toast({
          variant: 'destructive',
          title: 'Error re-hosting game',
          description: e.message,
        });
      }
    } finally {
        setRehostingGameId(null);
    }
  }
  
  const togglePasswordVisibility = (gameId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [gameId]: !prev[gameId] }));
  };

  const getActionTitle = useCallback(() => {
    switch (currentAction) {
        case 'delete': return 'Confirm Deletion';
        case 'edit': return 'Confirm Edit';
        case 'rehost': return 'Confirm Re-host';
        default: return 'Confirm Action';
    }
  }, [currentAction]);

  const getActionDescription = useCallback(() => {
    if (!selectedGame) return '';
    switch (currentAction) {
        case 'delete': return `To delete the game "${selectedGame.title}", please enter the password. This action cannot be undone.`;
        case 'edit': return `To edit the game "${selectedGame.title}", please enter the password.`;
        case 'rehost': return `To re-host a copy of the game "${selectedGame.title}", please enter the original password.`;
        default: return 'Please enter the game password to proceed.';
    }
  }, [currentAction, selectedGame]);


  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin
          </Link>
        </Button>
        <h1 className="text-3xl font-headline font-bold">Hosted Games</h1>
        <div></div>
      </div>
      
      {isUserLoading && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Loader2 className="h-8 w-8 animate-spin" /> Authenticating...
        </div>
      )}

      {!isUserLoading && !user && (
         <div className="text-center mt-8 space-y-4">
          <p className="text-lg">You must be logged in to view your hosted games.</p>
           <Button asChild>
             <Link href="/join">
                <LogIn className="mr-2 h-4 w-4"/>
                Login or Sign Up
             </Link>
           </Button>
        </div>
      )}

      {user && isLoading && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Loader2 className="h-8 w-8 animate-spin" /> Loading games...
        </div>
      )}
      
      {user && error && (
        <div className="text-destructive text-center mt-8">
          Error loading games: {error.message}
        </div>
      )}

      {user && !isLoading && games && (
        <>
        <Table>
          <TableCaption>
            A list of all games you have hosted.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Game Title</TableHead>
              <TableHead>Game ID</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Teams</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.map((game) => (
              <TableRow key={game.id}>
                <TableCell className="font-semibold">{game.title || 'Unknown Game'}</TableCell>
                <TableCell className="font-mono font-bold">{game.id}</TableCell>
                 <TableCell>
                  {game.password ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{visiblePasswords[game.id] ? game.password : '••••'}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePasswordVisibility(game.id)}>
                        {visiblePasswords[game.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <span className='text-muted-foreground italic'>None</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={game.status === 'in_progress' ? 'default' : 'secondary'}>
                    {game.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p>{game.team1?.name || '-'}</p>
                  <p>{game.team2?.name || '-'}</p>
                </TableCell>
                <TableCell className="text-right space-x-1">
                   <Button variant="outline" size="sm" onClick={() => handleActionClick(game, 'rehost')} disabled={rehostingGameId === game.id}>
                    {rehostingGameId === game.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                    Re-host
                  </Button>
                  
                  {game.status === 'finished' && (
                    <Button variant="outline" size="sm" onClick={() => handleReset(game)}>
                      <RefreshCw className="h-4 w-4" /> Reset
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/spectate/${game.id}?admin=true`}>
                      <Eye className="h-4 w-4" /> Spectate
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleActionClick(game, 'edit')}>
                      <Edit className="h-4 w-4" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleActionClick(game, 'delete')}>
                        <Trash className="h-4 w-4" /> Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{getActionTitle()}</DialogTitle>
                    <DialogDescription>
                        {getActionDescription()}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                    <Label htmlFor="password">Game Password</Label>
                    <Input 
                        id="password" 
                        type="password" 
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmAction()}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleConfirmAction}>
                        <Lock className="mr-2 h-4 w-4" /> Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
      )}
    </div>
  );
}
