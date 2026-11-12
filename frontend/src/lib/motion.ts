import type { Transition, Variants } from 'motion/react'

/** Shared easing curves. Keep motion consistent across every surface. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]
export const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1]
export const EASE_SOFT: [number, number, number, number] = [0.22, 0.61, 0.36, 1]

export const springSoft: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }
export const springSnappy: Transition = { type: 'spring', stiffness: 620, damping: 38, mass: 0.7 }

/** Route-level fade with a small rise; fast enough to never feel like a gate. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: EASE_IN } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35, ease: EASE_OUT } },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.44, ease: EASE_OUT } },
}

export const fadeUpSmall: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.03 } },
}

export const staggerFast: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14, ease: EASE_IN } },
}

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
}

export const modalPanel: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.975 },
  show: { opacity: 1, y: 0, scale: 1, transition: springSoft },
  exit: { opacity: 0, y: 10, scale: 0.985, transition: { duration: 0.16, ease: EASE_IN } },
}

export const drawerFromRight: Variants = {
  hidden: { x: '100%' },
  show: { x: 0, transition: springSoft },
  exit: { x: '100%', transition: { duration: 0.2, ease: EASE_IN } },
}

export const drawerFromLeft: Variants = {
  hidden: { x: '-100%' },
  show: { x: 0, transition: springSoft },
  exit: { x: '-100%', transition: { duration: 0.2, ease: EASE_IN } },
}

export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: springSnappy },
  exit: { opacity: 0, x: 24, transition: { duration: 0.18, ease: EASE_IN } },
}

export const expandVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  show: { height: 'auto', opacity: 1, transition: { duration: 0.28, ease: EASE_OUT } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: EASE_IN } },
}
