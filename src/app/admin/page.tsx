'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutTemplate, Play, FilePlus2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-4xl">
         <div className="text-center mb-12">
             <h1 className="font-headline text-4xl font-bold">Admin Panel</h1>
             <p className="text-muted-foreground mt-2">Create and manage game templates, or view hosted games.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="text-center">
                    <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
                        <LayoutTemplate className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle className="font-headline text-2xl">Manage Templates</CardTitle>
                    <CardDescription>
                        Create, view, and edit reusable game templates.
                    </CardDescription>
                </CardHeader>
                <CardContent className='flex justify-center'>
                    <Button asChild>
                        <Link href="/admin/templates">View Templates</Link>
                    </Button>
                </CardContent>
            </Card>

             <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="text-center">
                    <div className="mx-auto w-fit rounded-full bg-secondary p-4 mb-4">
                        <Play className="h-10 w-10 text-secondary-foreground" />
                    </div>
                    <CardTitle className="font-headline text-2xl">View Hosted Games</CardTitle>
                    <CardDescription>
                        See a list of all active, paused, or finished games.
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
