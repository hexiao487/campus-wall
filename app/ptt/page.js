'use client';

import { Suspense } from 'react';
import PttClient from './PttClient';

export default function PttPage() {
  return (
    <Suspense fallback={<div className="shell"><div className="empty">加载中…</div></div>}>
      <PttClient />
    </Suspense>
  );
}
