import React, { Suspense, lazy } from 'react';

// Lazy load framer-motion components
const MotionDiv = lazy(() =>
  import('framer-motion').then(module => ({ default: module.motion.div }))
);

const MotionSpan = lazy(() =>
  import('framer-motion').then(module => ({ default: module.motion.span }))
);

const MotionButton = lazy(() =>
  import('framer-motion').then(module => ({ default: module.motion.button }))
);

// Wrapper components with loading fallback
export const MotionDivWrapper = React.memo((props: any) => (
  <Suspense fallback={<div {...props} />}>
    <MotionDiv {...props} />
  </Suspense>
));

export const MotionSpanWrapper = React.memo((props: any) => (
  <Suspense fallback={<span {...props} />}>
    <MotionSpan {...props} />
  </Suspense>
));

export const MotionButtonWrapper = React.memo((props: any) => (
  <Suspense fallback={<button {...props} />}>
    <MotionButton {...props} />
  </Suspense>
));

// Lazy load AnimatePresence
export const AnimatePresence = lazy(() =>
  import('framer-motion').then(module => ({ default: module.AnimatePresence }))
);

export const AnimatePresenceWrapper = React.memo((props: any) => (
  <Suspense fallback={<>{props.children}</>}>
    <AnimatePresence {...props} />
  </Suspense>
));

MotionDivWrapper.displayName = 'MotionDivWrapper';
MotionSpanWrapper.displayName = 'MotionSpanWrapper';
MotionButtonWrapper.displayName = 'MotionButtonWrapper';
AnimatePresenceWrapper.displayName = 'AnimatePresenceWrapper';
