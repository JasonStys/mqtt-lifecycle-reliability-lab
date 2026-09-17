# Primary References

These sources shaped the implementation and its documented boundaries.

- [OASIS MQTT Version 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html) — retained
  messages, QoS behavior, session expiry, subscription options, and will delay.
- [Eclipse Sparkplug Specification](https://sparkplug.eclipse.org/specification/) — industrial MQTT
  topic, payload, and session-state concepts. The lab is explicitly not wire-compatible.
- [Eclipse Mosquitto configuration manual](https://mosquitto.org/man/mosquitto-conf-5.html) — broker
  persistence, resource limits, and listener configuration.
- [Eclipse Mosquitto authentication methods](https://mosquitto.org/documentation/authentication-methods/)
  — password files, authentication plugins, and anonymous access implications.
- [MQTT.js repository documentation](https://github.com/mqttjs/MQTT.js) — MQTT 5 options,
  reconnection, session state, QoS, publish properties, and queue controls.
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12) — portable envelope schema.

## Applied conclusions

- QoS 1 can redeliver, so the application needs an idempotency identity in addition to a sequence.
- Retained messages are distinct from session state, so lifecycle truth must be modeled explicitly.
- A will can be delayed or affected by broker failure, so consumers must tolerate state transitions
  rather than treating the network as a perfect failure detector.
- Client library queues and broker queues have independent limits; application-owned buffers still
  require an explicit policy.
- Similarity to an industrial state model does not establish protocol compatibility. Namespace and
  payload claims remain conservative until a conformance suite proves otherwise.
