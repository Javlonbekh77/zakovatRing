import CreateSampleGameButton from '@/components/create-sample-game-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FilePlus2 } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-3xl">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit mb-2">
              <FilePlus2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline text-3xl">
              Create New Game
            </CardTitle>
            <CardDescription>
              Click the button below to generate a sample game.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateSampleGameButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
