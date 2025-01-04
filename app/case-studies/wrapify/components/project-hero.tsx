import OvalBadge from '@/app/components/oval-badge'
import { AnimatedText } from '@/app/components/animated-text'

const techStack = [
    {name: "Vue.js", color: "#42b883"},
    {name: "Python", color: "#FFD43B"},
    {name: "Arduino C", color: "#4FCCF3"},
    {name: "Redis", color: "#D82C20"},
    {name: "FastAPI", color: "#4db894"},
    {name: "REST APIs", color: "#87CEEB"},
]
export function ProjectHero() {
    return (
        <section className="pt-24 pb-4">
            <div className="space-y-6">
                <AnimatedText>
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-light leading-tight">
                    Spotify Broke Wrapped
                </h1>
                </AnimatedText>
                <AnimatedText>
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-light leading-tight">
                    so I Fixed It
                </h1>
                </AnimatedText>
                <AnimatedText>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif italic opacity-75">
                    Wrapify - Your Actual Spotify Wrapped
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

