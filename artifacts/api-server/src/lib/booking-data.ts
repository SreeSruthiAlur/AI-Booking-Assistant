export type Listing = {
  id: string;
  name: string;
  city: string;
  country: string;
  type: string;
  description: string;
  imageUrl: string;
  pricePerNight: number;
  rating: number;
  reviewCount: number;
  amenities: string[];
  maxGuests: number;
  roomLabel: string;
};

export type Booking = {
  reference: string;
  listingId: string;
  listing: Listing;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addOns: string[];
  subtotal: number;
  taxes: number;
  fees: number;
  total: number;
  status: string;
  createdAt: string;
};

export const listings: Listing[] = [
  {
    id: "stay-001",
    name: "The Hoxton, Shoreditch",
    city: "London",
    country: "United Kingdom",
    type: "Boutique hotel",
    description: "A lively East London base with thoughtful design, a welcoming lobby, and easy access to the city.",
    imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85",
    pricePerNight: 228,
    rating: 4.8,
    reviewCount: 1248,
    amenities: ["Breakfast", "Wi-Fi", "Workspace", "Gym"],
    maxGuests: 2,
    roomLabel: "Cosy room · 1 queen bed",
  },
  {
    id: "stay-002",
    name: "Ace Hotel New York",
    city: "New York",
    country: "United States",
    type: "Design hotel",
    description: "A creative Midtown stay with generous rooms, a buzzing café, and a desk made for getting things done.",
    imageUrl: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=85",
    pricePerNight: 296,
    rating: 4.7,
    reviewCount: 892,
    amenities: ["Wi-Fi", "Workspace", "Late checkout", "Restaurant"],
    maxGuests: 2,
    roomLabel: "Deluxe king room · 1 king bed",
  },
  {
    id: "stay-003",
    name: "The Hoxton, Amsterdam",
    city: "Amsterdam",
    country: "Netherlands",
    type: "Canal house hotel",
    description: "Three canal houses turned into one characterful hotel, steps from the best of central Amsterdam.",
    imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=85",
    pricePerNight: 188,
    rating: 4.6,
    reviewCount: 675,
    amenities: ["Breakfast", "Wi-Fi", "Airport shuttle", "Workspace"],
    maxGuests: 2,
    roomLabel: "Cozy room · 1 queen bed",
  },
  {
    id: "stay-004",
    name: "The Standard, Bangkok",
    city: "Bangkok",
    country: "Thailand",
    type: "Modern hotel",
    description: "An energetic riverside address with panoramic city views, a rooftop pool, and generous shared spaces.",
    imageUrl: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=85",
    pricePerNight: 142,
    rating: 4.9,
    reviewCount: 1104,
    amenities: ["Breakfast", "Wi-Fi", "Pool", "Airport shuttle"],
    maxGuests: 3,
    roomLabel: "City view room · 1 king bed",
  },
  {
    id: "stay-005",
    name: "The Saguaro, Palm Springs",
    city: "Palm Springs",
    country: "United States",
    type: "Resort",
    description: "A colourful desert escape with a sun-soaked pool, mountain views, and a slower pace.",
    imageUrl: "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1200&q=85",
    pricePerNight: 175,
    rating: 4.5,
    reviewCount: 438,
    amenities: ["Pool", "Wi-Fi", "Breakfast", "Parking"],
    maxGuests: 4,
    roomLabel: "King room · 1 king bed",
  },
  {
    id: "stay-006",
    name: "Hotel Sanders",
    city: "Copenhagen",
    country: "Denmark",
    type: "Luxury hotel",
    description: "A quietly elegant home near the Royal Theatre, with a glasshouse courtyard and deeply comfortable rooms.",
    imageUrl: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=85",
    pricePerNight: 260,
    rating: 4.8,
    reviewCount: 521,
    amenities: ["Breakfast", "Wi-Fi", "Workspace", "Restaurant"],
    maxGuests: 2,
    roomLabel: "Sanders bedroom · 1 king bed",
  },
];

export const bookings: Booking[] = [];
let bookingCounter = 89342;

export function nextBookingReference() {
  bookingCounter += 1;
  return `BK-${bookingCounter}`;
}