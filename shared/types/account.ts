/** The only account fields exposed to the browser. */
export interface AccountUser { emailVerified?: boolean; id: string; email: string; displayName: string; }

export interface AccountProfile extends AccountUser { createdAt: string; updatedAt: string }
export interface AccountSession { id: string; createdAt: string; expiresAt: string; isCurrent: boolean }
