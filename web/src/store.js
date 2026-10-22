import { createContext } from 'preact';
import { useContext } from 'preact/hooks';

// { view, token, me, refresh(), act(action, payload), signOut() }
export const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}
