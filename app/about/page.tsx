"use client"

import Link from 'next/link'
import OvalBadge from '../components/oval-badge'
import ThemeToggle from '../components/theme-toggle'
import { CustomCursor } from '../components/custom-cursor'
import { useState } from 'react'
import { EmojiProvider, Emoji } from "react-apple-emojis"
import emojiData from "react-apple-emojis/src/data.json"

const clientsLeft = [
  'Apple',
  'Nike',
  'Adidas',
  'Visibility Office',
  'Airsign',
  'High Tide NYC',
  'Tonal Health',
  'Zero Motorcycles',
]

const techStackRight = [
  { name: 'Vue.js', color: '#323232'},
  { name: 'Python', color: '#323232'},
  { name: 'Arduino C', color: '#323232'},
  { name: 'Redis', color: '#323232'},
  { name: 'FastAPI', color: '#323232'},
  { name: 'REST APIs', color: '#323232'},
  { name: 'React', color: '#323232' },
  { name: 'Swift + SwiftUI', color: '#323232' },
]

export default function AboutPage() {
    const [isItemHovered, setIsItemHovered] = useState(false)
  return (
    <>
    <EmojiProvider data={emojiData}>
    <CustomCursor isHovered = {isItemHovered} />
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <nav className="flex justify-between items-center mb-32">
          <Link href="/" className="text-lg">
          ← Henry
          </Link>
          <span className="text-lg">About</span>
          <ThemeToggle />
        </nav>

        {/* Bio Section */}
        <section className="mb-32">
          <h2 className="text-xl mb-8">BIO</h2>
          <h1 className="text-6xl md:text-7xl font-normal leading-[1.1] max-w-6xl mb-32">
            Hello! I'm a Ghanaian<Emoji name="flag-ghana" className="inline-block max-w-10" />
            -American<Emoji name="flag-united-states" className="inline-block max-w-10" />
            founder and software engineer. I have a passion for telling impactful stories through innovative products.
          </h1>

          {/* Contact Info */}
          <div className="space-y-2">
          <h2 className="text-xl mb-8">CONTACT</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm">EMAIL →</span>
              <Link 
                href="mailto:henry@whatsfabric.com" 
                className="text-sm underline underline-offset-4"
              >
                henry@whatsfabric.com
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">LINKEDIN →</span>
              <Link 
                href="https://linkedin.com/in/anyimadu" 
                className="text-sm underline underline-offset-4"
              >
                linkedin.com/in/anyimadu
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">RESUME →</span>
              <Link 
                href="https://linkedin.com/in/anyimadu" 
                className="text-sm underline underline-offset-4"
              >
                linkedin.com/in/anyimadu
              </Link>
            </div>
          </div>
        </section>

        {/* Tech Stack Section */}
        <section>
        <h2 className="text-xl mb-8">TECH STACK</h2>
        <div className="grid grid-cols-2 gap-x-2 max-w-3xl">
            <div className="flex flex-col col-span-1 max-w-56 space-y-1">
              {techStackRight.map((badge, index) => (
                <OvalBadge key={index} data={badge} />
              ))}
            </div>
            <div className="flex flex-col col-span-1 max-w-56 space-y-1">
              {techStackRight.map((badge, index) => (
                <OvalBadge key={index} data={badge} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
    </EmojiProvider>
    </>
  )
}

