import type { Game, Team } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './ui/card';
import { Swords, User, Lock } from 'lucide-react';

interface ScoreboardProps {
  game: Game;
  playerTeam: 'team1' | 'team2' | null;
}

function TeamDisplay({
  team,
  isPlayer,
  hasFinished,
  opponentHasFinished,
}: {
  team?: Team;
  isPlayer: boolean;
  hasFinished: boolean;
  opponentHasFinished: boolean;
}) {
  // Show score if you are the player OR if the game is finished OR if the opponent has NOT finished yet.
  const showScore = isPlayer || (hasFinished && opponentHasFinished) || !opponentHasFinished;

  return (
    <div
      className={cn(
        'p-4 rounded-lg transition-all duration-300 w-full text-center md:text-left bg-card border-2',
        isPlayer ? 'border-primary shadow-lg' : 'border-border/50'
      )}
    >
      <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
        {isPlayer && <User className="h-5 w-5 text-primary" />}
        <h3 className="font-headline text-2xl font-bold truncate">
          {team?.name || 'Waiting...'}
        </h3>
      </div>
      {isPlayer && (
        <p className="text-xs text-primary -mt-1 mb-2 text-center md:text-left">
          Your Team
        </p>
      )}
      <div className="text-4xl font-bold font-mono text-foreground">
        {showScore ? (
          team?.score !== undefined ? (
            team.score
          ) : (
            '-'
          )
        ) : (
          <div className="flex items-center justify-center md:justify-start gap-2 text-3xl">
            <Lock className="h-8 w-8" />
            <span className="text-xl">Finished</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Scoreboard({ game, playerTeam }: ScoreboardProps) {
  const { team1, team2, rounds } = game;
  const totalRounds = rounds.length;

  const team1HasFinished = team1 ? team1.currentRoundIndex >= totalRounds : false;
  const team2HasFinished = team2 ? team2.currentRoundIndex >= totalRounds : false;

  return (
    <Card className="w-full overflow-hidden bg-muted/50">
      <CardContent className="p-2 md:p-4">
        <div className="flex items-center justify-around gap-2 md:gap-4">
          <TeamDisplay
            team={team1}
            isPlayer={playerTeam === 'team1'}
            hasFinished={team1HasFinished}
            opponentHasFinished={team2HasFinished}
          />
          <div className="shrink-0 text-primary p-2 bg-primary/10 rounded-full">
            <Swords className="h-8 w-8" />
          </div>
          <TeamDisplay
            team={team2}
            isPlayer={playerTeam === 'team2'}
            hasFinished={team2HasFinished}
            opponentHasFinished={team1HasFinished}
          />
        </div>
      </CardContent>
    </Card>
  );
}
