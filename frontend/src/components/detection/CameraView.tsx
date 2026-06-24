'use client'

type CameraViewProps = {
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
}

export function CameraView({ videoRef, canvasRef }: CameraViewProps) {
  return (
    <div className="relative w-full aspect-[4/3] bg-gray-900 rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full scale-x-[-1]"
      />
    </div>
  )
}
