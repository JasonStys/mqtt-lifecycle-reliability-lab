/**
 * @file Lifecycle message contracts and runtime validation.
 * @description Defines the wire-level envelope, telemetry metrics, and safe JSON parser.
 * @exports Metric, LifecycleEnvelope, lifecycleEnvelopeSchema, parseEnvelope.
 * @data schemaVersion fixes compatibility; messageId supports deduplication; sourceTimestamp
 * distinguishes device time from broker receive time; seq is an unsigned 8-bit sequence.
 */
import { z } from 'zod';

const identifier = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'use lowercase letters, digits, and hyphens');

/** Runtime schema for one strongly typed telemetry metric. */
export const metricSchema = z
  .object({
    dataType: z.enum(['boolean', 'float64', 'int64', 'string']),
    name: z
      .string()
      .min(1)
      .max(96)
      .regex(/^[a-z][a-z0-9_.-]*$/),
    quality: z.enum(['bad', 'good', 'uncertain']),
    sourceTimestamp: z.string().datetime({ offset: true }),
    unit: z.string().min(1).max(24).optional(),
    value: z.union([z.boolean(), z.number().finite(), z.string().max(512)]),
  })
  .strict()
  .superRefine((metric, context) => {
    const expectedType =
      metric.dataType === 'float64' || metric.dataType === 'int64' ? 'number' : metric.dataType;

    if (typeof metric.value !== expectedType) {
      context.addIssue({
        code: 'custom',
        message: `value must match dataType ${metric.dataType}`,
        path: ['value'],
      });
    }

    if (
      metric.dataType === 'int64' &&
      typeof metric.value === 'number' &&
      !Number.isSafeInteger(metric.value)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'int64 values must be JavaScript safe integers',
        path: ['value'],
      });
    }
  });

/** Runtime schema for the project-specific lifecycle envelope. */
export const lifecycleEnvelopeSchema = z
  .object({
    birthSequence: z.number().int().min(0).max(4_294_967_295),
    event: z.enum(['birth', 'data', 'death', 'state']),
    groupId: identifier,
    messageId: z.uuid(),
    metrics: z.array(metricSchema).max(256),
    nodeId: identifier,
    online: z.boolean(),
    reason: z.string().min(1).max(160).optional(),
    schemaVersion: z.literal('1.0'),
    seq: z.number().int().min(0).max(255),
    sourceTimestamp: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((envelope, context) => {
    if (envelope.event === 'birth' && envelope.seq !== 0) {
      context.addIssue({
        code: 'custom',
        message: 'birth events must reset seq to 0',
        path: ['seq'],
      });
    }

    if (envelope.event === 'death' && envelope.reason === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'death events require a reason',
        path: ['reason'],
      });
    }

    if (envelope.event === 'death' && envelope.online) {
      context.addIssue({
        code: 'custom',
        message: 'death events must be offline',
        path: ['online'],
      });
    }

    if ((envelope.event === 'birth' || envelope.event === 'data') && !envelope.online) {
      context.addIssue({
        code: 'custom',
        message: `${envelope.event} events must be online`,
        path: ['online'],
      });
    }
  });

export type Metric = z.infer<typeof metricSchema>;
export type LifecycleEnvelope = z.infer<typeof lifecycleEnvelopeSchema>;

export type EnvelopeParseResult =
  | { readonly ok: true; readonly value: LifecycleEnvelope }
  | { readonly error: string; readonly ok: false };

/**
 * Parses an untrusted UTF-8 payload without throwing across the application boundary.
 *
 * @param payload - Broker payload as bytes or text.
 * @returns A discriminated result containing a validated envelope or a concise error.
 */
export function parseEnvelope(payload: Uint8Array | string): EnvelopeParseResult {
  try {
    const text = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
    const parsed: unknown = JSON.parse(text);
    const result = lifecycleEnvelopeSchema.safeParse(parsed);

    if (!result.success) {
      return { error: z.prettifyError(result.error), ok: false };
    }

    return { ok: true, value: result.data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown JSON parse failure';
    return { error: `invalid JSON: ${message}`, ok: false };
  }
}
