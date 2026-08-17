'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomField, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Users,
  Tags,
  Filter,
  Upload,
  GitBranch,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

type AudienceType = 'all' | 'tags' | 'pipeline_stage' | 'custom_field' | 'csv';
type CustomFieldOperator = 'is' | 'is_not' | 'contains';

interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  pipelineId?: string;
  stageId?: string;
  customField?: CustomFieldFilter;
  csvContacts?: {
    phone: string;
    name?: string;
    fields?: Record<string, string>;
  }[];
  excludeTagIds?: string[];
}

interface Step2Props {
  audience: AudienceConfig;
  onUpdate: (audience: AudienceConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

interface PipelineOption {
  id: string;
  name: string;
}

interface PipelineStageOption {
  id: string;
  name: string;
  pipeline_id: string;
  position: number;
}

export function Step2SelectAudience({
  audience,
  onUpdate,
  onNext,
  onBack,
}: Step2Props) {
  const t = useTranslations('Broadcasts.wizard');

  const OPERATOR_OPTIONS = useMemo<
    { value: CustomFieldOperator; label: string }[]
  >(
    () => [
      { value: 'is', label: t('selectAudience.operatorIs') },
      { value: 'is_not', label: t('selectAudience.operatorIsNot') },
      { value: 'contains', label: t('selectAudience.operatorContains') },
    ],
    [t],
  );

  const audienceOptions = useMemo<
    {
      type: AudienceType;
      label: string;
      description: string;
      icon: typeof Users;
    }[]
  >(
    () => [
      {
        type: 'all',
        label: t('selectAudience.method.all'),
        description: t('selectAudience.allDescLoading'),
        icon: Users,
      },
      {
        type: 'tags',
        label: t('selectAudience.method.tags'),
        description: t('selectAudience.tagDesc'),
        icon: Tags,
      },
      {
        type: 'pipeline_stage',
        label: 'Etapa do funil',
        description:
          'Enviar para todos os contatos que estão em uma etapa específica do funil.',
        icon: GitBranch,
      },
      {
        type: 'custom_field',
        label: t('selectAudience.method.customField'),
        description: t('selectAudience.customFieldDesc'),
        icon: Filter,
      },
      {
        type: 'csv',
        label: t('selectAudience.method.csv'),
        description: t('selectAudience.csvDesc'),
        icon: Upload,
      },
    ],
    [t],
  );

  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageOption[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Tags are used by the primary tag filter and by the exclude-list.
  useEffect(() => {
    async function fetchTags() {
      setLoadingTags(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.from('tags').select('*').order('name');
        setTags(data ?? []);
      } finally {
        setLoadingTags(false);
      }
    }

    fetchTags();
  }, []);

  // Lazy-load custom fields only when that audience type is active.
  useEffect(() => {
    if (audience.type !== 'custom_field') return;

    async function fetchFields() {
      setLoadingFields(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .order('field_name');

        setCustomFields(data ?? []);
      } finally {
        setLoadingFields(false);
      }
    }

    fetchFields();
  }, [audience.type]);

  // Load pipelines when the new audience type is selected.
  useEffect(() => {
    if (audience.type !== 'pipeline_stage') return;

    async function fetchPipelines() {
      setLoadingPipelines(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('pipelines')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setPipelines((data ?? []) as PipelineOption[]);
      } catch (error) {
        console.error('Failed to load pipelines:', error);
        setPipelines([]);
      } finally {
        setLoadingPipelines(false);
      }
    }

    fetchPipelines();
  }, [audience.type]);

  // Load stages only for the selected pipeline.
  useEffect(() => {
    if (audience.type !== 'pipeline_stage' || !audience.pipelineId) {
      setPipelineStages([]);
      return;
    }

    async function fetchStages() {
      setLoadingStages(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('pipeline_stages')
          .select('id, name, pipeline_id, position')
          .eq('pipeline_id', audience.pipelineId)
          .order('position');

        if (error) throw error;
        setPipelineStages((data ?? []) as PipelineStageOption[]);
      } catch (error) {
        console.error('Failed to load pipeline stages:', error);
        setPipelineStages([]);
      } finally {
        setLoadingStages(false);
      }
    }

    fetchStages();
  }, [audience.type, audience.pipelineId]);

  const fetchEstimatedCount = useCallback(async () => {
    setLoadingCount(true);

    try {
      const supabase = createClient();

      let baseIds: Set<string> | null = null;

      if (audience.type === 'all') {
        // Full-table count handled below.
      } else if (
        audience.type === 'tags' &&
        audience.tagIds &&
        audience.tagIds.length > 0
      ) {
        const { data } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.tagIds);

        baseIds = new Set(
          (data ?? [])
            .map((row) => row.contact_id)
            .filter((id): id is string => Boolean(id)),
        );
      } else if (
        audience.type === 'pipeline_stage' &&
        audience.pipelineId &&
        audience.stageId
      ) {
        const stageContactIds = new Set<string>();
        const PAGE_SIZE = 1000;
        let offset = 0;

        while (true) {
          const { data: dealRows, error } = await supabase
            .from('deals')
            .select('contact_id')
            .eq('pipeline_id', audience.pipelineId)
            .eq('stage_id', audience.stageId)
            .range(offset, offset + PAGE_SIZE - 1);

          if (error) throw error;

          for (const row of dealRows ?? []) {
            if (row.contact_id) stageContactIds.add(row.contact_id);
          }

          if (!dealRows || dealRows.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }

        baseIds = stageContactIds;
      } else if (
        audience.type === 'custom_field' &&
        audience.customField?.fieldId &&
        audience.customField.value
      ) {
        const { fieldId, operator, value } = audience.customField;

        let query = supabase
          .from('contact_custom_values')
          .select('contact_id')
          .eq('custom_field_id', fieldId);

        if (operator === 'is') query = query.eq('value', value);
        else if (operator === 'is_not') query = query.neq('value', value);
        else query = query.ilike('value', `%${value}%`);

        const { data } = await query;

        baseIds = new Set(
          (data ?? [])
            .map((row) => row.contact_id)
            .filter((id): id is string => Boolean(id)),
        );
      } else if (
        audience.type === 'csv' &&
        audience.csvContacts &&
        audience.csvContacts.length > 0
      ) {
        setEstimatedCount(audience.csvContacts.length);
        return;
      } else {
        setEstimatedCount(null);
        return;
      }

      let excludeSet: Set<string> | null = null;

      if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
        const { data: excludeRows } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.excludeTagIds);

        excludeSet = new Set(
          (excludeRows ?? [])
            .map((row) => row.contact_id)
            .filter((id): id is string => Boolean(id)),
        );
      }

      if (baseIds) {
        const effective = [...baseIds].filter(
          (id) => !excludeSet?.has(id),
        );
        setEstimatedCount(effective.length);
      } else {
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true });

        const total = count ?? 0;
        setEstimatedCount(
          excludeSet ? Math.max(0, total - excludeSet.size) : total,
        );
      }
    } catch (error) {
      console.error('Failed to calculate audience size:', error);
      setEstimatedCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [
    audience.type,
    audience.tagIds,
    audience.pipelineId,
    audience.stageId,
    audience.customField,
    audience.csvContacts,
    audience.excludeTagIds,
  ]);

  useEffect(() => {
    fetchEstimatedCount();
  }, [fetchEstimatedCount]);

  function toggleTag(tagId: string) {
    const current = audience.tagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];

    onUpdate({ ...audience, tagIds: updated });
  }

  function toggleExcludeTag(tagId: string) {
    const current = audience.excludeTagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];

    onUpdate({ ...audience, excludeTagIds: updated });
  }

  function updateCustomField(patch: Partial<CustomFieldFilter>) {
    const previous = audience.customField ?? {
      fieldId: '',
      operator: 'is' as CustomFieldOperator,
      value: '',
    };

    onUpdate({
      ...audience,
      customField: { ...previous, ...patch },
    });
  }

  async function handleCsvFile(file: File | null) {
    if (!file) return;

    const bytes = await file.arrayBuffer();

    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder('windows-1252').decode(bytes);
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      window.alert('O CSV está vazio ou não possui dados.');
      onUpdate({ ...audience, csvContacts: [] });
      return;
    }

    const separator = lines[0].includes(';') ? ';' : ',';

    function parseCsvLine(line: string) {
      const regex = new RegExp(
        `${separator}(?=(?:[^"]*"[^"]*")*[^"]*$)`,
      );

      return line.split(regex).map((value) =>
        value
          .trim()
          .replace(/^"|"$/g, '')
          .replace(/""/g, '"'),
      );
    }

    function normalizeHeader(value: string) {
      return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    }

    const headers = parseCsvLine(lines[0]).map((header) => header.trim());
    const normalizedHeaders = headers.map(normalizeHeader);

    const phoneIndex = normalizedHeaders.findIndex((header) =>
      [
        'telefone',
        'phone',
        'celular',
        'whatsapp',
        'numero',
        'numero de telefone',
      ].includes(header),
    );

    const nameIndex = normalizedHeaders.findIndex((header) =>
      ['nome', 'name'].includes(header),
    );

    if (phoneIndex === -1) {
      window.alert('O CSV precisa ter uma coluna chamada Telefone.');
      onUpdate({ ...audience, csvContacts: [] });
      return;
    }

    const contacts: {
      phone: string;
      name?: string;
      fields?: Record<string, string>;
    }[] = [];

    const seenPhones = new Set<string>();

    for (const line of lines.slice(1)) {
      const columns = parseCsvLine(line);
      const phone = (columns[phoneIndex] ?? '').replace(/\D/g, '');
      const name =
        nameIndex >= 0 ? (columns[nameIndex] ?? '').trim() : '';

      if (!phone || seenPhones.has(phone)) continue;

      seenPhones.add(phone);

      const fields: Record<string, string> = {};

      headers.forEach((header, index) => {
        if (!header) return;
        fields[header] = (columns[index] ?? '').trim();
      });

      contacts.push({
        phone,
        ...(name ? { name } : {}),
        fields,
      });
    }

    onUpdate({
      ...audience,
      csvContacts: contacts,
    });
  }

  const isValid =
    audience.type === 'all' ||
    (audience.type === 'tags' &&
      audience.tagIds &&
      audience.tagIds.length > 0) ||
    (audience.type === 'pipeline_stage' &&
      Boolean(audience.pipelineId) &&
      Boolean(audience.stageId)) ||
    (audience.type === 'custom_field' &&
      Boolean(audience.customField?.fieldId) &&
      Boolean(audience.customField?.value?.length)) ||
    (audience.type === 'csv' &&
      audience.csvContacts &&
      audience.csvContacts.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {t('selectAudience.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('selectAudience.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {audienceOptions.map((option) => {
          const isSelected = audience.type === option.type;
          const Icon = option.icon;

          return (
            <button
              key={option.type}
              onClick={() =>
                onUpdate({
                  ...audience,
                  type: option.type,
                  tagIds:
                    option.type === 'tags' ? audience.tagIds : undefined,
                  pipelineId:
                    option.type === 'pipeline_stage'
                      ? audience.pipelineId
                      : undefined,
                  stageId:
                    option.type === 'pipeline_stage'
                      ? audience.stageId
                      : undefined,
                  customField:
                    option.type === 'custom_field'
                      ? audience.customField
                      : undefined,
                  csvContacts:
                    option.type === 'csv'
                      ? audience.csvContacts
                      : undefined,
                })
              }
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border bg-card/50 hover:border-border'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">
                  {option.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {audience.type === 'tags' && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            {t('selectAudience.selectTags')}
          </p>

          {loadingTags ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : tags.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('selectAudience.noTagsFound')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const isSelected = audience.tagIds?.includes(tag.id);

                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted text-muted-foreground hover:border-border'
                    }`}
                  >
                    <span
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {audience.type === 'pipeline_stage' && (
        <div className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Etapa do funil
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Escolha o funil e a etapa. Cada contato entra apenas uma vez,
              mesmo que tenha mais de uma oportunidade na mesma etapa.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Funil
              </label>
              <select
                value={audience.pipelineId ?? ''}
                onChange={(event) =>
                  onUpdate({
                    ...audience,
                    pipelineId: event.target.value || undefined,
                    stageId: undefined,
                  })
                }
                disabled={loadingPipelines}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                <option value="">
                  {loadingPipelines
                    ? 'Carregando funis...'
                    : 'Selecione o funil...'}
                </option>

                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Etapa
              </label>
              <select
                value={audience.stageId ?? ''}
                onChange={(event) =>
                  onUpdate({
                    ...audience,
                    stageId: event.target.value || undefined,
                  })
                }
                disabled={!audience.pipelineId || loadingStages}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-60"
              >
                <option value="">
                  {!audience.pipelineId
                    ? 'Selecione primeiro o funil'
                    : loadingStages
                      ? 'Carregando etapas...'
                      : 'Selecione a etapa...'}
                </option>

                {pipelineStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {audience.type === 'custom_field' && (
        <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
          <p className="text-sm font-medium text-foreground">
            {t('selectAudience.method.customField')}
          </p>

          {loadingFields ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : customFields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('selectAudience.errorLoadFields')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
              <select
                value={audience.customField?.fieldId ?? ''}
                onChange={(event) =>
                  updateCustomField({ fieldId: event.target.value })
                }
                className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">
                  {t('selectAudience.selectField')}
                </option>

                {customFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.field_name}
                  </option>
                ))}
              </select>

              <select
                value={audience.customField?.operator ?? 'is'}
                onChange={(event) =>
                  updateCustomField({
                    operator: event.target.value as CustomFieldOperator,
                  })
                }
                className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {OPERATOR_OPTIONS.map((operator) => (
                  <option key={operator.value} value={operator.value}>
                    {operator.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={audience.customField?.value ?? ''}
                onChange={(event) =>
                  updateCustomField({ value: event.target.value })
                }
                placeholder={t('selectAudience.valuePlaceholder')}
                className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {audience.type === 'csv' && (
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Importar arquivo CSV
          </label>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              handleCsvFile(event.target.files?.[0] ?? null)
            }
            className="block w-full cursor-pointer rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground"
          />

          <p className="mt-2 text-xs text-muted-foreground">
            O arquivo deve conter uma coluna Telefone. A coluna Nome é
            opcional.
          </p>

          {audience.csvContacts && audience.csvContacts.length > 0 && (
            <p className="mt-2 text-sm font-medium text-foreground">
              {audience.csvContacts.length} contatos carregados.
            </p>
          )}
        </div>
      )}

      {/* Exclude list — applies regardless of audience type */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <X className="h-4 w-4 text-red-400" />
          <p className="text-sm font-medium text-foreground">
            {t('selectAudience.excludeTags')}
          </p>
        </div>

        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('selectAudience.noTagsFound')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isExcluded = audience.excludeTagIds?.includes(tag.id);

              return (
                <button
                  key={tag.id}
                  onClick={() => toggleExcludeTag(tag.id)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isExcluded
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-border bg-muted text-muted-foreground hover:border-border'
                  }`}
                >
                  <span
                    className="mr-1.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Audience Summary */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">
          Audience Summary
        </p>

        {loadingCount ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">
              Calculando…
            </span>
          </div>
        ) : estimatedCount !== null ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground">
              {estimatedCount.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">
              destinatários estimados
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Selecione e configure o público para ver a estimativa.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-border text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Button>

        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t('next')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
