import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BrainCircuit, Gamepad2, Wrench } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="p-4 bg-primary/10 rounded-full mb-4">
            <BrainCircuit className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-4xl">TimeLine</CardTitle>
          <CardDescription className="text-lg">
            The ultimate intellectual showdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            Join a game to test your knowledge or head to the admin panel to create and manage games.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-4">
           <Button asChild className="w-full" size="lg">
            <Link href="/join">
              <Gamepad2 />
              Join Game
            </Link>
          </Button>
          <Button asChild className="w-full" variant="secondary" size="lg">
            <Link href="/admin">
              <Wrench />
              Admin Panel
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
