/**
 * @file Topic construction and parsing.
 * @description Owns the original lifecycle namespace used by the lab.
 * @exports LifecycleEvent, LifecycleTopic, buildLifecycleTopic, parseLifecycleTopic.
 * @data TOPIC_ROOT prevents accidental overlap with standard Sparkplug namespaces.
 */

export const TOPIC_ROOT = 'reliability/v1';
const identifierPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type LifecycleEvent = 'birth' | 'data' | 'death' | 'state';

export interface LifecycleTopic {
  readonly event: LifecycleEvent;
  readonly groupId: string;
  readonly nodeId: string;
}

/** Builds a canonical topic after validating every caller-controlled segment. */
export function buildLifecycleTopic(topic: LifecycleTopic): string {
  validateIdentifier('groupId', topic.groupId);
  validateIdentifier('nodeId', topic.nodeId);
  return `${TOPIC_ROOT}/${topic.groupId}/nodes/${topic.nodeId}/events/${topic.event}`;
}

/** Parses a canonical lifecycle topic and rejects wildcards or extra path segments. */
export function parseLifecycleTopic(topic: string): LifecycleTopic | undefined {
  const segments = topic.split('/');
  if (
    segments.length !== 7 ||
    segments[0] !== 'reliability' ||
    segments[1] !== 'v1' ||
    segments[3] !== 'nodes'
  ) {
    return undefined;
  }

  const groupId = segments[2];
  const nodeId = segments[4];
  const event = segments[5];
  const trailing = segments[6];

  // A reserved literal makes malformed seven-segment paths fail closed.
  if (
    groupId === undefined ||
    nodeId === undefined ||
    event !== 'events' ||
    trailing === undefined ||
    !isLifecycleEvent(trailing) ||
    !identifierPattern.test(groupId) ||
    !identifierPattern.test(nodeId)
  ) {
    return undefined;
  }

  return { event: trailing, groupId, nodeId };
}

/** Returns the exact subscription filter for one group. */
export function buildGroupSubscription(groupId: string): string {
  validateIdentifier('groupId', groupId);
  return `${TOPIC_ROOT}/${groupId}/nodes/+/events/+`;
}

function isLifecycleEvent(value: string): value is LifecycleEvent {
  return value === 'birth' || value === 'data' || value === 'death' || value === 'state';
}

function validateIdentifier(label: string, value: string): void {
  if (!identifierPattern.test(value)) {
    throw new Error(`${label} must contain lowercase letters, digits, or internal hyphens`);
  }
}
