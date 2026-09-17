/**
 * @file Environment-backed MQTT client configuration.
 * @description Validates broker settings at startup and keeps secrets out of diagnostic summaries.
 * @exports loadMqttConfiguration, MqttConfiguration, publicConfiguration.
 * @data MQTT_PASSWORD is accepted only in memory and is never returned by publicConfiguration.
 */
import { z } from 'zod';
import type { DropPolicy } from '../core/bounded-outbox.ts';

const environmentSchema = z.object({
  MQTT_DROP_POLICY: z.enum(['drop-oldest', 'reject-newest']).default('drop-oldest'),
  MQTT_GROUP_ID: z.string().min(1).default('lab'),
  MQTT_NODE_ID: z.string().min(1).default('edge-01'),
  MQTT_OUTBOX_CAPACITY: z.coerce.number().int().min(1).max(100_000).default(128),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_URL: z.url().refine((value) => value.startsWith('mqtt://') || value.startsWith('mqtts://'), {
    message: 'MQTT_URL must use mqtt:// or mqtts://',
  }),
  MQTT_USERNAME: z.string().optional(),
});

export interface MqttConfiguration {
  readonly dropPolicy: DropPolicy;
  readonly groupId: string;
  readonly nodeId: string;
  readonly outboxCapacity: number;
  readonly password: string | undefined;
  readonly url: string;
  readonly username: string | undefined;
}

/** Parses untrusted process environment data and fails early with field-specific errors. */
export function loadMqttConfiguration(
  environment: Record<string, string | undefined> = process.env,
): MqttConfiguration {
  const parsed = environmentSchema.parse(environment);
  return {
    dropPolicy: parsed.MQTT_DROP_POLICY,
    groupId: parsed.MQTT_GROUP_ID,
    nodeId: parsed.MQTT_NODE_ID,
    outboxCapacity: parsed.MQTT_OUTBOX_CAPACITY,
    password: emptyToUndefined(parsed.MQTT_PASSWORD),
    url: parsed.MQTT_URL,
    username: emptyToUndefined(parsed.MQTT_USERNAME),
  };
}

/** Returns a safe diagnostic view that cannot disclose the configured password. */
export function publicConfiguration(configuration: MqttConfiguration): Record<string, unknown> {
  return {
    authenticationConfigured: configuration.username !== undefined,
    dropPolicy: configuration.dropPolicy,
    groupId: configuration.groupId,
    nodeId: configuration.nodeId,
    outboxCapacity: configuration.outboxCapacity,
    url: configuration.url,
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}
