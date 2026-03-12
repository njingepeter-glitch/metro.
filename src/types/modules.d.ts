// Fallback type declarations for packages whose types may not be resolved

declare module 'leaflet/dist/images/marker-icon-2x.png' {
  const src: string;
  export default src;
}
declare module 'leaflet/dist/images/marker-icon.png' {
  const src: string;
  export default src;
}
declare module 'leaflet/dist/images/marker-shadow.png' {
  const src: string;
  export default src;
}

declare module 'mapbox-gl' {
  const mapboxgl: any;
  export default mapboxgl;
  export as namespace mapboxgl;
}
declare module 'qrcode.react' {
  import { ForwardRefExoticComponent, RefAttributes } from 'react';
  export const QRCodeCanvas: ForwardRefExoticComponent<any & RefAttributes<HTMLCanvasElement>>;
  export const QRCodeSVG: any;
}
declare module 'leaflet' {
  const L: any;
  export default L;
  export as namespace L;
}
declare module '@capacitor/core' {
  export const Capacitor: { isNativePlatform(): boolean; getPlatform(): string; };
}
declare module '@capacitor/push-notifications' {
  export const PushNotifications: any;
}
declare module 'jspdf' {
  class jsPDF {
    constructor(options?: any);
    [key: string]: any;
  }
  export default jsPDF;
}
declare module 'jspdf-autotable' {
  export default function autoTable(doc: any, options: any): void;
}
declare module 'embla-carousel-autoplay' {
  export default function Autoplay(options?: any): any;
}
declare module '@yudiel/react-qr-scanner' {
  export const Scanner: any;
}
declare module 'vite-plugin-pwa' {
  export function VitePWA(options?: any): any;
}