import { AnimatedText } from "@/app/components/animated-text";

export function ContentSection() {
    return (
        <section className="py-24 max-w-4xl">
            <div className="space-y-16">
                <div>
                    <AnimatedText>
                    <h2 className="text-4xl md:text-5xl font-light mb-8">
                        End-to-end data analysis system for motorsports telemetry
                    </h2>
                    </AnimatedText>
                    <AnimatedText>
                    <p className="text-lg leading-relaxed opacity-75">
                    I’m the Head of Data of WashU Racing, an 80-person Formula SAE team based out of Washington University in St. Louis. 
                    Every year, we build a Formula-style race car to compete against 100+ universities around the world. 
                    From Computer Scientists to Mechanical Engineers to Business students, we’re an extremely diverse, cross-functional team. 
                    With the final competition in May, it’s important that we’re testing the car throughout the year to ensure that our components 
                    work as intended. How do we know that the hundreds of components on our car work? Data.
                    </p>
                    </AnimatedText>
                    <br />
                    <br />
                    <AnimatedText>
                    <p className="text-lg leading-relaxed opacity-75">
                    As long as the car is on, we are constantly sending sensor measurements and driver inputs to a designated laptop via an RF radio operating at 5Hz. 
                    This RF signal transfers a string of comma-separated values to the website’s backend, which allows us to store the data for future analysis. 
                    The data is then sent via API calls to our Vue.js frontend, which uses SciChart Line and Scatter plots to display our data.
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
                            Create an end-to-end live data system. This system needs to collect CAN data from a race car,
                            send it to cloud storage, and display it on a user-friendly full-stack web app—in 1/10th of
                            a second.
                        </p>
                        </AnimatedText>
                    </div>
                    <div>
                        <AnimatedText>
                        <h3 className="text-xl font-medium mb-4">Solution</h3>
                        <p className="opacity-75">
                            A full-stack system that collects data from the car, stores it in cloud storage, and displays it on a user-friendly web app.
                            The system is designed to be modular and scalable, allowing for easy integration of new sensors and data sources.      
                        </p>
                        </AnimatedText>
                    </div>
                    <div>
                        <AnimatedText>
                        <h3 className="text-xl font-medium mb-4">Outcome</h3>
                        <p className="opacity-75">
                            A never-before-seen data system that allows us to collect, store, and display data from the car in real-time.
                            This system has saved the team hours of manual data collection, and thousands of dollars compared to the alternatives.
                        </p>
                        </AnimatedText>
                    </div>
                    <div>
                        <AnimatedText>
                        <h3 className="text-xl font-medium mb-4">Impact</h3>
                        <p className="opacity-75">
                        I personally built the backend, frontend, and database. I also assisted with the hardware design of the RF radio sender and receiver.
                        </p>
                        </AnimatedText>
                    </div>
                </div>
            </div>
        </section>
    )
}

