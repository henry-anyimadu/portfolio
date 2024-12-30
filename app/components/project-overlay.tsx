'use client'

import { motion } from 'framer-motion'

interface Project {
  title: string
  color: string
}

const projects: Project[] = [
  {
    title: 'NASA Planetary Data System',
    color: 'bg-red-500',
  },
  {
    title: 'WashU Formula Student Telemetry System',
    color: 'bg-green-900',
  },
  {
    title: 'Social Fabric - Stitching Society Together',
    color: 'bg-gray-400',
  },
  {
    title: 'Wrapify - Your Actual Spotify',
    color: 'bg-black',
  },
]

interface ProjectOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export function ProjectOverlay({ isOpen, onClose }: ProjectOverlayProps) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: isOpen ? '0%' : '100%' }}
      transition={{ type: 'spring', duration: 0.2 }}
      className="fixed inset-y-0 right-0 w-1/3 bg-[#090909] p-8 shadow-xl rounded-2xl"
    >
      <div className="space-y-8">
        {projects.map((project) => (
          <div key={project.title} className="flex items-center gap-6">
            <div className={`w-48 h-32 rounded-xl ${project.color} shadow-lg`} />
            <h3 className="text-2xl font-medium text-white">{project.title}</h3>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

