export function createQuotaPolicy(options: { development: boolean; host: string; nodeEnv: string | undefined },
  limited: () => Promise<boolean>) {
  if (options.development) {
    if (options.nodeEnv === 'production' || !['127.0.0.1', '::1', 'localhost'].includes(options.host)) {
      throw new Error('Chế độ kiểm thử không giới hạn lượt chỉ được chạy local, ngoài production.');
    }
    // Do not read or increment existing counters during local development.
    return { mode: 'development-unlimited' as const, consume: async () => true };
  }
  return { mode: 'limited' as const, consume: limited };
}
