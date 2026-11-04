import { useId } from 'react';
import { Button, Checkbox, Flex, Text, TextInput } from '@gravity-ui/uikit';
import { facets, type Facet, type Filters as FilterState, type facetOptions } from './filtering';
import { specialtyColor } from './palette';

interface Props {
  filters: FilterState;
  options: ReturnType<typeof facetOptions>;
  query: string;
  onQuery: (query: string) => void;
  onToggle: (facet: Facet, value: string) => void;
  onReset: () => void;
}

export function Filters({ filters, options, query, onQuery, onToggle, onReset }: Props) {
  const searchId = useId();
  const active = Object.values(filters).reduce((count, values) => count + values.length, 0) + Number(Boolean(query));
  return <Flex direction="column" gap="spacing-5">
    <Flex alignItems="center" justifyContent="space-between" gap="spacing-2"><Text as="h2" variant="subheader-2">Подобрать занятия</Text><Button size="s" view="flat-secondary" onClick={onReset} disabled={!active}>Сбросить</Button></Flex>
    <Flex direction="column" gap="spacing-2"><Text as="label" htmlFor={searchId} variant="caption-2" color="secondary">Поиск по названию</Text>
      <TextInput id={searchId} type="search" size="l" hasClear placeholder="Название студии" value={query} onUpdate={onQuery} />
    </Flex>
    {facets.map(({ key, label }) => <fieldset className="filter-fieldset" key={key}>
      <Text as="legend" variant="subheader-1" color="secondary">{label}</Text>
      <Flex direction="column" gap="spacing-3">
        {options[key].map(({ value, count }) => <Flex key={value} alignItems="baseline" gap="spacing-2">
          <Checkbox className="facet-checkbox" size="l" checked={filters[key].includes(value)} onUpdate={() => onToggle(key, value)}>
            {key === 'specialties' && <span className="category-dot" style={{ background: specialtyColor(value) }} aria-hidden="true" />}{value}
          </Checkbox>
          <Text className="option-count" variant="caption-1" color="secondary" aria-hidden="true">{count}</Text>
        </Flex>)}
      </Flex>
    </fieldset>)}
  </Flex>;
}
