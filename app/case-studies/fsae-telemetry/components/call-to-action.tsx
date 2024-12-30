'use client'

import { ImageShowcase } from './image-showcase'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

export function CallToAction() {
    const [canScrollPage, setCanScrollPage] = useState(false)

    useEffect(() => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setCanScrollPage(true)
            }
          },
          { threshold: 1 }
        )
    
        return () => observer.disconnect()
      }, [])

    return (
        <section className={`z-20 py-24 border-t border-white/10 transition-opacity duration-500 ${canScrollPage ? 'opacity-0' : 'opacity-100'}`}>
        <div className="max-w-2xl">
          <h2 className="text-3xl font-light mb-8">Explore the project</h2>
          <p className="text-lg opacity-75 mb-12">
            Discover how we're making space exploration data more accessible 
            and meaningful for everyone.
          </p>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-px bg-white/50" />
              <p className="text-sm">
                <span className="opacity-50">Data Points Visualized</span>
                <br />
                <span className="text-xl">1M+</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-20 h-px bg-white/50" />
              <p className="text-sm">
                <span className="opacity-50">Active Researchers</span>
                <br />
                <span className="text-xl">5,000+</span>
              </p>
            </div>
          </div>
        </div>
      </section>
    )
}

