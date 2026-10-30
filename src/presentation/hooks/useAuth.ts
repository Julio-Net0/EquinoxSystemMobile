import { useContext } from 'react';
import { AuthContext, AuthContextData } from '../context/AuthContext';

export function useAuth(): AuthContextData {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error('useAuth precisa estar dentro de um AuthProvider');
  }

  return contexto;
}
