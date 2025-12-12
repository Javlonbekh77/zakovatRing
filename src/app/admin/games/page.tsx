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
} from 'lucide-react';
import Link from 'next/link';
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
import { useRouter } from 'next/navigation';

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
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const gamesQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'games'), orderBy('lastActivityAt', 'desc'))
        : null,
    [firestore]
  );

  const { data: games, isLoading, error } = useCollection<Game>(gamesQuery);

  const handleDelete = async (gameId: string) => {
    if (!firestore || !user) {
        toast({variant: 'destructive', title: 'Error', description: 'You must be signed in to delete a game.'});
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
    }
  }

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

      {isLoading && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Loader2 className="h-8 w-8 animate-spin" /> Loading games...
        </div>
      )}
      {error && (
        <div className="text-destructive text-center mt-8">
          Error loading games: {error.message}
        </div>
      )}

      {!isLoading && games && (
        <Table>
          <TableCaption>
            A list of all hosted (active or finished) games.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Game Title</TableHead>
              <TableHead>Game ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Team 1</TableHead>
              <TableHead>Team 2</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.map((game) => (
              <TableRow key={game.id}>
                <TableCell className="font-semibold">{game.title || 'Unknown Game'}</TableCell>
                <TableCell className="font-mono font-bold">{game.id}</TableCell>
                <TableCell>
                  <Badge variant={game.status === 'in_progress' ? 'default' : 'secondary'}>
                    {game.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {game.team1?.name || '-'} ({game.team1?.score || 0} pts)
                </TableCell>
                <TableCell>
                  {game.team2?.name || '-'} ({game.team2?.score || 0} pts)
                </TableCell>
                <TableCell>
                  {game.lastActivityAt?.toDate().toLocaleString()}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleRehost(game)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Re-host
                  </Button>
                  
                  {game.status === 'finished' && (
                    <Button variant="outline" size="sm" onClick={() => handleReset(game)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/spectate/${game.id}?admin=true`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Manage
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/edit/${game.id}`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the
                          game
                          <span className="font-bold font-mono mx-1">{game.id}</span> and
                          all of its data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(game.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
