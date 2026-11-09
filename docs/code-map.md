# Source code map

Line anchors match the 2026-11-09 recovery workflow source. Headers describe responsibilities;
the tables centralize declarations and state locations so line references are reviewed together.
Function-local variables are listed with their actual declaration lines; field names identify class state.

## `dashboard/app.ts`

| Declaration           | Line |
| --------------------- | ---: |
| `statusElement`       |    9 |
| `summaryElement`      |   10 |
| `scenariosElement`    |   11 |
| `response`            |   14 |
| `report`              |   18 |
| `renderReport`        |   19 |
| `renderReport`        |   25 |
| `allPassed`           |   26 |
| `node`                |   38 |
| `summaryCards`        |   39 |
| `card`                |   50 |
| `renderScenario`      |   60 |
| `article`             |   61 |
| `headingRow`          |   64 |
| `timeline`            |   72 |
| `details`             |   78 |
| `summary`             |   79 |
| `list`                |   81 |
| `item`                |   83 |
| `renderTimelineEntry` |   92 |
| `item`                |   93 |
| `requiredElement`     |  103 |
| `element`             |  104 |
| `textElement`         |  111 |
| `element`             |  116 |

## `src/benchmark.ts`

| Declaration           | Line |
| --------------------- | ---: |
| `iterations`          |   15 |
| `minimumThroughput`   |   16 |
| `store`               |   17 |
| `birthTopic`          |   18 |
| `dataTopic`           |   19 |
| `receivedAt`          |   20 |
| `start`               |   23 |
| `result`              |   25 |
| `elapsedMilliseconds` |   34 |
| `throughputPerSecond` |   35 |
| `report`              |   36 |
| `repositoryRoot`      |   45 |
| `output`              |   46 |
| `envelope`            |   55 |
| `readPositiveInteger` |   79 |
| `raw`                 |   80 |
| `parsed`              |   84 |

## `src/cli.ts`

| Declaration      | Line |
| ---------------- | ---: |
| `repositoryRoot` |   12 |
| `report`         |   13 |
| `serialized`     |   14 |
| `outputs`        |   15 |
| `resolve`        |   16 |
| `resolve`        |   17 |

## `src/core/authorization.ts`

| Declaration             | Line |
| ----------------------- | ---: |
| `Principal`             |    9 |
| `AuthorizationDecision` |   14 |
| `AuthorizationPolicy`   |   20 |
| `authorizePublish`      |   21 |
| `parsed`                |   22 |
| `authorizeSubscribe`    |   38 |
| `allowedFilter`         |   43 |
| `allow`                 |   50 |
| `deny`                  |   54 |

## `src/core/bounded-outbox.ts`

| Declaration        | Line |
| ------------------ | ---: |
| `DropPolicy`       |    8 |
| `EnqueueResult`    |    9 |
| `OutboxStatistics` |   11 |
| `BoundedOutbox`    |   19 |
| `#capacity`        |   20 |
| `#items`           |   21 |
| `#policy`          |   22 |
| `#accepted`        |   23 |
| `#droppedOldest`   |   24 |
| `#highWaterMark`   |   25 |
| `#rejectedNewest`  |   26 |
| `constructor`      |   28 |
| `enqueue`          |   41 |
| `result`           |   42 |
| `dequeue`          |   60 |
| `snapshot`         |   65 |
| `statistics`       |   69 |

## `src/core/contracts.ts`

| Declaration               | Line |
| ------------------------- | ---: |
| `identifier`              |   10 |
| `metricSchema`            |   17 |
| `expectedType`            |   32 |
| `lifecycleEnvelopeSchema` |   57 |
| `Metric`                  |  106 |
| `LifecycleEnvelope`       |  107 |
| `EnvelopeParseResult`     |  109 |
| `parseEnvelope`           |  119 |
| `text`                    |  121 |
| `parsed`                  |  122 |
| `result`                  |  123 |
| `message`                 |  131 |

## `src/core/recovery-outbox.ts`

| Declaration            | Line |
| ---------------------- | ---: |
| `MAX_CHECKPOINT_BYTES` |   11 |
| `MAX_TTL`              |   12 |
| `timestamp`            |   13 |
| `batchSchema`          |   14 |
| `entrySchema`          |   15 |
| `identity`             |   23 |
| `checkpointSchema`     |   29 |
| `previous`             |   42 |
| `Checkpoint`           |   62 |
| `Entry`                |   63 |
| `RestoreResult`        |   64 |
| `RecoveryStatistics`   |   69 |
| `readCheckpoint`       |   76 |
| `RecoveryOutbox`       |   83 |
| `#capacity`            |   84 |
| `#policy`              |   85 |
| `#ttl`                 |   86 |
| `#entries`             |   87 |
| `#lastOrdinal`         |   88 |
| `#lastTime`            |   89 |
| `#used`                |   90 |
| `#accepted`            |   91 |
| `#droppedOldest`       |   92 |
| `#rejectedNewest`      |   93 |
| `#highWaterMark`       |   94 |
| `#expired`             |   95 |
| `#replayed`            |   96 |
| `#restored`            |   97 |
| `constructor`          |   99 |
| `enqueue`              |  116 |
| `safe`                 |  117 |
| `result`               |  127 |
| `dequeue`              |  146 |
| `entry`                |  149 |
| `replayOne`            |  155 |
| `entry`                |  158 |
| `snapshot`             |  167 |
| `restore`              |  174 |
| `live`                 |  179 |
| `expired`              |  180 |
| `capacityDropped`      |  181 |
| `retained`             |  182 |
| `statistics`           |  196 |
| `#validateTime`        |  208 |
| `#expire`              |  212 |
| `live`                 |  213 |

## `src/core/sequence.ts`

| Declaration          | Line |
| -------------------- | ---: |
| `MODULUS`            |    8 |
| `HALF_RANGE`         |    9 |
| `SequenceAssessment` |   11 |
| `assessSequence`     |   24 |
| `assertUint8`        |   25 |
| `assertUint8`        |   30 |
| `forwardDistance`    |   31 |
| `assertUint8`        |   45 |

## `src/core/state-store.ts`

| Declaration              | Line |
| ------------------------ | ---: |
| `NodeState`              |   11 |
| `StoreStatistics`        |   23 |
| `IngestionResult`        |   35 |
| `StateStore`             |   46 |
| `#dedupeLimit`           |   47 |
| `#nodes`                 |   48 |
| `#seenMessageIds`        |   49 |
| `#accepted`              |   50 |
| `#clockSkewWarnings`     |   51 |
| `#duplicateMessages`     |   52 |
| `#duplicateSequences`    |   53 |
| `#gaps`                  |   54 |
| `#invalid`               |   55 |
| `#missingMessages`       |   56 |
| `#orphanData`            |   57 |
| `#outOfOrder`            |   58 |
| `constructor`            |   60 |
| `ingest`                 |   68 |
| `parsedTopic`            |   69 |
| `parsedEnvelope`         |   74 |
| `envelope`               |   79 |
| `key`                    |   94 |
| `prior`                  |   95 |
| `sequence`               |  101 |
| `receivedTimestamp`      |  115 |
| `sourceTime`             |  116 |
| `clockSkewMs`            |  117 |
| `warning`                |  118 |
| `nextMetrics`            |  126 |
| `getNode`                |  142 |
| `state`                  |  143 |
| `snapshot`               |  147 |
| `statistics`             |  155 |
| `#recordSequence`        |  169 |
| `#reject`                |  180 |
| `#rememberMessageId`     |  185 |
| `oldest`                 |  188 |
| `assessEnvelopeSequence` |  196 |
| `mergeMetrics`           |  209 |
| `next`                   |  217 |
| `nodeKey`                |  224 |

## `src/core/topic.ts`

| Declaration              | Line |
| ------------------------ | ---: |
| `TOPIC_ROOT`             |    8 |
| `identifierPattern`      |    9 |
| `LifecycleEvent`         |   11 |
| `LifecycleTopic`         |   13 |
| `buildLifecycleTopic`    |   20 |
| `validateIdentifier`     |   21 |
| `validateIdentifier`     |   22 |
| `parseLifecycleTopic`    |   27 |
| `segments`               |   28 |
| `groupId`                |   38 |
| `nodeId`                 |   39 |
| `event`                  |   40 |
| `trailing`               |   41 |
| `buildGroupSubscription` |   60 |
| `validateIdentifier`     |   61 |
| `isLifecycleEvent`       |   65 |
| `validateIdentifier`     |   69 |

## `src/lab/determinism.ts`

| Declaration                    | Line |
| ------------------------------ | ---: |
| `createDeterministicClock`     |   10 |
| `startTime`                    |   11 |
| `tick`                         |   15 |
| `value`                        |   17 |
| `createDeterministicIdFactory` |   24 |
| `counter`                      |   28 |
| `suffix`                       |   30 |

## `src/lab/edge-node.ts`

| Declaration              | Line |
| ------------------------ | ---: |
| `RestoreResult`          |   13 |
| `RecoveryStatistics`     |   14 |
| `Clock`                  |   21 |
| `IdFactory`              |   22 |
| `EdgeNodeConfiguration`  |   24 |
| `EdgeNodeStatistics`     |   35 |
| `EdgeNode`               |   44 |
| `#broker`                |   45 |
| `#clock`                 |   46 |
| `#configuration`         |   47 |
| `#currentMetrics`        |   48 |
| `#idFactory`             |   49 |
| `#outbox`                |   50 |
| `#started`               |   51 |
| `#birthSequence`         |   52 |
| `#connection`            |   53 |
| `#publishedDataEvents`   |   54 |
| `#seq`                   |   55 |
| `constructor`            |   57 |
| `connect`                |   75 |
| `willEnvelope`           |   85 |
| `will`                   |   89 |
| `retryBuffered`          |  107 |
| `before`                 |  110 |
| `publishMetrics`         |  116 |
| `safeMetrics`            |  119 |
| `checkpoint`             |  129 |
| `now`                    |  131 |
| `checkpoint`             |  132 |
| `serialized`             |  141 |
| `restoreCheckpoint`      |  147 |
| `checkpoint`             |  150 |
| `result`                 |  156 |
| `disconnectGracefully`   |  164 |
| `death`                  |  168 |
| `disconnectUnexpectedly` |  176 |
| `statistics`             |  181 |
| `#flushOutbox`           |  191 |
| `#publishData`           |  199 |
| `#publishState`          |  209 |
| `options`                |  210 |
| `#publishEnvelope`       |  217 |
| `connection`             |  218 |
| `#makeEnvelope`          |  225 |
| `now`                    |  230 |
| `base`                   |  231 |
| `#topic`                 |  246 |

## `src/lab/in-memory-broker.ts`

| Declaration           | Line |
| --------------------- | ---: |
| `BrokerDelivery`      |   10 |
| `BrokerPublication`   |   16 |
| `PublishOptions`      |   20 |
| `WillPacket`          |   24 |
| `CredentialRecord`    |   30 |
| `Subscription`        |   35 |
| `AuthenticationError` |   41 |
| `constructor`         |   42 |
| `AuthorizationError`  |   48 |
| `constructor`         |   49 |
| `BrokerConnection`    |   56 |
| `#closed`             |   57 |
| `constructor`         |   59 |
| `publish`             |   65 |
| `subscribe`           |   76 |
| `disconnect`          |   81 |
| `markClosedByBroker`  |   88 |
| `#assertOpen`         |   92 |
| `InMemoryBroker`      |  100 |
| `#authorization`      |  101 |
| `#connections`        |  102 |
| `#credentials`        |  103 |
| `#retained`           |  104 |
| `#subscriptions`      |  105 |
| `#publications`       |  106 |
| `registerCredential`  |  108 |
| `connect`             |  115 |
| `record`              |  121 |
| `connection`          |  129 |
| `restart`             |  135 |
| `retainedCount`       |  145 |
| `publicationLog`      |  149 |
| `replay`              |  154 |
| `publication`         |  155 |
| `publishFrom`         |  162 |
| `decision`            |  169 |
| `subscribeFrom`       |  185 |
| `decision`            |  191 |
| `disconnectClient`    |  204 |
| `entry`               |  205 |
| `#deliver`            |  229 |
| `deliveries`          |  230 |
| `topicMatches`        |  241 |
| `filterSegments`      |  242 |
| `topicSegments`       |  243 |

## `src/lab/recovery-rehearsal.ts`

| Declaration                | Line |
| -------------------------- | ---: |
| `prepareRecoveryRehearsal` |   14 |
| `broker`                   |   15 |
| `now`                      |   25 |
| `clock`                    |   26 |
| `config`                   |   27 |
| `original`                 |   37 |
| `consumer`                 |   38 |
| `readings`                 |   49 |
| `metric`                   |   57 |
| `checkpoint`               |   68 |
| `recover`                  |   70 |
| `recovered`                |   72 |
| `restore`                  |   78 |
| `state`                    |   80 |
| `data`                     |   81 |
| `replayed`                 |   82 |
| `passed`                   |   86 |

## `src/lab/scenario-suite.ts`

| Declaration                    | Line |
| ------------------------------ | ---: |
| `GROUP_ID`                     |   16 |
| `NODE_ID`                      |   17 |
| `NODE_PASSWORD`                |   18 |
| `NODE_USERNAME`                |   19 |
| `CONSUMER_PASSWORD`            |   20 |
| `CONSUMER_USERNAME`            |   21 |
| `Harness`                      |   23 |
| `runScenarioSuite`             |   32 |
| `scenarios`                    |   33 |
| `finalHarness`                 |   42 |
| `passed`                       |   49 |
| `retainedBootstrapScenario`    |   64 |
| `harness`                      |   65 |
| `state`                        |   71 |
| `retained`                     |   72 |
| `passed`                       |   73 |
| `lifecycleRecoveryScenario`    |   98 |
| `harness`                      |   99 |
| `offline`                      |  103 |
| `recoveredState`               |  105 |
| `passed`                       |  106 |
| `duplicateAndOrderingScenario` |  130 |
| `harness`                      |  131 |
| `firstDataIndex`               |  135 |
| `firstData`                    |  141 |
| `lateEnvelope`                 |  145 |
| `injector`                     |  147 |
| `statistics`                   |  151 |
| `currentValue`                 |  152 |
| `passed`                       |  155 |
| `boundedOfflineBufferScenario` |  182 |
| `harness`                      |  183 |
| `beforeReconnect`              |  190 |
| `afterReconnect`               |  192 |
| `finalValue`                   |  193 |
| `passed`                       |  196 |
| `authorizationScenario`        |  226 |
| `harness`                      |  227 |
| `authenticationDenied`         |  228 |
| `crossNodePublishDenied`       |  229 |
| `crossGroupSubscribeDenied`    |  230 |
| `nodeConnection`               |  238 |
| `consumerConnection`           |  249 |
| `passed`                       |  261 |
| `brokerRestartScenario`        |  295 |
| `harness`                      |  296 |
| `offlineAfterRestart`          |  304 |
| `recovered`                    |  306 |
| `passed`                       |  307 |
| `createHarness`                |  341 |
| `broker`                       |  342 |
| `clock`                        |  352 |
| `ids`                          |  353 |
| `node`                         |  354 |
| `consumer`                     |  368 |
| `metric`                       |  379 |
| `entry`                        |  389 |
| `scenario`                     |  398 |
| `checkpointRecoveryScenario`   |  410 |
| `rehearsal`                    |  411 |
| `result`                       |  412 |

## `src/lab/state-consumer.ts`

| Declaration           | Line |
| --------------------- | ---: |
| `ConsumerObservation` |   12 |
| `StateConsumer`       |   20 |
| `#broker`             |   21 |
| `#clientId`           |   22 |
| `#clock`              |   23 |
| `#groupId`            |   24 |
| `#observations`       |   25 |
| `#password`           |   26 |
| `#store`              |   27 |
| `#username`           |   28 |
| `#connection`         |   29 |
| `constructor`         |   31 |
| `connect`             |   49 |
| `receivedAt`          |   55 |
| `result`              |   56 |
| `disconnect`          |   66 |
| `observations`        |   71 |
| `store`               |   75 |

## `src/mqtt/config.ts`

| Declaration             | Line |
| ----------------------- | ---: |
| `environmentSchema`     |   10 |
| `MqttConfiguration`     |   22 |
| `loadMqttConfiguration` |   33 |
| `parsed`                |   36 |
| `publicConfiguration`   |   49 |
| `emptyToUndefined`      |   60 |

## `src/mqtt/mqtt-publisher.ts`

| Declaration              | Line |
| ------------------------ | ---: |
| `MqttPublisherOptions`   |   11 |
| `MqttLifecyclePublisher` |   20 |
| `#client`                |   21 |
| `constructor`            |   23 |
| `clientOptions`          |   29 |
| `client`                 |   52 |
| `validated`              |   56 |
| `topic`                  |   57 |
| `client`                 |   66 |

## `src/recovery-cli.ts`

| Declaration      | Line |
| ---------------- | ---: |
| `root`           |   12 |
| `directory`      |   14 |
| `rehearsal`      |   15 |
| `checkpointPath` |   16 |
| `report`         |   22 |

## `src/reporting/report-model.ts`

| Declaration      | Line |
| ---------------- | ---: |
| `TimelineEntry`  |    9 |
| `ScenarioResult` |   16 |
| `LabReport`      |   25 |
