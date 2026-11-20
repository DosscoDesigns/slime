import { describe, it, expect } from "vitest";
import { parseBrowserPrintDevice } from "./browser-print";

describe("parseBrowserPrintDevice", () => {
  it("reads the JSON form", () => {
    const d = parseBrowserPrintDevice(
      '{"deviceType":"printer","uid":"ZDesigner GX420d","provider":"com.zebra.ds.webdriver.desktop.provider.DefaultDeviceProvider","name":"ZDesigner GX420d","connection":"driver","version":3,"manufacturer":"Zebra Technologies"}'
    );
    expect(d).toEqual(expect.objectContaining({ name: "ZDesigner GX420d", connection: "driver", version: 3 }));
  });

  it("reads the tab-separated form", () => {
    const d = parseBrowserPrintDevice(
      "\n\tZDesigner GX420d\n\tprinter\n\tusb\n\tUSB001\n\tcom.zebra.provider\n\tZebra Technologies"
    );
    expect(d).toEqual({
      name: "ZDesigner GX420d",
      deviceType: "printer",
      connection: "usb",
      uid: "USB001",
      provider: "com.zebra.provider",
      manufacturer: "Zebra Technologies",
      version: 0,
    });
  });

  it("returns null when there is no default printer", () => {
    expect(parseBrowserPrintDevice("")).toBeNull();
    expect(parseBrowserPrintDevice("   ")).toBeNull();
  });
});
