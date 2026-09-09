import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getRates,
  buyLabel,
  fetchLabelZpl,
  shipFromAddress,
  parcelCubicFeet,
  exceedsDimWeightThreshold,
  isTestMode,
  assertShippoConfigured,
  ShippoError,
  type Address,
  type Parcel,
} from "./shipping";

const TO: Address = {
  name: "Britaini Evanuik",
  street1: "111 Highview Avenue",
  city: "Pittsburgh",
  state: "PA",
  zip: "15238",
  country: "US",
};

const PARCEL: Parcel = { lengthIn: 12, widthIn: 10, heightIn: 8, weightLb: 3 };

const FROM_ENV = {
  SHIP_FROM_NAME: "The Slime Co",
  SHIP_FROM_STREET1: "1 Main St",
  SHIP_FROM_CITY: "Jacksonville",
  SHIP_FROM_STATE: "FL",
  SHIP_FROM_ZIP: "32256",
  SHIP_FROM_EMAIL: "info@theslimecompany.com",
  SHIP_FROM_PHONE: "9045551234",
};

beforeEach(() => {
  process.env.SHIPPO_API_KEY = "shippo_test_notarealkey";
  Object.assign(process.env, FROM_ENV);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SHIPPO_API_KEY;
  for (const k of Object.keys(FROM_ENV)) delete process.env[k];
});

function stubFetch(...responses: Response[]) {
  const spy = vi.fn();
  for (const r of responses) spy.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Shape copied from a real live-API response, not invented. */
function shipmentResponse(rates = RATES) {
  return {
    object_id: "shipment_1",
    status: "SUCCESS",
    messages: [{ source: "UPS", text: "Shipment origin is out of service area" }],
    rates,
  };
}

const RATES = [
  {
    object_id: "rate_priority",
    provider: "USPS",
    amount: "14.67",
    estimated_days: 3,
    servicelevel: { name: "Priority Mail", token: "usps_priority" },
  },
  {
    object_id: "rate_ground",
    provider: "USPS",
    amount: "6.99",
    estimated_days: 3,
    servicelevel: { name: "Ground Advantage", token: "usps_ground_advantage" },
  },
];

describe("dimensional weight", () => {
  it("computes cubic feet", () => {
    expect(parcelCubicFeet(PARCEL)).toBeCloseTo(0.5556, 3);
  });

  /**
   * Measured against the live API, FL->PA, 3 lb: a 0.56 cu ft box is $6.99 and
   * a 1.11 cu ft box is $16.87 at the same weight. The threshold is the single
   * most expensive thing about packaging, and it is what made shipped buckets
   * uneconomic. These pin which side of the line each shape falls on.
   */
  it("clears a 12x10x8 box", () => {
    expect(exceedsDimWeightThreshold(PARCEL)).toBe(false);
  });

  it("flags a 16x12x10 box", () => {
    expect(
      exceedsDimWeightThreshold({ lengthIn: 16, widthIn: 12, heightIn: 10, weightLb: 3 })
    ).toBe(true);
  });

  it("is about volume, not weight", () => {
    const light = { lengthIn: 16, widthIn: 12, heightIn: 10, weightLb: 1 };
    const heavy = { lengthIn: 10, widthIn: 8, heightIn: 6, weightLb: 20 };
    expect(exceedsDimWeightThreshold(light)).toBe(true);
    expect(exceedsDimWeightThreshold(heavy)).toBe(false);
  });
});

describe("configuration", () => {
  it("recognises a test key", () => {
    expect(isTestMode()).toBe(true);
    process.env.SHIPPO_API_KEY = "shippo_live_xyz";
    expect(isTestMode()).toBe(false);
  });

  it("throws when the key is missing", () => {
    delete process.env.SHIPPO_API_KEY;
    expect(() => assertShippoConfigured()).toThrow(/not configured/);
  });

  // USPS refuses the PURCHASE when the sender has no email or phone, and only
  // at the transaction step — after rates have come back looking fine. Failing
  // at config time is the difference between a clear error and a mystery.
  it("refuses a ship-from address with no email", () => {
    delete process.env.SHIP_FROM_EMAIL;
    expect(() => shipFromAddress()).toThrow(/SHIP_FROM_EMAIL/);
  });

  it("refuses a ship-from address with no phone", () => {
    delete process.env.SHIP_FROM_PHONE;
    expect(() => shipFromAddress()).toThrow(/SHIP_FROM_PHONE/);
  });

  it("defaults country to US", () => {
    expect(shipFromAddress().country).toBe("US");
  });
});

describe("getRates", () => {
  it("authenticates with ShippoToken, not Bearer", async () => {
    const spy = stubFetch(json(shipmentResponse()));
    await getRates(TO, PARCEL);
    expect(spy.mock.calls[0][1].headers.Authorization).toBe(
      "ShippoToken shippo_test_notarealkey"
    );
  });

  it("returns rates cheapest first, in cents", async () => {
    stubFetch(json(shipmentResponse()));
    const { rates } = await getRates(TO, PARCEL);
    expect(rates.map((r) => r.amountCents)).toEqual([699, 1467]);
    expect(rates[0].serviceToken).toBe("usps_ground_advantage");
  });

  // Shippo reports every master carrier account that declined, so a healthy
  // response still carries messages. Treating that as failure would reject
  // every real quote.
  it("succeeds despite carrier messages", async () => {
    stubFetch(json(shipmentResponse()));
    const quote = await getRates(TO, PARCEL);
    expect(quote.messages.length).toBeGreaterThan(0);
    expect(quote.rates).toHaveLength(2);
  });

  it("treats an empty rate list as the real failure", async () => {
    stubFetch(json({ object_id: "s", status: "SUCCESS", rates: [], messages: [] }));
    await expect(getRates(TO, PARCEL)).rejects.toThrow(/no rates/);
  });

  it("sends inches and pounds explicitly", async () => {
    const spy = stubFetch(json(shipmentResponse()));
    await getRates(TO, PARCEL);
    const sent = JSON.parse(spy.mock.calls[0][1].body);
    expect(sent.parcels[0]).toMatchObject({ distance_unit: "in", mass_unit: "lb" });
  });
});

describe("buyLabel", () => {
  const OK = {
    object_id: "txn_1",
    status: "SUCCESS",
    tracking_number: "9334620845500001363798",
    tracking_url_provider: "https://tools.usps.com/go/x",
    label_url: "https://deliver.goshippo.com/abc.zpl?Signature=x",
    rate: { amount: "6.99", provider: "USPS", servicelevel: { name: "Ground Advantage" } },
  };

  it("requests ZPLII so the label prints on the Zebra", async () => {
    const spy = stubFetch(json(OK));
    await buyLabel("rate_ground");
    expect(JSON.parse(spy.mock.calls[0][1].body).label_file_type).toBe("ZPLII");
  });

  it("returns the tracking number and label url", async () => {
    stubFetch(json(OK));
    const label = await buyLabel("rate_ground");
    expect(label.trackingNumber).toBe("9334620845500001363798");
    expect(label.amountCents).toBe(699);
  });

  // The real failure seen from the live API: rates quote fine, then USPS
  // rejects the purchase. Surfacing Shippo's own text is what makes it
  // diagnosable.
  it("surfaces why USPS refused the label", async () => {
    stubFetch(
      json({
        object_id: "txn_2",
        status: "ERROR",
        messages: [
          { source: "USPS", text: "Seller info missing email or phone." },
        ],
      })
    );
    await expect(buyLabel("rate_ground")).rejects.toThrow(/Seller info missing/);
  });

  it("does not report success when no label came back", async () => {
    stubFetch(json({ object_id: "t", status: "SUCCESS", tracking_number: "1" }));
    await expect(buyLabel("rate_ground")).rejects.toBeInstanceOf(ShippoError);
  });
});

describe("fetchLabelZpl", () => {
  it("returns the ZPL body", async () => {
    stubFetch(new Response("^XA^LL1219^PW812^XZ", { status: 200 }));
    await expect(fetchLabelZpl("https://x/abc.zpl")).resolves.toContain("^XA");
  });

  // An expired signed URL can answer 200 with an XML error body, so trusting
  // the status code would send an error page to the printer.
  it("rejects a 200 that is not actually ZPL", async () => {
    stubFetch(
      new Response("<?xml version='1.0'?><Error>AccessDenied</Error>", { status: 200 })
    );
    await expect(fetchLabelZpl("https://x/abc.zpl")).rejects.toThrow(/expired/);
  });

  it("rejects a failed download", async () => {
    stubFetch(new Response("nope", { status: 403 }));
    await expect(fetchLabelZpl("https://x/abc.zpl")).rejects.toThrow(/could not download/);
  });
});
