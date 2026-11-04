import { useEffect, useRef } from 'react';
import { Button, Card, DefinitionList, Flex, Label, Link, Text } from '@gravity-ui/uikit';
import type { MapPoint } from '../shared/catalog';
import { specialtyColor } from './palette';

export function PointCard({ point, onClose }: { point: MapPoint; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, [point.id]);
  return <Card className="point-card" view="raised" ref={ref} tabIndex={-1} role="region" aria-label="Информация о площадке" onKeyDown={event => {
    if (event.key === 'Escape') onClose();
  }}>
    <Flex direction="column" gap="spacing-4">
      <Flex alignItems="center" justifyContent="space-between" gap="spacing-2"><Text variant="caption-2" color="secondary">Занятия для детей</Text><Button view="flat" aria-label="Закрыть карточку" onClick={onClose}>×</Button></Flex>
      <Text as="h2" variant="header-2">{point.name}</Text>
      <Flex wrap gap="spacing-2">{point.specialties.map(value => <Label key={value} size="m" icon={<span className="category-dot" style={{ background: specialtyColor(value) }} />}>{value}</Label>)}</Flex>
      <Flex as="section" direction="column" gap="spacing-3" className="source-links"><Text as="h3" variant="subheader-1">Источники</Text>
        {point.sources.length === 0 && <Text color="secondary">Ссылок в поле «Источник» нет.</Text>}
        {point.sources.map((url, index) => <Link key={url} href={url} target="_blank" rel="noopener noreferrer">
          {new URL(url).hostname.replace(/^www\./, '')}{point.sources.length > 1 ? ` · ${index + 1}` : ''} <span aria-hidden="true">↗</span><span className="sr-only"> (откроется в новой вкладке)</span>
        </Link>)}
      </Flex>
      <DefinitionList direction="vertical">
        <DefinitionList.Item name="Тип партнёра">{point.partnerTypes.join(' · ')}</DefinitionList.Item>
        <DefinitionList.Item name="Массовость">{point.scales.join(' · ')}</DefinitionList.Item>
        <DefinitionList.Item name="Частный / государственный">{point.ownerships.join(' · ')}</DefinitionList.Item>
      </DefinitionList>
    </Flex>
  </Card>;
}
