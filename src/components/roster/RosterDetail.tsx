'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { AuditPanel } from '../AuditPanel';
import { StatsEvsEditor, type EvEstimateInfo } from '../StatsEvs';
import { TypeBadge } from '../TypeBadge';
import { ComboInput, GenderControl, PokemonSprite, PotentialSelect, TaskToggle, progressOf, type Gender } from './parts';
import { auditSuggestions } from '@/lib/audit-compare';
import { evTotal, formatEvs, type EvSpread } from '@/lib/import/evs';
import type { Lang } from '@/lib/i18n';
import type { IvRatings } from '@/lib/iv-ratings';
import { TYPE_COLORS, TYPE_NAMES_ES, TYPE_SLUGS } from '@/lib/pokemon-types';
import type { EditorOptions, RosterView } from '@/lib/roster';
import type { TaskKey, TaskStatus } from '@/lib/roster-status';
import { useT } from '@/lib/translate-client';

type Named = { id: number; nameEn: string; nameEs: string };

/** Short stat names for the +/− shown next to a nature. */
const STAT_SHORT: Record<string, { en: string; es: string }> = {
  attack: { en: 'Atk', es: 'Atq' },
  defense: { en: 'Def', es: 'Def' },
  'special-attack': { en: 'SpA', es: 'AtEsp' },
  'special-defense': { en: 'SpD', es: 'DefEsp' },
  speed: { en: 'Spe', es: 'Vel' },
};

const inputClass = 'w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm';

function Field({
  label,
  hint,
  children,
  action,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  /** A status toggle that sits beside the control. */
  action?: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        {action}
      </div>
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b border-line pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** The AI audit's answer for one field: it matches what the Pokémon has, or here is what it suggests. */
function Suggestion({
  same,
  title,
  onApply,
  children,
}: {
  same: boolean;
  /** The reason the AI gave. */
  title?: string;
  onApply?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useT();
  if (same) {
    return <p className="mt-1 text-[11px] text-done">✓ {t('Matches the AI audit')}</p>;
  }
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" title={title}>
      <span className="text-pending">
        {t('AI suggests')}: <span className="font-medium">{children}</span>
      </span>
      {onApply && (
        <button
          type="button"
          onClick={onApply}
          className="rounded border border-line px-1.5 py-0.5 text-muted hover:border-done/50 hover:text-done"
        >
          {t('Apply')}
        </button>
      )}
    </p>
  );
}

/** The stats section: type the stats and level, see the EVs. Saves when you click away. */
function StatsSection({
  p,
  info,
  onSave,
}: {
  p: RosterView;
  info?: EvEstimateInfo;
  onSave: (stats: EvSpread | null, level: number, ratings: IvRatings) => void;
}) {
  const [stats, setStats] = useState<EvSpread | null>(p.currentStats);
  const [level, setLevel] = useState(p.level);
  const [ratings, setRatings] = useState<IvRatings>(p.ivRatings ?? {});
  const commit = () => {
    const next = stats && evTotal(stats) > 0 ? stats : null;
    const changed =
      JSON.stringify(next) !== JSON.stringify(p.currentStats) ||
      level !== p.level ||
      JSON.stringify(ratings) !== JSON.stringify(p.ivRatings ?? {});
    if (changed) onSave(next, level, ratings);
  };
  return (
    <StatsEvsEditor
      stats={stats}
      level={level}
      ratings={ratings}
      onChange={(nextStats, nextLevel, nextRatings) => {
        setStats(nextStats);
        setLevel(nextLevel);
        setRatings(nextRatings);
      }}
      onCommit={commit}
      info={info}
      potential={p.potential}
      savedEvs={p.currentEvs}
      savedEstimated={p.currentEvsEstimated}
    />
  );
}

/**
 * Everything about one Pokémon, editable in place. Selects save as soon as you
 * choose; text boxes save when you click away. Parents give it `key={p.id}` so
 * the drafts start fresh for each Pokémon.
 */
export function RosterDetail({
  gameId,
  p,
  options,
  lang,
  judge,
  evs,
  evTarget,
  estimate,
  numberLabel,
  aiEnabled,
  auditing,
  auditOpen,
  onToggle,
  onSet,
  onGender,
  onPotential,
  onSaveStats,
  onAudit,
  onToggleAudit,
  onBreeder,
  onRemove,
}: {
  gameId: string;
  p: RosterView;
  options: EditorOptions;
  lang: Lang;
  judge: boolean;
  evs: boolean;
  evTarget: boolean;
  estimate?: EvEstimateInfo;
  numberLabel: string;
  aiEnabled: boolean;
  auditing: boolean;
  auditOpen: boolean;
  onToggle: (key: TaskKey, current: TaskStatus) => void;
  /** Saves fields; resolves to an error message, or null when it worked. */
  onSet: (set: Record<string, unknown>) => Promise<string | null>;
  onGender: (g: Gender) => void;
  onPotential: (v: RosterView['potential']) => void;
  onSaveStats: (stats: EvSpread | null, level: number, ratings: IvRatings) => void;
  onAudit: (refresh: boolean, deep: boolean) => void;
  onToggleAudit: () => void;
  /** Adds it to, or takes it off, the breeders. */
  onBreeder: (on: boolean) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const label = (x: Named | null | undefined) => (x ? (lang === 'en' ? x.nameEn : x.nameEs) : '');
  // The name in the other language: the suggestion list matches on it too.
  const other = (x: Named) => (lang === 'en' ? x.nameEs : x.nameEn);
  const mintName = (n: Named) => (lang === 'en' ? `${n.nameEn} Mint` : `Menta ${n.nameEs}`);
  const mintEffect = p.mintNature != null;
  const stat = (slug: string) => (STAT_SHORT[slug] ? STAT_SHORT[slug][lang] : slug);
  const find = (list: Named[], text: string) => {
    const q = text.trim().toLowerCase();
    return list.find((x) => x.nameEn.toLowerCase() === q || x.nameEs.toLowerCase() === q);
  };

  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState(p.nickname ?? '');
  const savedEvs = p.evs ? formatEvs(p.evs) : '';
  const [targetEvs, setTargetEvs] = useState(savedEvs);
  // The plan can be fixed from the audit, outside this box: show what was saved.
  const [shownSaved, setShownSaved] = useState(savedEvs);
  if (shownSaved !== savedEvs) {
    setShownSaved(savedEvs);
    setTargetEvs(savedEvs);
  }

  const prog = progressOf(p);

  /** Saves, and shows what went wrong next to the thing that was edited. */
  async function save(set: Record<string, unknown>) {
    setError(null);
    const message = await onSet(set);
    if (message) setError(message);
  }

  const savedMove = (slot: number) => {
    const m = p.moves.find((x) => x.slot === slot);
    return m ? (m.move ? label(m.move) : (m.rawName ?? '')) : '';
  };

  async function commitMove(slot: number, text: string) {
    if (text.trim() === savedMove(slot).trim()) return;
    if (!text.trim()) {
      await save({ moves: [{ slot, moveId: null }] });
      return;
    }
    const move = find(options.moves, text);
    if (!move) {
      setError(t('Move {n}: "{name}" is not a known move. Pick one from the suggestions.', { n: slot, name: text }));
      return;
    }
    await save({ moves: [{ slot, moveId: move.id }] });
  }

  // Shown in the current language, so it follows the language switch.
  const itemText = p.item ? label(p.item) : (p.itemNote ?? '');

  async function commitItem(item: string) {
    const current = itemText;
    if (item.trim() === current.trim()) return;
    const matched = item.trim() ? find(options.items, item) : undefined;
    await save({
      itemId: matched?.id ?? null,
      // Text that is not an exact item name is kept as a note ("Life Orb or Choice Band").
      itemNote: item.trim() && !matched ? item.trim() : null,
    });
  }

  // The ability it has stays selectable even if the species cannot normally have it.
  const abilityChoices =
    p.ability && !p.abilityOptions.some((a) => a.id === p.ability!.id)
      ? [...p.abilityOptions, { ...p.ability, isHidden: false }]
      : p.abilityOptions;


  // What the saved audit suggests against what it has now (the answer may be older than the latest edits).
  const sug = auditSuggestions(p.audit?.result as Parameters<typeof auditSuggestions>[0], {
    item: p.item?.nameEn ?? p.itemNote,
    moves: p.moves.flatMap((m) => (m.move ? [m.move.nameEn] : [])),
    tera: p.teraType,
    mintGiven: p.mintNature?.nameEn ?? null,
    realNature: (p.currentNature ?? p.targetNature)?.nameEn ?? null,
    evs: p.evs ? formatEvs(p.evs) : null,
  });
  const itemOf = (name: string) => find(options.items, name);
  const moveOf = (name: string) => find(options.moves, name);
  const natureOf = (name: string) => options.natures.find((n) => n.nameEn.toLowerCase() === name.toLowerCase());
  const itemName = (name: string) => label(itemOf(name)) || name;
  const moveName = (name: string) => label(moveOf(name)) || name;
  const typeName = (type: string) => (lang === 'es' ? (TYPE_NAMES_ES[type] ?? type) : type);
  const mintLabel = (nature: string) => {
    const n = natureOf(nature);
    return n ? mintName(n) : nature;
  };
  // The summary at the top of the audit: what it has now, what the AI suggests, and whether they agree.
  const dash = '—';
  const compareRows: { key: string; label: string; now: string; ai: string; same: boolean }[] = [
    ...(sug.item
      ? [{ key: 'item', label: t('Held item'), now: itemText || dash, ai: itemName(sug.item.name), same: sug.item.same }]
      : []),
    ...(sug.moves
      ? [
          {
            key: 'moves',
            label: t('Moves'),
            now: p.moves.flatMap((m) => (m.move ? [label(m.move)] : [])).join(', ') || dash,
            ai: sug.moves.map((m) => moveName(m.move)).join(', '),
            same: sug.moves.every((m) => m.has),
          },
        ]
      : []),
    ...(sug.tera
      ? [{ key: 'tera', label: t('Tera type'), now: p.teraType ? typeName(p.teraType) : dash, ai: typeName(sug.tera.type), same: sug.tera.same }]
      : []),
    ...(sug.mint
      ? [
          {
            key: 'mint',
            label: t('Mint'),
            now: p.mintNature ? mintName(p.mintNature) : t('No mint'),
            ai: sug.mint.keep && !p.mintNature ? t('No mint') : mintLabel(sug.mint.nature),
            same: sug.mint.same,
          },
        ]
      : []),
    ...(sug.evs
      ? [{ key: 'evs', label: t('EV plan'), now: p.evs ? formatEvs(p.evs) : dash, ai: sug.evs.spread, same: sug.evs.same }]
      : []),
  ];

  /** Puts a suggested move in the first free slot, or over one the AI does not want. */
  function applyMove(name: string) {
    const move = moveOf(name);
    if (!move) return;
    const wanted = new Set((sug.moves ?? []).map((m) => m.move.toLowerCase()));
    const slotOf = (slot: number) => p.moves.find((x) => x.slot === slot);
    const free = [1, 2, 3, 4].find((s) => !slotOf(s)?.move && !slotOf(s)?.rawName);
    const replace = [1, 2, 3, 4].find((s) => {
      const m = slotOf(s)?.move;
      return m != null && !wanted.has(m.nameEn.toLowerCase());
    });
    const slot = free ?? replace;
    if (slot) void save({ moves: [{ slot, moveId: move.id }] });
  }

  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      {/* ---------- header ---------- */}
      <header className="flex flex-wrap items-start gap-4">
        <PokemonSprite p={p} size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{label(p.species)}</h2>
            <span className="font-mono text-xs text-muted">{numberLabel}</span>
          </div>
          <p className="text-xs text-muted">
            {p.baseSpecies ? t('from {name}', { name: label(p.baseSpecies) }) : ''}
            {p.origin !== 'UNKNOWN' ? `${p.baseSpecies ? ' · ' : ''}${p.origin === 'BRED' ? t('bred') : t('caught')}` : ''}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {p.types.map((type) => (
              <TypeBadge key={type} type={type} lang={lang} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className={`text-sm font-semibold ${prog.complete ? 'text-done' : 'text-pending'}`}>
              {prog.complete ? `★ ${t('Ready')}` : `${prog.done}/${prog.total}`}
            </span>
            <span className="h-2 w-40 overflow-hidden rounded-full bg-bg">
              <motion.span
                className={`block h-full rounded-full ${prog.complete ? 'bg-done' : 'bg-pending'}`}
                animate={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }}
                transition={{ type: 'spring', stiffness: 160, damping: 22 }}
              />
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-2 text-muted">
            {t('Nickname')}
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => nickname.trim() !== (p.nickname ?? '') && save({ nickname: nickname.trim() || null })}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="w-40 rounded-md border border-line bg-bg px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <button onClick={onRemove} className="rounded-md border border-line px-3 py-1.5 text-muted hover:text-red-400">
            {t('Remove')}
          </button>
        </div>
      </header>

      <p className="mt-3 text-xs text-muted">
        <span className="text-pending">{t('Orange')}</span> = {t('still to do')},{' '}
        <span className="text-done">{t('green')}</span> = {t('done')}. {t('Click any chip to flip it.')}
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-pending/40 bg-pending/10 px-3 py-2 text-sm text-pending">
          {error}
        </p>
      )}

      {/* ---------- body ---------- */}
      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        <div className="space-y-5">
          <Section title={t('Basics')}>
            <Field
              label={t('Obtained')}
              action={
                <TaskToggle
                  status={p.owned ? 'DONE' : 'PENDING'}
                  onToggle={() => onToggle('owned', p.owned ? 'DONE' : 'PENDING')}
                  label={p.owned ? t('Yes') : t('Not yet')}
                  title={p.owned ? t('You have this Pokémon. Click to undo') : t('Not obtained yet. Click when you have it')}
                />
              }
            >
              <span className="text-xs text-muted">{t('Do you have this Pokémon?')}</span>
            </Field>
            <Field
              label={t('Breeding')}
              hint={t('A breeder is kept on the Breeders page with its IVs, and used as a parent by the breeding planner.')}
              action={
                <TaskToggle
                  status={p.roles.includes('BREEDER') ? 'DONE' : 'PENDING'}
                  onToggle={() => onBreeder(!p.roles.includes('BREEDER'))}
                  label={p.roles.includes('BREEDER') ? t('Also a breeder') : t('Not a breeder')}
                />
              }
            >
              <span className="text-xs text-muted">{t('Keep it for breeding too?')}</span>
            </Field>
            <Field label={t('Gender')} hint={t('Used by the breeding planner to know which parents you have.')}>
              <GenderControl p={p} onChange={onGender} />
            </Field>
          </Section>

          <Section title={t('Build')}>
            <Field
              label={t('Nature')}
              hint={
                p.currentNature && p.targetNature && p.currentNature.id !== p.targetNature.id
                  ? t('It has {current} now; you are aiming for {target}.', {
                      current: label(p.currentNature),
                      target: label(p.targetNature),
                    })
                  : undefined
              }
            >
              <select
                value={p.targetNature?.id ?? 0}
                onChange={(e) => save({ targetNatureId: Number(e.target.value) || null })}
                className={inputClass}
              >
                <option value={0}>{t('No nature planned')}</option>
                {options.natures.map((n) => (
                  <option key={n.id} value={n.id}>
                    {label(n)}
                    {n.increased ? ` (+${stat(n.increased)} −${stat(n.decreased!)})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={t('Mint given')}
              action={
                p.mintNature && (
                  <TaskToggle
                    status="DONE"
                    onToggle={() => save({ mintNatureId: null })}
                    title={t('Mint given. Click to remove it')}
                  />
                )
              }
              hint={
                mintEffect
                  ? t('The game now shows the effect of {nature}; its real nature stays {real}. The stats chart uses the mint.', {
                      nature: label(p.mintNature),
                      real: label(p.currentNature ?? p.targetNature) || '—',
                    })
                  : t('A Mint changes which stats the nature raises and lowers, without changing the nature itself.')
              }
            >
              <select
                value={p.mintNature?.id ?? 0}
                onChange={(e) => save({ mintNatureId: Number(e.target.value) || null })}
                className={inputClass}
              >
                <option value={0}>{t('No mint')}</option>
                {options.natures
                  .filter((n) => n.increased || n.slug === 'serious')
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {mintName(n)}
                      {n.increased ? ` (+${stat(n.increased)} −${stat(n.decreased!)})` : ` (${t('no change')})`}
                    </option>
                  ))}
              </select>
              {sug.mint &&
                (sug.mint.same ? (
                  <Suggestion same>{null}</Suggestion>
                ) : (
                  <Suggestion
                    same={false}
                    title={sug.mint.reason}
                    onApply={() => {
                      const n = natureOf(sug.mint!.nature);
                      if (n) void save({ mintNatureId: n.id });
                    }}
                  >
                    {mintLabel(sug.mint.nature)}
                  </Suggestion>
                ))}
            </Field>
            <Field
              label={t('Ability')}
              action={
                p.ability && (
                  <TaskToggle
                    status={p.abilityStatus}
                    onToggle={() => onToggle('ability', p.abilityStatus)}
                    warning={
                      p.abilityLegal === false
                        ? t('{name} cannot have this ability', { name: label(p.species) })
                        : undefined
                    }
                  />
                )
              }
            >
              <select
                value={p.ability?.id ?? 0}
                onChange={(e) => save({ abilityId: Number(e.target.value) || null })}
                className={inputClass}
              >
                <option value={0}>{t('No ability planned')}</option>
                {abilityChoices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {label(a)}
                    {a.isHidden ? ` (${t('hidden')})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={t('Held item')}
              hint={t('Pick from the list, or type your own note such as “Vidasfera o Cinta Elegida”.')}
              action={
                (p.item || p.itemNote) && (
                  <TaskToggle status={p.itemStatus} onToggle={() => onToggle('item', p.itemStatus)} />
                )
              }
            >
              <div className="flex items-center gap-2">
                {p.item?.spriteUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.item.spriteUrl} alt="" width={24} height={24} className="sprite shrink-0" />
                )}
                <ComboInput
                  list="detail-items"
                  value={itemText}
                  onCommit={commitItem}
                  className={inputClass}
                />
              </div>
              {sug.item && (
                <Suggestion
                  same={sug.item.same}
                  title={sug.item.reason}
                  onApply={() => {
                    const match = itemOf(sug.item!.name);
                    void save({ itemId: match?.id ?? null, itemNote: match ? null : sug.item!.name });
                  }}
                >
                  {itemName(sug.item.name)}
                </Suggestion>
              )}
            </Field>
            <Field
              label={t('Tera type')}
              action={
                p.teraType && <TaskToggle status={p.teraStatus} onToggle={() => onToggle('tera', p.teraStatus)} />
              }
            >
              <select
                value={p.teraType ?? ''}
                onChange={(e) => save({ teraType: e.target.value || null })}
                className={inputClass}
              >
                <option value="">{t('Not planned')}</option>
                {TYPE_SLUGS.map((type) => (
                  <option key={type} value={type}>
                    {lang === 'es' ? TYPE_NAMES_ES[type] : type}
                  </option>
                ))}
              </select>
              {sug.tera && (
                <Suggestion
                  same={sug.tera.same}
                  title={sug.tera.reason}
                  onApply={() => void save({ teraType: sug.tera!.type })}
                >
                  {typeName(sug.tera.type)}
                </Suggestion>
              )}
            </Field>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title={t('Moves')}>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((slot) => {
                const m = p.moves.find((x) => x.slot === slot);
                const exists = Boolean(m && (m.move || m.rawName));
                return (
                  <div key={slot} className="flex items-center gap-2">
                    {exists && m ? (
                      <TaskToggle
                        status={m.status}
                        onToggle={() => onToggle(`move:${slot}`, m.status)}
                        accent={m.move ? TYPE_COLORS[m.move.type] : undefined}
                        warning={
                          m.move == null
                            ? t('This move name was not recognised. Edit the Pokémon to fix it')
                            : m.legal === false
                              ? t('{name} cannot learn this move in this game', { name: label(p.species) })
                              : undefined
                        }
                      />
                    ) : (
                      <span className="w-[3.1rem] shrink-0 text-center text-xs text-muted">—</span>
                    )}
                    <ComboInput
                      list="detail-moves"
                      value={savedMove(slot)}
                      placeholder={t('Move {n}', { n: slot })}
                      aria-label={t('Move {n}', { n: slot })}
                      onCommit={(text) => commitMove(slot, text)}
                      className={inputClass}
                    />
                  </div>
                );
              })}
            </div>
            {sug.moves && (
              <div className="rounded-md border border-line bg-bg p-2 text-[11px]">
                <p className="mb-1 text-muted">{t('AI suggests')}:</p>
                <ul className="flex flex-wrap gap-1.5">
                  {sug.moves.map((m) => (
                    <li key={m.move} title={m.reason}>
                      {m.has ? (
                        <span className="rounded border border-done/50 px-1.5 py-0.5 text-done">✓ {moveName(m.move)}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => applyMove(m.move)}
                          className="rounded border border-pending/50 px-1.5 py-0.5 text-pending hover:bg-pending/10"
                          title={m.reason}
                        >
                          + {moveName(m.move)}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-muted">{t('A move you change is marked pending until you tick it as learned.')}</p>
          </Section>

          {(evs || judge) && (
            <Section title={evs ? t('Stats and IVs') : t('Potential')}>
              {evs && (evTarget || p.evs) && (
                <Field
                  label={t('Target EV spread')}
                  hint={t('For example 252 Atk / 4 SpD / 252 Spe. English or Spanish stat names work.')}
                  action={
                    p.evs && <TaskToggle status={p.evStatus} onToggle={() => onToggle('evs', p.evStatus)} />
                  }
                >
                  <input
                    value={targetEvs}
                    onChange={(e) => setTargetEvs(e.target.value)}
                    onBlur={() =>
                      targetEvs.trim() !== (p.evs ? formatEvs(p.evs) : '') && save({ evs: targetEvs.trim() || null })
                    }
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className={inputClass}
                  />
                  {sug.evs && (
                    <Suggestion same={sug.evs.same} onApply={() => void save({ evs: sug.evs!.spread })}>
                      {sug.evs.spread}
                    </Suggestion>
                  )}
                </Field>
              )}
              {evs && <StatsSection p={p} info={estimate} onSave={onSaveStats} />}
              {judge && (
                <Field label={t('Potential')}>
                  <PotentialSelect p={p} onChange={onPotential} />
                </Field>
              )}
            </Section>
          )}

        </div>
      </div>

      <div className="mt-5">
        <button
          onClick={() => (p.audit ? onToggleAudit() : onAudit(false, false))}
          disabled={(!aiEnabled && !p.audit) || auditing}
          title={aiEnabled ? undefined : t('Add an API key to .env.local to enable AI audits')}
          className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {auditing ? t('Auditing…') : p.audit ? (auditOpen ? t('Hide audit') : t('Show audit')) : t('AI audit')}
        </button>
      </div>

      {auditOpen && p.audit && (
        <AuditPanel
          gameId={gameId}
          aiEnabled={aiEnabled}
          locks={p.auditLocks}
          onLocksChange={(locks) => void save({ auditLocks: locks })}
          compare={compareRows}
          currentTera={p.teraType}
          mintGiven={p.mintNature?.nameEn ?? null}
          realNature={(p.currentNature ?? p.targetNature)?.nameEn ?? null}
          onMint={(nature, given) => {
            const match = options.natures.find((n) => n.nameEn.toLowerCase() === nature.toLowerCase());
            if (match) void save({ mintNatureId: given ? match.id : null });
          }}
          lockedPlan={p.evs ? formatEvs(p.evs) : null}
          onLockPlan={(spread) => void save({ evs: spread })}
          onUnlockPlan={() => void save({ evs: null })}
          audit={p.audit.result as Parameters<typeof AuditPanel>[0]['audit']}
          auditLang={p.audit.lang}
          meta={`${p.audit.provider} · ${p.audit.model}`}
          onRefresh={aiEnabled ? () => onAudit(true, false) : undefined}
          onDeep={aiEnabled ? () => onAudit(false, true) : undefined}
          onChangeLanguage={aiEnabled ? () => onAudit(false, false) : undefined}
          busy={auditing}
        />
      )}

      <datalist id="detail-moves">
        {options.moves.map((m) => (
          <option key={m.id} value={label(m)} label={other(m)} />
        ))}
      </datalist>
      <datalist id="detail-items">
        {options.items.map((it) => (
          <option key={it.id} value={label(it)} label={other(it)} />
        ))}
      </datalist>
    </article>
  );
}
