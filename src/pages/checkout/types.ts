export type LocationSuggestion = { value: string; count?: number };
export type ItemsEnvelope<T> = { items: T[] };
export type FulfillmentMode = "DELIVERY" | "PICKUP" | "EXPEDITION";
export type PaymentMethod = "BMCE" | "GAZHALA" | "CASH";
