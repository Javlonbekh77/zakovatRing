import { BrainCircuit } from 'lucide-react';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b shrink-0 bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2 font-headline text-xl font-bold text-primary">
            <BrainCircuit className="h-7 w-7" />
            <span>TimeLine</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
