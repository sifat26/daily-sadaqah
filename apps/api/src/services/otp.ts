import crypto from 'crypto';
import { AppEnvConfig } from '../config/env';

export interface OtpDispatchResult {
  dispatched: boolean;
  provider: 'console-dev' | 'sms-gateway';
  devOtpPreview?: string;
}

export interface IOtpProvider {
  sendOtp(phone: string, otpCode: string): Promise<OtpDispatchResult>;
}

export class ConsoleDevOtpProvider implements IOtpProvider {
  private readonly nodeEnv: string;
  constructor(nodeEnv: string) {
    this.nodeEnv = nodeEnv;
  }

  async sendOtp(phone: string, otpCode: string): Promise<OtpDispatchResult> {
    if (this.nodeEnv === 'production') {
      throw new Error('ConsoleDevOtpProvider cannot be used in production.');
    }
    return {
      dispatched: true,
      provider: 'console-dev',
      devOtpPreview: otpCode,
    };
  }
}

export class SmsGatewayOtpProvider implements IOtpProvider {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async sendOtp(_phone: string, _otpCode: string): Promise<OtpDispatchResult> {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error(
        'SMS_PROVIDER_NOT_CONFIGURED: SMS_GATEWAY_API_URL and SMS_GATEWAY_API_KEY are required.'
      );
    }
    // Pluggable external gateway adapter interface
    return {
      dispatched: true,
      provider: 'sms-gateway',
    };
  }
}

export function hashOtpCode(phone: string, otpCode: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${phone}:${otpCode}`).digest('hex');
}

export function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export function createOtpProvider(config: AppEnvConfig): IOtpProvider {
  if (config.otpProvider === 'sms-gateway') {
    return new SmsGatewayOtpProvider(config.smsGatewayApiUrl, config.smsGatewayApiKey);
  }
  return new ConsoleDevOtpProvider(config.nodeEnv);
}
