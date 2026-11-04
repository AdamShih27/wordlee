import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { KEYS, load, save } from '@/lib/storage';

interface Profile {
  playerId: string;
  name: string;
}

interface ProfileContext extends Profile {
  ready: boolean;
  setName: (name: string) => void;
}

const Ctx = createContext<ProfileContext | null>(null);

function randomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'p-';
  for (let i = 0; i < 20; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** 玩家身分:目前是存在本機的隨機 ID + 暱稱（之後可以換成正式登入）。 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    load<Profile | null>(KEYS.profile, null).then((p) => {
      const next = p?.playerId ? p : { playerId: randomId(), name: `玩家${Math.floor(1000 + Math.random() * 9000)}` };
      if (!p) save(KEYS.profile, next);
      setProfile(next);
    });
  }, []);

  const value = useMemo<ProfileContext>(
    () => ({
      playerId: profile?.playerId ?? '',
      name: profile?.name ?? '',
      ready: !!profile,
      setName: (name: string) =>
        setProfile((p) => {
          if (!p) return p;
          const next = { ...p, name: name.trim().slice(0, 16) || p.name };
          save(KEYS.profile, next);
          return next;
        }),
    }),
    [profile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile must be used inside ProfileProvider');
  return v;
}
