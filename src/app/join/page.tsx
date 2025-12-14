import JoinGameForm from '@/components/join-game-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Gamepad2 } from 'lucide-react';
import AuthProvider from '@/components/auth-provider';

export default function JoinPage() {
  return (
    <AuthProvider>
      <div className="flex-1 p-4 sm:p-6 md:p-8 flex items-center justify-center">
        <div className="container mx-auto max-w-md">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit mb-2">
                <Gamepad2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="font-headline text-3xl">Join Game</CardTitle>
              <CardDescription>
                Enter the game code and your team name to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JoinGameForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthProvider>
  );
}
