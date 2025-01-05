import { AnimatedText } from "@/app/components/animated-text";

export function ContentSection() {
    return (
        <section className="py-24 max-w-4xl">
            <div className="space-y-16">
                <div>
                    <AnimatedText>
                    <h2 className="text-4xl md:text-5xl font-light mb-8">
                        Undergraduate Research and Software Engineering
                    </h2>
                    </AnimatedText>
                    <AnimatedText>
                    <p className="text-lg leading-relaxed opacity-75">
                    The NASA Planetary Data System - Geosciences Node is the home of NASA&apos;s Geoscientific mission data. Data from satellites, Mars Rovers, and lunar
                    landers are stored here. However, The image data was all stored in a low-quality JPEG format, making it difficult for researchers to analyze.
                    </p>
                    </AnimatedText>
                    <br />
                    <br />
                    <AnimatedText>
                    <p className="text-lg leading-relaxed opacity-75">
                    To combat this issue, I developed a Python script that converts these images into a high-quality PNG or TIFF format. This script was made accessible to researchers
                    across the other Planetary Data System nodes, allowing for a more in-depth analysis of the worlds beyond our own.
                    </p>
                    </AnimatedText>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                        <AnimatedText>
                        <h3 className="text-xl font-medium mb-4">Challenge</h3>
                        </AnimatedText>
                        <AnimatedText>
                        <p className="opacity-75">
                            Create a system to transform planetary mission data into high-quality images for research and education.
                        </p>
                        </AnimatedText>
                    </div>
                    <div>
                        <AnimatedText>
                        <h3 className="text-xl font-medium mb-4">Solution</h3>
                        <p className="opacity-75">
                            An easy-to-use Jupyter Notebook, compatible with mission data across the Planetary Data System.      
                        </p>
                        </AnimatedText>
                    </div>
                    <div>
                        <AnimatedText>
                        <h3 className="text-xl font-medium mb-4">Outcome</h3>
                        <p className="opacity-75">
                            All of the mission data from the Curiosity and Perseverance rovers are now available in high-quality PNG and TIFF formats.
                        </p>
                        </AnimatedText>
                    </div>
                    <div>
                        <AnimatedText>
                        <h3 className="text-xl font-medium mb-4">Impact</h3>
                        <p className="opacity-75">
                        This script was made by myself, with the assistance of 3rd party libraries.
                        </p>
                        </AnimatedText>
                    </div>
                </div>
            </div>
        </section>
    )
}

