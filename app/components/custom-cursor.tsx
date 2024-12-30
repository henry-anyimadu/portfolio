import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect } from 'react'

interface CustomCursorProps {
  isHovered: boolean
}

export function CustomCursor({ isHovered }: CustomCursorProps) {
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)

  const springConfig = { damping: 25, stiffness: 700 }
  const cursorXSpring = useSpring(cursorX, springConfig)
  const cursorYSpring = useSpring(cursorY, springConfig)

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
    }

    window.addEventListener('mousemove', moveCursor)
    return () => {
      window.removeEventListener('mousemove', moveCursor)
    }
  }, [cursorX, cursorY])

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-50 mix-blend-difference"
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
      }}
    >
      <motion.div
        animate={{
          width: isHovered ? 120 : 24,
          height: isHovered ? 120 : 24,
          backgroundColor: isHovered ? 'white' : '#FF9919',
        }}
        transition={{ duration: 0.2 }}
        className="relative rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
      >
        {isHovered && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-black text-sm font-medium"
          >
            Click for more
          </motion.span>
        )}
      </motion.div>
    </motion.div>
  )
}

