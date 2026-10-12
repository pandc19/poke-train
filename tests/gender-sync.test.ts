import { describe, expect, it } from 'vitest';
import { genderOf, sidesOf } from '@/lib/gender-sync';

describe('gender sides', () => {
  it('reads which genders a recorded gender stands for', () => {
    expect(sidesOf('MALE')).toEqual({ male: true, female: false });
    expect(sidesOf('FEMALE')).toEqual({ male: false, female: true });
    expect(sidesOf('BOTH')).toEqual({ male: true, female: true });
    expect(sidesOf('UNKNOWN')).toEqual({ male: false, female: false });
    expect(sidesOf('GENDERLESS')).toEqual({ male: false, female: false });
  });

  it('turns sides back into a recorded gender', () => {
    expect(genderOf({ male: true, female: true }, 'UNKNOWN')).toBe('BOTH');
    expect(genderOf({ male: true, female: false }, 'UNKNOWN')).toBe('MALE');
    expect(genderOf({ male: false, female: true }, 'BOTH')).toBe('FEMALE');
    expect(genderOf({ male: false, female: false }, 'BOTH')).toBe('UNKNOWN');
  });

  it('never turns a genderless Pokémon into an unknown one', () => {
    expect(genderOf({ male: false, female: false }, 'GENDERLESS')).toBe('GENDERLESS');
  });
});
