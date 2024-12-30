import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Navigation } from './components/navigation'
import { ProjectHero } from './components/project-hero'
import { ContentSection } from './components/content-section'
import { ImageShowcase } from './components/image-showcase'
import { CallToAction } from './components/call-to-action'

export default function CaseStudy() {
    return (
        <div className="min-h-screen bg-[#1C1C1C] text-white">
            <div className="max-w-[1800px] mx-auto px-6 md:px-12">
                {/* Header */}
                <header className="py-8 flex justify-between items-center">
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

                <ProjectHero />

                <ContentSection />

                <ImageShowcase />

                <CallToAction />
            </div>
        </div>
    )
}

