export interface AppEnvConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  corsAllowedOrigins: string[];
  sessionSecret: string;
  csrfSecret: string;
  sessionCookieName: string;
  sessionTtlHours: number;
  bkashReceivingNumber: string;
  nagadReceivingNumber: string;
  otpProvider: 'console-dev' | 'sms-gateway';
  otpExpirySeconds: number;
  otpMaxAttempts: number;
  smsGatewayApiUrl: string;
  smsGatewayApiKey: string;
  storageDriver: 'local' | 's3';
  localPrivateStorageDir: string;
  localPublicStorageDir: string;
  maxUploadFileSizeBytes: number;
  fileSigningSecret: string;
}

export function loadEnvConfig(overrides: Partial<AppEnvConfig> = {}): AppEnvConfig {
  const nodeEnv = (overrides.nodeEnv || process.env.NODE_ENV || 'development') as
    | 'development'
    | 'test'
    | 'production';

  const otpProvider = (overrides.otpProvider ||
    process.env.OTP_PROVIDER ||
    (nodeEnv === 'production' ? 'sms-gateway' : 'console-dev')) as 'console-dev' | 'sms-gateway';

  if (nodeEnv === 'production' && otpProvider === 'console-dev') {
    throw new Error(
      'SECURITY_VIOLATION: console-dev OTP provider is strictly prohibited in production.'
    );
  }

  return {
    nodeEnv,
    port: Number(overrides.port || process.env.API_PORT || 4000),
    corsAllowedOrigins: (
      overrides.corsAllowedOrigins ||
      (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000').split(',')
    ).map((s) => s.trim()),
    sessionSecret:
      overrides.sessionSecret ||
      process.env.SESSION_SECRET ||
      'dev-only-session-secret-change-in-production-32bytes',
    csrfSecret:
      overrides.csrfSecret ||
      process.env.CSRF_SECRET ||
      'dev-only-csrf-secret-change-in-production-32bytes',
    sessionCookieName:
      overrides.sessionCookieName || process.env.SESSION_COOKIE_NAME || 'ds_session',
    sessionTtlHours: Number(overrides.sessionTtlHours || process.env.SESSION_TTL_HOURS || 168),
    bkashReceivingNumber:
      overrides.bkashReceivingNumber ||
      process.env.BKASH_RECEIVING_NUMBER ||
      '01681253714',
    nagadReceivingNumber:
      overrides.nagadReceivingNumber ||
      process.env.NAGAD_RECEIVING_NUMBER ||
      '01681253714',
    otpProvider,
    otpExpirySeconds: Number(overrides.otpExpirySeconds || process.env.OTP_EXPIRY_SECONDS || 300),
    otpMaxAttempts: Number(overrides.otpMaxAttempts || process.env.OTP_MAX_ATTEMPTS || 5),
    smsGatewayApiUrl: overrides.smsGatewayApiUrl || process.env.SMS_GATEWAY_API_URL || '',
    smsGatewayApiKey: overrides.smsGatewayApiKey || process.env.SMS_GATEWAY_API_KEY || '',
    storageDriver: (overrides.storageDriver || process.env.STORAGE_DRIVER || 'local') as
      | 'local'
      | 's3',
    localPrivateStorageDir:
      overrides.localPrivateStorageDir ||
      process.env.LOCAL_PRIVATE_STORAGE_DIR ||
      './storage/private',
    localPublicStorageDir:
      overrides.localPublicStorageDir ||
      process.env.LOCAL_PUBLIC_STORAGE_DIR ||
      './storage/public',
    maxUploadFileSizeBytes: Number(
      overrides.maxUploadFileSizeBytes || process.env.MAX_UPLOAD_FILE_SIZE_BYTES || 5 * 1024 * 1024
    ),
    fileSigningSecret:
      overrides.fileSigningSecret ||
      process.env.FILE_SIGNING_SECRET ||
      'dev-only-file-signing-secret-32bytes',
  };
}
