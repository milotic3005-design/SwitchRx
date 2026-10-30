'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { InfusionConsult } from '@/components/InfusionConsult';
import {
  checkCopilotPassword,
  consumedTokenOnLock,
  createUnlockStore,
  prefillToPass,
  type CopilotPrefill,
} from '@/lib/copilot/gate';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500';

/** The password screen: a card with one field. A wrong password clears the field and keeps focus in it. */
function LockScreen({ onUnlock, autoFocus }: { onUnlock: () => void; autoFocus: boolean }) {
  const [value, setValue] = useState('');
  // Counts failed tries, so the same message is announced again on a repeat miss.
  const [misses, setMisses] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (checkCopilotPassword(value)) {
      onUnlock();
      return;
    }
    setMisses(n => n + 1);
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center pb-8 pt-4 sm:pt-12">
      <div className="glass-panel w-full px-6 py-8 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
          <Lock size={20} className="text-violet-300" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-3xl">Infusion Copilot</h1>
        <p className="mt-2 text-[15px] text-slate-400">Enter the password to continue.</p>

        <form onSubmit={submit} noValidate className="mt-6 text-left">
          <label htmlFor={inputId} className="block text-[13px] font-medium text-slate-300">
            Password
          </label>
          <input
            ref={inputRef}
            id={inputId}
            name="copilot-password"
            type="password"
            value={value}
            onChange={e => {
              setValue(e.target.value);
              setMisses(0);
            }}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={misses > 0}
            aria-describedby={misses > 0 ? errorId : undefined}
            className={`mt-1.5 block w-full rounded-xl border bg-white/5 px-3 py-2 text-[16px] leading-6 text-slate-200 placeholder:text-slate-500 ${FOCUS_RING} ${
              misses > 0 ? 'border-violet-500/40' : 'border-white/10'
            }`}
          />
          {misses > 0 && (
            <p key={misses} id={errorId} role="alert" className="mt-2 text-[13px] text-violet-300">
              Incorrect password. Try again.
            </p>
          )}
          <button
            type="submit"
            className={`btn-premium mt-5 w-full rounded-full px-6 py-2.5 font-medium ${FOCUS_RING}`}
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Puts a password screen in front of the Infusion Copilot. The Copilot is not mounted while locked, so
 * no saved history is read or shown. A convenience screen, not security (see `lib/copilot/gate.ts`).
 * The unlock is kept in session storage; without working storage it lasts until the page is reloaded.
 *
 * The page renders on the server, so the flag can only be read in the browser: until then the tab shows
 * an empty box of the same room, rather than a lock screen that an unlocked user would see flash.
 *
 * The Copilot applies any prefill whose token it has not seen, and a Copilot that mounts again after
 * Lock then Unlock has seen none. The gate outlives it, so it remembers the last token the Copilot had
 * when it was locked and passes only newer ones.
 */
export function CopilotGate({ prefillScenario }: { prefillScenario?: CopilotPrefill | null }) {
  const [store] = useState(createUnlockStore);
  const unlocked = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
  const [consumedToken, setConsumedToken] = useState<number | null>(null);
  // Focus belongs in the password field after Lock, and on the page after Unlock; at load it stays put.
  const [lockedByUser, setLockedByUser] = useState(false);
  const unlockedByUser = useRef(false);
  const copilotRef = useRef<HTMLDivElement>(null);

  // The button that was pressed to unlock is gone by now. A question sent from another tab has already
  // moved focus into the question box; otherwise focus would fall to the top of the page.
  useEffect(() => {
    if (!unlocked || !unlockedByUser.current) return;
    unlockedByUser.current = false;
    if (document.activeElement === document.body) copilotRef.current?.focus();
  }, [unlocked]);

  const unlock = () => {
    unlockedByUser.current = true;
    store.unlock();
  };
  const lock = () => {
    setConsumedToken(consumedTokenOnLock(prefillScenario, consumedToken));
    setLockedByUser(true);
    store.lock();
  };

  if (unlocked === null) return <div className="min-h-[50vh]" aria-hidden="true" />;
  if (!unlocked) return <LockScreen onUnlock={unlock} autoFocus={lockedByUser} />;
  return (
    <div ref={copilotRef} tabIndex={-1} className="outline-none">
      <InfusionConsult prefillScenario={prefillToPass(prefillScenario, consumedToken)} onLock={lock} />
    </div>
  );
}
