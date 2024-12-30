'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'

const images = [
    '/dashboardscreenshot.png?height=1080&width=1920',
    '/racecar.jpg?height=1080&width=1920',
    '/dashboardscreenshot.png?height=1080&width=1920',
    '/dashboardscreenshot.png?height=1080&width=1920',
    '/dashboardscreenshot.png?height=1080&width=1920',
  ]

export function ImageShowcase() {
const containerRef = useRef<HTMLDivElement>(null)
  const imagesRef = useRef<HTMLDivElement>(null)
  const [canScrollPage, setCanScrollPage] = useState(false)

  const { scrollYProgress } = useScroll({
    target: imagesRef,
    offset: ["start end", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '-20%'])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCanScrollPage(true)
        }
      },
      { threshold: 1 }
    )

    if (imagesRef.current) {
      observer.observe(imagesRef.current)
    }

    return () => observer.disconnect()
  }, [])
    return (
        <div className="w-full lg:w-1/3 lg:fixed lg:top-0 lg:mt-12 lg:right-0 lg:bottom-0 overflow-y-auto overflow-x-auto lg:overflow-x-hidden" ref={imagesRef}>
            <motion.div 
              className="flex lg:flex-col gap-4 py-12 lg:py-24"
              style={{ y }}
            >
              {images.map((src, index) => (
                <div key={index} className="w-[80vw] lg:w-full flex-shrink-0">
                  <div className="aspect-video relative rounded-lg overflow-hidden shadow-2xl">
                    <Image
                      src={src}
                      alt={`NASA Project Image ${index + 1}`}
                      layout="fill"
                      objectFit="cover"
                    />
                  </div>
                  <p className="mt-4 text-sm opacity-75">
                    {`Image caption for NASA project visualization ${index + 1}`}
                  </p>
                </div>
              ))}
            </motion.div>
        </div>

    )
}

