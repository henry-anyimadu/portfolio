'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { ImageOverlay } from '@/app/components/image-overlay'
import { ProjectImages } from '@/app/types/projectImages'

const images: ProjectImages[] = [
    {
        src: '/dashboardscreenshot.png?height=1080&width=1920',
        alt: 'NASA Project Image 1',
        caption: 'Image caption for NASA project visualization'
    },
    {
        src: '/racecar.jpg?height=1080&width=1920',
        alt: 'NASA Project Image 1',
        caption: 'Image caption for NASA project visualization'
    },
    {
        src: '/dashboardscreenshot.png?height=1080&width=1920',
        alt: 'NASA Project Image 1',
        caption: 'Image caption for NASA project visualization'
    },
    {
        src: '/dashboardscreenshot.png?height=1080&width=1920',
        alt: 'NASA Project Image 1',
        caption: 'Image caption for NASA project visualization'
    },
    {
        src: '/dashboardscreenshot.png?height=1080&width=1920',
        alt: 'NASA Project Image 1',
        caption: 'Image caption for NASA project visualization'
    },
  ]

export function ImageShowcase() {
const containerRef = useRef<HTMLDivElement>(null)
  const imagesRef = useRef<HTMLDivElement>(null)
  const [canScrollPage, setCanScrollPage] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)

  const { scrollYProgress } = useScroll({
    target: imagesRef,
    offset: ["start end", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ['-140%', '40%'])

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
        <div className="w-full lg:w-1/3 lg:fixed lg:top-[24px] lg:mt-12 lg:right-0 lg:bottom-0 overflow-y-auto overflow-x-auto lg:overflow-x-hidden" ref={imagesRef}>
            <motion.div 
              className="flex lg:flex-col gap-4 py-12 lg:py-24"
              style={{ y }}
            >
              {images.map((image, index) => (
                <div key={index} className="w-[80vw] lg:w-full flex-shrink-0">
                  <div 
                    className="aspect-video relative rounded-lg overflow-hidden shadow-2xl" 
                    onClick={() => setSelectedImageIndex(index)}>
                    <Image
                      src={image.src}
                      alt={image.alt}
                      layout="fill"
                      objectFit="cover"
                    />
                  </div>
                  <p className="mt-4 text-sm opacity-75">
                    {`${index + 1} / ${images.length}: ${image.caption}`}
                  </p>
                </div>
              ))}
            </motion.div>
            
    <AnimatePresence>
        {selectedImageIndex !== null && (
          <ImageOverlay
            images={images}
            initialIndex={selectedImageIndex}
            onClose={() => setSelectedImageIndex(null)}
          />
        )}
      </AnimatePresence>
        </div>
    )
}

