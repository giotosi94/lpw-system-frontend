import React, { useEffect, useRef, useState } from 'react'
import { Camera, Upload, X } from 'lucide-react'
import api from '../services/api'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/api\/?$/, '')
const MAX_IMAGES = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function ImageUpload({
  images = [],
  onChange,
  label = 'Evidenze fotografiche dal campo',
  maxImages = MAX_IMAGES,
}) {
  const [uploading, setUploading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  useEffect(() => {
    if (!showCamera || !streamRef.current || !videoRef.current) return

    videoRef.current.srcObject = streamRef.current
    videoRef.current.play().catch(() => {})
  }, [showCamera])

  const resolveImageUrl = (url) => {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url
    }
    return `${API_BASE}${url}`
  }

  const validateFile = (file) => {
    if (!file.type.startsWith('image/')) {
      return 'Puoi caricare soltanto immagini.'
    }

    if (file.size > MAX_FILE_SIZE) {
      return 'L’immagine supera il limite massimo di 10 MB.'
    }

    return null
  }

  const uploadFiles = async (files) => {
    if (!files.length || uploading) return

    const availableSlots = Math.max(0, maxImages - images.length)

    if (availableSlots === 0) {
      alert(`Puoi caricare al massimo ${maxImages} immagini.`)
      return
    }

    const selectedFiles = files.slice(0, availableSlots)

    if (files.length > availableSlots) {
      alert(`Sono state selezionate troppe immagini. Verranno caricate solo le prime ${availableSlots}.`)
    }

    for (const file of selectedFiles) {
      const error = validateFile(file)

      if (error) {
        alert(`${file.name}: ${error}`)
        return
      }
    }

    setUploading(true)

    try {
      const uploadedUrls = []

      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post('/uploads/image', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        if (response.data?.url) {
          uploadedUrls.push(response.data.url)
        }
      }

      if (uploadedUrls.length > 0) {
        onChange?.([...images, ...uploadedUrls])
      }
    } catch (error) {
      console.error('Errore caricamento immagini:', error)
      alert(
        'Errore durante il caricamento: ' +
        (error.response?.data?.detail || error.message)
      )
    } finally {
      setUploading(false)
    }
  }

  const uploadFile = async (file) => {
    await uploadFiles([file])
  }

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || [])
    await uploadFiles(files)
    event.target.value = ''
  }

  const removeImage = (index) => {
    const newImages = images.filter((_, imageIndex) => imageIndex !== index)
    onChange?.(newImages)

    if (previewUrl === images[index]) {
      setPreviewUrl(null)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraReady(false)
  }

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('La fotocamera non è supportata da questo dispositivo o browser.')
      return
    }

    try {
      stopCamera()

      let stream

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: 'environment',
            },
          },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream
      setShowCamera(true)

      window.setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.play().catch(() => {})
        }
      }, 100)
    } catch (error) {
      console.error('Errore accesso fotocamera:', error)
      stopCamera()
      setShowCamera(false)

      if (error.name === 'NotAllowedError') {
        alert('Accesso alla fotocamera non autorizzato. Abilita il permesso nelle impostazioni del browser.')
      } else if (error.name === 'NotFoundError') {
        alert('Nessuna fotocamera disponibile sul dispositivo.')
      } else {
        alert('Impossibile accedere alla fotocamera.')
      }
    }
  }

  const closeCamera = () => {
    stopCamera()
    setShowCamera(false)
  }

  const takePhoto = async () => {
    const video = videoRef.current

    if (!video || !video.videoWidth || !video.videoHeight) {
      alert('La fotocamera non è ancora pronta.')
      return
    }

    const canvas = document.createElement('canvas')
    const maxDimension = 1600

    let width = video.videoWidth
    let height = video.videoHeight

    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(
        maxDimension / width,
        maxDimension / height
      )

      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      alert('Impossibile elaborare la fotografia.')
      return
    }

    context.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      async blob => {
        if (!blob) {
          alert('Impossibile acquisire la fotografia.')
          return
        }

        const file = new File(
          [blob],
          `gemba_${Date.now()}.jpg`,
          {
            type: 'image/jpeg',
          }
        )

        closeCamera()
        await uploadFile(file)
      },
      'image/jpeg',
      0.82
    )
  }

  const canAddImages = images.length < maxImages

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>

        <span className="text-xs text-gray-400">
          {images.length}/{maxImages}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((url, index) => (
          <div
            key={`${url}_${index}`}
            className="relative group overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(url)}
              className="block w-full"
              title="Apri immagine"
            >
              {React.createElement('img', {
                src: resolveImageUrl(url),
                alt: `Evidenza ${index + 1}`,
                className: 'w-full h-28 object-cover',
                loading: 'lazy',
              })}
            </button>

            <div className="absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded bg-black bg-opacity-60 text-white text-[10px]">
              Foto {index + 1}
            </div>

            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 shadow opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              title="Rimuovi immagine"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {canAddImages && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-primary hover:text-primary hover:bg-yellow-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={22} />
            <span className="text-xs font-medium mt-2">
              {uploading ? 'Caricamento...' : 'Carica immagini'}
            </span>
          </button>
        )}

        {canAddImages && (
          <button
            type="button"
            onClick={openCamera}
            disabled={uploading}
            className="h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-primary hover:text-primary hover:bg-yellow-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera size={22} />
            <span className="text-xs font-medium mt-2">
              Scatta foto
            </span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="text-xs text-gray-400 mt-2">
        Formati supportati: JPG, PNG, WEBP e immagini del dispositivo. Massimo {maxImages} immagini, 10 MB ciascuna.
      </div>

      {uploading && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
          </div>

          <div className="text-xs text-gray-500 mt-1">
            Caricamento delle evidenze in corso...
          </div>
        </div>
      )}

      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-3 text-white">
              <div>
                <div className="font-bold">
                  Acquisizione evidenza
                </div>

                <div className="text-xs text-gray-300">
                  Inquadra la condizione osservata durante il Gemba
                </div>
              </div>

              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-full bg-white bg-opacity-10 hover:bg-opacity-20"
                title="Chiudi fotocamera"
              >
                <X size={22} />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={() => setCameraReady(true)}
                className="w-full max-h-[70vh] object-contain"
              />

              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-sm">
                  Avvio fotocamera...
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={takePhoto}
                disabled={!cameraReady}
                className="bg-primary text-white px-6 py-3 rounded-full flex items-center gap-2 font-medium hover:bg-primary-light disabled:opacity-50"
              >
                <Camera size={20} />
                Scatta foto
              </button>

              <button
                type="button"
                onClick={closeCamera}
                className="bg-gray-700 text-white px-6 py-3 rounded-full hover:bg-gray-600"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white text-gray-800 shadow"
            title="Chiudi anteprima"
          >
            <X size={22} />
          </button>

          {React.createElement('img', {
            src: resolveImageUrl(previewUrl),
            alt: 'Anteprima evidenza',
            className: 'max-w-full max-h-[90vh] object-contain rounded-lg',
            onClick: event => event.stopPropagation(),
          })}
        </div>
      )}
    </div>
  )
}
