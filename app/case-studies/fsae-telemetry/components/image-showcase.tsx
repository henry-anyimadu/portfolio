'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

export function ImageShowcase() {
    return (
        <section className="py-24">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-24"
            >
                <div>
                    <div className="aspect-video relative rounded-lg overflow-hidden shadow-2xl">
                        <Image
                            src="/public/globe.svg?height=1080&width=1920"
                            alt="Neohaus Configurator Interface"
                            width={1920}
                            height={1080}
                            className="object-cover"
                        />
                    </div>
                    <p className="mt-4 text-sm opacity-75">
                        The configurator interface provides immediate visual feedback
                    </p>
                </div>

                <div>
                    <div className="aspect-video relative rounded-lg overflow-hidden shadow-2xl">
                        <Image
                            src="/public/next.svg?height=1080&width=1920"
                            alt="Neohaus Website Design"
                            width={1920}
                            height={1080}
                            className="object-cover"
                        />
                    </div>
                    <p className="mt-4 text-sm opacity-75">
                        Clean, modern website design reflects the brand's values
                    </p>
                </div>
            </motion.div>
        </section>
    )
}

