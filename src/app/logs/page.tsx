'use client';

import LogsView from '@/components/logs/LogsView';
import {Page, PageContent, PageHeader} from '@/components/page';

export default function LogsPage() {
  return (
    <Page>
      <PageHeader title="Logs" subtitle="Tail recent log entries from the mower stack." />
      <PageContent>
        <LogsView />
      </PageContent>
    </Page>
  );
}
