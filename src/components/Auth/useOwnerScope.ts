import { useAuth } from './context';
import { resolvedOwnerScope } from '../../services/ownerScope';
export function useOwnerScope() { const {status,user}=useAuth(); return resolvedOwnerScope(status,user); }
