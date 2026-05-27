'use client';

// Stub — implemented in Task 3

import React from 'react';
import { Annotation } from './VideoPlayerClient';

interface AnnotationPanelProps {
  videoId: string;
  annotations: Annotation[];
  accessToken: string;
  apiUrl: string;
  onAnnotationsChange: (a: Annotation[]) => void;
  status?: string;
}

export function AnnotationPanel(_props: AnnotationPanelProps) {
  return <div />;
}
