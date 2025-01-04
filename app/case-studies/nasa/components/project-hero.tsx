import OvalBadge from '@/app/components/oval-badge'
import { AnimatedText } from '@/app/components/animated-text'

const techStack = [
    {name: "Python", color: "#FFD43B"},
    {name: "Git Flow", color: "#4db894"},
    {name: "Research", color: "#4FCCF3"},
    {name: "Jupyter Notebooks", color: "#87CEEB"},
]
export function ProjectHero() {
    return (
        <section className="pt-24 pb-4">
            <div className="space-y-6">
                <AnimatedText>
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-light leading-tight">
                    Mars Mission Data
                </h1>
                </AnimatedText>
                <AnimatedText>
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-light leading-tight">
                    Back Down to Earth
                </h1>
                </AnimatedText>
                <AnimatedText>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif italic opacity-75">
                    NASA Planetary Data System - Geosciences Node
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

