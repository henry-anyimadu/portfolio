
'use client'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ProjectHero } from './components/project-hero'
import { ContentSection } from './components/content-section'
import { ImageShowcase } from './components/image-showcase'
import { CustomCursor } from '@/app/components/custom-cursor'
import ThemeToggle from '@/app/components/theme-toggle'
import Link from 'next/link'

export default function CaseStudy() {
    const [isItemHovered, setIsItemHovered] = useState(false)
    return (
        <>
            <CustomCursor isHovered={isItemHovered} />
            <ThemeToggle />
            <div className="min-h-screen cursor-none items-center">
                <div className="max-w-[1800px] items-center mx-auto px-6 md:px-12">
                    {/* Header */}
                    <header className="py-8 flex justify-between">
                        <div className="flex items-center gap-12">
                            <Link
                                href="/"
                                className="hover:opacity-75 transition-opacity"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </Link>
                            <p className="text-sm tracking-wide">
                                Digital storytelling for the modern age
                            </p>
                        </div>
                        <div className="text-md italic font-bold">anyimadu</div>
                    </header>

                    <div className="flex flex-col w-4/5 mx-auto content-center">
                        <ProjectHero />
                        <ContentSection />
                        <div
                            onMouseEnter={() => setIsItemHovered(true)}
                            onMouseLeave={() => setIsItemHovered(false)}
                        >
                            <ImageShowcase />
                        </div>
                        <div className="h-screen lg:h-0"></div>
                    </div>
                </div>
            </div>
        </>
    )
}
