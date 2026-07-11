
declare namespace naver.maps {
  class LatLng {
    constructor(lat: number, lng: number)
    lat(): number
    lng(): number
  }

  class LatLngBounds {
    constructor()
    extend(latlng: LatLng): LatLngBounds
  }

  class Point {
    constructor(x: number, y: number)
  }

  class Map {
    constructor(
      el: HTMLElement,
      options: {
        center: LatLng
        zoom: number
        zoomControl?: boolean
        mapDataControl?: boolean
      },
    )
    setCenter(latlng: LatLng): void
    setZoom(zoom: number): void
    fitBounds(bounds: LatLngBounds, margin?: number): void
    destroy(): void
  }

  class Marker {
    constructor(options: {
      position: LatLng
      map: Map
      title?: string
      icon?: {
        content: string
        anchor: Point
      }
    })
    setMap(map: Map | null): void
    setPosition(latlng: LatLng): void
  }
}

interface Window {
  naver?: {
    maps: typeof naver.maps
  }
}

type NaverMap = naver.maps.Map
type NaverMarker = naver.maps.Marker
