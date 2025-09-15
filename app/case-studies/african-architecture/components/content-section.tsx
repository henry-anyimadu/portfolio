'use client'
import { AnimatedText } from "@/app/components/animated-text";

export function ContentSection() {
    return (
        <section className="py-24">
            <div className="space-y-16">
                <div>
                    <AnimatedText>
                    <h2 className="text-4xl md:text-5xl font-light mb-8">
                        Understanding UX Research and Design
                    </h2>
                    </AnimatedText>
                    <AnimatedText>
                    <p className="text-lg leading-relaxed opacity-75">
                        After discovering the works of Ghanaian architect David Adjaye, I set out to create an application to build a database of his works. I started with physical wireframes, and then translated that to a mobile format. This project deepened my experience in UX Research, and I enjoyed the process of experimenting with different color palletes, typefaces, and user journeys.
                    </p>
                    </AnimatedText>
                    <br />
                </div>
                
                <div className="w-full h-[600px]">
                    <div className="w-full h-full">
                        <iframe style={{border: "1px solid rgba(0, 0, 0, 0.1)"}} width="100%" height="100%" src="https://embed.figma.com/proto/HBdI0xhe3W431f2PuVIw4b/Site-App-Project---Anyimadu?node-id=50-1040&p=f&scaling=scale-down&content-scaling=fixed&page-id=50%3A611&starting-point-node-id=180%3A2&embed-host=share" allowFullScreen></iframe>
                    </div>
                </div>
            </div>
        </section>
    )
}
