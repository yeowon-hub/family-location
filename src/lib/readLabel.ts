import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { createWorker } from 'tesseract.js'

const barcodeReader = new BrowserMultiFormatReader()

async function readBarcodeFromImage(imageUrl: string): Promise<string | null> {
  try {
    const result = await barcodeReader.decodeFromImageUrl(imageUrl)
    return result.getText()
  } catch (error) {
    if (error instanceof NotFoundException) return null
    throw error
  }
}

async function readOcrFromImage(imageUrl: string): Promise<string> {
  const worker = await createWorker('eng+kor')
  try {
    const { data } = await worker.recognize(imageUrl)
    return data.text.replace(/\s+/g, ' ').trim()
  } finally {
    await worker.terminate()
  }
}

export async function readTextFromImageUrl(imageUrl: string): Promise<string> {
  const barcodeText = await readBarcodeFromImage(imageUrl)
  if (barcodeText) return barcodeText

  return readOcrFromImage(imageUrl)
}

export async function readTextFromFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    return await readTextFromImageUrl(objectUrl)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function captureVideoFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('캔버스를 사용할 수 없습니다.')
  context.drawImage(video, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}
