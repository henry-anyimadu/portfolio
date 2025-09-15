'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useScroll } from 'framer-motion'
import { ImageOverlay } from '@/app/components/image-overlay'
import { ProjectImages } from '@/app/types/projectImages'

const images: ProjectImages[] = [
    {
        src: '/ArchitectureHero.png',
        alt: 'African Architecture Title Card',
        caption: 'Final Result displaying the work of Adjaye Associates'
    },
    {
        src: '/FirstDraft.png',
        alt: 'Rough Sketches',
        caption: 'Initial rough sketches'
    },
    {
        src: '/typog.png',
        alt: 'Final Typography',
        caption: 'Final color pallete and typography'
    },
    {
        src: '/DigitalWireframes.png',
        alt: 'Digital Wireframes',
        caption: 'First digital wireframes'
    },
    {
        src: '/ImageTreatment.png',
        alt: 'Image Treatment png',
        caption: 'First foray into Visual Design System experimentation, focusing on color pallete and image treatment'
    },

  ]

export function ImageShowcase() {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const scrollRef = useRef(null)
  const { scrollXProgress } = useScroll({ container: scrollRef })

    return (
        <div className="w-full py-12 bg-orange-100 dark:bg-gray-800 rounded-3xl">
            <div className="overflow-x-auto" ref={scrollRef}>
                <div className="flex flex-row gap-8">
                  {images.map((image, index) => (
                    <div key={index} className="w-[80vw] md:w-[40vw] flex-shrink-0">
                      <div 
                        className="aspect-video relative rounded-lg overflow-hidden shadow-2xl cursor-pointer" 
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
                </div>
            </div>
            <div className="h-1 w-full bg-gray-200 dark:bg-gray-800 rounded-full mt-8">
                <motion.div
                    className="h-1 bg-orange-500 rounded-full"
                    style={{ scaleX: scrollXProgress, transformOrigin: 'left' }}
                />
            </div>
              
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
