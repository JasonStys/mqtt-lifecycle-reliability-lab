/**
 * @file Deny-by-default topic authorization model.
 * @description Demonstrates least-privilege publish and subscribe decisions for lab principals.
 * @exports AuthorizationPolicy, AuthorizationDecision, Principal.
 * @data principals encode identity and role; every unrecognized action is denied.
 */
import { parseLifecycleTopic, TOPIC_ROOT } from './topic.ts';

export type Principal =
  | { readonly groupId: string; readonly nodeId: string; readonly role: 'node' }
  | { readonly groupId: string; readonly role: 'consumer' }
  | { readonly role: 'unknown' };

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/** Enforces scoped node writes and group-scoped consumer reads. */
export class AuthorizationPolicy {
  authorizePublish(principal: Principal, topic: string): AuthorizationDecision {
    const parsed = parseLifecycleTopic(topic);
    if (parsed === undefined) {
      return deny('topic is outside the lifecycle namespace');
    }

    if (
      principal.role === 'node' &&
      principal.groupId === parsed.groupId &&
      principal.nodeId === parsed.nodeId
    ) {
      return allow('node owns this namespace');
    }

    return deny('principal cannot publish to this node namespace');
  }

  authorizeSubscribe(principal: Principal, filter: string): AuthorizationDecision {
    if (principal.role !== 'consumer') {
      return deny('only consumers may create wildcard lifecycle subscriptions');
    }

    const allowedFilter = `${TOPIC_ROOT}/${principal.groupId}/nodes/+/events/+`;
    return filter === allowedFilter
      ? allow('consumer is scoped to its group')
      : deny('subscription exceeds the consumer group scope');
  }
}

function allow(reason: string): AuthorizationDecision {
  return { allowed: true, reason };
}

function deny(reason: string): AuthorizationDecision {
  return { allowed: false, reason };
}
