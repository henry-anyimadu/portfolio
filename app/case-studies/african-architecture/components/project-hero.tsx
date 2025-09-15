'use client'
import OvalBadge from '@/app/components/oval-badge'
import { AnimatedText } from '@/app/components/animated-text'

const techStack = [
    {name: "Figma", color: "#F24E1E"},
    {name: "UX Design", color: "#684503"}
]
export function ProjectHero() {
    return (
        <section className="pt-24 pb-4">
            <div className="space-y-6">
                <AnimatedText>
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-light leading-tight">
                    African Architecture iOS App
                </h1>
                </AnimatedText>
                <AnimatedText>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif italic opacity-75">
                    Figma UI/UX Design through the lens of African Architecture
                </h2>
                </AnimatedText>
                <div className="flex flex-wrap gap-4">
                    {techStack.map((badge, index) => (
                    <OvalBadge key={index} data={badge} />
                    ))}
                </div>
            </div>
        </section>
    )
}
