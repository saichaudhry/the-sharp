// Shared app state so any page (board, game hub, team hub) can update the
// bankroll, show a toast, or hand Lou a question without passing props down.
import { createContext, useContext } from 'react';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
