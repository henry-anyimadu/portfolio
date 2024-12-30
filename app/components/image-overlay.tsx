import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { ProjectImages } from '@/app/types/projectImages'

interface ImageOverlayProps {
  images: ProjectImages[]
  initialIndex: number
  onClose: () => void
}

export function ImageOverlay({ images, initialIndex, onClose }: ImageOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const handlePrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : images.length - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < images.length - 1 ? prevIndex + 1 : 0))
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="relative w-full h-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          onClick={onClose}
        >
          <X size={24} />
        </button>
        
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors"
          onClick={handlePrevious}
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex flex-col items-center w-4/5 max-w-screen-xl">
          <div className="w-4/5 md:w-full aspect-video relative">
            <Image
              src={images[currentIndex].src}
              alt={images[currentIndex].alt}
              layout="fill"
              objectFit="contain"
            />
          </div>
          <p className="text-md text-white text-center">
            {`${currentIndex + 1} / ${images.length}: ${images[currentIndex].caption}`}
          </p>
        </div>
                
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors"
          onClick={handleNext}
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </motion.div>
  )
}

// export function ImageOverlay({ images, initialIndex, onClose }: ImageOverlayProps) {
//   const [currentIndex, setCurrentIndex] = useState(initialIndex)

//   const handlePrevious = () => {
//     setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : images.length - 1))
//   }

//   const handleNext = () => {
//     setCurrentIndex((prevIndex) => (prevIndex < images.length - 1 ? prevIndex + 1 : 0))
//   }

//   return (
//     <motion.div
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       exit={{ opacity: 0 }}
//       className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
//       onClick={onClose}
//     >
//       <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
//         <button
//           className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
//           onClick={onClose}
//         >
//           <X size={24} />
//         </button>
        
//         <button
//           className="absolute left-4 text-white hover:text-gray-300 transition-colors"
//           onClick={handlePrevious}
//         >
//           <ChevronLeft size={24} />
//         </button>

//         <div className="w-4/5 md:w-1/2 aspect-video relative">
//           <Image
//             src={images[currentIndex].src}
//             alt={images[currentIndex].alt}
//             layout="fill"
//             objectFit="contain"
//           />
//         </div>
//         <p className="mt-4 text-md opacity-100">
//                 {`${currentIndex + 1} / ${images.length}: ${images[currentIndex].caption}`}
//         </p>
                
//         <button
//           className="absolute right-4 text-white hover:text-gray-300 transition-colors"
//           onClick={handleNext}
//         >
//           <ChevronRight size={24} />
//         </button>
//       </div>
//     </motion.div>
//   )
// }
