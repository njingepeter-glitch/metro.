import { Capacitor } from "@capacitor/core";
import { Camera } from "@capacitor/camera";
import { Geolocation } from "@capacitor/geolocation";

export const isNativeApp = () => Capacitor.isNativePlatform();

type DevicePosition = {
  latitude: number;
  longitude: number;
};

const normalizePosition = (coords: { latitude: number; longitude: number }): DevicePosition => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
});

export async function getCurrentDevicePosition(): Promise<DevicePosition> {
  if (isNativeApp()) {
    const permission = await Geolocation.requestPermissions();
    const granted = permission.location === "granted" || permission.coarseLocation === "granted";

    if (!granted) {
      throw new Error("Location permission denied");
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });

    return normalizePosition(position.coords);
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(normalizePosition(position.coords)),
      (error) => reject(error),
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000,
      }
    );
  });
}

export async function watchDevicePosition(
  onSuccess: (position: DevicePosition) => void,
  onError?: (error: Error | GeolocationPositionError) => void
): Promise<() => void> {
  if (isNativeApp()) {
    const permission = await Geolocation.requestPermissions();
    const granted = permission.location === "granted" || permission.coarseLocation === "granted";

    if (!granted) {
      throw new Error("Location permission denied");
    }

    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
      (position, error) => {
        if (error) {
          onError?.(error);
          return;
        }

        if (position?.coords) {
          onSuccess(normalizePosition(position.coords));
        }
      }
    );

    return () => {
      void Geolocation.clearWatch({ id: watchId });
    };
  }

  if (!navigator.geolocation) {
    throw new Error("Geolocation is not supported by your browser");
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => onSuccess(normalizePosition(position.coords)),
    (error) => onError?.(error),
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

export async function ensureCameraAccess(): Promise<boolean> {
  if (!isNativeApp()) {
    return true;
  }

  const permissions = await Camera.requestPermissions({ permissions: ["camera"] });
  return permissions.camera === "granted" || permissions.camera === "limited";
}