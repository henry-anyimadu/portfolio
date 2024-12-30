'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const sections = ['Intro', 'Problem', 'Process', 'Solution']

export function Navigation() {
    const [activeSection, setActiveSection] = useState('Intro')

    return (
        <nav className="py-8">
            <ul className="flex gap-8">
                {sections.map((section) => (
                    <li key={section}>
                        <button
                            onClick={() => setActiveSection(section)}
                            className={cn(
                                "text-sm tracking-wide hover:opacity-75 transition-opacity",
                                activeSection === section ? "opacity-100" : "opacity-50"
                            )}
                        >
                            {section}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )
}

