import { Injectable, OnModuleInit, OnModuleDestroy, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { getTenantTx, getEmpresaId, runInTenant } from '../tenant/tenant-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Cliente restringido al tenant de la request (transacción activa con RLS).
   * Fuera de contexto de tenant lanza error para evitar fugas silenciosas.
   */
  get tenant(): Prisma.TransactionClient {
    const tx = getTenantTx();
    if (!tx) throw new InternalServerErrorException('Operación fuera de contexto de empresa');
    return tx;
  }

  get empresaId(): string | null {
    return getEmpresaId();
  }

  /**
   * Ejecuta una operación dentro del tenant indicado (RLS activo).
   * Atención: el callback debe usar el cliente 'tx' para todas las consultas.
   */
  async runWithTenant<T>(empresaId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.empresa_id', $1, true)`, empresaId);
      await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'false', true)`);
      return runInTenant({ empresaId, tx }, () => fn(tx));
    });
  }

  /**
   * Ejecuta una operación de sistema sin filtro de tenant (login, onboarding).
   * El callback recibe 'tx' (cliente transaccional con bypass activo).
   */
  async runAsSystem<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'true', true)`);
      return runInTenant({ empresaId: null, tx }, () => fn(tx));
    });
  }
}