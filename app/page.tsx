'use client'
import { useState } from 'react'
import { ProjectOverlay } from './components/project-overlay'
import { Button } from '../components/ui/button'
import { CustomCursor } from './components/custom-cursor'

// TODO: Scaffold project pages
// TODO: Fill project pages with actual data
// TODO: Scaffold about section and fill with data
// TODO: Build out Contact Section
// TODO: Update colors
// TODO: Add micro interactions

export default function Page() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [isNavHovered, setIsNavHovered] = useState(false)

  return (
      <>
        <CustomCursor isHovered={isNavHovered} />
        <main className="min-h-screen bg-[#121212] text-white p-8 relative overflow-hidden [&_*]:cursor-none">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-7xl font-bold mb-4">Hi, I'm Henry</h1>
            <p className="text-xl max-w-xl">
              I'm a full-stack software engineer and founder studying Business, Computer Science, and
              Human-Computer Interaction at WashU
            </p>

            <div
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                onMouseEnter={() => setIsNavHovered(true)}
                onMouseLeave={() => setIsNavHovered(false)}
            >
              <div className="bg-[#4a4745] rounded-full p-1.5 flex gap-2">
                <Button
                    variant="ghost"
                    className="rounded-full px-8 py-6 text-lg bg-[#3b3836] transition-colors"
                    onClick={() => setSelectedSection('about')}
                >
                  About
                </Button>
                <Button
                    variant="ghost"
                    className="rounded-full px-8 py-6 text-lg bg-[#3b3836] transition-colors"
                    onClick={() => setSelectedSection('projects')}
                >
                  Projects
                </Button>
                <Button
                    variant="ghost"
                    className="rounded-full px-8 py-6 text-lg bg-[#3b3836] transition-colors"
                    onClick={() => window.open('https://www.whatsfabric.com', '_blank')}
                >
                  Fabric
                </Button>
                <Button
                    variant="ghost"
                    className="rounded-full px-8 py-6 text-lg bg-[#3b3836] transition-colors"
                    onClick={() => window.open('https://github.com/henry-anyimadu', '_blank')}
                >
                  Github
                </Button>
                <Button
                    variant="ghost"
                    className="rounded-full px-8 py-6 text-lg bg-[#3b3836] transition-colors"
                    onClick={() => window.open('https://www.linkedin.com/in/anyimadu', '_blank')}
                >
                  LinkedIn
                </Button>
              </div>
            </div>

            <div className="fixed bottom-8 right-8 text-right">
              <h2 className="text-7xl font-bold mb-4">Contact</h2>
              <div className="space-y-1">
                <p>henry@whatsfabric.com (Fabric)</p>
                <p>jnrhenryany@gmail.com (personal)</p>
                <p>linkedin.com/in/anyimadu</p>
              </div>
            </div>

            <ProjectOverlay
                isOpen={selectedSection === 'projects'}
                onClose={() => setSelectedSection(null)}
            />
          </div>
        </main>
      </>
  )
}

