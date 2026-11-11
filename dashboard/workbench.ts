/**
 * @file Full editable lifecycle campaign UI with actual original-engine replay and optional native files.
 * @description Separates unapplied input from last-good results, exact prefix navigation and saved local revision.
 * @exports startWorkbench; source locations and responsibilities: docs/code-map.md.
 * @data text is always rendered inertly; native IPC never exposes paths, credentials or network destinations.
 */
import {
  parseProject,
  preparedProject,
  replayProject,
  type CampaignProject,
} from '../src/workbench/campaign.ts';

interface NativeStudio {
  load(): Promise<{ revision: string; project: CampaignProject | null }>;
  save(request: {
    revision: string;
    serialized: string;
  }): Promise<{ revision: string; project: CampaignProject | null }>;
  import(): Promise<string | null>;
  export(request: { kind: string; serialized: string; cursor: number }): Promise<boolean>;
  quit(): Promise<boolean>;
}
declare global {
  interface Window {
    mqttStudio?: NativeStudio;
  }
}

/** Own UI state only; no broker socket, real credential, arbitrary command or hidden local database. */
export function startWorkbench(): void {
  const studio = window.mqttStudio;
  const element = <T extends HTMLElement>(id: string) => {
    const found = document.getElementById(id);
    if (!found) throw new Error('Missing workbench control: ' + id);
    return found as T;
  };
  const editor = element<HTMLTextAreaElement>('campaign-json');
  const message = element('campaign-message');
  const error = element('campaign-error');
  const settings = element<HTMLFormElement>('campaign-settings');
  let applied = preparedProject('cold-chain');
  let cursor = 0;
  let revision = 'none';
  let loaded = false;
  let busy = false;
  let result = replayProject(applied, cursor);
  const serialized = () => JSON.stringify(applied, null, 2);
  const jsonDirty = () => editor.value !== serialized();
  const formDirty = () => {
    const fields = currentSettings();
    return [
      'title',
      'groupId',
      'nodeId',
      'capacity',
      'restoreCapacity',
      'ttlMs',
      'overflowPolicy',
    ].some((key) => fields[key as keyof typeof fields] !== applied[key as keyof CampaignProject]);
  };
  const dirty = () => jsonDirty() || formDirty();
  const notice = (text: string) => {
    message.textContent = text;
    error.textContent = '';
  };
  const rejected = (failure: unknown) => {
    error.textContent =
      failure instanceof Error ? failure.message : 'Operation failed; previous data was retained.';
  };
  const requireApplied = () => {
    if (dirty()) throw new Error('Apply or discard the input edits before this action.');
  };
  const currentSettings = () => {
    const input = <T extends HTMLInputElement | HTMLSelectElement>(name: string) => {
      const found = settings.elements.namedItem(name);
      if (!(found instanceof HTMLInputElement || found instanceof HTMLSelectElement))
        throw new Error('Missing settings field.');
      return found as T;
    };
    return {
      ...applied,
      title: input<HTMLInputElement>('title').value,
      groupId: input<HTMLInputElement>('groupId').value,
      nodeId: input<HTMLInputElement>('nodeId').value,
      capacity: input<HTMLInputElement>('capacity').valueAsNumber,
      restoreCapacity: input<HTMLInputElement>('restoreCapacity').valueAsNumber,
      ttlMs: input<HTMLInputElement>('ttlMs').valueAsNumber,
      overflowPolicy: input<HTMLSelectElement>('overflowPolicy').value,
    };
  };
  function render(): void {
    editor.disabled = busy;
    for (const control of settings.querySelectorAll('input,select,button'))
      if (
        control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLButtonElement
      )
        control.disabled = busy;
    for (const id of [
      'campaign-prepared',
      'campaign-apply',
      'campaign-discard',
      'campaign-load',
      'campaign-import',
      'campaign-quit',
    ])
      element<HTMLButtonElement | HTMLSelectElement>(id).disabled = busy;
    element('campaign-position').textContent =
      `Event ${cursor} of ${applied.events.length}; ${result.rejectedOperations} rejected operation(s) in this prefix.`;
    element('campaign-summary').textContent =
      `${applied.groupId}/${applied.nodeId} | publisher ${result.publisher.connected ? 'connected' : 'offline'} | birth ${result.publisher.birthSequence} | buffered ${result.publisher.buffered} | expired ${result.publisher.outbox.expired} | dropped ${result.publisher.outbox.droppedOldest} | rejected newest ${result.publisher.outbox.rejectedNewest} | replayed ${result.publisher.outbox.replayed}`;
    element<HTMLButtonElement>('campaign-back').disabled = busy || dirty() || cursor === 0;
    element<HTMLButtonElement>('campaign-next').disabled =
      busy || dirty() || cursor >= applied.events.length;
    element<HTMLButtonElement>('campaign-run').disabled = busy || dirty();
    element<HTMLButtonElement>('campaign-save').disabled = !studio || !loaded || busy || dirty();
    for (const id of ['campaign-export-project', 'campaign-export-report'])
      element<HTMLButtonElement>(id).disabled = busy || dirty();
    element<HTMLButtonElement>('campaign-export-checkpoint').disabled =
      busy || dirty() || result.checkpoint === null;
    element('campaign-unsaved').textContent = dirty()
      ? 'Unapplied edits: displayed evidence still belongs to the prior applied project.'
      : 'The editor matches the applied project. Preview state is simulated; use Save project to persist configuration.';
    const term = element<HTMLInputElement>('campaign-search').value.toLowerCase();
    const filter = element<HTMLSelectElement>('campaign-outcome').value;
    const body = element<HTMLTableSectionElement>('campaign-events');
    body.replaceChildren();
    for (const row of result.rows) {
      const text = `${row.index + 1} ${row.event.type} ${row.event.atMs} ${row.outcome} ${row.error ?? ''}`;
      if ((filter !== 'all' && row.outcome !== filter) || !text.toLowerCase().includes(term))
        continue;
      const tr = document.createElement('tr');
      for (const value of [
        row.index + 1,
        row.event.atMs,
        row.event.type,
        row.outcome,
        row.publisher.buffered,
      ]) {
        const td = document.createElement('td');
        td.textContent = String(value);
        tr.append(td);
      }
      const details = document.createElement('td'),
        button = document.createElement('button');
      button.textContent = `Inspect event ${row.index + 1}`;
      button.addEventListener('click', () => {
        element('campaign-detail').textContent = JSON.stringify(row, null, 2);
      });
      details.append(button);
      tr.append(details);
      body.append(tr);
    }
    element('campaign-filter-count').textContent =
      `${body.childElementCount} of ${result.rows.length} replayed events shown; exports retain the full selected prefix.`;
    element('campaign-snapshot').textContent = JSON.stringify(
      { snapshot: result.snapshot, statistics: result.statistics },
      null,
      2,
    );
    element('campaign-detail').textContent = result.rows.length
      ? 'Choose an event to inspect original data, counters, state and any rejection.'
      : 'No events replayed yet.';
  }
  function apply(project: CampaignProject, text = 'Project applied; replay cursor reset.'): void {
    applied = project;
    editor.value = serialized();
    cursor = 0;
    result = replayProject(applied, cursor);
    element<HTMLSelectElement>('campaign-prepared').value = '';
    for (const name of [
      'title',
      'groupId',
      'nodeId',
      'capacity',
      'restoreCapacity',
      'ttlMs',
      'overflowPolicy',
    ] as const) {
      const control = settings.elements.namedItem(name);
      if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement)
        control.value = String(applied[name]);
    }
    notice(text);
    render();
  }
  function action(work: () => void): void {
    try {
      if (busy)
        throw new Error(
          'Finish the accepted local file operation before editing the applied project.',
        );
      work();
    } catch (failure: unknown) {
      rejected(failure);
    } finally {
      render();
    }
  }
  async function local(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    render();
    try {
      await work();
    } catch (failure: unknown) {
      rejected(failure);
    } finally {
      busy = false;
      render();
    }
  }
  editor.addEventListener('input', render);
  element('campaign-apply').addEventListener('click', () =>
    action(() => {
      if (formDirty())
        throw new Error('Apply form settings or explicitly discard them before applying JSON.');
      apply(parseProject(editor.value));
    }),
  );
  element('campaign-discard').addEventListener('click', () =>
    action(() => apply(applied, 'Unapplied JSON edits explicitly discarded.')),
  );
  settings.addEventListener('submit', (event) => {
    event.preventDefault();
    action(() => {
      if (jsonDirty())
        throw new Error('Apply or discard JSON edits before applying form settings.');
      apply(parseProject(JSON.stringify(currentSettings())));
    });
  });
  settings.addEventListener('input', render);
  settings.addEventListener('change', render);
  element<HTMLSelectElement>('campaign-prepared').addEventListener('change', (event) =>
    action(() => {
      requireApplied();
      const value = (event.target as HTMLSelectElement).value;
      if (value === 'cold-chain' || value === 'factory' || value === 'utility')
        apply(
          preparedProject(value),
          'Prepared input applied. Edit its real events/configuration before replay.',
        );
    }),
  );
  for (const [id, offset] of [
    ['campaign-back', -1],
    ['campaign-next', 1],
    ['campaign-run', 0],
  ] as const)
    element(id).addEventListener('click', () =>
      action(() => {
        requireApplied();
        cursor = offset === 0 ? applied.events.length : cursor + offset;
        result = replayProject(applied, cursor);
        notice('Original lifecycle engine replayed this exact event prefix.');
      }),
    );
  element('campaign-search').addEventListener('input', render);
  element('campaign-outcome').addEventListener('change', render);
  element('campaign-load').addEventListener('click', () => {
    void local(async () => {
      if (!studio)
        throw new Error(
          'Browser mode is memory-only. Import/export project files or use the native application.',
        );
      requireApplied();
      const saved = await studio.load();
      revision = saved.revision;
      loaded = true;
      if (saved.project)
        apply(
          saved.project,
          'Saved project loaded. Replay again to inspect its actual engine results.',
        );
      else
        notice(
          'No saved project yet. Current configuration is unchanged; Save is now authorized for this revision.',
        );
    });
  });
  element('campaign-save').addEventListener('click', () => {
    void local(async () => {
      if (!studio || !loaded) throw new Error('Load the saved revision before Save.');
      requireApplied();
      const saved = await studio.save({ revision, serialized: serialized() });
      revision = saved.revision;
      notice('Current project saved locally. Existing previous revision was retained.');
    });
  });
  element('campaign-import').addEventListener('click', () => {
    void local(async () => {
      requireApplied();
      if (studio) {
        const content = await studio.import();
        if (content !== null)
          apply(parseProject(content), 'Imported configuration applied, not saved.');
      } else element<HTMLInputElement>('campaign-import-file').click();
    });
  });
  element<HTMLInputElement>('campaign-import-file').addEventListener('change', (event) => {
    void local(async () => {
      requireApplied();
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 65_536) throw new Error('Campaign import exceeds 64 KiB.');
      apply(
        parseProject(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())),
        'Imported configuration applied, not saved.',
      );
      (event.target as HTMLInputElement).value = '';
    });
  });
  for (const kind of ['project', 'report', 'checkpoint'] as const)
    element('campaign-export-' + kind).addEventListener('click', () => {
      void local(async () => {
        requireApplied();
        if (studio) {
          if (await studio.export({ kind, serialized: serialized(), cursor }))
            notice(`New ${kind} file saved.`);
        } else {
          const content =
            kind === 'project'
              ? serialized()
              : kind === 'report'
                ? JSON.stringify({ project: applied, replay: result }, null, 2)
                : result.checkpoint;
          if (content === null) throw new Error('Replay a disconnected checkpoint event first.');
          const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'mqtt-' + kind + '.json';
          link.click();
          URL.revokeObjectURL(url);
          notice(`Browser ${kind} download requested.`);
        }
      });
    });
  element('campaign-quit').addEventListener('click', () => {
    void local(async () => {
      if (!studio)
        throw new Error('Close this browser tab. Native Quit is available inside the application.');
      await studio.quit();
    });
  });
  const help = element<HTMLDialogElement>('campaign-help');
  element('campaign-help-open').addEventListener('click', () => help.showModal());
  element('campaign-help-close').addEventListener('click', () => help.close());
  apply(applied);
}
