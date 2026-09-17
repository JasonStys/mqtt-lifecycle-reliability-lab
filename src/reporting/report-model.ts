/**
 * @file Reliability report data model.
 * @description Defines the stable JSON boundary consumed by the CLI, dashboard, and tests.
 * @exports LabReport, ScenarioResult, TimelineEntry.
 * @data scenarios hold pass/fail evidence; timeline entries preserve causal order.
 */
import type { NodeState, StoreStatistics } from '../core/state-store.ts';

export interface TimelineEntry {
  readonly detail: string;
  readonly event: string;
  readonly offset: number;
  readonly status: 'failure' | 'info' | 'success' | 'warning';
}

export interface ScenarioResult {
  readonly id: string;
  readonly observations: readonly string[];
  readonly passed: boolean;
  readonly purpose: string;
  readonly timeline: readonly TimelineEntry[];
  readonly title: string;
}

export interface LabReport {
  readonly generatedAt: string;
  readonly profile: {
    readonly compatibility: 'original-json-profile-not-sparkplug-wire-compatible';
    readonly namespace: 'reliability/v1';
    readonly transport: 'MQTT-5-semantics';
  };
  readonly scenarios: readonly ScenarioResult[];
  readonly snapshot: readonly NodeState[];
  readonly statistics: StoreStatistics;
  readonly summary: {
    readonly failed: number;
    readonly passed: number;
    readonly total: number;
  };
}
