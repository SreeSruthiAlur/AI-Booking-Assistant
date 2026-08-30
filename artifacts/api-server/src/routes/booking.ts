import { Router, type IRouter } from "express";
import {
  CreateBookingBody,
  GetBookingsResponse,
  GetListingsQueryParams,
  GetListingsResponse,
  SendAssistantMessageBody,
} from "@workspace/api-zod";
import {
  bookings,
  listings,
  nextBookingReference,
  type Listing,
} from "../lib/booking-data";

const router: IRouter = Router();

function matchesListing(listing: Listing, query: Record<string, unknown>) {
  const destination = typeof query.destination === "string" ? query.destination.trim().toLowerCase() : "";
  const amenity = typeof query.amenity === "string" ? query.amenity.trim().toLowerCase() : "";
  const checkIn = typeof query.checkIn === "string" ? query.checkIn : "";
  const checkOut = typeof query.checkOut === "string" ? query.checkOut : "";
  const guests = Number(query.guests);
  const maxPrice = Number(query.maxPrice);
  const unavailableWindow = checkIn === "2026-09-18" || checkIn === "2026-09-19";

  return (
    (!destination ||
      listing.city.toLowerCase().includes(destination) ||
      listing.country.toLowerCase().includes(destination) ||
      listing.name.toLowerCase().includes(destination)) &&
    (!amenity || listing.amenities.some((item) => item.toLowerCase().includes(amenity))) &&
    (!Number.isFinite(guests) || guests < 1 || listing.maxGuests >= guests) &&
    (!Number.isFinite(maxPrice) || maxPrice < 0 || listing.pricePerNight <= maxPrice) &&
    !unavailableWindow &&
    (!checkOut || !checkIn || checkOut > checkIn)
  );
}

function parseDestination(message: string) {
  const lower = message.toLowerCase();
  return listings.find(
    (listing) =>
      lower.includes(listing.city.toLowerCase()) ||
      lower.includes(listing.country.toLowerCase()),
  )?.city;
}

function parseBudget(message: string) {
  const match = message.match(/(?:under|below|max(?:imum)?|budget(?: of)?|less than)\s*\$?\s*(\d{2,4})/i);
  return match ? Number(match[1]) : undefined;
}

function parseGuests(message: string) {
  const match = message.match(/(\d+)\s*(?:guest|people|adult|person)/i);
  return match ? Number(match[1]) : undefined;
}

router.get("/listings", (req, res) => {
  const query = GetListingsQueryParams.parse(req.query);
  const available = listings.filter((listing) => matchesListing(listing, query));
  res.json(GetListingsResponse.parse(available));
});

router.post("/assistant/message", (req, res) => {
  const { message } = SendAssistantMessageBody.parse(req.body);
  const lower = message.toLowerCase();
  const destination = parseDestination(message);
  const maxPrice = parseBudget(message);
  const guests = parseGuests(message);
  const isOutOfDomain =
    /(weather|recipe|football|politics|stock price|write code|joke)/i.test(message);

  if (isOutOfDomain) {
    return res.json({
      message:
        "I’m focused on stays and reservations. Tell me a destination, dates, guest count, or budget and I’ll find the right fit.",
      intent: "out_of_domain",
      suggestedListings: [],
      extracted: {},
    });
  }

  const filtered = listings.filter((listing) =>
    matchesListing(listing, {
      destination,
      maxPrice,
      guests,
      amenity: lower.includes("breakfast") ? "breakfast" : undefined,
    }),
  );

  if (destination || maxPrice || guests) {
    const destinationLabel = destination ? ` in ${destination}` : "";
    const budgetLabel = maxPrice ? ` under $${maxPrice}/night` : "";
    const guestLabel = guests ? ` for ${guests} ${guests === 1 ? "guest" : "guests"}` : "";
    return res.json({
      message: filtered.length
        ? `I found ${filtered.length} strong match${filtered.length === 1 ? "" : "es"}${destinationLabel}${guestLabel}${budgetLabel}. Take a look and I’ll help you make it yours.`
        : "I couldn’t find an exact match for those preferences. Try a wider budget or another destination and I’ll keep looking.",
      intent: "search",
      suggestedListings: filtered.slice(0, 3),
      extracted: { destination, maxPrice, guests },
    });
  }

  return res.json({
    message:
      "I can help with that. Where would you like to stay, when are you travelling, and how many guests should I plan for?",
    intent: "inquiry",
    suggestedListings: [],
    extracted: {},
  });
});

router.get("/bookings", (_req, res) => {
  res.json(GetBookingsResponse.parse(bookings));
});

router.post("/bookings", (req, res) => {
  const input = CreateBookingBody.parse(req.body);
  const listing = listings.find((item) => item.id === input.listingId);
  if (!listing) {
    return res.status(400).json({ error: "That stay is no longer available." });
  }

  const checkIn = new Date(`${input.checkIn}T00:00:00Z`);
  const checkOut = new Date(`${input.checkOut}T00:00:00Z`);
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
  if (!Number.isFinite(nights) || nights < 1) {
    return res.status(400).json({ error: "Check-out must be after check-in." });
  }
  if (input.guests > listing.maxGuests) {
    return res.status(400).json({ error: `This room accommodates up to ${listing.maxGuests} guests.` });
  }
  if (input.checkIn === "2026-09-18" || input.checkIn === "2026-09-19") {
    return res.status(400).json({ error: "Those dates are unavailable for this stay. Try shifting your arrival by a day." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const subtotal = listing.pricePerNight * nights;
  const addOnTotal = input.addOns.length * 18 * nights;
  const taxableSubtotal = subtotal + addOnTotal;
  const taxes = Math.round(taxableSubtotal * 0.12 * 100) / 100;
  const fees = Math.round((taxableSubtotal * 0.04 + 12) * 100) / 100;
  const booking = {
    ...input,
    reference: nextBookingReference(),
    listing,
    nights,
    subtotal: Math.round((subtotal + addOnTotal) * 100) / 100,
    taxes,
    fees,
    total: Math.round((taxableSubtotal + taxes + fees) * 100) / 100,
    status: "confirmed",
    createdAt: new Date().toISOString(),
  };

  bookings.unshift(booking);
  return res.status(201).json(booking);
});

router.delete("/bookings/:reference", (req, res) => {
  const index = bookings.findIndex((booking) => booking.reference === req.params.reference);
  if (index === -1) {
    return res.status(404).json({ error: "Booking not found." });
  }
  bookings.splice(index, 1);
  return res.status(204).send();
});

export default router;