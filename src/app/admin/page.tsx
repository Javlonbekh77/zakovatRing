'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, FilePlus2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-4xl">
         <div className="text-center mb-12">
             <h1 className="font-headline text-4xl font-bold">Admin Panel</h1>
             <p className="text-muted-foreground mt-2">Create a new game or manage your previously hosted games.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="text-center">
                    <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
                        <FilePlus2 className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle className="font-headline text-2xl">Create Game</CardTitle>
                    <CardDescription>
                        Design a new game with your own questions and rounds.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex justify-center'>
                    <Button asChild>
                        <Link href="/admin/edit/new">Create New Game</Link>
                    </Button>
                </CardContent>
            </Card>

             <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="text-center">
                    <div className="mx-auto w-fit rounded-full bg-secondary p-4 mb-4">
                        <Play className="h-10 w-10 text-secondary-foreground" />
                    </div>
                    <CardTitle className="font-headline text-2xl">Hosted Games</CardTitle>
                    <CardDescription>
                        View, manage, or re-host your previously created games.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex justify-center'>
                     <Button asChild variant="secondary">
                        <Link href="/admin/games">View Hosted Games</Link>
                    </Button>
                </CardContent>
            </Card>

         </div>
      </div>
    </div>
  );
}
