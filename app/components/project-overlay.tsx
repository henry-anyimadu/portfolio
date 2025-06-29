'use client'

import { motion } from 'framer-motion'
import Link from 'next/link';
import { X } from 'lucide-react'
import { useState } from 'react'


interface Project {
  title: string
  color: string
  route: string
}

const projects: Project[] = [
  {
    title: 'NASA Planetary Data System - Geosciences Node',
    color: 'bg-blue-700',
    route: '/case-studies/nasa'
  },
  {
    title: 'WashU Formula Student Telemetry System',
    color: 'bg-yellow-500',
    route: '/case-studies/fsae-telemetry'
  },
  {
    title: 'Social Fabric - Consumer Social Tech Startup',
    color: 'bg-red-500',
    route: 'https://www.whatsfabric.com'
  },
  {
    title: 'Wrapify - Your Actual Spotify Wrapped',
    color: 'bg-green-600',
    route: 'https://github.com/henry-anyimadu/better-spotify-wrapped'

  },
]

interface ProjectOverlayProps {
  isOpen: boolean
  onClose: () => void
  setIsItemHovered: (value: boolean) => void
}

export function ProjectOverlay({ isOpen, onClose, setIsItemHovered }: ProjectOverlayProps) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: isOpen ? '0%' : '100%' }}
      transition={{ type: 'spring', duration: 0.6 }}
      className="fixed inset-y-0 right-0 sm:w-full md:w-1/3 bg-[#090909] p-8 shadow-xl rounded-2xl"
    >
       <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close overlay"
        >
          <X size={24} color="white" />
        </button>
      <div className="space-y-8">
        {projects.map((project) => (
          <Link
            href={project.route}
            key={project.title}
            className="flex items-center gap-6 hover:bg-gray-800/50 p-4 rounded-xl transition-colors"
            onMouseEnter={() => setIsItemHovered(true)}
            onMouseLeave={() => setIsItemHovered(false)}
          >
            <div className={`w-48 h-32 rounded-xl ${project.color} shadow-lg`} />
            <h3 className="text-2xl font-medium text-white">{project.title}</h3>
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

