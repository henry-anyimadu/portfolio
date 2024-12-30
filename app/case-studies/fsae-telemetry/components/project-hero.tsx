import OvalBadge from '@/app/components/oval-badge'

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
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-light leading-tight">
                    McLaren Technology
                </h1>
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-light leading-tight">
                    on a Honda Budget
                </h1>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif italic opacity-75">
                    WashU Racing Live Telemetry
                </h2>
                <div className="flex flex-wrap gap-4">
                    {techStack.map((badge, index) => (
                <OvalBadge key={index} data={badge} />
          ))}
        </div>
            </div>
        </section>
    )
}

