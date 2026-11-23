export type OwnerScope = 'guest' | `user:${string}`;
export function assertOwnerScope(scope: unknown): asserts scope is OwnerScope {
  if (scope !== 'guest' && (typeof scope !== 'string' || !/^user:[a-f0-9]{24}$/.test(scope))) throw new Error('Chưa xác định được chủ sở hữu dữ liệu.');
}
export function resolvedOwnerScope(status: 'checking' | 'ready' | 'unavailable', user: {id:string} | null): OwnerScope | null {
  if (status !== 'ready') return null;
  const scope: OwnerScope = user ? `user:${user.id}` : 'guest'; assertOwnerScope(scope); return scope;
}
