import { AsyncLocalStorage } from 'async_hooks';
import { Prisma } from '@prisma/client';

export interface TenantState {
  empresaId: string | null;
  tx: Prisma.TransactionClient | null;
}

export const tenantStorage = new AsyncLocalStorage<TenantState>();

export function getTenantState(): TenantState | undefined {
  return tenantStorage.getStore();
}

export function getEmpresaId(): string | null {
  return tenantStorage.getStore()?.empresaId ?? null;
}

export function getTenantTx(): Prisma.TransactionClient | null {
  return tenantStorage.getStore()?.tx ?? null;
}

export function runInTenant<T>(state: TenantState, fn: () => Promise<T> | T): Promise<T> {
  return tenantStorage.run(state, () => Promise.resolve(fn()));
}