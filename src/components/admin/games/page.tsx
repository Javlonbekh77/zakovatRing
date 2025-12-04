'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Game } from '@/lib/types';
import { collection, query, orderBy, deleteDoc, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
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
import { Eye, Loader2, Edit, Trash, ArrowLeft, RefreshCw } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';


export default function GamesListPage() {
  const firestore = useFirestore();

  const gamesQuery = useMemoFirebase(() => 
    firestore 
      ? query(collection(firestore, 'games'), orderBy('createdAt', 'desc'))
      : null, 
    [firestore]
  );
  
  const { data: games, isLoading, error } = useCollection<Game>(gamesQuery);
  const { toast } = useToast();

  const handleDelete = async (gameId: string) => {
    if (!firestore) return;
    const gameDocRef = doc(firestore, 'games', gameId);
    try {
        await deleteDoc(gameDocRef);
        toast({ title: 'Game Deleted', description: `Game ${gameId} has been successfully deleted.` });
    } catch (e) {
         if (e instanceof Error) {
            toast({ variant: 'destructive', title: 'Error deleting game', description: e.message });
         }
    }
  }

  const handleReset = async (game: Game) => {
     if (!firestore) return;
     const gameDocRef = doc(firestore, 'games', game.id);
     try {
        await runTransaction(firestore, async (transaction) => {
            const newRounds = game.rounds.map(round => ({
                ...round,
                status: 'pending',
                currentPoints: 1000,
                team1RevealedLetters: [],
                team2RevealedLetters: [],
                winner: null,
            }));
            
            const baseUpdate = {
                status: 'lobby',
                team1: null,
                team2: null,
                forfeitedBy: null,
                winner: null,
                currentRoundIndex: 0,
                rounds: newRounds,
                lastActivityAt: serverTimestamp(),
            };

            transaction.update(gameDocRef, baseUpdate);
        });
        toast({ title: 'Game Reset', description: `Game ${game.id} is now back in the lobby.` });
     } catch(e) {
        if (e instanceof Error) {
            toast({ variant: 'destructive', title: 'Error resetting game', description: e.message });
        }
     }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
             <Button variant="outline" size="sm" asChild>
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
            </Button>
            <h1 className="text-3xl font-headline font-bold">Games Admin</h1>
            <div></div>
        </div>

      {isLoading && <div className="flex justify-center items-center gap-2 mt-8"><Loader2 className="h-8 w-8 animate-spin" /> Loading games...</div>}
      {error && <div className="text-destructive text-center mt-8">Error loading games: {error.message}</div>}

      {!isLoading && games && (
        <Table>
          <TableCaption>A list of all games created.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Game ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Team 1</TableHead>
              <TableHead>Team 2</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.map((game) => (
              <TableRow key={game.id}>
                <TableCell className="font-mono font-bold">{game.id}</TableCell>
                <TableCell>
                  <Badge variant={game.status === 'in_progress' ? 'default' : game.status === 'lobby' ? 'secondary' : 'outline'}>
                    {game.status}
                  </Badge>
                </TableCell>
                <TableCell>{game.team1?.name || '-'} ({game.team1?.score || 0} pts)</TableCell>
                <TableCell>{game.team2?.name || '-'} ({game.team2?.score || 0} pts)</TableCell>
                <TableCell>{game.createdAt?.toDate().toLocaleString()}</TableCell>
                <TableCell className="text-right space-x-2">
                   {game.status === 'finished' && (
                        <Button variant="outline" size="sm" onClick={() => handleReset(game)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reset
                        </Button>
                   )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/spectate/${game.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Spectate
                    </Link>
                  </Button>
                   <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/edit/${game.id}`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit/Import
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
                            This action cannot be undone. This will permanently delete the game
                            <span className='font-bold font-mono mx-1'>{game.id}</span> and all of its data.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(game.id)}>Delete</AlertDialogAction>
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
