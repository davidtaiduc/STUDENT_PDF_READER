export interface BackendHealth {
  requestLimits?: 'development-unlimited' | 'limited';
  service: 'student-pdf-reader-api';
  database: 'connected' | 'unavailable';
  ai: { configured: boolean };
  accounts: { enabled: false };
}
