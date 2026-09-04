import { motion } from 'framer-motion'

/**
 * Shared "sticker" primitive — faces AND ingredient art reuse it.
 * CSS drop-shadow ring (portable, Safari-safe) instead of an SVG
 * feMorphology filter. Wiggle via Framer Motion.
 */

export const wiggleVariants = {
  wiggle: (i: number) => ({
    rotate: [-1.5, 1.5, -1, 1, -1.5],
    scale: [1, 1.02, 1, 1.02, 1],
    transition: {
      duration: 0.55,
      repeat: Infinity,
      ease: 'easeInOut' as const,
      delay: (i % 8) * 0.07,
    },
  }),
  still: { rotate: 0, scale: 1 },
}

const STICKER_FILTER =
  'drop-shadow(2.5px 0 0 #fff) drop-shadow(-2.5px 0 0 #fff) drop-shadow(0 2.5px 0 #fff) drop-shadow(0 -2.5px 0 #fff)'

interface Props {
  src: string
  alt: string
  size: number
  index?: number
  wiggle?: boolean
}

export function StickerImg({ src, alt, size, index = 0, wiggle = true }: Props) {
  return (
    <motion.img
      src={src}
      alt={alt}
      custom={index}
      variants={wiggleVariants}
      animate={wiggle ? 'wiggle' : 'still'}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: STICKER_FILTER,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    />
  )
}
