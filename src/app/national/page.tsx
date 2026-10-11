import { redirect } from 'next/navigation';
import { GAMES } from '@/lib/games';

/** The National Dex lives inside each game; this old address goes to the first one. */
export default function NationalRedirect() {
  redirect(`/${GAMES[0].id}/national`);
}
