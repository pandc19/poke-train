import { redirect } from 'next/navigation';
import { GAMES } from '@/lib/games';

/** The National Dex is a tab of each game's Pokédex; this old address goes to the first one. */
export default function NationalRedirect() {
  redirect(`/${GAMES[0].id}/pokedex?dex=national`);
}
