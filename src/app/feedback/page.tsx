'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { Feedback } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function FeedbackPage() {
  const firestore = useFirestore();

  const feedbackQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'feedback'), orderBy('createdAt', 'desc'))
        : null,
    [firestore]
  );

  const { data: feedbacks, isLoading, error } = useCollection<Feedback>(feedbackQuery);

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <h1 className="text-3xl font-headline font-bold">Game Feedbacks</h1>
        <div></div>
      </div>
      
      {isLoading && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Loader2 className="h-8 w-8 animate-spin" /> Loading feedbacks...
        </div>
      )}
      
      {error && (
        <div className="text-destructive text-center mt-8">
          Error loading feedbacks: {error.message}
        </div>
      )}

      {!isLoading && feedbacks && (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'><MessageSquare /> Feedbacks</CardTitle>
                <CardDescription>Here is a list of all submitted feedbacks from players.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableCaption>
                    A list of all submitted feedbacks.
                </TableCaption>
                <TableHeader>
                    <TableRow>
                    <TableHead>Game ID</TableHead>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {feedbacks.map((feedback) => (
                    <TableRow key={feedback.id}>
                        <TableCell className="font-mono">{feedback.gameId}</TableCell>
                        <TableCell className="font-semibold">{feedback.teamName}</TableCell>
                        <TableCell className='max-w-md'>{feedback.feedback}</TableCell>
                        <TableCell className="text-right">
                        {feedback.createdAt?.toDate().toLocaleString()}
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
