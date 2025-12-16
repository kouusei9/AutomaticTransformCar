import { useEffect, useRef, useState } from 'react';

// Video paths configuration
const TRANSFORM_VIDEOS = {
  TO_HIGHWAY: '/assets/car_to_highway.mp4',
  TO_DRONE: '/assets/car_to_drone.mp4',
  TO_FLIGHT: '/assets/car_to_fly.mp4',
  FROM_FLIGHT: '/assets/fly_to_car.mp4',
  FROM_DRONE: '/assets/drone_to_car.mp4',
  FROM_HIGHWAY: '/assets/highway_to_car.mp4'
} as const;

/**
 * Video preload hook with canplaythrough detection
 * @returns {boolean} - isAllPreloaded: true when all videos are ready
 */
export function useVideoPreload() {
  const preloadedVideos = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [isAllPreloaded, setIsAllPreloaded] = useState(false);

  useEffect(() => {
    const videoUrls = Object.values(TRANSFORM_VIDEOS);
    console.log('🎬 Starting video preload...', videoUrls.length, 'videos');

    // Create promises for all videos
    const loadPromises = videoUrls.map((url) => {
      return new Promise<void>((resolve, reject) => {
        const video = document.createElement('video');
        video.src = url;
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        // Listen for canplaythrough event
        const handleCanPlayThrough = () => {
          console.log(`✅ Video loaded:`, url);
          
          preloadedVideos.current.set(url, video);
          cleanup();
          resolve();
        };

        const handleError = (e: ErrorEvent | Event) => {
          console.error('❌ Video load failed:', url, e);
          cleanup();
          reject(new Error(`Failed to load video: ${url}`));
        };

        const cleanup = () => {
          video.removeEventListener('canplaythrough', handleCanPlayThrough);
          video.removeEventListener('error', handleError);
        };

        video.addEventListener('canplaythrough', handleCanPlayThrough, { once: true });
        video.addEventListener('error', handleError, { once: true });

        // Start loading
        video.load();
      });
    });

    // Wait for all videos to be loaded
    Promise.all(loadPromises)
      .then(() => {
        console.log('✅ All videos preloaded successfully');
        setIsAllPreloaded(true);
      })
      .catch((error) => {
        console.error('❌ Video preload failed:', error);
        // Still mark as loaded to allow app to continue
        setIsAllPreloaded(true);
      });

    // Cleanup on unmount
    return () => {
      preloadedVideos.current.forEach((video) => {
        video.src = '';
        video.load();
      });
      preloadedVideos.current.clear();
    };
  }, []);

  return isAllPreloaded;
}
