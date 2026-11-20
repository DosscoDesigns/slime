/**
 * Zebra Browser Print helpers. Pure, so they can be tested.
 */
export interface BrowserPrintDevice {
  name: string;
  deviceType: string;
  connection: string;
  uid: string;
  provider: string;
  manufacturer: string;
  version: number;
}

/**
 * Browser Print answers /default either as JSON or, in older builds, as
 * tab-separated lines (name, type, connection, uid, provider, manufacturer).
 * Normalise both to the device shape /write expects.
 */
export function parseBrowserPrintDevice(text: string): BrowserPrintDevice | null {
  const t = text.trim();
  if (!t) return null;
  if (t.startsWith("{")) {
    const d = JSON.parse(t) as Partial<BrowserPrintDevice>;
    if (!d.uid && !d.name) return null;
    return {
      name: d.name ?? "",
      deviceType: d.deviceType ?? "printer",
      connection: d.connection ?? "",
      uid: d.uid ?? "",
      provider: d.provider ?? "",
      manufacturer: d.manufacturer ?? "",
      version: d.version ?? 0,
    };
  }
  const parts = text.split("\n\t").map((x) => x.replace(/[\n\r\t]/g, "").trim());
  if (parts.length < 7) return null;
  const [, name, deviceType, connection, uid, provider, manufacturer] = parts;
  return { name, deviceType, connection, uid, provider, manufacturer, version: 0 };
}

