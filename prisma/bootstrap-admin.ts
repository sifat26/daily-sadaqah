// ============================================================================
// Daily Sadaqah — Controlled Initial Administrator Bootstrap CLI
// Prevents arbitrary admin registration and refuses execution if disabled or
// if an ADMIN account already exists.
// ============================================================================

import { normalizeBdPhone } from '../packages/shared/src/schemas/index';

export interface BootstrapAdminInput {
  enabled: boolean;
  configuredToken: string;
  providedToken: string;
  adminPhone: string;
  existingAdminCount: number;
}

export function verifyAdminBootstrapGuard(input: BootstrapAdminInput): { normalizedPhone: string } {
  if (!input.enabled) {
    throw new Error('ADMIN_BOOTSTRAP_DISABLED: Set ADMIN_BOOTSTRAP_ENABLED="true" only during initial setup.');
  }
  if (!input.configuredToken || input.configuredToken.length < 16) {
    throw new Error('ADMIN_BOOTSTRAP_INVALID_TOKEN_CONFIG: ADMIN_BOOTSTRAP_TOKEN must be at least 16 characters.');
  }
  if (input.providedToken !== input.configuredToken) {
    throw new Error('ADMIN_BOOTSTRAP_UNAUTHORIZED: Invalid bootstrap token provided.');
  }
  if (input.existingAdminCount > 0) {
    throw new Error('ADMIN_ALREADY_INITIALIZED: An administrator already exists. Bootstrap is locked.');
  }
  const normalizedPhone = normalizeBdPhone(input.adminPhone, 'ADMIN_INITIAL_PHONE');
  return { normalizedPhone };
}

async function runCli() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Platform Administrator' },
    });
    const existingAdminCount = await prisma.user.count({
      where: { roleId: adminRole.id },
    });

    const tokenArg = (process.argv.find((a) => a.startsWith('--token=')) || '').replace('--token=', '');
    const { normalizedPhone } = verifyAdminBootstrapGuard({
      enabled: process.env.ADMIN_BOOTSTRAP_ENABLED === 'true',
      configuredToken: process.env.ADMIN_BOOTSTRAP_TOKEN || '',
      providedToken: tokenArg || process.env.ADMIN_BOOTSTRAP_TOKEN || '',
      adminPhone: process.env.ADMIN_INITIAL_PHONE || '',
      existingAdminCount,
    });

    const adminUser = await prisma.user.upsert({
      where: { phone: normalizedPhone },
      update: { roleId: adminRole.id, status: 'ACTIVE' },
      create: {
        phone: normalizedPhone,
        name: 'প্রাথমিক অ্যাডমিন (System Admin)',
        roleId: adminRole.id,
        status: 'ACTIVE',
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: adminUser.id,
        action: 'ADMIN_BOOTSTRAP_COMPLETED',
        entityType: 'User',
        entityId: adminUser.id,
        metadata: { note: 'Initial administrator created via controlled CLI bootstrap' },
      },
    });

    console.log('Initial administrator created successfully. Set ADMIN_BOOTSTRAP_ENABLED="false" now.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error('[Bootstrap Error]:', err.message);
    process.exit(1);
  });
}
