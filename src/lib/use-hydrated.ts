import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False during SSR and hydration, true afterwards — for values that must come from the browser.
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
