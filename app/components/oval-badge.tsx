"use client"

import { motion } from 'framer-motion'
import { FC } from 'react'
import { BadgeType } from '../types/badgeType'


interface OvalBadgeProps {
  data: BadgeType
}

const OvalBadge: FC<OvalBadgeProps> = ({ data }) => {
  const { name, color } = data

  return (
    <motion.div
      className="inline-block"
      whileHover={{ scale: 1.1 }}
      transition={{ type: "spring", stiffness: 200, damping: 10 }}
    >
      <div 
        className={`px-4 py-2 rounded-full text-sm font-semibold text-white shadow-lg`}
        style={{ 
          backgroundColor: color,
          boxShadow: `0 0 5px ${color}80` // 80 adds 50% opacity to the glow color
        }}
      >
        {name}
      </div>
    </motion.div>
  )
}

export default OvalBadge

