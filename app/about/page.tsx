"use client"

import Link from 'next/link'
import OvalBadge from '../components/oval-badge'
import ThemeToggle from '../components/theme-toggle'
import { CustomCursor } from '../components/custom-cursor'
import { useState } from 'react'
import { EmojiProvider, Emoji } from "react-apple-emojis"
import { AnimatedText } from '../components/animated-text'
import emojiData from "react-apple-emojis/src/data.json"
import Image from 'next/image'

const techStackRight = [
  { name: 'Vue.js', color: '#323232'},
  { name: 'Redis', color: '#323232'},
  { name: 'REST APIs', color: '#323232'},
  { name: 'FastAPI', color: '#323232'},
  { name: 'React', color: '#323232' },
  { name: 'Arduino C', color: '#323232'},
  { name: 'Bun + Elysia', color: '#323232' },
  { name: 'Swift + SwiftUI', color: '#323232' },
  { name: 'Python', color: '#323232'},
  { name: 'Next.js', color: '#323232' },
  { name: 'Looker Studio', color: '#323232' },
  { name: 'Meta Business Suite', color: '#323232' },
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
          <AnimatedText>
          <h2 className="text-xl mb-8">BIO</h2>
          </AnimatedText>
          <AnimatedText>
          <h1 className="text-6xl md:text-7xl font-normal leading-[1.1] max-w-6xl mb-32">
            Hello! I'm a Ghanaian<Emoji name="flag-ghana" className="inline-block max-w-10" />
            -American<Emoji name="flag-united-states" className="inline-block max-w-10" />
            founder and software engineer. I have a passion for telling powerful stories through innovative products
            that solve real world problems.
          </h1>
          </AnimatedText>
          {/* Contact Info */}
          <div className="space-y-2">
            <AnimatedText>
          <h2 className="text-xl mb-8">CONTACT</h2>
          </AnimatedText>
          <AnimatedText>
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
                href="https://drive.google.com/file/d/1Qc62CiG50vCyWQHHa9YpGpMJwww-6fY7/view?usp=sharing" 
                className="text-sm underline underline-offset-4"
              >
                Click to View
              </Link>
            </div>
            <br />
            <div className="flex items-center gap-2">
              <span className="text-sm">I&apos;m passionate about all things entrepreneurship, product management, marketing, and Human-Computer Interaction.</span>
            </div>
            </AnimatedText>
          </div>
        </section>

        {/* Tech Stack Section */}
        <section>
          <AnimatedText>
        <h2 className="text-xl mb-8">TECH STACK</h2>
        </AnimatedText>
        <AnimatedText>
          <div className="grid grid-cols-2 gap-x-2 max-w-3xl">
            <div className="flex flex-col col-span-1 max-w-56 space-y-1">
              {techStackRight.map((badge, index) => (
                <OvalBadge key={index} data={badge} />
              ))}
            </div>
            <div className="flex flex-col col-span-1 max-w-56 space-y-1">
              Placeholder!
            </div>
          </div>
          </AnimatedText>
        </section>
      </div>
    </main>
    </EmojiProvider>
    </>
  )
}

