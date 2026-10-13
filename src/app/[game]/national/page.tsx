import { redirect } from 'next/navigation';

/** The National Dex is a tab of the Pokédex page; this old address goes there. */
export default async function NationalRedirect({ params }: PageProps<'/[game]/national'>) {
  const { game } = await params;
  redirect(`/${game}/pokedex?dex=national`);
}
