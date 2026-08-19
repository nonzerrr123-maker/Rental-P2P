export type GeolocationResult = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type GeolocationFailure = {
  message: string;
  code: "UNSUPPORTED" | "INSECURE" | "DENIED" | "UNAVAILABLE" | "TIMEOUT" | "UNKNOWN";
};

export function getCurrentBrowserLocation(): Promise<GeolocationResult> {
  return new Promise((resolve, reject: (reason: GeolocationFailure) => void) => {
    if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
      reject({ code: "UNSUPPORTED", message: "อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง" });
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      reject({ code: "INSECURE", message: "การอ่านตำแหน่งต้องเปิดเว็บผ่าน HTTPS" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject({ code: "DENIED", message: "ไม่ได้รับอนุญาตตำแหน่ง กรุณาอนุญาต Location ในการตั้งค่าเบราว์เซอร์แล้วลองใหม่" });
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          reject({ code: "UNAVAILABLE", message: "อุปกรณ์ยังหาตำแหน่งไม่ได้ ลองเปิด GPS/Wi‑Fi แล้วลองใหม่" });
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject({ code: "TIMEOUT", message: "ใช้เวลาหาตำแหน่งนานเกินไป กรุณาลองอีกครั้งหรือค้นหาด้วยจังหวัด" });
          return;
        }
        reject({ code: "UNKNOWN", message: "อ่านตำแหน่งไม่สำเร็จ กรุณาลองใหม่หรือค้นหาด้วยจังหวัด" });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}
