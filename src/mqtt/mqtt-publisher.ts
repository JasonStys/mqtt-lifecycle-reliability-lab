/**
 * @file Production MQTT.js publisher boundary.
 * @description Connects with MQTT 5, disables hidden QoS-0 queuing, and publishes validated envelopes.
 * @exports MqttLifecyclePublisher, MqttPublisherOptions.
 * @data client is undefined while disconnected; configuration secrets are never logged or exposed.
 */
import { connectAsync, type IClientOptions, type MqttClient } from 'mqtt';
import { lifecycleEnvelopeSchema, type LifecycleEnvelope } from '../core/contracts.ts';
import { buildLifecycleTopic } from '../core/topic.ts';

export interface MqttPublisherOptions {
  readonly clientId: string;
  readonly password?: string;
  readonly sessionExpirySeconds?: number;
  readonly url: string;
  readonly username?: string;
}

/** Thin MQTT.js adapter; policy, buffering, and lifecycle logic remain in the core. */
export class MqttLifecyclePublisher {
  #client: MqttClient | undefined;

  constructor(private readonly options: MqttPublisherOptions) {}

  async connect(): Promise<void> {
    if (this.#client !== undefined) {
      return;
    }
    const clientOptions: IClientOptions = {
      clean: false,
      clientId: this.options.clientId,
      connectTimeout: 10_000,
      protocolVersion: 5,
      queueQoSZero: false,
      reconnectOnConnackError: false,
      reconnectPeriod: 1_000,
      properties: {
        receiveMaximum: 32,
        sessionExpiryInterval: this.options.sessionExpirySeconds ?? 300,
      },
    };
    if (this.options.username !== undefined) {
      clientOptions.username = this.options.username;
    }
    if (this.options.password !== undefined) {
      clientOptions.password = this.options.password;
    }
    this.#client = await connectAsync(this.options.url, clientOptions);
  }

  async publish(envelope: LifecycleEnvelope, retain = false): Promise<void> {
    const client = this.#client;
    if (client === undefined) {
      throw new Error('MQTT client is not connected');
    }
    const validated = lifecycleEnvelopeSchema.parse(envelope);
    const topic = buildLifecycleTopic(validated);
    await client.publishAsync(topic, JSON.stringify(validated), {
      properties: { contentType: 'application/json', payloadFormatIndicator: true },
      qos: 1,
      retain,
    });
  }

  async disconnect(): Promise<void> {
    const client = this.#client;
    this.#client = undefined;
    if (client !== undefined) {
      await client.endAsync(false);
    }
  }
}
