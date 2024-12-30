export function ContentSection() {
    return (
        <section className="py-24 max-w-4xl">
            <div className="space-y-16">
                <div>
                    <h2 className="text-4xl md:text-5xl font-light mb-8">
                        End-to-end data analysis system for motorsports telemetry
                    </h2>
                    <p className="text-lg leading-relaxed opacity-75">
                        FERMO wanted to respond to the changes within the construction industry
                        and create a standardized solid house. Focus: design, quality,
                        sustainability - and above all simplicity. We supported FERMO from the
                        very beginning and brought the vision into digital reality with our
                        creative concept for the new house - from the brand experience to the
                        user experience.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div>
                        <h3 className="text-xl font-medium mb-4">Challenge</h3>
                        <p className="opacity-75">
                            Create an end-to-end live data system. This system needs to collect CAN data from a race car,
                            send it to cloud storage, and display it on a user-friendly full-stack web app—in 1/10th of
                            a second.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-xl font-medium mb-4">Solution</h3>
                        <p className="opacity-75">
                            A sophisticated configurator that guides users through each decision
                            with clarity and visual feedback.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-xl font-medium mb-4">Outcome</h3>
                        <p className="opacity-75">
                            40% increase in user engagement and 25% higher conversion rate
                            compared to traditional sales processes.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}

