export type ActorType = 'ADMIN' | 'CUSTOMER' | 'SYSTEM';

export interface RequestActor {
  type: ActorType;
  id: string | null;
}
