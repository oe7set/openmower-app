'use client';

import {createContext, useContext, type RefObject} from 'react';

// AppShell exposes the <main> element so chrome components (currently the
// auto-hide TopBar) can listen for scroll events on the actual content
// scroller instead of window — main has overflow: auto, the document does
// not scroll on its own.
type ScrollContainerRef = RefObject<HTMLElement | null>;

const ScrollContainerContext = createContext<ScrollContainerRef | null>(null);

export const ScrollContainerProvider = ScrollContainerContext.Provider;

export function useScrollContainerRef(): ScrollContainerRef | null {
  return useContext(ScrollContainerContext);
}
