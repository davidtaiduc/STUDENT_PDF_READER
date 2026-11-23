export interface UserUsage { dailyLimit: number; dailyUsed: number; dailyRemaining: number; resetAt: string; minuteLimit: number }
export interface QuotaDecision { allowed: boolean; retryAfterSeconds?: number; reason?: 'day' | 'minute' }
